'use strict';
/**
 * CantoBuddy — the UNO table, served inside the app.
 *
 * This started life as a standalone zero-dependency game server and was ported
 * here so the game lives at https://cantobuddy.com/games/uno rather than on a
 * second hostname: one deploy, one origin, one link to send the family.
 *
 * Transport is unchanged and deliberate: Server-Sent Events for server -> client
 * and plain JSON POST for client -> server. No WebSocket upgrade, because an
 * upgrade is the one thing a proxy is most likely to break, and a UNO game needs
 * nothing a one-way stream cannot do.
 *
 * TWO THINGS DIFFER FROM THE STANDALONE VERSION, both because this app is
 * read in four languages (en/fil/zh/id) and the game must speak the one the
 * learner already picked:
 *
 *   1. The action log is a list of STRUCTURED EVENTS (`{k:'play', who, card}`),
 *      not sentences. The server does not know which language the reader chose
 *      and a room can hold four different ones at once, so the client renders
 *      each event through its own dictionary. Never put a sentence in here.
 *   2. Errors are CODES (`{error:'notYourTurn'}`), translated by the client for
 *      the same reason. `errorText()` on the client has a readable fallback, so
 *      a code it has never seen is still a sentence rather than a blank box.
 *
 * Mounting: `app.use('/games/uno', uno.handle)` BEFORE `express.json()`. Express
 * strips the mount prefix from `req.url`, so the routes below are the same paths
 * the standalone server used, and mounting before the JSON body parser keeps the
 * request stream intact for `readBody()`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, 'public', 'uno');

const COLORS = ['red', 'yellow', 'green', 'blue'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Active rooms, keyed by pairing code. In memory: a restart ends live games. */
const rooms = new Map();

/* ------------------------------------------------------------------ limits */
/**
 * This endpoint is public and unauthenticated — anyone can POST /api/create and
 * make the server hold a room forever. The standalone build had no cap because
 * it was a private link; on the real site it is a free memory-exhaustion lever,
 * so both a global room cap and a per-IP creation rate are enforced here.
 */
const MAX_ROOMS = 200;
const CREATE_PER_HOUR = 30;
const createHits = new Map(); // ip -> [timestamps]

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

function buildDeck() {
  const deck = [];
  let n = 0;
  const add = (color, value) => deck.push({ id: 'k' + n++, color, value });
  for (const c of COLORS) {
    add(c, '0');
    for (let v = 1; v <= 9; v++) { add(c, String(v)); add(c, String(v)); }
    for (const v of ['skip', 'reverse', 'draw2']) { add(c, v); add(c, v); }
  }
  for (let i = 0; i < 4; i++) { add('wild', 'wild'); add('wild', 'wild4'); }
  return shuffle(deck);
}

/** A card as data, for the log. The client names it in the reader's language. */
const cardRef = (c) => ({ color: c.color, value: c.value });

/* ------------------------------------------------------------------ state */
function createRoom(hostName, hostAvatar) {
  const code = makeCode();
  const host = newPlayer(hostName, hostAvatar);
  const room = {
    code,
    hostId: host.id,
    players: [host],
    state: 'lobby',
    deck: [],
    discard: [],
    color: null,
    dir: 1,
    turn: 0,
    turnStart: now(),
    log: [],
    chat: [],
    winner: null,
    round: 0,
    createdAt: now(),
  };
  rooms.set(code, room);
  pushLog(room, { k: 'roomCreated', code });
  return room;
}

function newPlayer(name, avatar) {
  return {
    id: uid(),
    token: uid(),
    name: String(name || '').slice(0, 12).trim() || 'Player',
    avatar: avatar || '🙂',
    hand: [],
    conns: 0,
    disconnectedAt: 0,
    wins: 0,
    shouted: false,
  };
}

/** Append a structured event. Never a sentence — see the file header. */
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

/* ------------------------------------------------------------- game rules */
function topCard(room) {
  return room.discard[room.discard.length - 1];
}

function isPlayable(card, room) {
  if (room.state !== 'playing') return false;
  const top = topCard(room);
  if (!top) return true;
  if (card.color === 'wild') return true;
  if (card.color === room.color) return true;
  if (card.value === top.value) return true;
  return false;
}

