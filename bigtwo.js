'use strict';
/**
 * CantoBuddy — the Big Two table (鋤大D / 大老二), served inside the app.
 *
 * Same transport and same protocol as `uno.js`, deliberately: Server-Sent Events
 * for server -> client, JSON POST for client -> server, no WebSocket upgrade.
 * Read the header of `uno.js` first — the two rules it sets out apply here too:
 *
 *   1. The log is STRUCTURED EVENTS (`{k:'play', who, cards, type}`), never
 *      sentences. A room can hold a Filipino and an Indonesian reader at once,
 *      so the client renders each event through its own dictionary.
 *   2. Errors are CODES (`{error:'doesNotBeat'}`), translated by the client.
 *
 * Mounted at `/games/bigtwo` BEFORE `express.json()` — `readBody()` reads the
 * raw request stream, and a body parser mounted first would consume it.
 *
 * ---------------------------------------------------------------- the rules
 * Hong Kong / Cantonese Big Two, the version played in a Hong Kong home:
 *
 *   Ranks   3 4 5 6 7 8 9 10 J Q K A 2      (2 is the HIGHEST, 3 the lowest)
 *   Suits   ♦ < ♣ < ♥ < ♠                   (spades highest)
 *
 * A card's strength is its rank first, then its suit — so 2♠ beats 2♥, and any
 * 2 beats any A.
 *
 * Playable hands: single, pair, triple, and five-card hands. Five-card hands are
 * ranked by CLASS first and only then by their own cards:
 *
 *   straight (順子) < flush (同花) < full house (俘虜) < four of a kind (四條)
 *   < straight flush (同花順)
 *
 * So a flush of low cards beats a straight of high ones — that is the rule
 * people most often get wrong, and it is why `cls` exists below.
 *
 * Two decisions worth knowing:
 *   - A play must be the SAME SIZE as the one it beats, so a five-card hand can
 *     never be answered with a pair, and a four-of-a-kind cannot "bomb" a pair.
 *   - The 2 cannot appear in a straight. Straights run 3-4-5-6-7 up to
 *     10-J-Q-K-A; there is no A-2-3-4-5 "wheel" in this version.
 *
 * Everyone is dealt 13 cards whatever the table size (2–4), so the hand always
 * looks the same and the classic 3♦ opener exists in a four-player game. With
 * fewer players the unused cards stay out of play and the opener is whoever
 * holds the lowest card actually dealt.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, 'public', 'bigtwo');

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const HAND_SIZE = 13;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Active rooms, keyed by pairing code. In memory: a restart ends live games. */
const rooms = new Map();

/* ------------------------------------------------------------------ limits */
/** Public and unauthenticated — same caps as the UNO table, and for the same reason. */
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

/* ------------------------------------------------------------------- deck */
/**
 * Ranks are stored as numbers so that "stronger" is just `>`:
 * 3..10 keep their value, J=11 Q=12 K=13 A=14 2=15.
 * Suits: 0 ♦, 1 ♣, 2 ♥, 3 ♠ — again ascending strength.
 */
const SUITS = [0, 1, 2, 3];
const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function buildDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) deck.push({ id: `r${rank}s${suit}`, rank, suit });
  }
  return shuffle(deck);
}

/** A card as data, for the log and the wire. The client names it in its language. */
const cardRef = (c) => ({ id: c.id, rank: c.rank, suit: c.suit });
const cardRefs = (cs) => cs.map(cardRef);

/** Strength order: rank first, then suit. Used everywhere, so it lives once. */
function cardCmp(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.suit - b.suit;
}

