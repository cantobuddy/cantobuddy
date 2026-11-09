'use strict';

/**
 * Today in HK — a server-side aggregator for the home card and the /today page.
 *
 * It proxies two AUTHORITATIVE, official Hong Kong open-data sources so the
 * browser never has to fight CORS and so the values can be shown to a crawler
 * as plain server-rendered HTML (important for AdSense indexability):
 *
 *   - Hong Kong Observatory open-data API (real-time weather + warnings + forecast)
 *   - 1823 public-holiday iCal JSON (next general holiday, English + Simplified
 *     Chinese names)
 *
 * Design rules:
 *   - NEVER fabricate. If an upstream is down or times out, we return
 *     { available:false } together with the official source URLs so the UI can
 *     link straight out to the authority.
 *   - In-memory cache (10 min on success, 60 s on failure) keeps us polite to
 *     the upstreams and fast for visitors.
 *   - No user data is read or written; this module is a pure read of public feeds.
 */

const https = require('https');

const HKO = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
const HOLIDAYS = {
  en: 'https://www.1823.gov.hk/common/ical/en.json',
  sc: 'https://www.1823.gov.hk/common/ical/sc.json', // Simplified Chinese names
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

async function build(now) {
  const ref = new Date(now.getTime() + HKT_MS);
  const [rhR, flR, enR, scR] = await Promise.allSettled([
    fetchJson(HKO + '?dataType=rhrread&lang=en'),
    fetchJson(HKO + '?dataType=flw&lang=en'),
    fetchJson(HOLIDAYS.en),
    fetchJson(HOLIDAYS.sc),
  ]);
  const rh = rhR.status === 'fulfilled' ? rhR.value : null;
  const fl = flR.status === 'fulfilled' ? flR.value : null;
  const en = enR.status === 'fulfilled' ? enR.value : null;
  const sc = scR.status === 'fulfilled' ? scR.value : null;

  const temp = pickTemp(rh);
  const hum = pickHumidity(rh);
  const warns = warnings(rh);
  const forecast = fl && fl.forecastDesc ? fl.forecastDesc : null;
  const outlook = fl && fl.outlook ? fl.outlook : null;
  const holidayEn = holidayFromFeed(en, ref);
  const holidaySc = holidayFromFeed(sc, ref);
  const nextHoliday = holidayEn
    ? { ...holidayEn, nameZh: holidaySc ? holidaySc.name : holidayEn.name }
    : null;

  const available = !!(rh || fl || en);
  return {
    available,
    updatedAt: new Date().toISOString(),
    weather: {
      temperatureC: temp ? temp.value : null,
      humidityPct: hum ? hum.value : null,
      warnings: warns,
      forecast,
      outlook,
    },
    nextHoliday,
    sources: {
      weather: 'https://www.hko.gov.hk/en/wxinfo/currwx/warningsum.htm',
      holidays: 'https://www.1823.gov.hk/en/public-holiday/',
    },
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
      sources: {
        weather: 'https://www.hko.gov.hk/en/wxinfo/currwx/warningsum.htm',
        holidays: 'https://www.1823.gov.hk/en/public-holiday/',
      },
    };
  }
}

module.exports = {
  getTodayInHk,
  __test: { pickTemp, pickHumidity, warnings, holidayFromFeed, HOLIDAYS, HKO },
};
