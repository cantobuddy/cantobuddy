'use strict';

/**
 * Today in HK — a server-side aggregator for the home card, /today and the /en
 * elder companion.
 *
 * It proxies AUTHORITATIVE, official Hong Kong open-data sources so the browser
 * never has to fight CORS and so the values can be shown to a crawler as plain
 * server-rendered HTML (important for AdSense indexability):
 *
 *   - Hong Kong Observatory open-data API (real-time weather + warnings +
 *     forecast), requested in en / tc / sc so Chinese-reading elders get the
 *     Observatory's OWN Chinese wording instead of raw English machine text;
 *   - 1823 public-holiday iCal JSON in en / tc / sc (English, Traditional and
 *     Simplified Chinese holiday names).
 *
 * Design rules:
 *   - NEVER fabricate. If an upstream is down or times out, we return
 *     { available:false } together with the official source URLs so the UI can
 *     link straight out to the authority.
 *   - The original English fields (`warnings`, `forecast`, `outlook`, `name`)
 *     are preserved verbatim for the Cantonese home card and the /today SSR
 *     page. Chinese fields are additive.
 *   - In-memory cache (10 min on success, 60 s on failure) keeps us polite to
 *     the upstreams and fast for visitors.
 *   - No user data is read or written; this module is a pure read of public feeds.
 */

const https = require('https');
const { toSimplified } = require('./zh-convert');

const HKO = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
const HOLIDAYS = {
  en: 'https://www.1823.gov.hk/common/ical/en.json',
  tc: 'https://www.1823.gov.hk/common/ical/tc.json', // Traditional Chinese names
  sc: 'https://www.1823.gov.hk/common/ical/sc.json', // Simplified Chinese names
};

/**
 * Human-readable source pages shown when a feed is unavailable. Both old links
 * (the retired HKO warning-summary page and the retired 1823 holiday page) were
 * taken offline and returned 404 — reported by an /en elder user. These were checked live on
 * 2026-11-10 and return 200. Kept as one constant so the success path, the
 * failure path and the regression suite cannot drift apart.
 */
const SOURCES = {
  weather: 'https://www.hko.gov.hk/en/wxinfo/currwx/current.htm',
  holidays: 'https://www.1823.gov.hk/en/hong-kong-public-holidays-ical',
};
const TIMEOUT_MS = 12000;
const TTL_MS = 10 * 60 * 1000;
const FAIL_TTL_MS = 60 * 1000;
const HKT_MS = 8 * 3600 * 1000;
const USER_AGENT =
  'CantoBuddy/1.0 (+https://cantobuddy.com; weather widget, contact hello@cantobuddy.com)';

let cache = { at: 0, ttl: 0, data: null };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        }
        let s = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (s += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(s.replace(/^﻿/, '')));
          } catch (e) {
            reject(new Error('bad JSON from ' + url));
          }
        });
      }
    );
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('timeout for ' + url));
    });
    req.on('error', reject);
  });
}

function pickTemp(rh) {
  const arr = rh && rh.temperature && rh.temperature.data;
  if (!arr || !arr.length) return null;
  const hko = arr.find((t) => t.place === 'Hong Kong Observatory') || arr[0];
  return { value: hko.value, unit: hko.unit || 'C' };
}

function pickHumidity(rh) {
  const arr = rh && rh.humidity && rh.humidity.data;
  if (!arr || !arr.length) return null;
  return { value: arr[0].value, unit: '%' };
}

function warnings(rh) {
  const w = rh && rh.warningMessage;
  if (!w) return [];
  return Array.isArray(w) ? w : [w];
}

function asWarningList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(String).filter(Boolean);
}

/** Fallback only: convert the Observatory's official Traditional text. */
function simplifiedFromTraditional(value) {
  if (Array.isArray(value)) return value.map((x) => toSimplified(String(x)));
  return value == null ? value : toSimplified(String(value));
}

/**
 * Build the language-specific strings from the six official HKO responses.
 * Pure and deterministic, so the regression suite can pin it without network.
 */
function localisedWeatherFeeds(feeds) {
  const rhEn = feeds.rhEn || null;
  const rhTc = feeds.rhTc || null;
  const rhSc = feeds.rhSc || null;
  const flEn = feeds.flEn || null;
  const flTc = feeds.flTc || null;
  const flSc = feeds.flSc || null;

  const warningsEn = asWarningList(rhEn && rhEn.warningMessage);
  const warningsTc = asWarningList(rhTc && rhTc.warningMessage);
  let warningsSc = rhSc
    ? asWarningList(rhSc.warningMessage)
    : simplifiedFromTraditional(warningsTc);
  if (!warningsSc.length && warningsTc.length) {
    warningsSc = simplifiedFromTraditional(warningsTc);
  }

  const forecastEn = flEn && flEn.forecastDesc ? String(flEn.forecastDesc) : null;
  const forecastTc = flTc && flTc.forecastDesc ? String(flTc.forecastDesc) : null;
  const forecastSc = flSc && flSc.forecastDesc
    ? String(flSc.forecastDesc)
    : simplifiedFromTraditional(forecastTc);

  const outlookEn = flEn && flEn.outlook ? String(flEn.outlook) : null;
  const outlookTc = flTc && flTc.outlook ? String(flTc.outlook) : null;
  const outlookSc = flSc && flSc.outlook
    ? String(flSc.outlook)
    : simplifiedFromTraditional(outlookTc);

  return {
    warningsEn, warningsTc, warningsSc,
    forecastEn, forecastTc, forecastSc,
    outlookEn, outlookTc, outlookSc,
  };
}

