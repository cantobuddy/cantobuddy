/**
 * CantoBuddy — Sudoku, alone or together.
 *
 * WHAT IT IS. A number puzzle with THREE boards — 4×4 (Easy), 6×6 (Medium) and
 * 9×9 (Hard) — played two ways:
 *
 *   · Alone  — a single player, timed, with a hint button.
 *   · Together — one room code, everyone races the SAME puzzle on their own
 *                board; first to fill every cell wins.
 *
 * WHY THE SERVER OWNS THE ANSWER. The puzzle and its solution are generated and
 * kept on the server; the client only ever receives the GIVENS and its own
 * placements. A move is sent up, the server checks it against the stored
 * solution, and only correct cells come back. The client literally cannot read
 * the answer out of a response — the same rule the other games follow (see the
 * header in wordmatch.js). A wrong guess is reported to its author only, never
 * broadcast with a value, so brute-forcing a cell leaks nothing the solver
 * would not already give away.
 *
 * COMPLETION. A player has won the moment every non-given cell on THEIR board
 * is correctly filled. In a race that decides the winner; alone it just ends
 * the round. Either way the board is provably solvable because the generator
 * guarantees a unique solution.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const Core = require('./public/sudoku/core.js');
// Wins used to live only on the in-memory room object, so a restart erased them
// and there was nothing to come back to tomorrow. This writes them down.
const records = require('./game-records');

const PUBLIC = path.join(__dirname, 'public', 'sudoku');

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 6;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LANGS = ['en', 'fil', 'zh', 'id'];

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

function loadPool() {
  // Sudoku needs no vocabulary; present for symmetry with the other tables and
  // unused. Kept so the room-creation path reads the same as its siblings.
  return [];
}

/* ------------------------------------------------------------------ rooms */
function newPlayer(name, avatar, lang, deviceId) {
  return {
    id: uid(),
    token: uid(),
    name: String(name || '').slice(0, 12).trim() || 'Player',
    avatar: String(avatar || '🙂').slice(0, 8),
    lang: LANGS.includes(lang) ? lang : 'en',
    // Her identity across sessions. Null is legitimate: a player who has not
    // been identified still plays, she just has no record to show yet.
    deviceId: deviceId || null,
    record: null,
    conns: 0,
    disconnectedAt: 0,
    board: [],            // their current placements (givens pre-filled)
    mistakes: 0,
    done: false,
    wins: 0,
  };
}

function createRoom(opts) {
  const solo = !!opts.solo;
  const level = ['easy', 'medium', 'hard', 'expert'].includes(opts.level) ? opts.level : 'easy';
  const gen = Core.generate(level);
  const code = solo ? uid() : makeCode();
  const host = newPlayer(opts.name, opts.avatar, opts.lang, opts.deviceId);
  host.board = gen.puzzle.slice();
  const room = {
    code,
    solo,
    level,
    n: gen.n, br: gen.br, bc: gen.bc,
    puzzle: gen.puzzle,
    solution: gen.solution,
    givens: gen.givens,
    players: [host],
    hostId: host.id,
    state: 'lobby',            // lobby | playing | ended
    winner: null,
    startedAt: 0,
    createdAt: now(),
    streams: new Map(),
    chat: [],
    log: [],
  };
  if (solo) { room.state = 'playing'; room.startedAt = now(); }
  rooms.set(code, room);
  records.attachRecords(room.players, 'sudoku');
  pushLog(room, { k: solo ? 'soloCreated' : 'roomCreated', code, level, n: gen.n });
  return room;
}

function pushLog(room, ev) {
  room.log.push({ t: now(), ...ev });
  if (room.log.length > 80) room.log.splice(0, room.log.length - 80);
}

function findPlayer(room, token) {
  return room.players.find((p) => p.token === token) || null;
}

function roomByToken(token) {
  if (!token) return null;
  for (const room of rooms.values()) {
    const player = findPlayer(room, token);
    if (player) return { room, player };
  }
  return null;
}

function totalToFill(room) { return room.n * room.n - room.givens; }

function progressOf(room, player) {
  let filled = 0;
  for (let i = 0; i < player.board.length; i++) {
    if (room.puzzle[i] === 0 && player.board[i] !== 0) filled++;
  }
  return filled;
}

