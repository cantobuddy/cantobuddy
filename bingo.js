/**
 * CantoBuddy — Online Bingo, played together.
 *
 * WHY A SERVER (and not a client-only game): Bingo is the one of the four new
 * games that is meant to be played with family across devices, like UNO. The
 * server owns the single shared number draw so nobody can peek ahead or claim a
 * number that was never called — exactly the UNO rule that the caller is the
 * authority and the clients only ever see what the caller has announced.
 *
 * Transport is identical to UNO on purpose — Server-Sent Events down, plain JSON
 * POST up, no WebSocket upgrade — so the same proxy that carries UNO carries
 * Bingo without a new rule. The room model, the create/join/leave flow, the
 * `records` bridge and the housekeeping timer are all copied from uno.js; only
 * the rules differ: there is no turn order, the "dealer" is a timer that calls
 * one of 75 numbers every few seconds, and a win is a completed line on the
 * player's own 5x5 card.
 *
 * Mounting: `app.use('/games/bingo', require('./bingo').handle)` BEFORE
 * express.json() — same reason as the other tables: bingo.js reads the raw body
 * itself via readBody().
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const records = require('./game-records');

const PUBLIC = path.join(__dirname, 'public', 'bingo');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const B_COLS = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]]; // B I N G O
const CALL_INTERVAL = 5000; // ms between numbers — slow enough for older eyes

/** Winning lines on a 5x5 card: 5 rows, 5 columns, 2 diagonals. */
const LINES = (function () {
  const L = [];
  for (let r = 0; r < 5; r++) { const a = []; for (let c = 0; c < 5; c++) a.push(r * 5 + c); L.push(a); }
  for (let c = 0; c < 5; c++) { const a = []; for (let r = 0; r < 5; r++) a.push(r * 5 + c); L.push(a); }
  L.push([0, 6, 12, 18, 24]);
  L.push([4, 8, 12, 16, 20]);
  return L;
})();

/** Active rooms, keyed by pairing code. In memory: a restart ends live games. */
const rooms = new Map();

/* ------------------------------------------------------------------ limits */
const MAX_ROOMS = 200;
const CREATE_PER_HOUR = 30;
const createHits = new Map();

function allowCreate(ip) {
  if (rooms.size >= MAX_ROOMS) return false;
  const t = Date.now();
  const cutoff = t - 60 * 60 * 1000;
  const hits = (createHits.get(ip) || []).filter((x) => x > cutoff);
  if (hits.length >= CREATE_PER_HOUR) {
    createHits.set(ip, hits);
    return false;
  }
  hits.push(t);
  createHits.set(ip, hits);
  return true;
}

/* ------------------------------------------------------------------ utils */
const rnd = (n) => crypto.randomInt(n);
const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();

