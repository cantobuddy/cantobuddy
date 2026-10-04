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
const os = require('os');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { SEED_CATEGORIES, SEED_VOCABULARY, SEED_USERS } = require('./data');
const { SEED_STICKERS } = require('./stickers');

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

/**
 * Where the SQLite file lives.
 *
 * DATA_DIR wins (production mounts a persistent disk there). Otherwise the app
 * directory is used — but some hosting sandboxes ship the source read-only, so
 * each candidate is proved writable with a real write before it is accepted.
 * Falling back to the OS temp dir keeps the app bootable there; the trade-off
 * is that such a deployment's data does not survive a restart, which is fine
 * for a preview and wrong for production — hence DATA_DIR in the container.
 */
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    __dirname,
    path.join(os.tmpdir(), 'cantobuddy'),
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.cantobuddy-write-probe');
      fs.writeFileSync(probe, '');
      fs.unlinkSync(probe);
      return dir;
    } catch {
      /* not writable — try the next candidate */
    }
  }
  throw new Error('CantoBuddy: no writable directory available for the database.');
}

const DATA_DIR = resolveDataDir();

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

  /* A learner is a PERSON USING THE APP ON A DEVICE — deliberately not a
     login account. Helpers must be able to use CantoBuddy fully without ever
     creating one, so identity here is a long random token held in the
     browser's localStorage. The users table is only for people who can sign in.
     Keeping the two apart is what lets "connect to my employer" stay opt-in
     rather than a precondition for using the app. */
  CREATE TABLE IF NOT EXISTS learners (
    id           INTEGER PRIMARY KEY,
    public_id    TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    created_at   TEXT,
    last_seen_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'learner',
    name          TEXT NOT NULL DEFAULT '',
    email         TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    learner_id    INTEGER REFERENCES learners(id) ON DELETE SET NULL,
    last_login_at TEXT,
    created_at    TEXT
  );

  /* An employer invites a helper by sharing a link. No email is sent — there
     is no mail provider in this app — so the code in the URL *is* the delivery
     mechanism, which also suits how helpers actually communicate. */
  CREATE TABLE IF NOT EXISTS invitations (
    id           INTEGER PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    employer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    helper_label TEXT NOT NULL DEFAULT '',
    note         TEXT NOT NULL DEFAULT '',
    created_at   TEXT,
    expires_at   TEXT NOT NULL,
    accepted_at  TEXT,
    accepted_by  INTEGER REFERENCES learners(id) ON DELETE SET NULL,
    revoked_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_invitations_employer ON invitations(employer_id);
  CREATE INDEX IF NOT EXISTS idx_invitations_code     ON invitations(code);

  /* The consent record. A helper can revoke this at any time in one tap, and
     the employer sees learning progress only — never anything else. */
  CREATE TABLE IF NOT EXISTS employer_learners (
    id            INTEGER PRIMARY KEY,
    employer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learner_id    INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    invitation_id INTEGER REFERENCES invitations(id) ON DELETE SET NULL,
    connected_at  TEXT,
    revoked_at    TEXT,
    revoked_by    TEXT,
    UNIQUE(employer_id, learner_id)
  );
  CREATE INDEX IF NOT EXISTS idx_emp_learners_employer ON employer_learners(employer_id);
  CREATE INDEX IF NOT EXISTS idx_emp_learners_learner  ON employer_learners(learner_id);

  CREATE TABLE IF NOT EXISTS progress (
    id          INTEGER PRIMARY KEY,
    session_id  TEXT UNIQUE,
    learner     TEXT NOT NULL,
    learner_id  INTEGER REFERENCES learners(id) ON DELETE SET NULL,
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
  CREATE INDEX IF NOT EXISTS idx_progress_learner    ON progress(learner);
  CREATE INDEX IF NOT EXISTS idx_progress_level      ON progress(level);
  CREATE INDEX IF NOT EXISTS idx_progress_learner_id ON progress(learner_id);

  /* Which stickers a learner has collected.
     Only the UNLOCK is stored, not the credit balance: credits are derived by
     summing progress.score, so they can never drift out of step with the quiz
     results they came from. This table exists purely to record WHEN a sticker
     was earned — which is what lets the app celebrate a new one exactly once,
     instead of re-announcing it every time the album is opened.
     UNIQUE(learner_id, sticker_key) makes unlocking idempotent. */
  CREATE TABLE IF NOT EXISTS learner_stickers (
    id          INTEGER PRIMARY KEY,
    learner_id  INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    sticker_key TEXT NOT NULL,
    unlocked_at TEXT,
    UNIQUE(learner_id, sticker_key)
  );
  CREATE INDEX IF NOT EXISTS idx_learner_stickers ON learner_stickers(learner_id);

  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

  /* Password reset. There is no mail provider, so a reset link is minted and
     handed to the operator rather than emailed. The token machinery is
     complete either way, so adding an email sender later is a one-function
     change and nothing here has to move. */
  CREATE TABLE IF NOT EXISTS password_resets (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT,
    expires_at TEXT NOT NULL,
    used_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
`);

// ---------------------------------------------------------------------------
// Migration — bring an EXISTING database up to the current schema.
//
// A fresh file already gets the right shape from the CREATE TABLEs above, so
// everything here is guarded by an inspection of the live schema and does
// nothing on a new database. It must stay idempotent: it runs on the
// production file every boot.
// ---------------------------------------------------------------------------

function columnNames(table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

function addColumnIfMissing(table, column, definition) {
  if (columnNames(table).has(column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

function migrateSchema() {
  const changes = [];

  if (addColumnIfMissing('users', 'email', 'TEXT')) changes.push('users.email');
  if (addColumnIfMissing('users', 'status', "TEXT NOT NULL DEFAULT 'active'")) changes.push('users.status');
  if (addColumnIfMissing('users', 'last_login_at', 'TEXT')) changes.push('users.last_login_at');
  if (addColumnIfMissing('users', 'learner_id', 'INTEGER REFERENCES learners(id) ON DELETE SET NULL')) {
    changes.push('users.learner_id');
  }

  // progress.learner_id used to reference users(id), which could never be
  // populated because helpers do not have accounts. It now references
  // learners(id). SQLite cannot alter a foreign key in place, so the table is
  // rebuilt. foreign_keys must be OFF for the swap, and that pragma cannot be
  // changed inside a transaction — hence the explicit ordering below.
  //
  // Note the index handling: index names are global, so the old
  // idx_progress_learner would collide if the new table carried it before the
  // old table was dropped. Create the table bare, drop the old one (which
  // takes its indexes with it), rename, then create the indexes.
  const staleFk = db.prepare('PRAGMA foreign_key_list(progress)').all().some((f) => f.table === 'users');
  if (staleFk) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE progress_new (
          id          INTEGER PRIMARY KEY,
          session_id  TEXT UNIQUE,
          learner     TEXT NOT NULL,
          learner_id  INTEGER REFERENCES learners(id) ON DELETE SET NULL,
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
        INSERT INTO progress_new
          (id, session_id, learner, learner_id, level, category_id, quiz_type, score, total, answered, completed, created_at, updated_at)
          SELECT id, session_id, learner, NULL, level, category_id, quiz_type, score, total, answered, completed, created_at, updated_at
          FROM progress;
        DROP TABLE progress;
        ALTER TABLE progress_new RENAME TO progress;
        CREATE INDEX IF NOT EXISTS idx_progress_learner    ON progress(learner);
        CREATE INDEX IF NOT EXISTS idx_progress_level      ON progress(level);
        CREATE INDEX IF NOT EXISTS idx_progress_learner_id ON progress(learner_id);
      `);
      db.exec('COMMIT');
      changes.push('progress rebuilt so learner_id references learners');
    } catch (err) {
      db.exec('ROLLBACK');
      db.exec('PRAGMA foreign_keys = ON');
      throw err;
    }
    db.exec('PRAGMA foreign_keys = ON');
  }

  // Give every pre-existing progress row a learner identity. Before this
  // migration the ONLY identity available was the typed name, so that is what
  // we key on. The unavoidable consequence: two helpers who typed the same
  // name were already merged, and their historical rows stay merged. New
  // progress is keyed on the device identity, so the problem stops growing.
  const orphans = db
    .prepare(
      `SELECT DISTINCT learner FROM progress
        WHERE learner IS NOT NULL AND learner <> '' AND learner_id IS NULL`
    )
    .all();

  if (orphans.length) {
    const insLearner = db.prepare(
      'INSERT INTO learners (public_id, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?)'
    );
    const attach = db.prepare('UPDATE progress SET learner_id = ? WHERE learner = ? AND learner_id IS NULL');
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      for (const row of orphans) {
        const publicId = 'legacy_' + crypto.randomBytes(16).toString('hex');
        const info = insLearner.run(publicId, row.learner, now, now);
        attach.run(Number(info.lastInsertRowid), row.learner);
      }
      db.exec('COMMIT');
      changes.push(`backfilled ${orphans.length} learner(s) from existing progress`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // The single seeded admin predates the email/status columns.
  db.exec("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''");

  return changes;
}

const migrations = migrateSchema();

// ---------------------------------------------------------------------------
// Seed (only when the database is brand new and empty)
// ---------------------------------------------------------------------------

/**
 * The password to create an account with, when the seed file does not carry one.
 *
 * A committed default is not an option — this repository is public, so a value
 * written here would be a published credential. The environment supplies it
 * when it can; otherwise a random one is generated and reported once.
 */
function resolveSeedPassword(username) {
  const envUser = String(process.env.ADMIN_USER || '').trim().toLowerCase();
  const envPass = process.env.ADMIN_PASSWORD;
  if (envUser && envPass && String(username).trim().toLowerCase() === envUser) {
    return { password: envPass, generated: false };
  }
  return { password: crypto.randomBytes(18).toString('base64url'), generated: true };
}

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

  const generated = [];

  db.exec('BEGIN');
  try {
    SEED_CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.icon || '📁', i));
    SEED_VOCABULARY.forEach((v) =>
      insVocab.run(v.id, v.cantonese, v.jyutping, v.english, v.tagalog || '', v.emoji || '📝', v.level || 1, v.category_id ?? null, now, now)
    );
    SEED_USERS.forEach((u) => {
      const r = u.password ? { password: u.password, generated: false } : resolveSeedPassword(u.username);
      if (r.generated) generated.push({ username: u.username, password: r.password });
      insUser.run(u.id, u.username, hashPassword(r.password), u.role || 'admin', u.name || '', now);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Printed once, on the run that creates the account. There is no other way
  // for the operator to learn a generated password, and it is deliberately
  // never written to disk in plaintext.
  generated.forEach((g) => {
    console.log('\n  ─────────────────────────────────────────────────────────────');
    console.log('   No ADMIN_PASSWORD was set, so a random one was generated.');
    console.log(`     username: ${g.username}`);
    console.log(`     password: ${g.password}`);
    console.log('   Set ADMIN_USER / ADMIN_PASSWORD to choose this yourself.');
    console.log('  ─────────────────────────────────────────────────────────────\n');
  });

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
    `UPDATE progress SET learner = ?, learner_id = ?, score = ?, total = ?, answered = ?, completed = ?, updated_at = ?
     WHERE session_id = ?`
  ),

  countVocabulary: db.prepare('SELECT COUNT(*) AS n FROM vocabulary'),
  countCategories: db.prepare('SELECT COUNT(*) AS n FROM categories'),
  countProgress: db.prepare('SELECT COUNT(*) AS n FROM progress'),
  countPartial: db.prepare('SELECT COUNT(*) AS n FROM progress WHERE completed = 0'),
  // Reporting keys on learner_id, never on the name. Grouping by `learner` (the
  // name text) merged two helpers who happen to share one — "Maria" is one of
  // the most common names in the Philippines — into a single row with their
  // scores added together, presented to the operator as fact.
  //
  // The name comes from the learners table, not from the progress row: progress
  // stores the name as it was when the row was written, so reading it back
  // would show a stale name after the helper renames herself.
  //
  // Rows written before device tokens existed have no learner_id. They fall
  // back to the name, which is the best key those rows have — and the GROUP BY
  // keeps them in their own bucket rather than mixing them with anyone.
  statsAllByLearnerId: db.prepare(`
    SELECT p.learner_id AS learner_id,
           COALESCE(l.display_name, p.learner) AS learner,
           COUNT(*) AS attempts,
           SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) AS completedAttempts,
           SUM(CASE WHEN p.completed = 0 THEN 1 ELSE 0 END) AS partialAttempts,
           SUM(p.score) AS totalScore,
           SUM(p.total) AS totalMax
      FROM progress p
      LEFT JOIN learners l ON l.id = p.learner_id
     GROUP BY p.learner_id, COALESCE(l.display_name, p.learner)
     ORDER BY learner COLLATE NOCASE, p.learner_id
  `),
  statsAllByLearnerIdLevel: db.prepare(`
    SELECT p.learner_id AS learner_id,
           COALESCE(l.display_name, p.learner) AS learner,
           p.level AS level,
           COUNT(*) AS attempts, SUM(p.score) AS score, SUM(p.total) AS max
      FROM progress p
      LEFT JOIN learners l ON l.id = p.learner_id
     GROUP BY p.learner_id, COALESCE(l.display_name, p.learner), p.level
  `),

  sumScoreByLearner: db.prepare('SELECT COALESCE(SUM(score), 0) AS n FROM progress WHERE learner_id = ?'),
  listStickersByLearner: db.prepare('SELECT sticker_key, unlocked_at FROM learner_stickers WHERE learner_id = ?'),
  // OR IGNORE + the UNIQUE constraint is what makes unlocking safe to repeat:
  // a second call for an already-earned sticker changes nothing.
  insertSticker: db.prepare('INSERT OR IGNORE INTO learner_stickers (learner_id, sticker_key, unlocked_at) VALUES (?, ?, ?)'),

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

  // --- learners (device identity, no account required) ---
  getLearnerById: db.prepare('SELECT * FROM learners WHERE id = ?'),
  getLearnerByPublicId: db.prepare('SELECT * FROM learners WHERE public_id = ?'),
  insertLearner: db.prepare(
    'INSERT INTO learners (public_id, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?)'
  ),
  updateLearnerName: db.prepare('UPDATE learners SET display_name = ?, last_seen_at = ? WHERE id = ?'),
  touchLearner: db.prepare('UPDATE learners SET last_seen_at = ? WHERE id = ?'),
  listLearners: db.prepare('SELECT * FROM learners ORDER BY id'),
  // A row created by the schema migration (public_id 'legacy_…') has no device
  // behind it yet. When a device first appears carrying the same name it adopts
  // that row, so progress recorded before device tokens existed is not orphaned.
  // After adoption the public_id is the device token, so this matches once only.
  getLegacyLearnerByName: db.prepare(
    "SELECT * FROM learners WHERE display_name = ? AND public_id LIKE 'legacy_%' ORDER BY id LIMIT 1"
  ),
  adoptLearnerPublicId: db.prepare('UPDATE learners SET public_id = ?, last_seen_at = ? WHERE id = ?'),

  // --- users (accounts) ---
  listUsers: db.prepare('SELECT * FROM users ORDER BY id'),
  insertUser: db.prepare(
    `INSERT INTO users (username, password_hash, role, name, email, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  updateUser: db.prepare('UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?'),
  touchUserLogin: db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?'),
  countActiveAdmins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'"),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

  // --- password resets ---
  insertReset: db.prepare(
    'INSERT INTO password_resets (token, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)'
  ),
  getReset: db.prepare('SELECT * FROM password_resets WHERE token = ?'),
  useReset: db.prepare('UPDATE password_resets SET used_at = ? WHERE token = ?'),
  purgeResets: db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL'),
  dropResetsForUser: db.prepare('DELETE FROM password_resets WHERE user_id = ?'),

  // --- invitations ---
  insertInvitation: db.prepare(
    `INSERT INTO invitations (code, employer_id, helper_label, note, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  getInvitationByCode: db.prepare('SELECT * FROM invitations WHERE code = ?'),
  getInvitationById: db.prepare('SELECT * FROM invitations WHERE id = ?'),
  listInvitationsByEmployer: db.prepare('SELECT * FROM invitations WHERE employer_id = ? ORDER BY id DESC'),
  acceptInvitation: db.prepare('UPDATE invitations SET accepted_at = ?, accepted_by = ? WHERE id = ?'),
  revokeInvitation: db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ?'),

  // --- employer <-> learner consent links ---
  // Re-accepting an invitation the helper previously revoked revives the link
  // rather than failing on the UNIQUE constraint.
  upsertLink: db.prepare(
    `INSERT INTO employer_learners (employer_id, learner_id, invitation_id, connected_at, revoked_at, revoked_by)
     VALUES (?, ?, ?, ?, NULL, NULL)
     ON CONFLICT(employer_id, learner_id) DO UPDATE SET
       revoked_at    = NULL,
       revoked_by    = NULL,
       connected_at  = excluded.connected_at,
       invitation_id = excluded.invitation_id`
  ),
  getLinkById: db.prepare('SELECT * FROM employer_learners WHERE id = ?'),
  listLinksByEmployer: db.prepare(
    `SELECT el.id, el.employer_id, el.learner_id, el.connected_at,
            l.display_name, l.public_id, l.last_seen_at
       FROM employer_learners el
       JOIN learners l ON l.id = el.learner_id
      WHERE el.employer_id = ? AND el.revoked_at IS NULL
      ORDER BY el.id`
  ),
  listLinksByLearner: db.prepare(
    `SELECT el.id, el.employer_id, el.connected_at,
            u.name AS employer_name, u.email AS employer_email
       FROM employer_learners el
       JOIN users u ON u.id = el.employer_id
      WHERE el.learner_id = ? AND el.revoked_at IS NULL
      ORDER BY el.id`
  ),
  revokeLinkById: db.prepare('UPDATE employer_learners SET revoked_at = ?, revoked_by = ? WHERE id = ?'),

  // --- operator view: who is on the platform, and who is connected to whom ---
  listEmployers: db.prepare(
    "SELECT * FROM users WHERE role = 'employer' ORDER BY name COLLATE NOCASE, id"
  ),
  listAllLinksByEmployer: db.prepare('SELECT * FROM employer_learners WHERE employer_id = ? ORDER BY id'),
  countInvitationsByEmployer: db.prepare('SELECT COUNT(*) AS n FROM invitations WHERE employer_id = ?'),
  countPendingInvitationsByEmployer: db.prepare(
    'SELECT COUNT(*) AS n FROM invitations WHERE employer_id = ? AND accepted_at IS NULL AND revoked_at IS NULL'
  ),
  // Learners nobody can currently see — no *active* consent link to any employer.
  // A revoked link does not count, so a helper who withdrew access appears here.
  listLearnersWithoutEmployer: db.prepare(
    `SELECT l.* FROM learners l
      WHERE NOT EXISTS (
        SELECT 1 FROM employer_learners el
         WHERE el.learner_id = l.id AND el.revoked_at IS NULL
      )
      ORDER BY l.display_name COLLATE NOCASE, l.id`
  ),

  // --- progress read by learner id (what an employer is allowed to see) ---
  listProgressByLearnerId: db.prepare('SELECT * FROM progress WHERE learner_id = ? ORDER BY id'),
  statsByLearnerId: db.prepare(`
    SELECT COUNT(*) AS attempts,
           SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completedAttempts,
           SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS partialAttempts,
           SUM(score) AS totalScore,
           SUM(total) AS totalMax,
           MAX(updated_at) AS lastActive
      FROM progress WHERE learner_id = ?
  `),
  statsByLearnerIdLevel: db.prepare(`
    SELECT level, COUNT(*) AS attempts, SUM(score) AS score, SUM(total) AS max
      FROM progress WHERE learner_id = ? GROUP BY level
  `),
  countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
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

function listProgress({ learner, learner_id, level, category_id } = {}) {
  // The device identity is the authoritative key now; the name is only kept
  // for legacy rows written before learners existed.
  if (learner_id != null && learner_id !== '') return S.listProgressByLearnerId.all(Number(learner_id));

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
  // Accept a boolean OR the 0/1 the read path returns. `0 !== false`, so a
  // caller that echoed back a row it had just read would otherwise flip an
  // abandoned quiz to "completed". Legacy callers that omit it mean finished.
  const raw = b.completed;
  const completed = !(raw === false || raw === 0 || raw === '0');
  const learnerId = b.learner_id != null && b.learner_id !== '' ? Number(b.learner_id) : null;

  if (sessionId) {
    const existing = S.getProgressBySession.get(sessionId);
    if (existing) {
      S.updateProgressBySession.run(
        b.learner ?? existing.learner,
        learnerId ?? existing.learner_id,
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
    learnerId,
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
  const learners = S.statsAllByLearnerId.all().map((r) => ({
    // learner_id is null only for rows written before device tokens existed.
    learner_id: r.learner_id == null ? null : Number(r.learner_id),
    learner: r.learner || 'Learner',
    attempts: r.attempts,
    completedAttempts: r.completedAttempts,
    partialAttempts: r.partialAttempts,
    totalScore: r.totalScore || 0,
    totalMax: r.totalMax || 0,
    byLevel: {},
  }));

  // Key the level rows exactly the way the query grouped them, or the per-level
  // breakdown lands on the wrong person. Two learners sharing a name must not
  // collide here — that is the whole point of keying on the id.
  const key = (r) => (r.learner_id == null ? `name:${r.learner}` : `id:${Number(r.learner_id)}`);
  const index = new Map(learners.map((l) => [key(l), l]));
  for (const r of S.statsAllByLearnerIdLevel.all()) {
    const l = index.get(key(r));
    if (l) l.byLevel[r.level] = { attempts: r.attempts, score: r.score || 0, max: r.max || 0 };
  }

  return {
    totalVocabulary: S.countVocabulary.get().n,
    totalCategories: S.countCategories.get().n,
    totalQuizAttempts: S.countProgress.get().n,
    totalPartialAttempts: S.countPartial.get().n,
    totalUsers: S.countUsers.get().n,
    totalLearners: S.listLearners.all().length,
    learners,
  };
}

// ---------------------------------------------------------------------------
// Rewards — credits and stickers
// ---------------------------------------------------------------------------

/**
 * A learner's credit balance: one credit per correct quiz answer, ever.
 *
 * Derived rather than stored. `progress` is already upserted on `session_id`,
 * so a quiz in progress holds exactly one row at any moment — summing `score`
 * across a learner's rows cannot double-count a single attempt, and retaking a
 * quiz legitimately earns again because it is a new session. The alternative
 * (a running ledger updated on every write) would need reconciliation the first
 * time a row is updated rather than inserted, which is exactly the bug this
 * avoids.
 */
function getCredits(learnerId) {
  return Number(S.sumScoreByLearner.get(Number(learnerId)).n) || 0;
}

/**
 * The full reward state for a learner, with any newly-earned stickers unlocked
 * as a side effect.
 *
 * Returns `newly_unlocked` so the caller can celebrate a sticker exactly once:
 * the unlock is recorded here, so the next call reports nothing new. That is
 * the whole reason `learner_stickers` exists as a table.
 */
function getRewards(learnerId) {
  const id = Number(learnerId);
  const credits = getCredits(id);

  const earned = SEED_STICKERS.filter((s) => credits >= s.credits).map((s) => s.key);
  const now = new Date().toISOString();
  const newly = [];
  for (const key of earned) {
    if (S.insertSticker.run(id, key, now).changes > 0) newly.push(key);
  }

  const stamps = {};
  for (const r of S.listStickersByLearner.all(id)) stamps[r.sticker_key] = r.unlocked_at;

  return {
    credits,
    stickers: SEED_STICKERS.map((s) => ({
      ...s,
      unlocked: Boolean(stamps[s.key]),
      unlocked_at: stamps[s.key] || null,
    })),
    newly_unlocked: newly,
    // What to aim for next, so the album can show a progress bar.
    next: SEED_STICKERS.find((s) => credits < s.credits) || null,
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
  if (user.status && user.status !== 'active') return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  if (needsRehash(user.password_hash)) S.setUserPassword.run(hashPassword(password), user.id);
  S.touchUserLogin.run(new Date().toISOString(), user.id);
  return S.getUserById.get(user.id);
}

const listUsers = () => S.listUsers.all();
const countActiveAdmins = () => S.countActiveAdmins.get().n;

/**
 * Creates an account. `username` is the login id — for employers it is their
 * email address, which keeps one unique key rather than two.
 */
function createUser({ username, password, role = 'learner', name = '', email = null, status = 'active' }) {
  const id = String(username || '').trim().toLowerCase();
  if (!id) throw new Error('username is required');
  if (!password) throw new Error('password is required');
  const now = new Date().toISOString();
  const info = S.insertUser.run(id, hashPassword(password), role, name || '', email || id, status, now);
  return S.getUserById.get(Number(info.lastInsertRowid));
}

function updateUser(id, patch) {
  const current = S.getUserById.get(Number(id));
  if (!current) return null;
  S.updateUser.run(
    patch.name ?? current.name,
    patch.email ?? current.email,
    patch.role ?? current.role,
    patch.status ?? current.status,
    Number(id)
  );
  return S.getUserById.get(Number(id));
}

/** Refuses to remove the last active admin — that would lock everyone out. */
function deleteUser(id) {
  const user = S.getUserById.get(Number(id));
  if (!user) return false;
  if (user.role === 'admin' && countActiveAdmins() <= 1) {
    const err = new Error('Cannot delete the last active admin account.');
    err.code = 'LAST_ADMIN';
    throw err;
  }
  return S.deleteUser.run(Number(id)).changes > 0;
}

/**
 * Makes ADMIN_USER / ADMIN_PASSWORD authoritative, on every boot.
 *
 * Two problems this solves. First, without it the environment could only ever
 * *add* a credential: the row created on the very first run would keep working
 * for ever, so the operator could never actually retire a password without
 * shell access to the disk. Second, it keeps the database honest — when the
 * environment is configured, the stored hash is that password and nothing
 * else, so there is no forgotten second way in.
 *
 * The practical effect is that rotation is "change the variable, restart".
 */
function syncEnvAdmin() {
  const username = String(process.env.ADMIN_USER || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return { configured: false };

  const existing = S.getUserByUsername.get(username);
  if (existing) {
    // Re-hash only when the stored value no longer matches, so an ordinary
    // boot does not churn the hash (and its salt) for no reason.
    let alreadyMatches = false;
    try { alreadyMatches = verifyPassword(password, existing.password_hash); } catch { alreadyMatches = false; }
    if (alreadyMatches && existing.role === 'admin' && existing.status === 'active') {
      return { configured: true, action: 'unchanged', username };
    }
    db.prepare('UPDATE users SET password_hash = ?, role = ?, status = ? WHERE id = ?')
      .run(hashPassword(password), 'admin', 'active', existing.id);
    return { configured: true, action: 'updated', username };
  }

  createUser({ username, password, role: 'admin', name: 'Operator' });
  return { configured: true, action: 'created', username };
}

/** Result of the boot-time sync, surfaced in the startup banner. */
const envAdmin = syncEnvAdmin();

// ---------------------------------------------------------------------------
// Learners — a person using the app on a device, with or without an account
// ---------------------------------------------------------------------------

const getLearnerById = (id) => S.getLearnerById.get(Number(id));
const getLearnerByPublicId = (pid) => S.getLearnerByPublicId.get(String(pid));

/**
 * Resolves the device token from the browser into a learner row, creating one
 * on first contact. The token is the identity; the name is just a label the
 * helper can change at any time without losing their history.
 */
function identifyLearner({ public_id, display_name }) {
  const pid = String(public_id || '').trim();
  if (!pid) throw new Error('public_id is required');
  const now = new Date().toISOString();
  const name = (display_name || '').trim();

  const existing = getLearnerByPublicId(pid);
  if (existing) {
    if (name && name !== existing.display_name) {
      S.updateLearnerName.run(name, now, existing.id);
    } else {
      S.touchLearner.run(now, existing.id);
    }
    return getLearnerById(existing.id);
  }

  // First contact from this device. If a pre-device learner row carries the same
  // name and is still unclaimed, adopt it — otherwise the helper's older
  // progress would sit under a row no device can ever reach again.
  if (name) {
    const legacy = S.getLegacyLearnerByName.get(name);
    if (legacy) {
      S.adoptLearnerPublicId.run(pid, now, legacy.id);
      return getLearnerById(legacy.id);
    }
  }

  const info = S.insertLearner.run(pid, name, now, now);
  return getLearnerById(Number(info.lastInsertRowid));
}

/** Who this learner has chosen to share their progress with. */
const listEmployersForLearner = (learnerId) => S.listLinksByLearner.all(Number(learnerId));

/** The learners an employer is allowed to see — accepted invitations only. */
const listLearnersForEmployer = (employerId) => S.listLinksByEmployer.all(Number(employerId));

/**
 * Revokes a consent link. `by` is 'learner' or 'employer' and is recorded, so
 * there is a trail if the relationship is ever disputed.
 */
function revokeLink(linkId, by = 'learner') {
  const link = S.getLinkById.get(Number(linkId));
  if (!link) return false;
  return S.revokeLinkById.run(new Date().toISOString(), String(by), Number(linkId)).changes > 0;
}

// ---------------------------------------------------------------------------
// Password resets
// ---------------------------------------------------------------------------

const RESET_TTL_MS = 60 * 60 * 1000; // one hour

/**
 * Mints a single-use reset token. Nothing is emailed — there is no mail
 * provider — so the caller decides how to deliver it. Swapping in an email
 * sender later means calling this and then sending `token`; nothing else moves.
 */
function createResetToken(userId) {
  const user = S.getUserById.get(Number(userId));
  if (!user) return null;
  S.dropResetsForUser.run(user.id); // one live token per account
  const token = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  S.insertReset.run(token, user.id, new Date(now).toISOString(), new Date(now + RESET_TTL_MS).toISOString());
  return { token, user, expires_at: new Date(now + RESET_TTL_MS).toISOString() };
}

/** Validates a token without consuming it, so a form can be shown first. */
function peekResetToken(token) {
  const row = S.getReset.get(String(token || ''));
  if (!row) return null;
  if (row.used_at) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  const user = S.getUserById.get(row.user_id);
  if (!user) return null;
  return { reset: row, user };
}

function consumeResetToken(token, newPassword) {
  const found = peekResetToken(token);
  if (!found) return null;
  if (!newPassword || String(newPassword).length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.code = 'WEAK_PASSWORD';
    throw err;
  }
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    S.setUserPassword.run(hashPassword(newPassword), found.user.id);
    S.useReset.run(now, String(token));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return S.getUserById.get(found.user.id);
}

const purgeExpiredResets = () => S.purgeResets.run(new Date().toISOString()).changes;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Ambiguous characters (0/O, 1/I/L) are left out — these codes get read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newInviteCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function createInvitation({ employer_id, helper_label = '', note = '', ttl_ms = INVITE_TTL_MS }) {
  const employer = S.getUserById.get(Number(employer_id));
  if (!employer) throw new Error('Unknown employer');
  const now = Date.now();

  // Retry on the (vanishingly unlikely) code collision rather than failing.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    try {
      const info = S.insertInvitation.run(
        code,
        employer.id,
        String(helper_label || '').slice(0, 80),
        String(note || '').slice(0, 400),
        new Date(now).toISOString(),
        new Date(now + ttl_ms).toISOString()
      );
      return S.getInvitationById.get(Number(info.lastInsertRowid));
    } catch (err) {
      if (!String(err.message || '').includes('UNIQUE')) throw err;
    }
  }
  throw new Error('Could not allocate an invitation code.');
}

const getInvitationByCode = (code) => S.getInvitationByCode.get(String(code || '').trim().toUpperCase());
const listInvitations = (employerId) => S.listInvitationsByEmployer.all(Number(employerId));

/** 'pending' | 'accepted' | 'revoked' | 'expired' — computed, never stored. */
function invitationStatus(inv) {
  if (!inv) return null;
  if (inv.revoked_at) return 'revoked';
  if (inv.accepted_at) return 'accepted';
  if (Date.parse(inv.expires_at) < Date.now()) return 'expired';
  return 'pending';
}

function revokeInvitation(id, employerId) {
  const inv = S.getInvitationById.get(Number(id));
  if (!inv || inv.employer_id !== Number(employerId)) return false;
  return S.revokeInvitation.run(new Date().toISOString(), inv.id).changes > 0;
}

/**
 * The helper accepts. Everything happens in one transaction: the invitation is
 * marked accepted, and the consent link is created (or revived, if this helper
 * had previously disconnected from this employer).
 */
function acceptInvitation({ code, learner }) {
  const inv = getInvitationByCode(code);
  const status = invitationStatus(inv);
  if (!inv || (status !== 'pending' && status !== 'accepted')) {
    const err = new Error(
      status === 'expired' ? 'This invitation has expired.'
        : status === 'revoked' ? 'This invitation was cancelled.'
          : 'This invitation link is not valid.'
    );
    err.code = 'INVITE_' + String(status || 'invalid').toUpperCase();
    throw err;
  }

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    S.acceptInvitation.run(now, learner.id, inv.id);
    S.upsertLink.run(inv.employer_id, learner.id, inv.id, now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { invitation: S.getInvitationById.get(inv.id), link: listEmployersForLearner(learner.id) };
}

// ---------------------------------------------------------------------------
// What an employer is allowed to see: learning progress, and nothing else
// ---------------------------------------------------------------------------

function getLearnerReport(learnerId) {
  const learner = getLearnerById(learnerId);
  if (!learner) return null;
  const totals = S.statsByLearnerId.get(learner.id) || {};
  const byLevel = {};
  for (const r of S.statsByLearnerIdLevel.all(learner.id)) {
    byLevel[r.level] = { attempts: r.attempts, score: r.score || 0, max: r.max || 0 };
  }
  const recent = S.listProgressByLearnerId
    .all(learner.id)
    .slice(-10)
    .reverse()
    .map((r) => ({
      id: r.id,
      level: r.level,
      quiz_type: r.quiz_type,
      score: r.score,
      total: r.total,
      answered: r.answered,
      completed: r.completed,
      updated_at: r.updated_at,
    }));

  return {
    learner: { id: learner.id, display_name: learner.display_name, last_seen_at: learner.last_seen_at },
    totals: {
      attempts: totals.attempts || 0,
      completedAttempts: totals.completedAttempts || 0,
      partialAttempts: totals.partialAttempts || 0,
      totalScore: totals.totalScore || 0,
      totalMax: totals.totalMax || 0,
      lastActive: totals.lastActive || null,
    },
    byLevel,
    recent,
  };
}

/**
 * Progress totals for one learner, in the shape the admin view displays.
 * Kept separate from getLearnerReport so the overview does not pay for the
 * recent-attempts query it never shows.
 */
function learnerSummary(learnerId) {
  const t = S.statsByLearnerId.get(learnerId) || {};
  const byLevel = {};
  for (const r of S.statsByLearnerIdLevel.all(learnerId)) {
    byLevel[r.level] = { attempts: r.attempts, score: r.score || 0, max: r.max || 0 };
  }
  return {
    attempts: t.attempts || 0,
    completedAttempts: t.completedAttempts || 0,
    partialAttempts: t.partialAttempts || 0,
    totalScore: t.totalScore || 0,
    totalMax: t.totalMax || 0,
    lastActive: t.lastActive || null,
    byLevel,
  };
}

/**
 * The operator's view: every employer, the helpers connected to them, and the
 * learners who are connected to nobody.
 *
 * Read-only on purpose. The operator runs the service but is not a party to the
 * consent relationship, so nothing here can create, alter or revoke a link.
 * Only *active* links are listed — a helper who withdrew access is counted, not
 * exposed.
 */
function getPeopleOverview() {
  const employers = S.listEmployers.all().map((u) => {
    const active = S.listLinksByEmployer.all(u.id);
    const all = S.listAllLinksByEmployer.all(u.id);
    return {
      id: u.id,
      username: u.username,
      name: u.name || u.username,
      email: u.email,
      status: u.status,
      created_at: u.created_at,
      last_login_at: u.last_login_at,
      helper_count: active.length,
      disconnected_count: all.filter((l) => l.revoked_at).length,
      invitations_sent: S.countInvitationsByEmployer.get(u.id).n,
      invitations_pending: S.countPendingInvitationsByEmployer.get(u.id).n,
      helpers: active.map((l) => ({
        link_id: l.id,
        learner_id: l.learner_id,
        display_name: l.display_name,
        connected_at: l.connected_at,
        last_seen_at: l.last_seen_at,
        summary: learnerSummary(l.learner_id),
      })),
    };
  });

  const unconnected = S.listLearnersWithoutEmployer.all().map((l) => ({
    learner_id: l.id,
    display_name: l.display_name,
    created_at: l.created_at,
    last_seen_at: l.last_seen_at,
    summary: learnerSummary(l.id),
  }));

  // A helper working for two families is still one person, so count distinct
  // learners rather than summing the per-employer counts.
  const distinctHelpers = new Set();
  for (const e of employers) for (const h of e.helpers) distinctHelpers.add(h.learner_id);

  return {
    employers,
    unconnected,
    totals: {
      employers: employers.length,
      employersWithHelpers: employers.filter((e) => e.helper_count > 0).length,
      helpers: distinctHelpers.size,
      unconnected: unconnected.length,
    },
  };
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
  migrations,

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

  getCredits,
  getRewards,

  findUserByUsername,
  getUserById,
  listUsers,
  countActiveAdmins,
  createUser,
  updateUser,
  deleteUser,
  syncEnvAdmin,
  envAdmin,

  getLearnerById,
  getLearnerByPublicId,
  identifyLearner,
  listEmployersForLearner,
  listLearnersForEmployer,
  revokeLink,
  getLearnerReport,
  getPeopleOverview,

  createResetToken,
  peekResetToken,
  consumeResetToken,
  purgeExpiredResets,

  createInvitation,
  getInvitationByCode,
  listInvitations,
  invitationStatus,
  revokeInvitation,
  acceptInvitation,

  getSessionRow,
  putSessionRow,
  dropSessionRow,
  purgeExpiredSessions,

  snapshot,
  close,
};
