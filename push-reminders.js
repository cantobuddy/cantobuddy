'use strict';

/**
 * What to say, and when — the reminder planner.
 *
 * This module is pure. It has no database handle, no network, no clock of its
 * own: everything it needs arrives as arguments. That is deliberate, because
 * the only way to test a reminder ladder honestly is to be able to ask "what
 * would you send this device at 19:30 on day 7?" without a push service, a
 * subscriber, or waiting a week.
 *
 * Two rules shape everything here.
 *
 * **One message, one evening, one chance.** A helper works six days a week. A
 * notification that arrives while she is working is a notification she swipes
 * away, and the second one she swipes away is the one that gets notifications
 * turned off for good. So there is exactly one send window a day (19:20–19:59
 * HKT — her evening, after the family has eaten), exactly one message in it,
 * and the caller is expected to record the send so a second sweep cannot repeat
 * it. The window is 40 minutes wide on purpose: the sweep runs every ten, and
 * on a free-tier host a single missed tick must not cost her the one message
 * that day.
 *
 * **Specific or silent.** "Practise Cantonese" is the message that trains
 * people to mute an app. Every branch below carries something that is only
 * true of her — her streak length, the number of answers between her and her
 * next sticker, a headline that is actually new today, or one phrase for her
 * kitchen. When there is nothing specific and true to say, the planner returns
 * null and she is not disturbed. Silence is a valid output.
 *
 * The ladder, in order of what is worth saying:
 *
 *   streak   practised yesterday, not yet today  → "Day 12 — 2 minutes keeps it"
 *   new      idle 3+ days                        → "New today: <headline>"
 *   sticker  idle 7+ days                        → "3 answers from 🍚 食飯"
 *   phrase   idle 14+ days                       → one phrase, with audio
 *   (silence) idle 21+ days                      → stop entirely
 *
 * That last row matters as much as the others: a device that has been gone
 * three weeks is not won back by a fourth notification. It is only won back by
 * her own memory of the app, and continuing to push would just be noise on a
 * phone she has already decided about.
 */

const { SEED_STICKERS } = require('./stickers');

const HKT_OFFSET_MS = 8 * 3600000;
const DAY_MS = 24 * 3600000;

/** The one send window, in minutes after local midnight (HKT). */
const WINDOW_FROM = 19 * 60 + 20; // 19:20
const WINDOW_TO = 19 * 60 + 59; // 19:59

/** Idle thresholds, in whole days since her last practice. */
const RUNG_NEW = 3;
const RUNG_STICKER = 7;
const RUNG_PHRASE = 14;
const GIVE_UP = 21;

const LANGS = ['en', 'fil', 'zh', 'id'];

// ---------------------------------------------------------------------------
// Copy — four languages, because a Filipino helper reading English is the
// generic-notification failure in another form. Kept short: Android truncates
// a notification title at roughly 45 characters.
// ---------------------------------------------------------------------------
const COPY = {
  en: {
    streakTitle: 'Day {n} — 2 minutes keeps it',
    streakBody: 'Your streak is safe if you practise before midnight.',
    newTitle: 'New today: {title}',
    newBody: 'A two-minute read from Hong Kong.',
    stickerTitle: '{remaining} answers from {emoji} {cantonese}',
    stickerBody: 'Your next sticker is that close — a short quiz gets you there.',
    phraseTitle: 'One phrase for your kitchen: {cantonese}',
    phraseBody: '{jyutping} — {english}. Tap to hear it.',
  },
  fil: {
    streakTitle: 'Araw {n} — 2 minuto lang, tuloy pa rin',
    streakBody: 'Safe ang streak mo kung mag-practice ka bago maghatinggabi.',
    newTitle: 'Bago ngayon: {title}',
    newBody: 'Dalawang minutong babasahin mula sa Hong Kong.',
    stickerTitle: '{remaining} sagot pa para sa {emoji} {cantonese}',
    stickerBody: 'Malapit na ang susunod na sticker — isang maikling quiz lang.',
    phraseTitle: 'Isang parirala para sa kusina: {cantonese}',
    phraseBody: '{jyutping} — {english}. Pindutin para marinig.',
  },
  zh: {
    streakTitle: '第 {n} 天 — 2 分鐘就保得住',
    streakBody: '午夜前練習一下，紀錄就不會斷。',
    newTitle: '今日新內容：{title}',
    newBody: '兩分鐘，看看香港發生什麼事。',
    stickerTitle: '再答 {remaining} 題，就得到 {emoji} {cantonese}',
    stickerBody: '差一點就有新貼紙，做個兩分鐘小測驗吧。',
    phraseTitle: '廚房一句話：{cantonese}',
    phraseBody: '{jyutping} — {english}。點一下聽發音。',
  },
  id: {
    streakTitle: 'Hari {n} — 2 menit saja, tetap jalan',
    streakBody: 'Streak-mu aman kalau kamu latihan sebelum tengah malam.',
    newTitle: 'Baru hari ini: {title}',
    newBody: 'Bacaan dua menit dari Hong Kong.',
    stickerTitle: '{remaining} jawaban lagi untuk {emoji} {cantonese}',
    stickerBody: 'Stiker berikutnya sudah dekat — kuis sebentar saja.',
    phraseTitle: 'Satu frasa untuk dapurmu: {cantonese}',
    phraseBody: '{jyutping} — {english}. Ketuk untuk dengar.',
  },
};

// ---------------------------------------------------------------------------
// Time, in her timezone
// ---------------------------------------------------------------------------

