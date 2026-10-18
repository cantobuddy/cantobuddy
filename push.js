'use strict';

/**
 * Web Push sender — VAPID auth + RFC 8291 (aes128gcm) payload encryption,
 * implemented with Node's built-in crypto so the project takes no new
 * dependency. Browsers subscribe with our public VAPID key and we use the
 * matching private key to sign the VAPID JWT, and an ephemeral P-256 key to
 * encrypt each message body.
 *
 * Required env (configure()): VAPID_PUBLIC_KEY (base64url, raw 65-byte point),
 * VAPID_PRIVATE_KEY (base64 of the PKCS#8 DER), VAPID_SUBJECT (mailto:…).
 */

const crypto = require('crypto');

// ASN.1 prefix that turns a raw 65-byte uncompressed P-256 point into a 91-byte
// SPKI DER public key.
const P256_SPKI_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');

const rawToSpki = (raw) => Buffer.concat([P256_SPKI_PREFIX, raw]);

const b64urlDecode = (s) => {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Buffer.from(t, 'base64');
};

const b64urlEncode = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let config = null;

function configure(env = process.env) {
  const pub = env.VAPID_PUBLIC_KEY;
  const privB64 = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || 'mailto:hello@cantobuddy.com';
  if (!pub || !privB64) {
    console.warn('  !  VAPID keys not configured — Web Push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
    config = null;
    return false;
  }
  try {
    const privateKey = crypto.createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' });
    const pubRaw = b64urlDecode(pub);
    if (pubRaw.length !== 65) throw new Error('public key must be 65 bytes');
    const publicKey = crypto.createPublicKey({ key: rawToSpki(pubRaw), format: 'der', type: 'spki' });
    config = { privateKey, publicKey, publicKeyRaw: pubRaw, subject };
    return true;
  } catch (e) {
    console.error('  !  Failed to parse VAPID keys:', e.message);
    config = null;
    return false;
  }
}

function isEnabled() { return !!config; }
function getPublicKey() { return config ? b64urlEncode(config.publicKeyRaw) : null; }

// --- VAPID JWT (ES256, raw r||s signature) ---
function makeJwt(aud) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud, exp: now + 12 * 3600, sub: config.subject };
  const enc = (o) => b64urlEncode(Buffer.from(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const sig = crypto.sign('sha256', Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${b64urlEncode(sig)}`;
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const hkdfExpand = (prk, info, L) => hmac(prk, Buffer.concat([info, Buffer.from([0x01])])).subarray(0, L);

/**
 * Encrypt a message for one subscription (RFC 8291 aes128gcm).
 * Returns the raw HTTP body to POST to the push endpoint.
 */
function encryptPayload(messageBuf, clientPubRaw, authSecretRaw) {
  const eph = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const ephPubRaw = (() => {
    const der = eph.publicKey.export({ type: 'spki', format: 'der' });
    return der.subarray(der.length - 65);
  })();
  const clientPub = crypto.createPublicKey({ key: rawToSpki(clientPubRaw), format: 'der', type: 'spki' });
  const sharedSecret = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: clientPub });

  const salt = crypto.randomBytes(16);
  const prk = hmac(authSecretRaw, sharedSecret); // key = auth secret, data = shared secret

  const context = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    Buffer.from([0x00, clientPubRaw.length]), clientPubRaw,
    Buffer.from([0x00, config.publicKeyRaw.length]), config.publicKeyRaw,
  ]);
  const cek = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm'), Buffer.from([0x00]), context]), 16);
  const nonce = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce'), Buffer.from([0x00]), context]), 12);

  // plaintext = 2-byte padding length (0) || message || 0x02
  const plaintext = Buffer.concat([Buffer.from([0x00, 0x00]), messageBuf, Buffer.from([0x02])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);

  const rs = ciphertext.length;
  return Buffer.concat([
    salt,
    Buffer.from([(rs >>> 24) & 0xff, (rs >>> 16) & 0xff, (rs >>> 8) & 0xff, rs & 0xff]),
    Buffer.from([0x41]), // idlen = 65
    ephPubRaw,
    ciphertext,
  ]);
}

/**
 * Send one push message. Returns { ok, expired?, status?, error? }.
 * 404/410 mean the subscription is gone — the caller should prune it.
 */
async function sendNotification(subscription, payload) {
  if (!config) return { ok: false, reason: 'disabled' };
  const { endpoint } = subscription;
  const keys = subscription.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) return { ok: false, reason: 'bad-subscription' };
  const messageBuf = Buffer.from(JSON.stringify(payload));
  let body;
  try {
    body = encryptPayload(messageBuf, b64urlDecode(keys.p256dh), b64urlDecode(keys.auth));
  } catch (e) {
    return { ok: false, reason: 'encrypt-failed', error: e.message };
  }
  const aud = new URL(endpoint).origin;
  const jwt = makeJwt(aud);
  const ttl = Number(process.env.PUSH_TTL) || 60 * 60 * 24 * 3;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        TTL: String(ttl),
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: `WebPush ${jwt}`,
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return { ok: false, expired: true, status: res.status };
    if (res.status >= 400) return { ok: false, status: res.status };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Send to every subscription in `subscriptions`. Pure (no DB access) — the
 * caller supplies the list and does any pruning using the `expired` flags.
 */
async function broadcast(subscriptions, payload) {
  if (!config) return { sent: 0, failed: 0, expired: 0, disabled: true, results: [] };
  let sent = 0;
  let failed = 0;
  let expired = 0;
  const results = [];
  for (const sub of subscriptions) {
    const r = await sendNotification(sub, payload);
    if (r.expired) {
      expired += 1;
      results.push({ endpoint: sub.endpoint, expired: true });
    } else if (r.ok) {
      sent += 1;
    } else {
      failed += 1;
      results.push({ endpoint: sub.endpoint, ...r });
    }
  }
  return { sent, failed, expired, results };
}

/**
 * Local round-trip validation of the encryption pipeline: encrypt with a fresh
 * client key, then decrypt as that client would, and confirm the message is
 * recovered. Catches any mistake in the ECDH/HKDF/AES steps without needing a
 * real browser.
 */
function selfTest() {
  if (!config) return { ok: false, reason: 'no-config' };
  const client = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const clientPubRaw = (() => {
    const d = client.publicKey.export({ type: 'spki', format: 'der' });
    return d.subarray(d.length - 65);
  })();
  const auth = crypto.randomBytes(16);
  const message = Buffer.from(JSON.stringify({ title: 'self-test', body: 'hello', url: '/' }));
  const body = encryptPayload(message, clientPubRaw, auth);

  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const ephPubRaw = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);

  const ephPub = crypto.createPublicKey({ key: rawToSpki(ephPubRaw), format: 'der', type: 'spki' });
  const sharedSecret = crypto.diffieHellman({ privateKey: client.privateKey, publicKey: ephPub });
  const prk = hmac(auth, sharedSecret);
  const context = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    Buffer.from([0x00, clientPubRaw.length]), clientPubRaw,
    Buffer.from([0x00, config.publicKeyRaw.length]), config.publicKeyRaw,
  ]);
  const cek = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm'), Buffer.from([0x00]), context]), 16);
  const nonce = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce'), Buffer.from([0x00]), context]), 12);

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const enc = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(enc), decipher.final()]);
  const recovered = plaintext.subarray(2, plaintext.length - 1).toString();
  return { ok: plaintext[0] === 0 && plaintext[1] === 0 && plaintext[plaintext.length - 1] === 0x02 && recovered === message.toString() };
}

module.exports = { configure, isEnabled, getPublicKey, sendNotification, broadcast, selfTest, makeJwt, encryptPayload };