// `ref` is an HKT Date (server local time + 8h) so "today" and the day count
// line up with the Hong Kong calendar rather than UTC.
function holidayFromFeed(feed, ref) {
  if (!feed || !feed.vcalendar || !feed.vcalendar[0] || !feed.vcalendar[0].vevent) return null;
  const ev = feed.vcalendar[0].vevent;
  const today = ref.toISOString().slice(0, 10).replace(/-/g, '');
  const upcoming = ev
    .map((e) => ({ date: String(e.dtstart[0]), name: e.summary }))
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  const h = upcoming[0];
  const iso = h.date.slice(0, 4) + '-' + h.date.slice(4, 6) + '-' + h.date.slice(6, 8);
  const d = new Date(iso + 'T00:00:00+08:00');
  const daysUntil = Math.round((d - ref) / 86400000);
  return { date: iso, daysUntil, name: h.name };
}

function localisedHoliday(feeds, ref) {
  const en = holidayFromFeed(feeds.en, ref);
  const tc = holidayFromFeed(feeds.tc, ref);
  const sc = holidayFromFeed(feeds.sc, ref);
  const base = en || tc || sc;
  if (!base) return null;
  const nameTc = tc ? tc.name : null;
  const nameSc = sc ? sc.name : (tc ? toSimplified(tc.name) : null);
  return {
    ...base,
    // Legacy English contract for /today and the Cantonese home card.
    name: en ? en.name : base.name,
    nameZh: nameSc || nameTc || (en ? en.name : base.name),
    nameTc,
    nameSc,
  };
}

async function build(now) {
  const ref = new Date(now.getTime() + HKT_MS);
  const responses = await Promise.allSettled([
    fetchJson(HKO + '?dataType=rhrread&lang=en'),
    fetchJson(HKO + '?dataType=rhrread&lang=tc'),
    fetchJson(HKO + '?dataType=rhrread&lang=sc'),
    fetchJson(HKO + '?dataType=flw&lang=en'),
    fetchJson(HKO + '?dataType=flw&lang=tc'),
    fetchJson(HKO + '?dataType=flw&lang=sc'),
    fetchJson(HOLIDAYS.en),
    fetchJson(HOLIDAYS.tc),
    fetchJson(HOLIDAYS.sc),
  ]);
  const value = (r) => (r.status === 'fulfilled' ? r.value : null);
  const [rhEn, rhTc, rhSc, flEn, flTc, flSc, en, tc, sc] = responses.map(value);

  const temp = pickTemp(rhEn || rhTc || rhSc);
  const hum = pickHumidity(rhEn || rhTc || rhSc);
  const loc = localisedWeatherFeeds({ rhEn, rhTc, rhSc, flEn, flTc, flSc });
  const nextHoliday = localisedHoliday({ en, tc, sc }, ref);
  const available = !!(rhEn || rhTc || rhSc || flEn || flTc || flSc || en || tc || sc);

  return {
    available,
    updatedAt: new Date().toISOString(),
    weather: {
      temperatureC: temp ? temp.value : null,
      humidityPct: hum ? hum.value : null,
      warnings: loc.warningsEn,
      warningsTc: loc.warningsTc,
      warningsSc: loc.warningsSc,
      forecast: loc.forecastEn,
      forecastTc: loc.forecastTc,
      forecastSc: loc.forecastSc,
      outlook: loc.outlookEn,
      outlookTc: loc.outlookTc,
      outlookSc: loc.outlookSc,
    },
    nextHoliday,
    sources: { ...SOURCES },
  };
}

async function getTodayInHk() {
  const now = new Date();
  if (cache.data && now.getTime() - cache.at < cache.ttl) return cache.data;
  try {
    const data = await build(now);
    cache = { at: now.getTime(), ttl: data.available ? TTL_MS : FAIL_TTL_MS, data };
    return data;
  } catch (e) {
    if (cache.data) return cache.data; // serve stale on a hard crash
    return {
      available: false,
      updatedAt: new Date().toISOString(),
      error: 'unavailable',
      weather: null,
      nextHoliday: null,
      sources: { ...SOURCES },
    };
  }
}

module.exports = {
  getTodayInHk,
  __test: {
    pickTemp, pickHumidity, warnings, asWarningList, simplifiedFromTraditional,
    localisedWeatherFeeds, holidayFromFeed, localisedHoliday, HOLIDAYS, HKO, SOURCES,
  },
};
