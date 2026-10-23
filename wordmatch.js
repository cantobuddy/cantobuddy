/**
 * CantoBuddy — Word match (配對), a two-player race on the vocabulary list.
 *
 * WHAT IT IS. A Cantonese word appears; both players see four meanings and race
 * to tap the right one. First correct answer takes the round. Tap wrong and you
 * are locked out of that round, so guessing is punished rather than free.
 * Eight rounds, highest score wins.
 *
 * WHY THE OPTIONS ARE PER-PLAYER. The app ships four learner languages, and two
 * people in the same room may not share one — a Filipino helper and her
 * Indonesian friend, or a Cantonese-speaking employer watching. Each player is
 * sent the four options labelled in THEIR language, so nobody is asked to
 * compete in a language they cannot read. The option IDS are shared, so "the
 * third option" is the same word for both; only the label differs.
 *
 * THE ANSWER IS NOT IN THE PAYLOAD. This is the one thing a quiz game must get
 * right: while a round is live, `stateFor` sends the four options WITHOUT a
 * `correct` flag. A client could otherwise read the answer out of the network
 * response and win every round without knowing a word. The flag appears only in
 * the reveal, after the round is decided. `tools/wordmatch-test.js` pins this.
 *
 * The same rule applies to the QUESTION. `room.prompt` carries `vocabId` for the
 * server's own use, but `stateFor` deliberately does not forward it: the options
 * travel as `{ id, label }`, so a prompt that also named its vocabulary id would
 * hand the client `prompt.vocabId === options[i].id` — the answer, in one
 * comparison, without ever showing a `correct` flag. The prompt goes out as text
 * only: cantonese, jyutping, emoji, level.
 *
 * DISTRACTORS ARE DEDUPED IN EVERY LANGUAGE. Two different words can share a
 * meaning ("Hello" / "Hi"), and a distractor that reads the same as the correct
 * answer would make two options right. Candidates are checked against every
 * language present in the room, not just one.
 *
 * Structured log, no sentences: same rule as the other two games — the client
 * names events in its own language.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./db');

const PUBLIC = path.join(__dirname, 'public', 'wordmatch');

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 2;          // "race a partner" — a duel, not a party
const ROUNDS = 8;
const OPTIONS = 4;              // one right, three wrong
const ASK_MS = 20000;           // per-round deadline, so an AFK player cannot stall
const REVEAL_MS = 2200;         // long enough to read who won and why
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** The meaning a given language shows. English is the guaranteed column. */
function meaningOf(row, lang) {
  if (!row) return '';
  if (lang === 'zh') return String(row.mandarin || row.english || '').trim();
  if (lang === 'fil') return String(row.tagalog || row.english || '').trim();
  if (lang === 'id') return String(row.indonesian || row.english || '').trim();
  return String(row.english || '').trim();
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* --------------------------------------------------------------- the pool */
/**
 * The words a round can draw from. Read fresh at the start of each game rather
 * than cached for the life of the process, so a category the operator switches
 * off in the admin is genuinely out of the pool for the next game — the same
 * reason `/api/vocabulary` filters.
 */
function loadPool() {
  let rows;
  try {
    rows = store.listVocabulary({ enabledOnly: true });
  } catch (e) {
    return [];
  }
  // A row is only usable if the prompt and at least the English meaning exist.
  // Every shipped row has all four languages, but a hand-added one may not, and
  // a blank option would be an unanswerable round.
  return rows.filter((r) => String(r.cantonese || '').trim() && meaningOf(r, 'en'));
}

/* ------------------------------------------------------------------ rooms */
function newPlayer(name, avatar, lang) {
  return {
    id: uid(),
    token: uid(),
    name: String(name || '').slice(0, 12).trim() || 'Player',
    avatar: String(avatar || '🙂').slice(0, 8),
    lang: LANGS.includes(lang) ? lang : 'en',
    conns: 0,
    disconnectedAt: 0,
    score: 0,
    wins: 0,          // games won, kept across a rematch
    /** Locked out of the current round after a wrong answer. */
    locked: false,
    /** What this player answered this round, for the reveal. */
    answerId: null,
    answeredAt: 0,
  };
}

function createRoom(hostName, hostAvatar, hostLang) {
  const code = makeCode();
  const host = newPlayer(hostName, hostAvatar, hostLang);
  const room = {
    code,
    hostId: host.id,
    players: [host],
    state: 'lobby',            // lobby | asking | reveal | ended
    round: 0,
    totalRounds: ROUNDS,
    /** { vocabId, cantonese, jyutping, emoji, level } — the question. */
    prompt: null,
    /** The four vocabulary ids, correct one included. Never send `correct` early. */
    options: [],
    /** Server-side only. Never serialized — see `stateFor`. */
    correctId: null,
    /** { winnerId, winnerName, correctId, reason } once a round is decided. */
    result: null,
    /** Vocabulary ids already used this game, so a word cannot repeat. */
    used: [],
    roundDeadline: 0,
    revealUntil: 0,
    log: [],
    chat: [],
    winner: null,
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
    const player = findPlayer(room, token);
    if (player) return { room, player };
  }
  return null;
}

/* ------------------------------------------------------------------ rounds */
/**
 * Choose four options: the right answer plus three distractors that read
 * DIFFERENTLY from it and from each other in every language the room speaks.
 *
 * The per-language check is the part that is easy to skip and wrong to skip.
 * "Hello" and "Hi" are separate rows; in English a distractor like that would
 * give the round two defensible answers. Because the two players may read
 * different columns, the check has to pass in all of them, not just the asker's.
 */
function pickOptions(room, correctRow, pool) {
  const langs = [...new Set(room.players.map((p) => p.lang))];
  const chosen = [correctRow];
  const taken = {};
  for (const L of langs) taken[L] = new Set([norm(meaningOf(correctRow, L))]);

  const candidates = shuffle(pool.filter((r) =>
    r.id !== correctRow.id && norm(r.cantonese) !== norm(correctRow.cantonese)));

  for (const row of candidates) {
    if (chosen.length >= OPTIONS) break;
    let clash = false;
    for (const L of langs) {
      const label = norm(meaningOf(row, L));
      if (!label || taken[L].has(label)) { clash = true; break; }
    }
    if (clash) continue;
    chosen.push(row);
    for (const L of langs) taken[L].add(norm(meaningOf(row, L)));
  }
  return shuffle(chosen);
}

/** Start the next round, or end the game if the rounds are used up. */
function nextRound(room) {
  if (room.round >= room.totalRounds) return finishGame(room);

  const pool = loadPool();
  if (pool.length < OPTIONS) {
    // Not enough usable vocabulary to build a round. End rather than deal an
    // unanswerable question — and say so, instead of looking like a freeze.
    room.state = 'ended';
    room.winner = null;
    room.result = { reason: 'notEnoughWords' };
    pushLog(room, { k: 'ended', reason: 'notEnoughWords' });
    broadcast(room, { type: 'ended' });
    return;
  }

  const fresh = pool.filter((r) => !room.used.includes(r.id));
  // If the unused tail is short, allow repeats rather than refuse to continue.
  const source = fresh.length >= 1 ? fresh : pool;
  const correctRow = source[rnd(source.length)];

  room.round += 1;
  room.used.push(correctRow.id);
  room.prompt = {
    vocabId: correctRow.id,
    cantonese: String(correctRow.cantonese || ''),
    jyutping: String(correctRow.jyutping || ''),
    emoji: String(correctRow.emoji || ''),
    level: correctRow.level,
  };
  room.options = pickOptions(room, correctRow, pool).map((r) => r.id);
  room.correctId = correctRow.id;
  room.result = null;
  room.state = 'asking';
  room.roundDeadline = now() + ASK_MS;
  room.revealUntil = 0;
  for (const p of room.players) { p.locked = false; p.answerId = null; p.answeredAt = 0; }

  pushLog(room, { k: 'roundStart', round: room.round, word: room.prompt.cantonese });
  broadcast(room, { type: 'round' });
}

function startGame(room) {
  room.state = 'asking';
  room.round = 0;
  room.used = [];
  room.winner = null;
  room.result = null;
  for (const p of room.players) { p.score = 0; p.locked = false; p.answerId = null; }
  pushLog(room, { k: 'start' });
  nextRound(room);
}

/**
 * Decide the round and move to the reveal.
 *
 * `reason` is one of 'correct' (someone got it), 'bothWrong', or 'timeout'.
 * The reveal is a distinct state, not an immediate jump to the next round: both
 * players need to see WHICH answer was right, or the wrong answer teaches
 * nothing and the game is just a buzzer.
 */
function endRound(room, winnerId, reason) {
  if (room.state !== 'asking') return;
  room.state = 'reveal';
  const winner = winnerId ? room.players.find((p) => p.id === winnerId) : null;
  if (winner) winner.score += 1;
  room.result = {
    winnerId: winner ? winner.id : null,
    winnerName: winner ? winner.name : '',
    correctId: room.correctId,
    reason,
  };
  room.revealUntil = now() + REVEAL_MS;
  pushLog(room, { k: 'roundEnd', round: room.round, winner: winner ? winner.name : '', reason });
  broadcast(room, { type: 'reveal' });
}

function finishGame(room) {
  room.state = 'ended';
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const tie = sorted.length > 1 && sorted[1].score === top.score;
  room.winner = tie ? null : (top ? top.id : null);
  if (!tie && top) top.wins += 1;
  room.result = {
    winnerId: room.winner,
    winnerName: room.winner ? top.name : '',
    tie,
    scores: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    reason: 'finished',
  };
  pushLog(room, { k: 'ended', winner: room.winner ? top.name : '', tie });
  broadcast(room, { type: 'ended' });
}

/* --------------------------------------------------------------- serialize */
/**
 * What one player is allowed to see. Personalised twice over: the option
 * LABELS are in the viewer's language, and `correct` is withheld until the
 * round is decided.
 */
function stateFor(room, viewer) {
  const revealing = room.state === 'reveal' || room.state === 'ended';
  const byId = new Map();
  if (room.options.length) {
    // Only the four option rows are needed for labels, so re-read just those.
    try {
      for (const id of room.options) {
        const row = store.getVocabulary(id);
        if (row) byId.set(id, row);
      }
    } catch (e) { /* leave labels empty rather than throw a state */ }
  }

  return {
    code: room.code,
    state: room.state,
    round: room.round,
    totalRounds: room.totalRounds,
    hostId: room.hostId,
    winner: room.winner,
    serverNow: now(),
    roundDeadline: room.roundDeadline,
    you: {
      id: viewer.id,
      name: viewer.name,
      avatar: viewer.avatar,
      lang: viewer.lang,
      score: viewer.score,
      locked: viewer.locked,
      answeredId: viewer.answerId,
      isHost: viewer.id === room.hostId,
      canStart: room.state !== 'asking' && room.state !== 'reveal'
        && viewer.id === room.hostId && room.players.length >= MIN_PLAYERS,
    },
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, wins: p.wins,
      connected: p.conns > 0, isHost: p.id === room.hostId,
      // Whether the other player has locked in is public — that is the race.
      // WHAT they answered is not.
      locked: p.locked,
      answered: p.answerId !== null,
    })),
    // Text only — NOT `vocabId`. The options go out as { id, label }, so
    // including the prompt's id here would make `prompt.vocabId ===
    // options[i].id` the answer. See the file header.
    prompt: room.state === 'lobby' || !room.prompt ? null : {
      cantonese: room.prompt.cantonese,
      jyutping: room.prompt.jyutping,
      emoji: room.prompt.emoji,
      level: room.prompt.level,
    },
    // No `correct` flag here. See the file header.
    options: room.state === 'lobby' ? [] : room.options.map((id) => ({
      id,
      label: meaningOf(byId.get(id), viewer.lang),
    })),
    // Only in the reveal, once the round can no longer be won.
    result: revealing && room.result ? room.result : null,
    log: room.log.slice(-18),
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
    return json(res, 200, { ok: true, game: 'wordmatch', rooms: rooms.size, uptime: process.uptime() });
  }

  if (p === '/api/create' && req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!allowCreate(ip)) return json(res, 429, { error: 'tooManyRooms' });
    const body = await readBody(req);
    const room = createRoom(body.name, body.avatar, body.lang);
    const host = room.players[0];
    return json(res, 200, {
      code: room.code, token: host.token, playerId: host.id,
      name: host.name, avatar: host.avatar, lang: host.lang,
    });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: 'roomNotFound' });
    if (room.players.length >= MAX_PLAYERS) return json(res, 409, { error: 'roomFull' });
    if (room.state === 'asking' || room.state === 'reveal') return json(res, 409, { error: 'alreadyPlaying' });
    const name = String(body.name || '').slice(0, 12).trim();
    if (!name) return json(res, 400, { error: 'nameRequired' });
    if (room.players.some((x) => x.name === name)) return json(res, 409, { error: 'nameTaken' });
    const player = newPlayer(name, body.avatar, body.lang);
    room.players.push(player);
    pushLog(room, { k: 'join', name: player.name });
    broadcast(room, { type: 'join', name: player.name });
    return json(res, 200, {
      code: room.code, token: player.token, playerId: player.id,
      name: player.name, avatar: player.avatar, lang: player.lang,
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
      if (room.state === 'asking' || room.state === 'reveal') {
        return json(res, 400, { error: 'alreadyPlaying' });
      }
      startGame(room);
      return json(res, 200, { ok: true });
    }

    // ---- the race -----------------------------------------------------
    if (type === 'answer') {
      if (room.state !== 'asking') return json(res, 400, { error: 'noRound' });
      if (player.locked) return json(res, 400, { error: 'lockedOut' });
      if (player.answerId !== null) return json(res, 400, { error: 'alreadyAnswered' });

      const id = Number(body.vocabId);
      if (!room.options.includes(id)) return json(res, 400, { error: 'badOption' });

      player.answerId = id;
      player.answeredAt = now();

      if (id === room.correctId) {
        // FIRST correct answer wins. The state check above means a second
        // player can only get here while the round is still 'asking', so the
        // race is decided by which request the server handled first.
        endRound(room, player.id, 'correct');
        return json(res, 200, { ok: true, correct: true });
      }

      player.locked = true;
      pushLog(room, { k: 'wrong', name: player.name, round: room.round });
      const allLocked = room.players.every((p) => p.locked || p.answerId !== null);
      if (allLocked) endRound(room, null, 'bothWrong');
      else broadcast(room, { type: 'wrong', by: player.name });
      return json(res, 200, { ok: true, correct: false });
    }

    // ---- chat and emoji: same caps as the other two tables --------------
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
      room.chat.push({
        t: now(), id: player.id, name: player.name, avatar: player.avatar, text: emoji, kind: 'shout',
      });
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
        // A duel with one seat left cannot continue; drop back to the lobby
        // rather than leave a round nobody can win.
        if (room.state === 'asking' || room.state === 'reveal') {
          room.state = 'lobby';
          room.round = 0;
          room.prompt = null;
          room.options = [];
          room.result = null;
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
 * One unref'd timer for the process, at 400ms rather than the 5s the card games
 * use: this game is built on a 20s deadline and a 2.2s reveal, and a 5s tick
 * would make both feel arbitrary. Two state transitions live here —
 *
 *   asking  -> the deadline passes, nobody got it: end the round as a timeout,
 *              so an idle or disconnected player cannot freeze the game.
 *   reveal  -> the reveal has been on screen long enough: deal the next round.
 *
 * Rooms where everyone has gone are dropped, same as the other tables.
 */
setInterval(() => {
  const t = now();
  for (const room of [...rooms.values()]) {
    if (room.state === 'asking' && room.roundDeadline && t > room.roundDeadline) {
      endRound(room, null, 'timeout');
    } else if (room.state === 'reveal' && room.revealUntil && t > room.revealUntil) {
      nextRound(room);
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
}, 400).unref();

module.exports = {
  handle, rooms,
  // Exported so the option-picking and the language fallback can be tested
  // without a server or a browser — they are the parts that are silently wrong.
  pickOptions, meaningOf, stateFor, createRoom, startGame, endRound, nextRound,
  ROUNDS, OPTIONS, MIN_PLAYERS, MAX_PLAYERS, ASK_MS, REVEAL_MS,
};
