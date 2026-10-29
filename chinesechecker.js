'use strict';

/**
 * CantoBuddy — Chinese Checkers (中国跳棋).
 *
 * WHY THIS IS A ROOM GAME AND A SOLO GAME AT ONCE. The brief was "play with
 * computer or play online with family", and the two must not be two codebases.
 * So a solo table is an ordinary room whose empty seats are filled by bots the
 * moment it starts: one move handler, one broadcast, one win check. The only
 * thing `solo` changes is that nobody can join and the bots exist from turn one.
 *
 * WHY THE SERVER DECIDES EVERYTHING. The client holds core.js too, but only to
 * draw the board and highlight where a peg may go. Legality, whose turn it is
 * and who won are decided here, from here. A client that could decide its own
 * legality could teleport a peg across the board, and the other five players
 * would watch it happen.
 *
 * SEATS, NOT PLAYERS. A table is 2, 3, 4 or 6 corners; 5 is not offered because
 * there is no five-corner arrangement where everyone's race is the same length.
 * A seat is a position at the table (0..seats-1), and its corner is fixed by
 * core.js, so the player who joins second always gets the second corner and the
 * race stays fair regardless of who leaves.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const Core = require('./public/chinesechecker/core.js');
const records = require('./game-records');

const PUBLIC = path.join(__dirname, 'public', 'chinesechecker');

const SEAT_CHOICES = [2, 3, 4, 6];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* The safety net. A game has never reached this in testing, but a bot that can
   shuffle forever would leave a real player waiting on a turn that never comes,
   and that is a far worse failure than calling a game on points. When it is hit
   the leader by pegs-home wins; a tie is a draw. */
const MAX_PLIES = 1000;

const MAX_ROOMS = 200;
const CREATE_PER_HOUR = 40;
const createHits = new Map();

/* Every live table, keyed by its four-letter code. In-process on purpose: a room
   is a shared clock and a shared board, and putting it behind a second process
   would mean the turn order and the SSE fan-out need a broker. Losing the map on
   a restart costs a game in progress, which is the same thing that happens when
   a phone dies. */
const rooms = new Map();

const rnd = (n) => crypto.randomInt(n);
const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();

function allowCreate(ip) {
  const t = now();
  const cutoff = t - 60 * 60 * 1000;
  const hits = (createHits.get(ip) || []).filter((x) => x > cutoff);
  if (hits.length >= CREATE_PER_HOUR) { createHits.set(ip, hits); return false; }
  hits.push(t);
  createHits.set(ip, hits);
  return true;
}