function drawFromDeck(room, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      // reshuffle the discard pile, keep the visible top card
      if (room.discard.length <= 1) break;
      const top = room.discard.pop();
      const recycled = room.discard.splice(0, room.discard.length);
      room.deck = shuffle(recycled.map((c) => ({ ...c })));
      room.discard = [top];
      pushLog(room, { k: 'deckRecycled' });
    }
    if (room.deck.length === 0) break;
    out.push(room.deck.pop());
  }
  return out;
}

function startGame(room) {
  room.deck = buildDeck();
  room.discard = [];
  room.state = 'playing';
  room.dir = 1;
  room.turn = 0;
  room.winner = null;
  room.round += 1;
  room.turnStart = now();
  for (const p of room.players) {
    p.hand = room.deck.splice(0, 7);
    p.shouted = false;
  }
  // The opening card is always a plain number card, so nobody is hit by a +2
  // before their first turn. Wilds and actions go back under the deck.
  let first = room.deck.pop();
  let guard = 0;
  while (first && (first.color === 'wild' || ['skip', 'reverse', 'draw2'].includes(first.value)) && guard++ < 60) {
    room.deck.unshift(first);
    first = room.deck.pop();
  }
  room.discard = [first || { id: 'fallback', color: 'red', value: '7' }];
  room.color = room.discard[0].color;
  pushLog(room, {
    k: 'roundStart', round: room.round, name: room.players[0].name, card: cardRef(room.discard[0]),
  });
}

function advance(room, steps = 1) {
  const n = room.players.length;
  if (n === 0) return;
  room.turn = ((room.turn + room.dir * steps) % n + n) % n;
  room.turnStart = now();
  room.players.forEach((p) => { p.shouted = false; });
}

function playerAt(room, offset) {
  const n = room.players.length;
  return room.players[((room.turn + room.dir * offset) % n + n) % n];
}

function finishRound(room, winner) {
  room.state = 'ended';
  room.winner = winner.id;
  winner.wins += 1;
  pushLog(room, { k: 'win', name: winner.name, round: room.round });
}

function playCard(room, player, cardId, chosenColor) {
  if (room.state !== 'playing') return { error: 'notStarted' };
  if (room.players[room.turn].id !== player.id) return { error: 'notYourTurn' };
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { error: 'cardNotInHand' };
  const card = player.hand[idx];
  if (!isPlayable(card, room)) return { error: 'cardNotPlayable' };

  player.hand.splice(idx, 1);
  room.discard.push(card);
  if (card.color === 'wild') {
    room.color = COLORS.includes(chosenColor) ? chosenColor : COLORS[rnd(4)];
  } else {
    room.color = card.color;
  }

  const who = player.name;
  if (player.hand.length === 0) {
    pushLog(room, { k: 'lastCardOut', who, card: cardRef(card) });
    finishRound(room, player);
    return { ok: true };
  }

  let steps = 1;
  if (card.value === 'skip') {
    const victim = playerAt(room, 1);
    pushLog(room, { k: 'skip', who, card: cardRef(card), victim: victim.name });
    steps = 2;
  } else if (card.value === 'reverse') {
    room.dir *= -1;
    if (room.players.length === 2) {
      pushLog(room, { k: 'reverseTwo', who, card: cardRef(card) });
      steps = 2;
    } else {
      pushLog(room, { k: 'reverse', who, card: cardRef(card) });
      steps = 1;
    }
  } else if (card.value === 'draw2') {
    const victim = playerAt(room, 1);
    victim.hand.push(...drawFromDeck(room, 2));
    pushLog(room, { k: 'draw2', who, card: cardRef(card), victim: victim.name });
    steps = 2;
  } else if (card.value === 'wild4') {
    const victim = playerAt(room, 1);
    victim.hand.push(...drawFromDeck(room, 4));
    pushLog(room, { k: 'wild4', who, color: room.color, victim: victim.name });
    steps = 2;
  } else if (card.value === 'wild') {
    pushLog(room, { k: 'wild', who, color: room.color });
  } else {
    pushLog(room, { k: 'play', who, card: cardRef(card) });
  }

  advance(room, steps);
  if (player.hand.length === 1) pushLog(room, { k: 'oneLeft', who });
  return { ok: true };
}