function keyCmp(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

/* --------------------------------------------------------------- evaluate */
/**
 * Class of a five-card hand. The ORDER IS THE RULE — a bigger number beats a
 * smaller one regardless of the cards' ranks. Do not renumber casually.
 */
const CLASS = { straight: 1, flush: 2, fullhouse: 3, quads: 4, straightflush: 5 };
const CLASS_NAME = { 1: 'straight', 2: 'flush', 3: 'fullhouse', 4: 'quads', 5: 'straightflush' };

/**
 * Turn 1–5 cards into a playable hand, or null if they do not form one.
 * Returns `{ type, cls, size, key:[rank, suit], cards }`:
 *   - `type` is what the player played ('single', 'pair', …)
 *   - `cls`  is only meaningful for five-card hands
 *   - `key`  is what two hands of the same type are compared on
 */
function evaluate(cards) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) return null;
  const size = cards.length;
  const sorted = [...cards].sort(cardCmp); // weakest first
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);

  if (size === 1) {
    return { type: 'single', cls: 0, size, key: [ranks[0], suits[0]], cards: sorted };
  }
  if (size === 2) {
    if (ranks[0] !== ranks[1]) return null;
    return { type: 'pair', cls: 0, size, key: [ranks[1], suits[1]], cards: sorted };
  }
  if (size === 3) {
    if (!(ranks[0] === ranks[1] && ranks[1] === ranks[2])) return null;
    return { type: 'triple', cls: 0, size, key: [ranks[2], suits[2]], cards: sorted };
  }

  // ---- five cards
  // The guard is not cosmetic: without it a four-of-a-kind walks into the
  // pattern test below and comes back as a legal 'quads' play of FOUR cards,
  // and four cards of one suit come back as a 'flush'. The suite caught both.
  if (size !== 5) return null;
  const distinct = counts.size === 5;
  const isFlush = suits.every((s) => s === suits[0]);
  // No wheel and no 2: a straight's top card can be at most an Ace (14).
  const isStraight = distinct && ranks[4] - ranks[0] === 4 && ranks[4] <= 14;
  const pattern = [...counts.values()].sort((a, b) => b - a); // e.g. [3,2]
  const top = [ranks[4], suits[4]]; // the strongest card, for straight/flush

  if (isStraight && isFlush) {
    return { type: 'straightflush', cls: CLASS.straightflush, size, key: top, cards: sorted };
  }
  if (pattern[0] === 4) {
    const quad = [...counts.entries()].find(([, n]) => n === 4)[0];
    return { type: 'quads', cls: CLASS.quads, size, key: [quad, 0], cards: sorted };
  }
  if (pattern[0] === 3 && pattern[1] === 2) {
    const trip = [...counts.entries()].find(([, n]) => n === 3)[0];
    return { type: 'fullhouse', cls: CLASS.fullhouse, size, key: [trip, 0], cards: sorted };
  }
  if (isFlush) {
    return { type: 'flush', cls: CLASS.flush, size, key: top, cards: sorted };
  }
  if (isStraight) {
    return { type: 'straight', cls: CLASS.straight, size, key: top, cards: sorted };
  }
  return null;
}

/**
 * Does `a` beat `b`? `b === null` means the player is leading, so anything legal
 * beats nothing. Size must match; five-card hands compare by class first.
 */
function beats(a, b) {
  if (!a) return false;
  if (!b) return true;
  if (a.size !== b.size) return false;
  if (a.size === 5) {
    if (a.cls !== b.cls) return a.cls > b.cls;
    return keyCmp(a.key, b.key) > 0;
  }
  if (a.type !== b.type) return false;
  return keyCmp(a.key, b.key) > 0;
}

/* ------------------------------------------------------------------ state */
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
    finished: false,
  };
}

function createRoom(hostName, hostAvatar) {
  const code = makeCode();
  const host = newPlayer(hostName, hostAvatar);
  const room = {
    code,
    hostId: host.id,
    players: [host],
    state: 'lobby',   // lobby | playing | ended
    turn: 0,
    turnStart: now(),
    /** The play to beat. `null` means the player whose turn it is must lead. */
    trick: null,      // { by, play, byName }
    /** Consecutive passes since the last play; all-but-one ends the trick. */
    passes: 0,
    /** The opening play must contain this card (the lowest one dealt). */
    opening: null,    // { playerId, cardId }
    log: [],
    winner: null,
    round: 0,
    createdAt: now(),
  };
  rooms.set(code, room);
  pushLog(room, { k: 'roomCreated', code });
  return room;
}

/** Append a structured event. Never a sentence — see the file header. */
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
    const p = findPlayer(room, token);
    if (p) return { room, player: p };
  }
  return null;
}

/* ------------------------------------------------------------- game rules */
function startGame(room) {
  const deck = buildDeck();
  room.state = 'playing';
  room.winner = null;
  room.round += 1;
  room.trick = null;
  room.passes = 0;
  room.turnStart = now();
  room.players.forEach((p) => { p.hand = []; p.finished = false; });

  // Round-robin, 13 each: every hand is the same size at every table size.
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of room.players) p.hand.push(deck.pop());
  }
  room.players.forEach((p) => p.hand.sort(cardCmp));

  // The holder of the lowest card leads and must open with it. With four
  // players that is always the 3♦; with two or three it is whatever lowest
  // card happened to be dealt.
  let lowest = null;
  let opener = room.players[0];
  for (const p of room.players) {
    for (const c of p.hand) {
      if (!lowest || cardCmp(c, lowest.card) < 0) lowest = { card: c, player: p };
    }
  }
  opener = lowest.player;
  room.opening = { playerId: opener.id, cardId: lowest.card.id };
  room.turn = room.players.indexOf(opener);

  pushLog(room, {
    k: 'roundStart', round: room.round, opener: opener.name, card: cardRef(lowest.card),
  });
}