function makeCode() {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[rnd(CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  return null;
}

function newPlayer(name, avatar, seat, opts) {
  opts = opts || {};
  return {
    id: uid(),
    token: uid(),
    name: String(name || '').slice(0, 12).trim() || 'Player',
    avatar: String(avatar || '').slice(0, 8) || '🙂',
    seat: seat,
    bot: !!opts.bot,
    level: opts.level || 'normal',
    deviceId: opts.deviceId || null,
    record: null,
    wins: 0,
    conns: 0,
    disconnectedAt: 0,
  };
}

function pushLog(room, ev) {
  ev.t = now();
  room.log.push(ev);
  if (room.log.length > 80) room.log.shift();
}

function createRoom(opts) {
  const seats = SEAT_CHOICES.includes(Number(opts.seats)) ? Number(opts.seats) : 2;
  const code = makeCode();
  if (!code) return null;

  const room = {
    code: code,
    createdAt: now(),
    solo: !!opts.solo,
    seats: seats,
    level: opts.level || 'normal',
    state: 'lobby',
    hostId: null,
    players: [],
    occ: Core.emptyBoard(),
    turn: 0,
    ply: 0,
    winner: null,
    winnerName: '',
    lastMove: null,
    log: [],
    chat: [],
    streams: new Map(),
    botTimer: null,
    round: 0,
  };

  const host = newPlayer(opts.name, opts.avatar, 0, {
    level: room.level,
    deviceId: opts.deviceId,
  });
  room.players.push(host);
  room.hostId = host.id;

  rooms.set(code, room);
  if (rooms.size > MAX_ROOMS) {
    const oldest = [...rooms.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest && oldest.code !== code) rooms.delete(oldest.code);
  }
  return room;
}

function findPlayer(room, token) {
  return room.players.find((p) => p.token === token) || null;
}

function roomByToken(token) {
  for (const room of rooms.values()) {
    const p = findPlayer(room, token);
    if (p) return { room, player: p };
  }
  return null;
}

/* --------------------------------------------------------------- the table */

function fillBots(room) {
  const used = new Set(room.players.map((p) => p.seat));
  /* Distinct names, in the order a Filipino household would recognise them.
     An earlier list cycled two "Ate" entries into a six-seat room, which is
     confusing in the turn banner ("Ate is thinking…" - which Ate?) and would
     also collide with a real player who joined under that name. */
  const names = ['Ate', 'Kuya', 'Lola', 'Tito', 'Lolo', 'Bunso'];
  const faces = ['🐱', '🐶', '🐰', '🐻', '🦊', '🐼'];
  for (let seat = 0; seat < room.seats; seat++) {
    if (used.has(seat)) continue;
    const bot = newPlayer(names[seat % names.length], faces[seat % faces.length], seat, {
      bot: true,
      level: room.level,
    });
    room.players.push(bot);
  }
  room.players.sort((a, b) => a.seat - b.seat);
}

function startGame(room) {
  if (room.state === 'playing') return false;
  if (room.players.length < 1) return false;

  // Any seat nobody claimed becomes a bot. This is what makes "play with family"
  // work for a household of three when the board is set to six: nobody has to
  // wait for the other three cousins to install anything.
  if (room.players.length < room.seats) fillBots(room);

  room.state = 'playing';
  room.occ = Core.initialBoard(room.seats);
  room.turn = 0;
  room.ply = 0;
  room.winner = null;
  room.winnerName = '';
  room.lastMove = null;
  room.round += 1;
  pushLog(room, { k: 'start', seats: room.seats });
  broadcast(room, { type: 'start' });
  scheduleBot(room);
  return true;
}

function seatOf(room, player) { return player.seat; }

function playerBySeat(room, seat) {
  return room.players.find((p) => p.seat === seat) || null;
}

function currentPlayer(room) {
  return playerBySeat(room, room.turn);
}

/**
 * Apply one move. Every rule that matters is checked here, in this order, and
 * the order is the point: whose turn it is, then whether the peg is theirs, then
 * whether the destination is legal. Checking legality first would let a client
 * probe the board on someone else's turn.
 */
function doMove(room, player, from, to) {
  if (room.state !== 'playing') return { error: 'notPlaying' };
  if (room.turn !== player.seat) return { error: 'notYourTurn' };
  if (!Number.isInteger(from) || !Number.isInteger(to)) return { error: 'badMove' };
  if (from < 0 || from >= Core.N || to < 0 || to >= Core.N) return { error: 'badMove' };
  if (room.occ[from] !== player.seat) return { error: 'notYourPeg' };
  if (room.occ[to] >= 0) return { error: 'occupied' };
  if (!Core.legalMoves(room.occ, from, room.seats, player.seat).includes(to)) return { error: 'illegalMove' };

  const jump = Core.isJump(from, to);
  /* Before the move is applied: movePath needs the peg still on `from`. */
  const path = Core.movePath(room.occ, from, to);
  Core.applyMove(room.occ, from, to, player.seat);
  room.ply += 1;
  room.lastMove = { from: from, to: to, seat: player.seat, jump: jump, ply: room.ply, path: path };
  pushLog(room, { k: 'move', name: player.name, seat: player.seat, from: from, to: to, jump: jump });

  if (Core.isWin(room.occ, room.seats, player.seat)) {
    finishGame(room, player.id);
    return { ok: true, won: true };
  }

  if (room.ply >= MAX_PLIES) {
    finishOnPoints(room);
    return { ok: true, capped: true };
  }

  room.turn = (room.turn + 1) % room.seats;
  broadcast(room, { type: 'move', seat: player.seat, from: from, to: to });
  scheduleBot(room);
  return { ok: true };
}

/**
 * How long the client will spend drawing the move that was just played.
 *
 * The client walks a jump hop by hop, and the two seats are paced differently:
 * the player is watching their OWN peg, so it is deliberately slow, while the
 * computer's is quicker so the bot's turn does not drag. Those numbers live in
 * public/chinesechecker/index.html and are mirrored here. If you retune one,
 * retune the other — otherwise the computer starts answering in the middle of
 * the player's route and the route is silently cut short, which is precisely
 * the bug this function exists to prevent.
 *
 * A single step (path of two cells) is not animated at all, so it costs nothing.
 */
function hopMsOwn(hops) { return Math.max(300, Math.min(520, 2400 / hops)); }
function hopMsOther(hops) { return Math.max(190, Math.min(360, 1500 / hops)); }

function routeMs(room) {
  const mv = room.lastMove;
  if (!mv || !mv.path || mv.path.length < 3) return 0;
  const hops = mv.path.length - 1;
  const mover = playerBySeat(room, mv.seat);
  const own = !!mover && !mover.bot;
  return hops * (own ? hopMsOwn(hops) : hopMsOther(hops));
}

/**
 * Run the bots. Each bot move is scheduled on a timer rather than run in a loop
 * so the humans see the peg land, one move at a time - a 6-seat table where four
 * bots answer instantly is unreadable, and the whole point of the animation is
 * that a beginner can follow whose turn it is.
 *
 * The wait is the move's animation PLUS a beat, not a flat 620ms. A flat delay
 * landed the computer's reply ~0.6s after the player's jump began, and the reply
 * redraws the board - so the player's own route, the slow one, was wiped out
 * after about a single hop while the computer's route always played in full.
 * That read as "the red colour does not display slow motion to step route like
 * the blue colour". Waiting out the animation fixes it at the source, and on a
 * six-hop jump the pause simply reads as the computer thinking.
 */
function scheduleBot(room) {
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
  if (room.state !== 'playing') return;
  const p = currentPlayer(room);
  if (!p || !p.bot) return;

  const delay = Math.max(620, routeMs(room) + 260);

  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (room.state !== 'playing') return;
    const bot = currentPlayer(room);
    if (!bot || !bot.bot) return;

    const mv = Core.botMove(room.occ, room.seats, bot.seat, bot.level || 'normal');
    if (!mv) { finishOnPoints(room); return; }

    const jump = Core.isJump(mv[0], mv[1]);
    const path = Core.movePath(room.occ, mv[0], mv[1]);
    Core.applyMove(room.occ, mv[0], mv[1], bot.seat);
    room.ply += 1;
    room.lastMove = { from: mv[0], to: mv[1], seat: bot.seat, jump: jump, ply: room.ply, path: path };
    pushLog(room, { k: 'move', name: bot.name, seat: bot.seat, from: mv[0], to: mv[1], jump: jump });

    if (Core.isWin(room.occ, room.seats, bot.seat)) { finishGame(room, bot.id); return; }
    if (room.ply >= MAX_PLIES) { finishOnPoints(room); return; }

    room.turn = (room.turn + 1) % room.seats;
    broadcast(room, { type: 'move', seat: bot.seat, from: mv[0], to: mv[1] });
    scheduleBot(room);
  }, delay);
  if (room.botTimer.unref) room.botTimer.unref();
}