function makeCode() {
  for (let attempt = 0; attempt < 200; attempt++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_ALPHABET[rnd(CODE_ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
  return 'R' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** One player's 5x5 card. Centre (row 2, col 2) is the free space. */
function genCard() {
  const card = [];
  for (let c = 0; c < 5; c++) {
    const used = {};
    for (let r = 0; r < 5; r++) {
      if (r === 2 && c === 2) { card.push({ value: 0, free: true, col: c }); continue; }
      let v, guard = 0;
      do { v = B_COLS[c][0] + rnd(B_COLS[c][1] - B_COLS[c][0] + 1); guard++; } while (used[v] && guard < 60);
      used[v] = true;
      card.push({ value: v, free: false, col: c });
    }
  }
  return card;
}

function newPlayer(name, avatar, deviceId) {
  return {
    id: uid(),
    token: uid(),
    name: String(name || '').slice(0, 12).trim() || 'Player',
    avatar: String(avatar || '🙂').slice(0, 8),
    deviceId: deviceId || null,
    record: null,
    card: null,
    conns: 0,
    disconnectedAt: 0,
    wins: 0,
  };
}

function createRoom(hostName, hostAvatar, hostDeviceId) {
  const code = makeCode();
  const host = newPlayer(hostName, hostAvatar, hostDeviceId);
  const room = {
    code,
    hostId: host.id,
    players: [host],
    state: 'lobby',
    numbers: shuffle(Array.from({ length: 75 }, (_, i) => i + 1)),
    called: [],
    callIdx: 0,
    startedAt: 0,
    winner: null,
    createdAt: now(),
    streams: new Map(),
    chat: [],
    log: [],
    callTimer: null,
  };
  rooms.set(code, room);
  records.attachRecords(room.players, 'bingo');
  return room;
}

function pushLog(room, ev) {
  room.log.push({ t: now(), ...ev });
  if (room.log.length > 60) room.log.splice(0, room.log.length - 60);
}

function findPlayer(room, token) {
  return room.players.find((p) => p.token === token) || null;
}
function roomByToken(token) {
  if (!token) return null;
  for (const room of rooms.values()) {
    const p = findPlayer(room, token);
    if (p) return { room, player: p };
  }
  return null;
}

/** How many of a player's non-free cells have already been called. */
function progressOf(room, player) {
  if (!player.card) return 0;
  const called = new Set(room.called);
  let n = 0;
  for (const cell of player.card) if (!cell.free && called.has(cell.value)) n++;
  return n;
}

/** True if any line on this card is fully covered by called numbers. */
function hasBingo(room, player) {
  if (!player.card) return false;
  const called = new Set(room.called);
  for (const line of LINES) {
    let ok = true;
    for (const idx of line) {
      const cell = player.card[idx];
      if (!cell.free && !called.has(cell.value)) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function startGame(room) {
  for (const p of room.players) {
    p.card = genCard();
    p.wins = p.wins; // unchanged; per-room tally is not tracked for bingo
  }
  room.state = 'playing';
  room.startedAt = now();
  room.called = [];
  room.callIdx = 0;
  room.winner = null;
  // The dealer. Slow on purpose; elders need time to find each number.
  if (room.callTimer) clearInterval(room.callTimer);
  room.callTimer = setInterval(() => callNext(room), CALL_INTERVAL).unref();
  pushLog(room, { k: 'start' });
  broadcast(room, { type: 'start' });
}

function callNext(room) {
  if (room.state !== 'playing') return;
  if (room.callIdx >= room.numbers.length) {
    // All 75 called and nobody lined up: the board is exhausted, no winner.
    finishGame(room, null);
    return;
  }
  const n = room.numbers[room.callIdx++];
  room.called.push(n);
  // Check every player the instant a number lands, so a completed line wins
  // without waiting for anyone to notice and tap "Bingo!".
  for (const p of room.players) {
    if (p.card && hasBingo(room, p)) { finishGame(room, p.id); return; }
  }
  pushLog(room, { k: 'call', n });
  broadcast(room, { type: 'call', n });
}

function finishGame(room, winnerId) {
  if (room.callTimer) { clearInterval(room.callTimer); room.callTimer = null; }
  room.state = 'ended';
  room.winner = winnerId;
  const winner = room.players.find((p) => p.id === winnerId) || null;
  if (winner) winner.wins += 1;
  records.recordFinish({ game: 'bingo', room, winnerId });
  pushLog(room, { k: 'ended', winner: winner ? winner.name : '' });
  broadcast(room, { type: 'ended' });
}

/* --------------------------------------------------------------- serialize */
function stateFor(room, viewer) {
  const turnPlayer = null;
  return {
    code: room.code,
    state: room.state,
    serverNow: now(),
    startedAt: room.startedAt,
    hostId: room.hostId,
    winner: room.winner,
    called: room.called.slice(),
    lastCalled: room.called.length ? room.called[room.called.length - 1] : null,
    remaining: room.numbers.length - room.callIdx,
    you: {
      id: viewer.id,
      name: viewer.name,
      avatar: viewer.avatar,
      record: viewer.record || null,
      isHost: viewer.id === room.hostId,
      card: viewer.card ? viewer.card.map((c) => ({ value: c.value, free: c.free, col: c.col })) : null,
      progress: progressOf(room, viewer),
      hasBingo: hasBingo(room, viewer),
      canStart: room.state !== 'playing' && room.hostId === viewer.id && room.players.length >= 1,
    },
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, record: p.record || null,
      connected: p.conns > 0, isHost: p.id === room.hostId,
      progress: progressOf(room, p), hasBingo: hasBingo(room, p),
    })),
    chat: room.chat.slice(-30),
    log: room.log.slice(-10),
  };
}

function broadcast(room, extra) {
  for (const p of room.players) {
    const payload = stateFor(room, p);
    if (extra) payload.event = extra;
    const data = 'data: ' + JSON.stringify(payload) + '\n\n';
    const set = room.streams.get(p.id);
    if (!set) continue;
    for (const res of set) { try { res.write(data); } catch (e) { /* dropped */ } }
  }
}

/* ------------------------------------------------------------------- http */
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return resolve({});
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function serveClient(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (/^\/[A-Z0-9]{4}$/.test(pathname)) {
        return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); return res.end('not found'); }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(html);
        });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/* ------------------------------------------------------------------ routes */
async function handle(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  } catch (e) {
    return json(res, 400, { error: 'badRequest' });
  }
  const p = url.pathname;

  if (p === '/api/health') {
    return json(res, 200, { ok: true, game: 'bingo', rooms: rooms.size, uptime: process.uptime() });
  }

  if (p === '/api/create' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom(body.name, body.avatar, records.deviceIdFrom(body));
    const host = room.players[0];
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar, record: host.record,
    });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: 'roomNotFound' });
    if (room.players.length >= 8) return json(res, 409, { error: 'roomFull' });
    const name = String(body.name || '').slice(0, 12).trim();
    if (!name) return json(res, 400, { error: 'nameRequired' });
    if (room.players.some((x) => x.name === name && room.state === 'lobby')) {
      return json(res, 409, { error: 'nameTaken' });
    }
    const player = newPlayer(name, body.avatar, records.deviceIdFrom(body));
    room.players.push(player);
    records.attachRecords(room.players, 'bingo');
    pushLog(room, { k: 'join', name: player.name });
    broadcast(room, { type: 'join', name: player.name });
    return json(res, 200, {
      code: room.code, token: player.token, playerId: player.id,
      name: player.name, avatar: player.avatar, record: player.record,
    });
  }

  if (p === '/api/state' && req.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const found = roomByToken(token);
    if (!found) return json(res, 401, { error: 'sessionExpired' });
    return json(res, 200, stateFor(found.room, found.player));
  }

  if (p === '/api/action' && req.method === 'POST') {
    const body = await readBody(req);
    const found = roomByToken(String(body.token || ''));
    if (!found) return json(res, 401, { error: 'sessionExpired' });
    const { room, player } = found;
    const type = body.type;

    if (type === 'start') {
      if (room.hostId !== player.id) return json(res, 403, { error: 'onlyHost' });
      if (room.state === 'playing') return json(res, 400, { error: 'alreadyPlaying' });
      startGame(room);
      return json(res, 200, { ok: true });
    }

    if (type === 'bingo') {
      // A player may tap "Bingo!" early; the server re-checks against the numbers
      // it has actually called, so a premature tap is simply rejected.
      if (room.state !== 'playing') return json(res, 400, { error: 'notPlaying' });
      if (!hasBingo(room, player)) return json(res, 400, { error: 'noBingo' });
      finishGame(room, player.id);
      return json(res, 200, { ok: true });
    }

    if (type === 'chat') {
      const text = String(body.text || '').slice(0, 140).trim();
      if (!text) return json(res, 400, { error: 'emptyMessage' });
      room.chat.push({ t: now(), id: player.id, name: player.name, avatar: player.avatar, text, kind: 'chat' });
      if (room.chat.length > 60) room.chat.shift();
      broadcast(room, { type: 'chat' });
      return json(res, 200, { ok: true });
    }

    if (type === 'leave') {
      const idx = room.players.findIndex((x) => x.id === player.id);
      if (idx >= 0) {
        room.players.splice(idx, 1);
        pushLog(room, { k: 'leave', name: player.name });
        if (room.hostId === player.id && room.players.length) room.hostId = room.players[0].id;
        if (room.players.length === 0) {
          if (room.callTimer) { clearInterval(room.callTimer); room.callTimer = null; }
          rooms.delete(room.code);
          return json(res, 200, { ok: true });
        }
        broadcast(room, { type: 'leave', by: player.name });
      }
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: 'unknownAction' });
  }

  if (p === '/api/events' && req.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const found = roomByToken(token);
    if (!found) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.write('data: ' + JSON.stringify({ fatal: 'expired' }) + '\n\n');
      return res.end();
    }
    const { room, player } = found;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');

    if (!room.streams.has(player.id)) room.streams.set(player.id, new Set());
    room.streams.get(player.id).add(res);
    player.conns += 1;
    player.disconnectedAt = 0;
    broadcast(room, { type: 'sync' });

    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) { /* ignore */ }
    }, 15000);

    const cleanup = () => {
      clearInterval(hb);
      const set = room.streams.get(player.id);
      if (set) set.delete(res);
      player.conns = Math.max(0, player.conns - 1);
      if (player.conns === 0) {
        player.disconnectedAt = now();
        broadcast(room, { type: 'offline', name: player.name });
      }
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    return;
  }

  if (req.method === 'GET') return serveClient(req, res, p);
  res.writeHead(405);
  res.end('method not allowed');
}

/* --------------------------------------------------- housekeeping / timers */
setInterval(() => {
  const t = now();
  for (const room of [...rooms.values()]) {
    const allGone = room.players.every((p) => p.conns === 0 && p.disconnectedAt && t - p.disconnectedAt > 30 * 60 * 1000);
    if (allGone || room.players.length === 0) {
      if (room.callTimer) { clearInterval(room.callTimer); room.callTimer = null; }
      rooms.delete(room.code);
    }
  }
  if (createHits.size > 5000) {
    const cutoff = t - 60 * 60 * 1000;
    for (const [ip, hits] of createHits) {
      if (!hits.some((x) => x > cutoff)) createHits.delete(ip);
    }
  }
}, 5000).unref();

module.exports = {
  handle, rooms, createRoom, startGame, genCard, hasBingo,
};
