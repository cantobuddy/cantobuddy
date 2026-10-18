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
    // The VAPID public key and private key MUST be one pair. If they are not,
    // every send fails 401/403 because the JWT is signed by a key the push
    // service does not associate with the subscription. Say so loudly at boot —
    // it is the single most common reason "failed 1" with 0 expired.
    const derivedPub = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).subarray(-65);
    config = { privateKey, publicKey, publicKeyRaw: pubRaw, subject, keyPairMatches: derivedPub.equals(pubRaw) };
    if (!config.keyPairMatches) {
      console.error('  !  VAPID_PUBLIC_KEY does not match VAPID_PRIVATE_KEY — push sends will fail 401/403. Regenerate a matching pair.');
    }
    return true;
  } catch (e) {
    console.error('  !  Failed to parse VAPID keys:', e.message);
    config = null;
    return false;
  }
}

function isEnabled() { return !!config; }
function keyPairMatches() { return !!(config && config.keyPairMatches); }
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
function encryptPayload(messageBuf, clientPubRaw, authSecretRaw, opts = {}) {
  // The sender's ephemeral ECDH key pair. RFC 8291 calls it (as_private,
  // as_public); its public half is the `keyid` in the content-coding header AND
  // the `as_public` fed into key_info — they MUST be the same key. `opts` exists
  // only for the known-answer test, which injects the RFC's fixed key and salt.
  const ecdh = crypto.createECDH('prime256v1');
  if (opts.ephPrivateKey) ecdh.setPrivateKey(opts.ephPrivateKey);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65-byte uncompressed point
  const sharedSecret = ecdh.computeSecret(clientPubRaw);

  const salt = opts.salt || crypto.randomBytes(16);

  // ---- RFC 8291 §3.4 ----
  // PRK_key = HMAC-SHA-256(auth_secret, ecdh_secret)
  const prkKey = hmac(authSecretRaw, sharedSecret);
  // key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info', 'utf8'),
    Buffer.from([0x00]),
    clientPubRaw, // ua_public (the subscription's p256dh)
    asPublic,     // as_public (this message's ephemeral key)
  ]);
  // IKM = HKDF-Expand(PRK_key, key_info, 32)
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  // PRK = HMAC-SHA-256(salt, IKM)
  const prk = hmac(salt, ikm);
  // CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm" || 0x00, 16)
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\x00', 'latin1'), 16);
  // NONCE = HKDF-Expand(PRK, "Content-Encoding: nonce" || 0x00, 12)
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\x00', 'latin1'), 12);

  // ---- RFC 8188: one (final) record = data || 0x02 ----
  // There is NO leading padding-length field. The 0x02 delimiter is the last
  // non-zero octet; the receiver finds it by scanning back from the end.
  const plaintext = Buffer.concat([messageBuf, Buffer.from([0x02])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);

  // rs (record size) must be >= 18. For a single record, the ciphertext length
  // is a valid size (the last record may be smaller than rs, and here it is rs).
  const rs = opts.recordSize || Math.max(ciphertext.length, 18);
  return Buffer.concat([
    salt,
    Buffer.from([(rs >>> 24) & 0xff, (rs >>> 16) & 0xff, (rs >>> 8) & 0xff, rs & 0xff]),
    Buffer.from([asPublic.length]), // idlen = 65
    asPublic,
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
    if (res.status >= 400) {
      // The push service explains WHY (e.g. "VapidPkHashMismatch" on a key
      // mismatch, or 400 on a malformed body). Surface a short snippet so an
      // operator can tell those apart instead of guessing.
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch (e) { /* body not readable */ }
      return { ok: false, status: res.status, detail };
    }
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
  const checks = {};

  // ---- Known-answer test: RFC 8291 Appendix A ------------------------------
  // These are the RFC's fixed inputs and expected intermediates. If any step of
  // the derivation drifts, the CEK/NONCE/ciphertext stop matching — which is the
  // only way to catch a self-consistent-but-wrong implementation (the previous
  // version round-tripped against itself and passed while being non-compliant).
  const asPrivate = b64urlDecode('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');
  const uaPublic = b64urlDecode('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
  const salt = b64urlDecode('DGv6ra1nlYgDCS1FRnbzlw');
  const auth = b64urlDecode('BTBZMqHH6r4Tts7J_aSIgg');
  const message = Buffer.from('When I grow up, I want to be a watermelon');

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(asPrivate);
  const asPublic = ecdh.getPublicKey();
  checks.asPublic = asPublic.equals(b64urlDecode('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'));
  const sharedSecret = ecdh.computeSecret(uaPublic);
  checks.sharedSecret = sharedSecret.equals(b64urlDecode('kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs'));

  const prkKey = hmac(auth, sharedSecret);
  checks.prkKey = prkKey.equals(b64urlDecode('Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k'));
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info'), Buffer.from([0x00]), uaPublic, asPublic]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  checks.ikm = ikm.equals(b64urlDecode('S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg'));
  const prk = hmac(salt, ikm);
  checks.prk = prk.equals(b64urlDecode('09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc'));
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\x00', 'latin1'), 16);
  checks.cek = cek.equals(b64urlDecode('oIhVW04MRdy2XN9CiKLxTg'));
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\x00', 'latin1'), 12);
  checks.nonce = nonce.equals(b64urlDecode('4h_95klXJ5E_qnoN'));

  const plaintext = Buffer.concat([message, Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  checks.ciphertext = ciphertext.equals(b64urlDecode('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'));

  // ---- Round-trip through the real encryptPayload --------------------------
  // Uses a fresh client key + the live config's message path, then decrypts as
  // the browser would. Proves the header keyid and key_info `as_public` agree.
  const client = crypto.createECDH('prime256v1');
  client.generateKeys();
  const clientPubRaw = client.getPublicKey();
  const auth2 = crypto.randomBytes(16);
  const msg2 = Buffer.from(JSON.stringify({ title: 'self-test', body: 'hello', url: '/' }));
  const body = encryptPayload(msg2, clientPubRaw, auth2);

  const salt2 = body.subarray(0, 16);
  const idlen2 = body[20];
  const asPub2 = body.subarray(21, 21 + idlen2);
  const ct2 = body.subarray(21 + idlen2);
  const shared2 = client.computeSecret(asPub2);
  const prkKey2 = hmac(auth2, shared2);
  const keyInfo2 = Buffer.concat([Buffer.from('WebPush: info'), Buffer.from([0x00]), clientPubRaw, asPub2]);
  const ikm2 = hkdfExpand(prkKey2, keyInfo2, 32);
  const prk2 = hmac(salt2, ikm2);
  const cek2 = hkdfExpand(prk2, Buffer.from('Content-Encoding: aes128gcm\x00', 'latin1'), 16);
  const nonce2 = hkdfExpand(prk2, Buffer.from('Content-Encoding: nonce\x00', 'latin1'), 12);
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek2, nonce2);
  decipher.setAuthTag(ct2.subarray(ct2.length - 16));
  const pt2 = Buffer.concat([decipher.update(ct2.subarray(0, ct2.length - 16)), decipher.final()]);
  checks.roundTrip = pt2[pt2.length - 1] === 0x02 && pt2.subarray(0, pt2.length - 1).toString() === msg2.toString();

  const ok = Object.values(checks).every(Boolean);
  return { ok, checks, reason: ok ? undefined : 'rfc8291-known-answer-mismatch' };
}

module.exports = { configure, isEnabled, keyPairMatches, getPublicKey, sendNotification, broadcast, selfTest, makeJwt, encryptPayload };
