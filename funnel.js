#!/usr/bin/env node
/**
 * One funnel, one vocabulary — W1.1 of the enhancement programme.
 *
 * This module is the ONLY SERVER-SIDE place the event names, the languages and
 * the acquisition-source buckets are defined. db.js (the rollup) and server.js
 * (the public endpoint + admin report) both require it. seo.js does NOT require
 * it: it injects public/funnel-client.js, which is the browser half of the same
 * contract and is pinned to this file's names by tools/funnel-test.js source
 * invariants. That test is what stops the app, the 159 server-rendered pages,
 * the admin report and GA4 from quietly drifting into three different
 * definitions of "activation".
 *
 * Deliberately NOT a database module and NOT an Express router: it is pure
 * constants and pure normalisers, so db.js can require it without opening a
 * connection and a test can require it without booting the app.
 *
 * Privacy contract: nothing in here accepts or returns a device token. The
 * funnel stores counts by (Hong Kong day, step, language, source) and nothing
 * else — no learner id, no public id, no path, no IP. The device token is used
 * by the endpoint only to decide whether an event is plausible, and is dropped
 * before the write.
 */

'use strict';

/** The five steps, in funnel order. Order matters for the conversion table. */
const FUNNEL_STEPS = Object.freeze([
  'landing_view',
  'first_word_view',
  'first_audio_play',
  'first_quiz_answer',
  'day1_return',
]);

/**
 * Auxiliary events are measured but are NOT funnel steps.
 *
 * `open_app_click` is the numerator of "SEO-to-app conversion" (Section 7 of
 * the proposal): a reader on a server-rendered page tapping through to the app.
 * It cannot be a funnel step because not every visitor passes through it — an
 * app-native visitor goes straight from landing to a word.
 */
const FUNNEL_AUX_EVENTS = Object.freeze(['open_app_click']);

const ALLOWED_EVENTS = Object.freeze([...FUNNEL_STEPS, ...FUNNEL_AUX_EVENTS]);
const FUNNEL_LANGS = Object.freeze(['en', 'fil', 'zh', 'id']);

/** The complete, finite set of source buckets. No arbitrary string is stored. */
const FUNNEL_SOURCES = Object.freeze([
  '(direct)',
  'google',
  'facebook',
  'instagram',
  'whatsapp',
  'search_other',
  'referral',
  'push',
  'offline',
  'other',
]);

/**
 * Map anything a URL can carry into one of the buckets above.
 *
 * `?ref=` holds a helper's share CODE and `utm_source` holds a campaign name —
 * both unbounded strings from the public internet. Writing them verbatim would
 * let one caller create unlimited rows and would turn an aggregate table into a
 * list of identifiers. Exact referral codes still live in `learners.referrer`
 * and the Referrers report; this table answers "which CHANNEL", not "which
 * person shared the link", so collapsing them is the correct shape.
 */
const SOURCE_RULES = [
  [/google|organic|^g$/, 'google'],
  [/facebook|messenger|^fb$|meta/, 'facebook'],
  [/instagram|^ig$/, 'instagram'],
  [/whatsapp|^wa$/, 'whatsapp'],
  [/bing|yahoo|duckduckgo|yandex|baidu|search/, 'search_other'],
  [/push|notification|reminder/, 'push'],
  [/qr|poster|flyer|print|offline/, 'offline'],
  [/refer|invite|share|employer|^ref$|^ref_/, 'referral'],
];

function normalizeLang(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (FUNNEL_LANGS.includes(s)) return s;
  // A few shapes show up in the wild: html lang="zh-CN", legacy "tl" for
  // Filipino, and "en-US" from a browser locale.
  if (s === 'tl' || s === 'fil-ph' || s.startsWith('fil')) return 'fil';
  if (s.startsWith('zh')) return 'zh';
  if (s.startsWith('id')) return 'id';
  return 'en';
}

function normalizeSource(v) {
  const s = String(v == null ? '' : v)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:\-]/g, '')
    .slice(0, 40);
  if (!s || s === '(direct)' || s === 'direct' || s === 'none') return '(direct)';
  for (const [re, bucket] of SOURCE_RULES) {
    if (re.test(s)) return bucket;
  }
  return 'other';
}

/** Clamp a report window. The baseline is 14 days; nothing may exceed 90. */
function funnelDays(v, fallback = 14) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(90, Math.max(1, n));
}

module.exports = {
  FUNNEL_STEPS,
  FUNNEL_AUX_EVENTS,
  ALLOWED_EVENTS,
  FUNNEL_LANGS,
  FUNNEL_SOURCES,
  SOURCE_RULES,
  normalizeLang,
  normalizeSource,
  funnelDays,
};