function finishGame(room, winnerId) {
  room.state = 'ended';
  room.winner = winnerId;
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
  const winner = room.players.find((p) => p.id === winnerId);
  room.winnerName = winner ? winner.name : '';
  if (winner) winner.wins += 1;

  /* A bot winning must not write a record. recordFinish keys off deviceId, and a
     bot has none, so it is already safe - but the room still gets its one write
     so the humans' played counts go up. */
  records.recordFinish({ game: 'chinesechecker', room, winnerId: winner && !winner.bot ? winnerId : null });
  pushLog(room, { k: 'ended', name: room.winnerName });
  broadcast(room, { type: 'ended' });
}

/* The cap was reached. Rank by pegs home, then by how little travelling is left;
   a genuine tie is a draw and is recorded as one. */
function finishOnPoints(room) {
  let bestSeat = -1;
  let bestHome = -1;
  let bestTravel = Infinity;
  let tie = false;
  for (let s = 0; s < room.seats; s++) {
    const home = Core.homeCount(room.occ, room.seats, s);
    const travel = Core.travel(room.occ, room.seats, s);
    if (home > bestHome || (home === bestHome && travel < bestTravel)) {
      bestHome = home; bestTravel = travel; bestSeat = s; tie = false;
    } else if (home === bestHome && travel === bestTravel) {
      tie = true;
    }
  }
  const p = tie ? null : playerBySeat(room, bestSeat);
  if (!p) {
    room.state = 'ended';
    if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
    room.winner = null;
    room.winnerName = '';
    records.recordDraw({ game: 'chinesechecker', room });
    pushLog(room, { k: 'ended', name: '' });
    broadcast(room, { type: 'ended' });
    return;
  }
  finishGame(room, p.id);
}

/* --------------------------------------------------------------- serialize */
function stateFor(room, viewer) {
  return {
    code: room.code,
    solo: room.solo,
    seats: room.seats,
    level: room.level,
    state: room.state,
    hostId: room.hostId,
    turn: room.turn,
    ply: room.ply,
    winner: room.winner,
    winnerName: room.winnerName,
    occ: Array.from(room.occ),
    lastMove: room.lastMove,
    log: room.log.slice(-40),
    chat: room.chat.slice(-40),
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      seat: p.seat,
      bot: p.bot,
      conns: p.conns,
      wins: p.wins,
      record: p.record,
      home: room.state === 'playing' || room.state === 'ended'
        ? Core.homeCount(room.occ, room.seats, p.seat) : 0,
    })),
    you: {
      id: viewer.id,
      seat: viewer.seat,
      name: viewer.name,
      avatar: viewer.avatar,
      isHost: viewer.id === room.hostId,
    },
  };
}

