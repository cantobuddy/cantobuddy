'use strict';
/**
 * CantoBuddy — English Track data layer (ISOLATED from the Cantonese site).
 *
 * Deliberately a SEPARATE module and a SEPARATE SQLite file (cantobuddy-en.db)
 * so the existing Cantonese database (cantobuddy.db) and db.js are never touched.
 * This is the safest way to add the English track: a bug here cannot corrupt the
 * live Cantonese data, and there is no shared connection to deadlock.
 *
 * Uses Node's built-in node:sqlite (DatabaseSync), the same engine db.js uses —
 * no new dependency.
 *
 * Tables: en_categories, en_vocabulary, en_scenarios, en_progress.
 *   - en_vocabulary.type = 'word'  -> browsed/quizzed by category
 *   - en_vocabulary.type = 'sentence' -> belongs to a scenario (scenario_id)
 */

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { SEED_EN_CATEGORIES, SEED_EN_VOCABULARY, SEED_EN_SCENARIOS } = require('./en-data');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = process.env.EN_DB_FILE || path.join(DATA_DIR, 'cantobuddy-en.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

// ---- Schema -----------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS en_categories (
    id         INTEGER PRIMARY KEY,
    name_en    TEXT NOT NULL,
    name_yue   TEXT NOT NULL DEFAULT '',
    name_zh    TEXT NOT NULL DEFAULT '',
    name_fil   TEXT NOT NULL DEFAULT '',
    name_id    TEXT NOT NULL DEFAULT '',
    icon       TEXT NOT NULL DEFAULT '📁',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS en_vocabulary (
    id          INTEGER PRIMARY KEY,
    english     TEXT NOT NULL,
    phonetic    TEXT NOT NULL DEFAULT '',
    cantonese   TEXT NOT NULL DEFAULT '',
    emoji       TEXT NOT NULL DEFAULT '📝',
    level       INTEGER NOT NULL DEFAULT 1,
    category_id INTEGER,
    type        TEXT NOT NULL DEFAULT 'word',
    scenario_id INTEGER,
    created_at  TEXT,
    updated_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS en_scenarios (
    id          INTEGER PRIMARY KEY,
    name_en     TEXT NOT NULL,
    name_yue    TEXT NOT NULL DEFAULT '',
    name_zh     TEXT NOT NULL DEFAULT '',
    name_fil    TEXT NOT NULL DEFAULT '',
    name_id     TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '💬',
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS en_progress (
    device_id TEXT NOT NULL,
    vocab_id  INTEGER NOT NULL,
    seen      INTEGER NOT NULL DEFAULT 0,
    correct   INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT,
    PRIMARY KEY (device_id, vocab_id)
  );
`);

// ---- Seed (once) ------------------------------------------------------------
function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM en_categories').get();
  if (n > 0) return;

  const now = new Date().toISOString();
  const insCat = db.prepare(
    'INSERT INTO en_categories (id, name_en, name_yue, name_zh, name_fil, name_id, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insScen = db.prepare(
    'INSERT INTO en_scenarios (id, name_en, name_yue, name_zh, name_fil, name_id, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insVocab = db.prepare(
    'INSERT INTO en_vocabulary (english, phonetic, cantonese, emoji, level, category_id, type, scenario_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  SEED_EN_CATEGORIES.forEach((c, i) =>
    insCat.run(c.id, c.name_en, c.name_yue || '', c.name_zh || '', c.name_fil || '', c.name_id || '', c.icon || '📁', i)
  );
  SEED_EN_SCENARIOS.forEach((s, i) =>
    insScen.run(s.id, s.name_en, s.name_yue || '', s.name_zh || '', s.name_fil || '', s.name_id || '', s.icon || '💬', s.description || '', i)
  );
  SEED_EN_VOCABULARY.forEach((v) =>
    insVocab.run(
      v.english,
      v.phonetic || '',
      v.cantonese || '',
      v.emoji || '📝',
      v.level || 1,
      v.category_id == null ? null : Number(v.category_id),
      v.type || 'word',
      v.scenario_id == null ? null : Number(v.scenario_id),
      now,
      now
    )
  );
}
seedIfEmpty();

// ---- Prepared statements ----------------------------------------------------
const S = {
  listCategories: db.prepare('SELECT * FROM en_categories ORDER BY sort_order, id'),
  listScenarios: db.prepare('SELECT * FROM en_scenarios ORDER BY sort_order, id'),
  listWords: db.prepare("SELECT * FROM en_vocabulary WHERE type = 'word' ORDER BY level, id"),
  listSentences: db.prepare("SELECT * FROM en_vocabulary WHERE type = 'sentence' ORDER BY id"),
  listAll: db.prepare('SELECT * FROM en_vocabulary ORDER BY id'),
  listWordsByCat: db.prepare("SELECT * FROM en_vocabulary WHERE type = 'word' AND category_id = ? ORDER BY level, id"),
  listWordsByLevel: db.prepare("SELECT * FROM en_vocabulary WHERE type = 'word' AND level = ? ORDER BY id"),
  listWordsByCatLevel: db.prepare("SELECT * FROM en_vocabulary WHERE type = 'word' AND category_id = ? AND level = ? ORDER BY id"),
  listByScenario: db.prepare('SELECT * FROM en_vocabulary WHERE scenario_id = ? ORDER BY id'),
  getVocab: db.prepare('SELECT * FROM en_vocabulary WHERE id = ?'),
  upsertProgress: db.prepare(`
    INSERT INTO en_progress (device_id, vocab_id, seen, correct, updated_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(device_id, vocab_id)
    DO UPDATE SET seen = seen + 1, correct = correct + ?, updated_at = excluded.updated_at
  `),
  getProgress: db.prepare('SELECT vocab_id, seen, correct FROM en_progress WHERE device_id = ?'),
};

// ---- Accessors --------------------------------------------------------------
const listEnCategories = () => S.listCategories.all();
const listEnScenarios = () => S.listScenarios.all();

/**
 * Vocabulary accessor used by the SPA.
 *
 * With a category/level filter it returns matching WORDS only (for the browse
 * and quiz screens). With NO filter it returns EVERYTHING — words AND sentences
 * — because the frontend keeps the full set in STATE.words and filters client
 * side: browse/quiz need words (by category_id), while the scenario detail
 * screen needs sentences (by scenario_id). Returning only words here previously
 * left every scenario detail page empty.
 */
function listEnWords({ category_id, level } = {}) {
  const hasCat = category_id != null && category_id !== '';
  const hasLevel = level != null && level !== '';
  if (hasCat && hasLevel) return S.listWordsByCatLevel.all(Number(category_id), Number(level));
  if (hasCat) return S.listWordsByCat.all(Number(category_id));
  if (hasLevel) return S.listWordsByLevel.all(Number(level));
  return S.listAll.all();
}

/** Sentences for one scenario (type = 'sentence' AND scenario_id). */
const listEnScenarioPhrases = (scenario_id) => S.listByScenario.all(Number(scenario_id));

const getEnVocabulary = (id) => S.getVocab.get(Number(id));

/** Record a quiz/seen result for a device. correct = boolean.
 *  SQL param order: (device_id, vocab_id, correct_initial, updated_at, correct_increment).
 *  `seen` is hard-coded to 1 in the INSERT; on conflict seen is incremented and
 *  correct is incremented by the correct_increment term. Keeping the timestamp in
 *  the updated_at slot (not the increment slot) is essential — otherwise SQLite
 *  coerces the ISO date to a number and adds it to `correct`. */
function recordEnProgress(deviceId, vocabId, correct) {
  const now = new Date().toISOString();
  S.upsertProgress.run(String(deviceId), Number(vocabId), correct ? 1 : 0, now, correct ? 1 : 0);
}

/** Return { vocab_id: { seen, correct } } for a device. */
function getEnProgress(deviceId) {
  const rows = S.getProgress.all(String(deviceId));
  const map = {};
  for (const r of rows) map[r.vocab_id] = { seen: Number(r.seen), correct: Number(r.correct) };
  return map;
}

module.exports = {
  DB_PATH,
  listEnCategories,
  listEnScenarios,
  listEnWords,
  listEnScenarioPhrases,
  getEnVocabulary,
  recordEnProgress,
  getEnProgress,
};