/** Local Hong Kong wall-clock for an instant. */
function hktParts(nowMs) {
  const d = new Date(nowMs + HKT_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** Midnight-anchored day number, so day arithmetic is exact across DST-free HKT. */
const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`);

const shiftDay = (date, delta) => new Date(dayNumber(date) + delta * DAY_MS).toISOString().slice(0, 10);

/** How many consecutive days ending at `date` appear in `days`. */
function streakEndingOn(days, date) {
  let n = 0;
  let cursor = date;
  while (days.has(cursor)) {
    n += 1;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

const truncate = (s, max) => {
  const t = String(s || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}

// ---------------------------------------------------------------------------
// The planner
// ---------------------------------------------------------------------------

/**
 * The sticker she is closest to, and the one after it. Used for the day-7
 * message ("3 answers from 🍚 食飯") and the day-14 phrase, which deliberately
 * picks a phrase she has NOT collected yet — a reminder that teaches her
 * something new is worth opening; one that repeats her first sticker is not.
 */
function nextSticker(credits) {
  const total = Number(credits) || 0;
  const next = SEED_STICKERS.find((s) => s.credits > total) || null;
  const fallback = SEED_STICKERS[SEED_STICKERS.length - 1];
  return { next, phrase: next || fallback };
}

/**
 * Decide what — if anything — this device should receive right now.
 *
 * `target`:
 *   endpoint         the push endpoint (identity for the send log)
 *   lang             'en' | 'fil' | 'zh' | 'id'
 *   activeDays       HKT date strings on which she completed a quiz
 *   lastPracticeDay  the most recent of those, or null
 *   lastActiveAt     ISO timestamp of her last page load, or null
 *   credits          total quiz score (drives the sticker message)
 *   headline         today's newest post title, for the day-3 message
 *   pushedToday      true if any push already went to this endpoint today (HKT)
 *   lastPushKind     the last kind sent on or after `lastPracticeDay` — see the
 *                    note in the caller. Comparing against this is what stops a
 *                    rung repeating every evening for a week, and filtering it
 *                    to after her last practice is what lets the ladder start
 *                    again from the bottom when she comes back and goes quiet.
 *
 * Returns `{ kind, payload, lang }` or null. Null is the common answer.
 */
function planPush(target, nowMs = Date.now()) {
  if (!target || !target.endpoint) return null;

  const now = hktParts(nowMs);
  if (now.minutes < WINDOW_FROM || now.minutes > WINDOW_TO) return null;
  if (target.pushedToday) return null;
  if (target.practisedToday) return null;

  const lang = LANGS.includes(target.lang) ? target.lang : 'en';
  const copy = COPY[lang];
  const days = new Set(target.activeDays || []);

  // ---- 1. Streak at risk. The only message that arrives while it still
  // matters: she practised yesterday, so a run exists, and she has not been in
  // today, so it dies at midnight.
  const yesterday = shiftDay(now.date, -1);
  if (days.has(yesterday)) {
    const streak = streakEndingOn(days, yesterday);
    return {
      kind: 'streak',
      lang,
      payload: {
        title: fill(copy.streakTitle, { n: streak }),
        body: copy.streakBody,
        url: '/',
        tag: 'reminder',
      },
    };
  }

  // ---- 2. The idle ladder.
  const sinceDay = target.lastPracticeDay
    || (target.lastActiveAt ? hktParts(Date.parse(target.lastActiveAt)).date : null);
  if (!sinceDay) return null; // never seen: nothing true to say

  const idle = Math.round((dayNumber(now.date) - dayNumber(sinceDay)) / DAY_MS);
  if (idle < RUNG_NEW) return null; // she was here today or yesterday
  if (idle >= GIVE_UP) return null; // gone three weeks: stop, respectfully

  const kind = idle >= RUNG_PHRASE ? 'phrase' : idle >= RUNG_STICKER ? 'sticker' : 'new';
  if (target.lastPushKind === kind) return null; // this rung has already been sent

  if (kind === 'new') {
    const headline = truncate(target.headline, 34);
    if (!headline) return null; // nothing new to point at
    return {
      kind,
      lang,
      payload: {
        title: fill(copy.newTitle, { title: headline }),
        body: copy.newBody,
        url: '/discover',
        tag: 'reminder',
      },
    };
  }

  const { next, phrase } = nextSticker(target.credits);

  if (kind === 'sticker' && next) {
    return {
      kind,
      lang,
      payload: {
        title: fill(copy.stickerTitle, {
          remaining: next.credits - (Number(target.credits) || 0),
          emoji: next.emoji,
          cantonese: next.cantonese,
        }),
        body: copy.stickerBody,
        url: '/',
        tag: 'reminder',
      },
    };
  }

  // ---- 3. One phrase, at the point where anything longer would be ignored.
  return {
    kind: 'phrase',
    lang,
    payload: {
      title: fill(copy.phraseTitle, { cantonese: phrase.cantonese }),
      body: fill(copy.phraseBody, {
        jyutping: phrase.jyutping,
        english: phrase.english,
      }),
      url: '/learn',
      tag: 'reminder',
    },
  };
}

/** Plan for a whole list of targets. One entry per device that should be sent to. */
function planSweep(targets, nowMs = Date.now()) {
  const out = [];
  for (const t of targets || []) {
    const plan = planPush(t, nowMs);
    if (plan) out.push({ endpoint: t.endpoint, ...plan });
  }
  return out;
}

module.exports = {
  planPush,
  planSweep,
  hktParts,
  shiftDay,
  streakEndingOn,
  nextSticker,
  WINDOW_FROM,
  WINDOW_TO,
  RUNG_NEW,
  RUNG_STICKER,
  RUNG_PHRASE,
  GIVE_UP,
  LANGS,
  COPY,
};