function broadcast(room, extra) {
  for (const p of room.players) {
    if (p.bot) continue;
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
    return json(res, 200, { ok: true, game: 'chinesechecker', rooms: rooms.size, uptime: process.uptime() });
  }

  if (p === '/api/create' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom({
      seats: body.seats, name: body.name, avatar: body.avatar,
      level: body.level, deviceId: records.deviceIdFrom(body),
    });
    if (!room) return json(res, 503, { error: 'noCode' });
    const host = room.players[0];
    records.attachRecords(room.players, 'chinesechecker');
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar, seats: room.seats, record: host.record,
    });
  }

  if (p === '/api/solo' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom({
      solo: true, seats: body.seats, name: body.name, avatar: body.avatar,
      level: body.level, deviceId: records.deviceIdFrom(body),
    });
    if (!room) return json(res, 503, { error: 'noCode' });
    records.attachRecords(room.players, 'chinesechecker');
    startGame(room);
    const host = room.players[0];
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar, seats: room.seats,
      level: room.level, record: host.record,
    });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: 'roomNotFound' });
    if (room.solo) return json(res, 409, { error: 'soloRoom' });
    if (room.state === 'playing') return json(res, 409, { error: 'alreadyPlaying' });
    if (room.state === 'ended') return json(res, 409, { error: 'alreadyEnded' });
    if (room.players.length >= room.seats) return json(res, 409, { error: 'roomFull' });
    const name = String(body.name || '').slice(0, 12).trim();
    if (!name) return json(res, 400, { error: 'nameRequired' });
    if (room.players.some((x) => x.name === name)) return json(res, 409, { error: 'nameTaken' });

    const used = new Set(room.players.map((x) => x.seat));
    let seat = 0;
    while (used.has(seat)) seat += 1;

    const player = newPlayer(name, body.avatar, seat, { deviceId: records.deviceIdFrom(body) });
    room.players.push(player);
    room.players.sort((a, b) => a.seat - b.seat);
    records.attachRecords(room.players, 'chinesechecker');
    pushLog(room, { k: 'join', name: player.name });
    broadcast(room, { type: 'join', name: player.name });
    return json(res, 200, {
      code: room.code, token: player.token, playerId: player.id,
      name: player.name, avatar: player.avatar, seats: room.seats, record: player.record,
    });
  }

  if (p === '/api/state' && req.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const found = roomByToken(token);
    if (!found) return json(res, 404, { error: 'expired' });
    return json(res, 200, stateFor(found.room, found.player));
  }

  if (p === '/api/action' && req.method === 'POST') {
    const body = await readBody(req);
    const found = roomByToken(String(body.token || ''));
    if (!found) return json(res, 404, { error: 'expired' });
    const { room, player } = found;
    const type = String(body.type || '');

    if (type === 'start') {
      if (player.id !== room.hostId) return json(res, 403, { error: 'notHost' });
      if (room.state === 'playing') return json(res, 409, { error: 'alreadyPlaying' });
      if (!startGame(room)) return json(res, 409, { error: 'cannotStart' });
      return json(res, 200, { ok: true });
    }

    if (type === 'move') {
      const r = doMove(room, player, Number(body.from), Number(body.to));
      if (r.error) return json(res, 400, r);
      return json(res, 200, { ok: true });
    }

    /* A rematch keeps the table and the seats and deals a new board. The round
       counter is what stops the previous result being written twice. */
    if (type === 'again') {
      if (player.id !== room.hostId) return json(res, 403, { error: 'notHost' });
      if (room.state !== 'ended') return json(res, 409, { error: 'notEnded' });
      room.state = 'lobby';
      startGame(room);
      return json(res, 200, { ok: true });
    }

    if (type === 'chat') {
      const text = String(body.text || '').slice(0, 140).trim();
      if (!text) return json(res, 400, { error: 'emptyMessage' });
      room.chat.push({ t: now(), id: player.id, name: player.name, avatar: player.avatar, text: text, kind: 'chat' });
      if (room.chat.length > 60) room.chat.shift();
      broadcast(room, { type: 'chat' });
      return json(res, 200, { ok: true });
    }

    if (type === 'shout') {
      const emoji = String(body.emoji || '').slice(0, 12) || '🎉';
      room.chat.push({ t: now(), id: player.id, name: player.name, avatar: player.avatar, text: emoji, kind: 'shout' });
      if (room.chat.length > 60) room.chat.shift();
      broadcast(room, { type: 'shout', by: player.name, emoji: emoji });
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
    const humans = room.players.filter((p) => !p.bot);
    const allGone = humans.length === 0
      || humans.every((p) => p.conns === 0 && p.disconnectedAt && t - p.disconnectedAt > 30 * 60 * 1000);
    if (allGone) {
      if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
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
  handle, rooms, Core,
  createRoom, startGame, doMove, stateFor, scheduleBot, finishOnPoints,
  routeMs, hopMsOwn, hopMsOther,
};
