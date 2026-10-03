/**
 * CantoBuddy data layer — SQLite via Node's built-in `node:sqlite`.
 *
 * Why SQLite and not a hosted database:
 *   - `node:sqlite` ships with Node 22.5+, so there is NO new dependency,
 *     no native compilation, and nothing new to pay for.
 *   - It lives on the persistent disk the app already mounts (DATA_DIR),
 *     so the monthly cost is unchanged.
 *   - It gives real transactions, foreign keys, indexes and joins — the things
 *     a single JSON file cannot provide once two people write at the same time.
 *
 * The API below is a repository layer: callers ask for what they want, they do
 * not load or save the whole dataset. That is what makes concurrent writes safe.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { SEED_CATEGORIES, SEED_VOCABULARY, SEED_USERS } = require('./data');

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_FILE || path.join(DATA_DIR, 'cantobuddy.db');

// ---------------------------------------------------------------------------
// Password hashing (node:crypto scrypt — no dependency required)
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Accepts a scrypt hash. Also accepts a legacy plaintext value (the shape the
 * old db.json used) so existing accounts keep working — callers should re-hash
 * on successful legacy login. See `needsRehash`.
 */
function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (!String(stored).startsWith('scrypt$')) return safeEqual(plain, stored);
  const [, salt, derived] = String(stored).split('$');
  if (!salt || !derived) return false;
  const calc = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN).toString('hex');
  return safeEqual(calc, derived);
}