function drawCard(room, player) {
  if (room.state !== 'playing') return { error: 'notStarted' };
  if (room.players[room.turn].id !== player.id) return { error: 'notYourTurn' };
  const got = drawFromDeck(room, 1);
  if (!got.length) {
    pushLog(room, { k: 'deckEmptyDraw', name: player.name });
    advance(room, 1);
    return { ok: true };
  }
  player.hand.push(got[0]);
  pushLog(room, { k: 'draw', name: player.name });
  // Drawing ALWAYS ends the turn, even when the card drawn happens to be
  // playable (operator's rule, 2026-10-21: "he cannot discard at that turn").
  // The old code kept the turn so she could immediately play what she drew,
  // which turned Draw into a free look at the deck: draw until you like the
  // card. The drawn card stays in her hand for her NEXT turn.
  advance(room, 1);
  return { ok: true };
}

/*
 * There is no `pass` action, deliberately. A UNO turn ends by playing a card or
 * by drawing one — and the pass that used to sit here let a player skip WITHOUT
 * drawing, which is not UNO and could stall a table indefinitely: nobody's hand
 * changes, the discard never changes, and the turn just goes round. Drawing is
 * the way to decline, and it ends the turn whether or not the card suits her.
 */

/* -------------------------------------------------------------- broadcast */
function stateFor(room, viewer) {
  const turnPlayer = room.players[room.turn];
  const top = topCard(room);
  return {
    code: room.code,
    state: room.state,
    color: room.color,
    dir: room.dir,
    turn: turnPlayer ? turnPlayer.id : null,
    turnName: turnPlayer ? turnPlayer.name : '',
    turnStart: room.turnStart,
    hostId: room.hostId,
    winner: room.winner,
    round: room.round,
    deckCount: room.deck.length,
    discardTop: top ? { id: top.id, color: top.color, value: top.value } : null,
    discardCount: room.discard.length,
    you: {
      id: viewer.id,
      name: viewer.name,
      avatar: viewer.avatar,
      isTurn: !!(turnPlayer && turnPlayer.id === viewer.id),
      hand: viewer.hand.map((c) => ({
        id: c.id, color: c.color, value: c.value, playable: isPlayable(c, room),
      })),
      canStart: room.state !== 'playing' && room.hostId === viewer.id && room.players.length >= 2,
    },
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, count: p.hand.length,
      connected: p.conns > 0, wins: p.wins,
      isTurn: !!(turnPlayer && turnPlayer.id === p.id),
      isHost: p.id === room.hostId,
    })),
    log: room.log.slice(-14),
    chat: room.chat.slice(-20),
  };
}

function broadcast(room, extra) {
  const streams = getStreams(room);
  for (const p of room.players) {
    const payload = stateFor(room, p);
    if (extra) payload.event = extra;
    const data = 'data: ' + JSON.stringify(payload) + '\n\n';
    for (const res of streams.get(p.id) || []) {
      try { res.write(data); } catch (e) { /* dropped */ }
    }
  }
}

function getStreams(room) {
  if (!room.streams) room.streams = new Map();
  return room.streams;
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
};