/** The next player who still holds cards, starting after the current one. */
function nextActive(room, from) {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (room.players[i].hand.length > 0 && !room.players[i].finished) return i;
  }
  return from;
}

function activeCount(room) {
  return room.players.filter((p) => p.hand.length > 0 && !p.finished).length;
}

function finishGame(room, winner) {
  room.state = 'ended';
  room.winner = winner.id;
  winner.wins += 1;
  pushLog(room, { k: 'win', name: winner.name, round: room.round });
}

function playCards(room, player, cardIds) {
  if (room.state !== 'playing') return { error: 'notStarted' };
  if (room.players[room.turn].id !== player.id) return { error: 'notYourTurn' };
  if (!Array.isArray(cardIds) || cardIds.length === 0) return { error: 'nothingSelected' };

  // Every id must be a distinct card in this player's hand.
  const seen = new Set();
  const picked = [];
  for (const id of cardIds) {
    if (seen.has(id)) return { error: 'duplicateCard' };
    seen.add(id);
    const c = player.hand.find((x) => x.id === id);
    if (!c) return { error: 'notInHand' };
    picked.push(c);
  }

  const play = evaluate(picked);
  if (!play) return { error: 'invalidCombo' };
  if (!beats(play, room.trick ? room.trick.play : null)) return { error: 'doesNotBeat' };

  // The opening play of a game must contain the lowest card dealt.
  if (room.opening && room.opening.playerId === player.id) {
    if (!seen.has(room.opening.cardId)) return { error: 'mustIncludeLowest' };
  }

  for (const c of picked) player.hand.splice(player.hand.indexOf(c), 1);
  room.trick = { by: player.id, byName: player.name, play };
  room.passes = 0;
  if (room.opening && room.opening.playerId === player.id) room.opening = null;

  pushLog(room, {
    k: 'play', who: player.name, cards: cardRefs(play.cards), type: play.type,
  });

  if (player.hand.length === 0) {
    player.finished = true;
    finishGame(room, player);
    return { ok: true, play: play.type };
  }

  room.turn = nextActive(room, room.turn);
  room.turnStart = now();
  return { ok: true, play: play.type };
}

function passTurn(room, player) {
  if (room.state !== 'playing') return { error: 'notStarted' };
  if (room.players[room.turn].id !== player.id) return { error: 'notYourTurn' };
  // You cannot pass on a trick you are leading — there is nothing to beat.
  if (!room.trick) return { error: 'mustPlay' };

  room.passes += 1;
  pushLog(room, { k: 'pass', who: player.name });

  // Everyone else has passed: the last player to play takes the trick and leads.
  if (room.passes >= activeCount(room) - 1) {
    const leader = room.players.find((p) => p.id === room.trick.by);
    room.trick = null;
    room.passes = 0;
    pushLog(room, { k: 'trickWon', who: leader ? leader.name : '' });
    if (leader && leader.hand.length > 0) {
      room.turn = room.players.indexOf(leader);
      room.turnStart = now();
      return { ok: true, newTrick: true };
    }
  }

  room.turn = nextActive(room, room.turn);
  room.turnStart = now();
  return { ok: true };
}