/* ------------------------------------------------------------------ rounds */
function startGame(room) {
  room.state = 'playing';
  room.startedAt = now();
  room.winner = null;
  for (const p of room.players) {
    p.board = room.puzzle.slice();
    p.mistakes = 0;
    p.done = false;
  }
  pushLog(room, { k: 'start' });
  broadcast(room, { type: 'start' });
}

function setCell(room, player, index, value) {
  if (room.state !== 'playing') return { error: 'noBoard' };
  if (!Number.isInteger(index) || index < 0 || index >= room.n * room.n) return { error: 'badCell' };
  if (room.puzzle[index] !== 0) return { error: 'givenCell' };   // a given cannot change
  if (player.board[index] !== 0) return { error: 'alreadyFilled' };
  if (!Number.isInteger(value) || value < 1 || value > room.n) return { error: 'badValue' };

  if (room.solution[index] === value) {
    player.board[index] = value;
    broadcast(room, { type: 'set' });
    if (!player.done && progressOf(room, player) >= totalToFill(room)) {
      player.done = true;
      finishGame(room, player.id);
    }
    return { ok: true, correct: true };
  }
  // Wrong: counted against the player, reported to them only. The value is
  // never stored or broadcast, so it leaks nothing about the right answer.
  player.mistakes += 1;
  broadcast(room, { type: 'wrong', by: player.name });
  return { ok: true, correct: false };
}

function clearCell(room, player, index) {
  if (room.state !== 'playing') return { error: 'noBoard' };
  if (room.puzzle[index] !== 0) return { error: 'givenCell' };   // cannot clear a given
  if (player.board[index] === 0) return { ok: true };
  player.board[index] = 0;
  player.done = false;
  broadcast(room, { type: 'clear' });
  return { ok: true };
}

function hintCell(room, player, index) {
  if (!room.solo) return { error: 'soloOnly' };
  if (room.state !== 'playing') return { error: 'noBoard' };
  if (room.puzzle[index] !== 0 || player.board[index] !== 0) return { error: 'badCell' };
  player.board[index] = room.solution[index];
  broadcast(room, { type: 'set' });
  if (!player.done && progressOf(room, player) >= totalToFill(room)) {
    player.done = true;
    finishGame(room, player.id);
  }
  return { ok: true, value: room.solution[index] };
}

function finishGame(room, winnerId) {
  room.state = 'ended';
  room.winner = winnerId;
  const winner = room.players.find((p) => p.id === winnerId);
  if (winner) winner.wins += 1;
  // Written down before anything else: the room's own tally dies with the
  // process, and this is the only part of the result that outlives it. A solo
  // board is recorded too, with a table of one — she did finish it.
  records.recordFinish({ game: 'sudoku', room, winnerId });
  pushLog(room, { k: 'ended', winner: winner ? winner.name : '' });
  broadcast(room, { type: 'ended' });
}

/* --------------------------------------------------------------- serialize */
function stateFor(room, viewer) {
  return {
    code: room.code,
    solo: room.solo,
    level: room.level,
    n: room.n, br: room.br, bc: room.bc,
    givens: room.givens,
    state: room.state,
    hostId: room.hostId,
    winner: room.winner,
    startedAt: room.startedAt,
    serverNow: now(),
    you: {
      id: viewer.id,
      name: viewer.name,
      avatar: viewer.avatar,
      lang: viewer.lang,
      record: viewer.record || null,
      isHost: viewer.id === room.hostId,
      done: viewer.done,
      mistakes: viewer.mistakes,
      progress: progressOf(room, viewer),
      isWinner: room.winner === viewer.id,
      canStart: viewer.id === room.hostId && room.state === 'lobby' && room.players.length >= 1,
    },
    // The player's own board only — in a race nobody sees a rival's fills.
    board: viewer.board.slice(),
    puzzle: room.puzzle.slice(),
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, done: p.done,
      mistakes: p.mistakes, progress: progressOf(room, p),
      // Lifetime record, not this room's tally.
      record: p.record || null,
      connected: p.conns > 0, isHost: p.id === room.hostId,
    })),
    chat: room.chat.slice(-40),
  };
}

function broadcast(room, extra) {
  for (const p of room.players) {
    const payload = stateFor(room, p);
    if (extra) payload.event = extra;
    const data = 'data: ' + JSON.stringify(payload) + '\n\n';
    const set = room.streams.get(p.id);
    if (!set) continue;
    for (const res of set) {
      try { res.write(data); } catch (e) { /* dropped */ }
    }
  }
}