/**
 * The client is one HTML file. A shared link is /games/uno/ABCD, which is not a
 * file, so a four-letter path falls back to the client and the code is read out
 * of the URL — the same trick the standalone build used.
 */
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
    return json(res, 200, { ok: true, rooms: rooms.size, uptime: process.uptime() });
  }

  if (p === '/api/create' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom(body.name, body.avatar);
    const host = room.players[0];
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar,
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
    const player = newPlayer(name, body.avatar);
    room.players.push(player);
    pushLog(room, { k: 'join', name: player.name });
    broadcast(room, { type: 'join', name: player.name });
    return json(res, 200, {
      code: room.code, token: player.token, playerId: player.id,
      name: player.name, avatar: player.avatar,
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
      if (room.players.length < 2) return json(res, 400, { error: 'needTwoPlayers' });
      if (room.state === 'playing') return json(res, 400, { error: 'alreadyPlaying' });
      startGame(room);
      broadcast(room, { type: 'start' });
      return json(res, 200, { ok: true });
    }

    if (type === 'play') {
      const r = playCard(room, player, body.cardId, body.color);
      if (r.error) return json(res, 400, r);
      broadcast(room, { type: 'play', by: player.name });
      return json(res, 200, r);
    }

    if (type === 'draw') {
      const r = drawCard(room, player);
      if (r.error) return json(res, 400, r);
      broadcast(room, { type: 'draw', by: player.name });
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
      const emoji = String(body.emoji || 'UNO!').slice(0, 12);
      room.chat.push({
        t: now(), id: player.id, name: player.name, avatar: player.avatar, text: emoji, kind: 'shout',
      });
      if (room.chat.length > 60) room.chat.shift();
      broadcast(room, { type: 'shout', by: player.name, emoji });
      return json(res, 200, { ok: true });
    }

    if (type === 'again') {
      if (room.hostId !== player.id) return json(res, 403, { error: 'onlyHost' });
      startGame(room);
      broadcast(room, { type: 'start' });
      return json(res, 200, { ok: true });
    }

    if (type === 'leave') {
      const idx = room.players.findIndex((x) => x.id === player.id);
      if (idx >= 0) {
        room.players.splice(idx, 1);
        pushLog(room, { k: 'leave', name: player.name });
        if (room.turn >= room.players.length) room.turn = 0;
        if (room.hostId === player.id && room.players.length) room.hostId = room.players[0].id;
        if (room.players.length === 0) {
          rooms.delete(room.code);
          return json(res, 200, { ok: true });
        }
        if (room.state === 'playing' && room.players.length < 2) {
          room.state = 'lobby';
          pushLog(room, { k: 'backToLobby' });
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
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
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

    const streams = getStreams(room);
    if (!streams.has(player.id)) streams.set(player.id, new Set());
    streams.get(player.id).add(res);
    player.conns += 1;
    player.disconnectedAt = 0;
    broadcast(room, { type: 'sync' });

    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) { /* ignore */ }
    }, 15000);

    const cleanup = () => {
      clearInterval(hb);
      const set = streams.get(player.id);
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
/**
 * One timer for the whole process, started on first require. `unref()` so it can
 * never hold the app open on shutdown — the test suites spawn and kill servers,
 * and a referenced interval turns that into a hang.
 */
setInterval(() => {
  const t = now();
  for (const room of [...rooms.values()]) {
    // Auto-play for someone who dropped mid-turn, so the table never stalls.
    if (room.state === 'playing') {
      const cur = room.players[room.turn];
      if (cur && cur.conns === 0 && cur.disconnectedAt && t - cur.disconnectedAt > 25000) {
        pushLog(room, { k: 'autoPass', name: cur.name });
        // Just move on. This used to `drawFromDeck(room, 1)` and discard the
        // result — the card left the deck and reached nobody, which is a slow
        // leak that looks like the deck thinning for no reason. An absent
        // player is skipped; she is not dealt a card she cannot see.
        advance(room, 1);
        broadcast(room, { type: 'autopass' });
      }
    }
    const allGone = room.players.every((p) => p.conns === 0 && p.disconnectedAt && t - p.disconnectedAt > 30 * 60 * 1000);
    if (allGone || room.players.length === 0) rooms.delete(room.code);
  }
  // Keep the per-IP creation ledger from growing without bound.
  if (createHits.size > 5000) {
    const cutoff = t - 60 * 60 * 1000;
    for (const [ip, hits] of createHits) {
      if (!hits.some((x) => x > cutoff)) createHits.delete(ip);
    }
  }
}, 5000).unref();

// The room functions are exported so the rules can be tested with no browser
// and no HTTP — same reason bigtwo.js exports its hand evaluator. A rule that is
// wrong is silently wrong: the game still deals and still declares a winner.
module.exports = {
  handle, rooms, createRoom, startGame, drawCard, playCard, advance, isPlayable,
};