function needsRehash(stored) {
  return !String(stored || '').startsWith('scrypt$');
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');   // concurrent readers + one writer
db.exec('PRAGMA foreign_keys = ON;');    // SQLite defaults this OFF — must enable
db.exec('PRAGMA busy_timeout = 5000;');  // wait for a lock instead of throwing

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY,
    name_en    TEXT NOT NULL,
    name_yue   TEXT NOT NULL DEFAULT '',
    name_fil   TEXT NOT NULL DEFAULT '',
    icon       TEXT NOT NULL DEFAULT '📁',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vocabulary (
    id          INTEGER PRIMARY KEY,
    cantonese   TEXT NOT NULL,
    jyutping    TEXT NOT NULL,
    english     TEXT NOT NULL,
    tagalog     TEXT NOT NULL DEFAULT '',
    emoji       TEXT NOT NULL DEFAULT '📝',
    level       INTEGER NOT NULL DEFAULT 1,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at  TEXT,
    updated_at  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vocab_category ON vocabulary(category_id);
  CREATE INDEX IF NOT EXISTS idx_vocab_level    ON vocabulary(level);

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'learner',
    name          TEXT NOT NULL DEFAULT '',
    created_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS progress (
    id          INTEGER PRIMARY KEY,
    session_id  TEXT UNIQUE,
    learner     TEXT NOT NULL,
    learner_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    level       INTEGER NOT NULL DEFAULT 1,
    category_id INTEGER NOT NULL DEFAULT 0,
    quiz_type   TEXT NOT NULL DEFAULT 'multiple_choice',
    score       INTEGER NOT NULL DEFAULT 0,
    total       INTEGER NOT NULL DEFAULT 0,
    answered    INTEGER NOT NULL DEFAULT 0,
    completed   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT,
    updated_at  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_progress_learner ON progress(learner);
  CREATE INDEX IF NOT EXISTS idx_progress_level   ON progress(level);

  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`);

// ---------------------------------------------------------------------------
// Seed (only when the database is brand new and empty)
// ---------------------------------------------------------------------------

function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categories').get();
  if (n > 0) return false;

  const now = new Date().toISOString();
  const insCat = db.prepare(
    'INSERT INTO categories (id, name_en, name_yue, name_fil, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insVocab = db.prepare(
    `INSERT INTO vocabulary (id, cantonese, jyutping, english, tagalog, emoji, level, category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insUser = db.prepare(
    'INSERT INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    SEED_CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.icon || '📁', i));
    SEED_VOCABULARY.forEach((v) =>
      insVocab.run(v.id, v.cantonese, v.jyutping, v.english, v.tagalog || '', v.emoji || '📝', v.level || 1, v.category_id ?? null, now, now)
    );
    SEED_USERS.forEach((u) => insUser.run(u.id, u.username, hashPassword(u.password), u.role || 'admin', u.name || '', now));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return true;
}

const seeded = seedIfEmpty();

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const S = {
  listCategories: db.prepare('SELECT * FROM categories ORDER BY sort_order, id'),
  getCategory: db.prepare('SELECT * FROM categories WHERE id = ?'),
  insertCategory: db.prepare(
    'INSERT INTO categories (name_en, name_yue, name_fil, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
  ),
  updateCategory: db.prepare(
    'UPDATE categories SET name_en = ?, name_yue = ?, name_fil = ?, icon = ? WHERE id = ?'
  ),
  deleteCategory: db.prepare('DELETE FROM categories WHERE id = ?'),
  setCategoryOrder: db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?'),
  maxCategoryOrder: db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories'),

  listVocabulary: db.prepare('SELECT * FROM vocabulary ORDER BY level, id'),
  listVocabularyByLevel: db.prepare('SELECT * FROM vocabulary WHERE level = ? ORDER BY id'),
  listVocabularyByCategory: db.prepare('SELECT * FROM vocabulary WHERE category_id = ? ORDER BY level, id'),
  listVocabularyByBoth: db.prepare('SELECT * FROM vocabulary WHERE level = ? AND category_id = ? ORDER BY id'),
  getVocabulary: db.prepare('SELECT * FROM vocabulary WHERE id = ?'),
  insertVocabulary: db.prepare(
    `INSERT INTO vocabulary (cantonese, jyutping, english, tagalog, emoji, level, category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  updateVocabulary: db.prepare(
    `UPDATE vocabulary SET cantonese = ?, jyutping = ?, english = ?, tagalog = ?, emoji = ?, level = ?, category_id = ?, updated_at = ?
     WHERE id = ?`
  ),
  deleteVocabulary: db.prepare('DELETE FROM vocabulary WHERE id = ?'),

  listProgress: db.prepare('SELECT * FROM progress ORDER BY id'),
  listProgressByLearner: db.prepare('SELECT * FROM progress WHERE learner = ? ORDER BY id'),
  listProgressByLevel: db.prepare('SELECT * FROM progress WHERE level = ? ORDER BY id'),
  listProgressByCategory: db.prepare('SELECT * FROM progress WHERE category_id = ? ORDER BY id'),
  listProgressByLearnerLevel: db.prepare('SELECT * FROM progress WHERE learner = ? AND level = ? ORDER BY id'),
  listProgressByLearnerCategory: db.prepare('SELECT * FROM progress WHERE learner = ? AND category_id = ? ORDER BY id'),
  getProgressById: db.prepare('SELECT * FROM progress WHERE id = ?'),
  getProgressBySession: db.prepare('SELECT * FROM progress WHERE session_id = ?'),
  insertProgress: db.prepare(
    `INSERT INTO progress (session_id, learner, learner_id, level, category_id, quiz_type, score, total, answered, completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  updateProgressBySession: db.prepare(
    `UPDATE progress SET score = ?, total = ?, answered = ?, completed = ?, updated_at = ? WHERE session_id = ?`
  ),

  countVocabulary: db.prepare('SELECT COUNT(*) AS n FROM vocabulary'),
  countCategories: db.prepare('SELECT COUNT(*) AS n FROM categories'),
  countProgress: db.prepare('SELECT COUNT(*) AS n FROM progress'),
  countPartial: db.prepare('SELECT COUNT(*) AS n FROM progress WHERE completed = 0'),
  statsByLearner: db.prepare(`
    SELECT learner,
           COUNT(*) AS attempts,
           SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completedAttempts,
           SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS partialAttempts,
           SUM(score) AS totalScore,
           SUM(total) AS totalMax
    FROM progress GROUP BY learner ORDER BY learner
  `),
  statsByLearnerLevel: db.prepare(`
    SELECT learner, level, COUNT(*) AS attempts, SUM(score) AS score, SUM(total) AS max
    FROM progress GROUP BY learner, level
  `),

  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  setUserPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),

  getSession: db.prepare('SELECT * FROM sessions WHERE sid = ?'),
  upsertSession: db.prepare(
    `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`
  ),
  deleteSession: db.prepare('DELETE FROM sessions WHERE sid = ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const listCategories = () => S.listCategories.all();
const getCategory = (id) => S.getCategory.get(Number(id));

function createCategory({ name_en, name_yue = '', name_fil = '', icon = '📁' }) {
  const { m } = S.maxCategoryOrder.get();
  const info = S.insertCategory.run(name_en, name_yue, name_fil, icon, m + 1);
  return getCategory(Number(info.lastInsertRowid));
}

function updateCategory(id, patch) {
  const current = getCategory(id);
  if (!current) return null;
  S.updateCategory.run(
    patch.name_en ?? current.name_en,
    patch.name_yue ?? current.name_yue,
    patch.name_fil ?? current.name_fil,
    patch.icon ?? current.icon,
    Number(id)
  );
  return getCategory(id);
}

function deleteCategory(id) {
  return S.deleteCategory.run(Number(id)).changes > 0;
}

/** Applies a new display order. Unknown ids are ignored; unlisted categories keep their relative order at the end. */
function reorderCategories(order) {
  const current = listCategories();
  const byId = new Map(current.map((c) => [c.id, c]));
  const ordered = [];
  for (const raw of order) {
    const cat = byId.get(Number(raw));
    if (cat) { ordered.push(cat); byId.delete(cat.id); }
  }
  for (const leftover of byId.values()) ordered.push(leftover);

  db.exec('BEGIN');
  try {
    ordered.forEach((cat, i) => S.setCategoryOrder.run(i, cat.id));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return listCategories();
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

function listVocabulary({ level, category_id } = {}) {
  const hasLevel = level != null && level !== '';
  const hasCat = category_id != null && category_id !== '';
  if (hasLevel && hasCat) return S.listVocabularyByBoth.all(Number(level), Number(category_id));
  if (hasLevel) return S.listVocabularyByLevel.all(Number(level));
  if (hasCat) return S.listVocabularyByCategory.all(Number(category_id));
  return S.listVocabulary.all();
}

const getVocabulary = (id) => S.getVocabulary.get(Number(id));

function createVocabulary(b) {
  const now = new Date().toISOString();
  const info = S.insertVocabulary.run(
    b.cantonese, b.jyutping, b.english,
    b.tagalog || '', b.emoji || '📝',
    Number(b.level) || 1, b.category_id != null ? Number(b.category_id) : null,
    now, now
  );
  return getVocabulary(Number(info.lastInsertRowid));
}

function updateVocabulary(id, b) {
  const cur = getVocabulary(id);
  if (!cur) return null;
  S.updateVocabulary.run(
    b.cantonese ?? cur.cantonese,
    b.jyutping ?? cur.jyutping,
    b.english ?? cur.english,
    b.tagalog ?? cur.tagalog,
    b.emoji ?? cur.emoji,
    b.level != null ? Number(b.level) : cur.level,
    b.category_id != null ? Number(b.category_id) : cur.category_id,
    new Date().toISOString(),
    Number(id)
  );
  return getVocabulary(id);
}

function deleteVocabulary(id) {
  return S.deleteVocabulary.run(Number(id)).changes > 0;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

function listProgress({ learner, level, category_id } = {}) {
  const hasLearner = !!learner;
  const hasLevel = level != null && level !== '';
  const hasCat = category_id != null && category_id !== '';
  if (hasLearner && hasLevel) return S.listProgressByLearnerLevel.all(learner, Number(level));
  if (hasLearner && hasCat) return S.listProgressByLearnerCategory.all(learner, Number(category_id));
  if (hasLearner) return S.listProgressByLearner.all(learner);
  if (hasLevel) return S.listProgressByLevel.all(Number(level));
  if (hasCat) return S.listProgressByCategory.all(Number(category_id));
  return S.listProgress.all();
}

/**
 * Upserts one quiz run, keyed on `session_id`.
 *
 * A quiz is saved repeatedly while in progress (after every answered question)
 * and once more when it finishes. Keying on `session_id` means one run always
 * occupies exactly ONE row, and a quiz abandoned halfway still leaves a record.
 * Returns { row, created } so the route can answer 201 vs 200.
 */
function saveProgress(b) {
  const now = new Date().toISOString();
  const sessionId = b.session_id ? String(b.session_id) : null;
  const completed = b.completed !== false; // legacy callers omit it → treat as finished

  if (sessionId) {
    const existing = S.getProgressBySession.get(sessionId);
    if (existing) {
      S.updateProgressBySession.run(
        Number(b.score) || 0,
        Number(b.total) || 0,
        Number(b.answered) || 0,
        completed ? 1 : 0,
        now,
        sessionId
      );
      return { row: S.getProgressBySession.get(sessionId), created: false };
    }
  }

  const info = S.insertProgress.run(
    sessionId,
    b.learner,
    b.learner_id != null ? Number(b.learner_id) : null,
    Number(b.level) || 1,
    Number(b.category_id) || 0,
    b.quiz_type || 'multiple_choice',
    Number(b.score) || 0,
    Number(b.total) || 0,
    Number(b.answered) || 0,
    completed ? 1 : 0,
    now,
    now
  );
  return { row: S.getProgressById.get(Number(info.lastInsertRowid)), created: true };
}

function getStats() {
  const learners = S.statsByLearner.all().map((r) => ({
    learner: r.learner,
    attempts: r.attempts,
    completedAttempts: r.completedAttempts,
    partialAttempts: r.partialAttempts,
    totalScore: r.totalScore || 0,
    totalMax: r.totalMax || 0,
    byLevel: {},
  }));
  const index = new Map(learners.map((l) => [l.learner, l]));
  for (const r of S.statsByLearnerLevel.all()) {
    const l = index.get(r.learner);
    if (l) l.byLevel[r.level] = { attempts: r.attempts, score: r.score || 0, max: r.max || 0 };
  }
  return {
    totalVocabulary: S.countVocabulary.get().n,
    totalCategories: S.countCategories.get().n,
    totalQuizAttempts: S.countProgress.get().n,
    totalPartialAttempts: S.countPartial.get().n,
    learners,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const findUserByUsername = (username) => S.getUserByUsername.get(String(username));
const getUserById = (id) => S.getUserById.get(Number(id));

/** Verifies credentials and transparently upgrades a legacy plaintext password to scrypt. */
function authenticate(username, password) {
  const user = findUserByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  if (needsRehash(user.password_hash)) S.setUserPassword.run(hashPassword(password), user.id);
  return user;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const getSessionRow = (sid) => S.getSession.get(sid);
const putSessionRow = (sid, json, expiresAt) => S.upsertSession.run(sid, json, expiresAt);
const dropSessionRow = (sid) => S.deleteSession.run(sid);
const purgeExpiredSessions = () => S.purgeSessions.run(Date.now()).changes;

// ---------------------------------------------------------------------------
// Backup — a consistent snapshot while the app keeps running.
//
// NOTE: with WAL enabled the database also has `-wal` / `-shm` sidecar files,
// so copying the .db file alone can miss recent writes. `VACUUM INTO` produces
// one self-contained, consistent file. Copy the result OFF the disk — a
// snapshot sitting on the same disk is not a backup.
// ---------------------------------------------------------------------------

function snapshot(destPath) {
  const target = String(destPath).replace(/\\/g, '/');
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return destPath;
}

function close() {
  try { db.close(); } catch { /* already closed */ }
}

module.exports = {
  db,
  DB_PATH,
  DATA_DIR,
  seeded,

  hashPassword,
  verifyPassword,
  authenticate,

  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,

  listVocabulary,
  getVocabulary,
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,

  listProgress,
  saveProgress,
  getStats,

  findUserByUsername,
  getUserById,

  getSessionRow,
  putSessionRow,
  dropSessionRow,
  purgeExpiredSessions,

  snapshot,
  close,
};
