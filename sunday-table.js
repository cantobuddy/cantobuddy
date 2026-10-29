'use strict';

/**
 * The Sunday Table — one fixed weekly appointment.
 *
 * Sunday is the only day a domestic helper in Hong Kong has real free time, so
 * the one weekly rhythm the app can own is Sunday afternoon. This module decides
 * *when* that is, *which* game is featured, and *which* passage is the passage of
 * the week. It does not render anything and it does not send anything.
 *
 * Pure, for the same reason push-reminders.js is pure: "what is the Table on
 * Wednesday 14:05?" and "is it still open at 18:00:01?" are questions that must
 * be answerable without waiting a week or moving a server clock. Everything here
 * is a function of (nowMs, data).
 *
 * The slot is 16:00–18:00 Hong Kong time on Sunday. Two hours rather than one
 * because a helper's afternoon is not a calendar event — she is cooking, or on a
 * bus, or waiting for a friend — and a one-hour window would mostly measure who
 * happened to be looking at her phone at 16:00.
 *
 * Everything is anchored on HKT (UTC+8, no daylight saving ever) and on the
 * Hong Kong calendar date, because that is the day she experiences.
 */

const HKT_OFFSET_MS = 8 * 3600000;
const DAY_MS = 24 * 3600000;

/** The slot, in minutes after local midnight. */
const SLOT_START_MINUTES = 16 * 60; // 16:00 HKT
const SLOT_END_MINUTES = 18 * 60;   // 18:00 HKT
const SLOT_MINUTES = SLOT_END_MINUTES - SLOT_START_MINUTES;

/** How far back the "in the news this week" digest reaches. */
const DIGEST_DAYS = 7;
const DIGEST_MAX = 4;

/**
 * The four games, in a fixed order. Fixed because the rotation is an index into
 * this array: reordering it would silently change which game is featured in a
 * week that has already been announced.
 */
const GAMES = ['uno', 'bigtwo', 'wordmatch', 'sudoku'];

/** Hong Kong wall-clock parts for a moment. `dow` is 0 for Sunday. */
function hktParts(nowMs) {
  const d = new Date(nowMs + HKT_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    dow: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** The HKT date of the Sunday that starts the week containing `nowMs`. */
function sundayOf(nowMs) {
  const p = hktParts(nowMs);
  const midnight = Date.parse(`${p.date}T00:00:00Z`);
  return new Date(midnight - p.dow * DAY_MS).toISOString().slice(0, 10);
}

/** Epoch ms of 16:00 HKT on a given calendar date. */
function slotStartMs(date) {
  return Date.parse(`${date}T00:00:00Z`) + SLOT_START_MINUTES * 60000 - HKT_OFFSET_MS;
}

/**
 * ISO-8601 week key, e.g. "2026-W43".
 *
 * The featured game and the passage of the week are chosen from this key, so it
 * has to be the same on every server and stable for the whole week. ISO weeks
 * start on Monday, which means a Sunday belongs to the week that began six days
 * earlier — which is exactly the week the Table is closing out, and the right
 * week for "this week's passage".
 */
function weekKey(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;              // Monday = 1 … Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dow);      // move to the Thursday of this week
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The numeric part of a week key, or 0 if it is malformed. */
function weekNumber(key) {
  const m = /-W(\d{1,2})$/.exec(String(key || ''));
  return m ? Number(m[1]) : 0;
}

/** The featured game for a week. Rotates once a week, same for everyone. */
function featuredGame(key) {
  const n = weekNumber(key);
  return GAMES[((n % GAMES.length) + GAMES.length) % GAMES.length];
}

/**
 * The passage of the week.
 *
 * Sorted by slug before choosing so the pick cannot depend on the order the
 * query happened to return — two servers, or the same server after a reseed,
 * must agree on the week's passage or the "passage of the week" label is a lie
 * on one of them. Retired passages simply shrink the pool.
 */
function passageOfWeek(posts, key) {
  const list = (Array.isArray(posts) ? posts : [])
    .filter((p) => p && p.slug)
    .slice()
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  if (!list.length) return null;
  const n = weekNumber(key);
  return list[((n % list.length) + list.length) % list.length];
}

/**
 * The digest: what has been published in the last week, newest first.
 *
 * Deliberately not labelled "Hong Kong": posts carry no region, and the news
 * channel mixes Hong Kong with the Philippines and Indonesia. A label that
 * promises Hong Kong and then shows Davao is a small lie, and this feature has
 * no budget for small lies.
 *
 * A window rather than "the last N posts", so an empty week reads as an empty
 * week instead of reaching back a month to fill the space. A digest that is
 * quietly three weeks old is worse than no digest.
 */
function digest(posts, nowMs) {
  const from = nowMs - DIGEST_DAYS * DAY_MS;
  return (Array.isArray(posts) ? posts : [])
    .filter((p) => {
      if (!p || !p.slug) return false;
      const t = Date.parse(p.published_at || p.created_at || '');
      return Number.isFinite(t) && t >= from && t <= nowMs;
    })
    .sort((a, b) => Date.parse(b.published_at || b.created_at || '') - Date.parse(a.published_at || a.created_at || ''))
    .slice(0, DIGEST_MAX);
}

/**
 * The Table, right now.
 *
 * Returns `active` plus the slot it refers to — the one open now, or the next
 * one if today's has finished. `minutesUntil` is negative while a Table is open
 * and counts down to the start otherwise, so a caller can render "starts in 40
 * minutes" and "open now" from the same two numbers.
 */
function tableFor(nowMs = Date.now()) {
  const thisSunday = sundayOf(nowMs);
  const startMs = slotStartMs(thisSunday);
  const endMs = startMs + SLOT_MINUTES * 60000;
  const active = nowMs >= startMs && nowMs < endMs;

  const date = active || nowMs < startMs
    ? thisSunday
    : new Date(Date.parse(`${thisSunday}T00:00:00Z`) + 7 * DAY_MS).toISOString().slice(0, 10);

  const startsAtMs = slotStartMs(date);
  const endsAtMs = startsAtMs + SLOT_MINUTES * 60000;
  const key = weekKey(date);

  return {
    active,
    date,
    week: key,
    startsAtMs,
    endsAtMs,
    minutesUntil: Math.round((startsAtMs - nowMs) / 60000),
    featuredGame: featuredGame(key),
  };
}

module.exports = {
  HKT_OFFSET_MS,
  DAY_MS,
  SLOT_START_MINUTES,
  SLOT_END_MINUTES,
  SLOT_MINUTES,
  DIGEST_DAYS,
  DIGEST_MAX,
  GAMES,
  hktParts,
  sundayOf,
  slotStartMs,
  weekKey,
  weekNumber,
  featuredGame,
  passageOfWeek,
  digest,
  tableFor,
};