/* -------------------------------------------------------------- broadcast */
function stateFor(room, viewer) {
  const turnPlayer = room.players[room.turn];
  return {
    code: room.code,
    state: room.state,
    turn: turnPlayer ? turnPlayer.id : null,
    turnName: turnPlayer ? turnPlayer.name : '',
    turnStart: room.turnStart,
    hostId: room.hostId,
    winner: room.winner,
    round: room.round,
    passes: room.passes,
    trick: room.trick ? {
      by: room.trick.by,
      byName: room.trick.byName,
      type: room.trick.play.type,
      cards: cardRefs(room.trick.play.cards),
    } : null,
    opening: room.opening && room.opening.playerId === viewer.id ? room.opening.cardId : null,
    you: {
      id: viewer.id,
      name: viewer.name,
      avatar: viewer.avatar,
      isTurn: !!(turnPlayer && turnPlayer.id === viewer.id),
      hand: viewer.hand.map(cardRef),
      canStart: room.state !== 'playing' && room.hostId === viewer.id
        && room.players.length >= MIN_PLAYERS,
      mustLead: !room.trick && room.state === 'playing',
    },
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, count: p.hand.length,
      connected: p.conns > 0, wins: p.wins, finished: p.finished,
      isTurn: !!(turnPlayer && turnPlayer.id === p.id),
      isHost: p.id === room.hostId,
    })),
    log: room.log.slice(-18),
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

/** A shared link is /games/bigtwo/ABCD — four letters fall back to the client. */
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
    return json(res, 200, { ok: true, game: 'bigtwo', rooms: rooms.size, uptime: process.uptime() });
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
    if (room.players.length >= MAX_PLAYERS) return json(res, 409, { error: 'roomFull' });
    if (room.state === 'playing') return json(res, 409, { error: 'alreadyPlaying' });
    const name = String(body.name || '').slice(0, 12).trim();
    if (!name) return json(res, 400, { error: 'nameRequired' });
    if (room.players.some((x) => x.name === name)) return json(res, 409, { error: 'nameTaken' });
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

    if (type === 'start' || type === 'again') {
      if (room.hostId !== player.id) return json(res, 403, { error: 'onlyHost' });
      if (room.players.length < MIN_PLAYERS) return json(res, 400, { error: 'needTwoPlayers' });
      if (room.state === 'playing') return json(res, 400, { error: 'alreadyPlaying' });
      startGame(room);
      broadcast(room, { type: 'start' });
      return json(res, 200, { ok: true });
    }

    if (type === 'play') {
      const r = playCards(room, player, body.cardIds);
      if (r.error) return json(res, 400, r);
      broadcast(room, { type: 'play', by: player.name });
      return json(res, 200, r);
    }

    if (type === 'pass') {
      const r = passTurn(room, player);
      if (r.error) return json(res, 400, r);
      broadcast(room, { type: 'pass', by: player.name });
      return json(res, 200, r);
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
        if (room.state === 'playing' && room.players.length < MIN_PLAYERS) {
          room.state = 'lobby';
          room.trick = null;
          room.passes = 0;
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
 * One unref'd timer for the process. A player who drops mid-turn must not stall
 * the table: after 25s they pass if there is something to beat, or play their
 * lowest single card if they are leading.
 */
setInterval(() => {
  const t = now();
  for (const room of [...rooms.values()]) {
    if (room.state === 'playing') {
      const cur = room.players[room.turn];
      if (cur && cur.conns === 0 && cur.disconnectedAt && t - cur.disconnectedAt > 25000) {
        if (room.trick) {
          room.passes += 1;
          pushLog(room, { k: 'autoPass', name: cur.name });
          if (room.passes >= activeCount(room) - 1) {
            const leader = room.players.find((p) => p.id === room.trick.by);
            room.trick = null;
            room.passes = 0;
            pushLog(room, { k: 'trickWon', who: leader ? leader.name : '' });
            if (leader && leader.hand.length > 0) room.turn = room.players.indexOf(leader);
          } else {
            room.turn = nextActive(room, room.turn);
          }
        } else {
          // Leading and gone: play the lowest card so the game can continue.
          const lowest = [...cur.hand].sort(cardCmp)[0];
          if (lowest) {
            cur.hand.splice(cur.hand.indexOf(lowest), 1);
            const play = evaluate([lowest]);
            room.trick = { by: cur.id, byName: cur.name, play };
            room.passes = 0;
            pushLog(room, { k: 'autoPlay', name: cur.name, cards: cardRefs([lowest]), type: 'single' });
            if (cur.hand.length === 0) { cur.finished = true; finishGame(room, cur); }
            else room.turn = nextActive(room, room.turn);
          }
        }
        room.turnStart = now();
        broadcast(room, { type: 'autopass' });
      }
    }
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
  // Exported so the rules can be tested without a server or a browser — a hand
  // evaluator is exactly the kind of thing that is wrong in one corner case.
  evaluate, beats, cardCmp, buildDeck, startGame, playCards, passTurn,
  CLASS, CLASS_NAME, MIN_PLAYERS, MAX_PLAYERS, HAND_SIZE,
};