/* ------------------------------------------------------------------- http */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

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
      // A 4-character code is a room link, not a file: hand it the app so the
      // client can read the code out of the path and offer to join.
      if (/^\/[A-Z0-9]{4}$/.test(pathname)) {
        return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); return res.end('not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
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
    return json(res, 200, { ok: true, game: 'sudoku', rooms: rooms.size, uptime: process.uptime() });
  }

  if (p === '/api/create' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom({ solo: false, level: body.level, name: body.name, avatar: body.avatar, lang: body.lang, deviceId: records.deviceIdFrom(body) });
    const host = room.players[0];
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar, lang: host.lang, level: room.level, record: host.record,
    });
  }

  if (p === '/api/solo' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom({ solo: true, level: body.level, name: body.name || 'You', avatar: body.avatar, lang: body.lang, deviceId: records.deviceIdFrom(body) });
    const host = room.players[0];
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar, lang: host.lang, level: room.level, record: host.record,
    });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: 'roomNotFound' });
    if (room.solo) return json(res, 409, { error: 'soloRoom' });
    if (room.players.length >= MAX_PLAYERS) return json(res, 409, { error: 'roomFull' });
    if (room.state === 'ended') return json(res, 409, { error: 'alreadyEnded' });
    const name = String(body.name || '').slice(0, 12).trim();
    if (!name) return json(res, 400, { error: 'nameRequired' });
    if (room.players.some((x) => x.name === name)) return json(res, 409, { error: 'nameTaken' });
    const player = newPlayer(name, body.avatar, body.lang, records.deviceIdFrom(body));
    player.board = room.puzzle.slice();
    room.players.push(player);
    records.attachRecords(room.players, 'sudoku');
    pushLog(room, { k: 'join', name: player.name });
    broadcast(room, { type: 'join', name: player.name });
    return json(res, 200, {
      code: room.code, token: player.token, playerId: player.id,
      name: player.name, avatar: player.avatar, lang: player.lang, record: player.record,
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

    if (type === 'set') {
      const r = setCell(room, player, Number(body.index), Number(body.value));
      if (r.error) return json(res, 400, { error: r.error });
      return json(res, 200, r);
    }

    if (type === 'clear') {
      const r = clearCell(room, player, Number(body.index));
      if (r.error) return json(res, 400, { error: r.error });
      return json(res, 200, r);
    }

    if (type === 'hint') {
      const r = hintCell(room, player, Number(body.index));
      if (r.error) return json(res, 400, { error: r.error });
      return json(res, 200, r);
    }

    if (type === 'chat') {
      const text = String(body.text || '').slice(0, 140).trim();
      if (!text) return json(res, 400, { error: 'emptyMessage' });
      room.chat.push({ t: now(), id: player.id, name: player.name, avatar: player.avatar, text, kind: 'chat' });
      if (room.chat.length > 60) room.chat.shift();
      broadcast(room, { type: 'chat' });
      return json(res, 200, { ok: true });
    }

    if (type === 'shout') {
      const emoji = String(body.emoji || '👏').slice(0, 12);
      room.chat.push({ t: now(), id: player.id, name: player.name, avatar: player.avatar, text: emoji, kind: 'shout' });
      if (room.chat.length > 60) room.chat.shift();
      broadcast(room, { type: 'shout', by: player.name, emoji });
      return json(res, 200, { ok: true });
    }

    if (type === 'leave') {
      const idx = room.players.findIndex((x) => x.id === player.id);
      if (idx >= 0) {
        room.players.splice(idx, 1);
        pushLog(room, { k: 'leave', name: player.name });
        if (room.hostId === player.id && room.players.length) room.hostId = room.players[0].id;
        if (room.players.length === 0) {
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
    if (allGone || room.players.length === 0) rooms.delete(room.code);
  }
  if (createHits.size > 5000) {
    const cutoff = t - 60 * 60 * 1000;
    for (const [ip, hits] of createHits) {
      if (!hits.some((x) => x > cutoff)) createHits.delete(ip);
    }
  }
}, 5000).unref();

module.exports = {
  handle, rooms,
  createRoom, startGame, setCell, clearCell, hintCell, stateFor, totalToFill,
  Core,
};
