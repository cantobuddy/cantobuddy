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
const { SEED_CATEGORIES, SEED_VOCABULARY, SEED_SCENARIOS, SEED_USERS } = require('./data');
const { SEED_STICKERS } = require('./stickers');

// ---------------------------------------------------------------------------
// Hong Kong time
//
// Defined up here because BOTH the recording path (a visit is stamped with the
// day it happened on) and the reporting path need it, and the recording path
// sits above the reporting section.
//
// The helpers are in Hong Kong and the app is for them, so "how many quizzes
// yesterday" has to mean yesterday in Hong Kong. In UTC, everything a helper
// does before 08:00 local time lands on the previous date — and early morning
// is exactly when someone caring for an elderly person gets a quiet moment.
// ---------------------------------------------------------------------------

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Hong Kong calendar date (YYYY-MM-DD) for an instant. */
const hktDate = (ms) => new Date(ms + HKT_OFFSET_MS).toISOString().slice(0, 10);

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

  /* A scenario is a SET of phrases for one situation — "asking for help", "at
     the clinic", "reporting to the family". It is a grouping, not an entry, so
     it gets its own table rather than being a value on a word.

     Deliberately the same shape as "categories" — same columns, same "enabled"
     switch — so the operator manages both the same way and one piece of admin
     code serves both. */
  CREATE TABLE IF NOT EXISTS scenarios (
    id          INTEGER PRIMARY KEY,
    name_en     TEXT NOT NULL,
    name_yue    TEXT NOT NULL DEFAULT '',
    name_fil    TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '💬',
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1
  );

  /* Small key/value store for things the app must remember ACROSS boots that
     are not user data. Currently used for the content version, so a content
     migration runs exactly once instead of re-inserting rows the operator may
     have deliberately deleted. */
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

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

  /* One row per learner per Hong Kong day — the daily rollup behind the
     visitor and practice numbers.

     Why a rollup and not an event log: the operator's question is "how many
     people came, and did she practise?" — not "what did she tap". One row per
     learner per day answers visits, practice-only learners, and the daily
     trend, while keeping what is stored to counts. A per-word browsing history
     would be a different product decision, and a more intimate one, so it is
     deliberately not what this is.

     UNIQUE(learner_id, day) turns every write into an upsert, so a day's
     visits, cards and quiz starts accumulate onto one row instead of creating
     a row per tap. That is what makes it safe to call on every page load.

     NOTE the day is a Hong Kong date, not a UTC one — see hktDate(). */
  CREATE TABLE IF NOT EXISTS learner_daily (
    id              INTEGER PRIMARY KEY,
    learner_id      INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    day             TEXT NOT NULL,
    visits          INTEGER NOT NULL DEFAULT 0,
    words_viewed    INTEGER NOT NULL DEFAULT 0,
    cards_opened    INTEGER NOT NULL DEFAULT 0,
    quizzes_started INTEGER NOT NULL DEFAULT 0,
    first_at        TEXT,
    last_at         TEXT,
    UNIQUE(learner_id, day)
  );
  CREATE INDEX IF NOT EXISTS idx_learner_daily_day     ON learner_daily(day);
  CREATE INDEX IF NOT EXISTS idx_learner_daily_learner ON learner_daily(learner_id);

  /* Page views by day and path, with NO learner link — deliberately.

     The landing pages are served as static HTML with no app runtime, so a
     visitor there is counted by a small beacon rather than by the app. Keeping
     this table aggregate and anonymous means search traffic is measurable
     without turning a Google visitor into a tracked person, and it keeps a
     path-level breakdown available for the SEO work.

     Which page a person read is not something this app needs to remember about
     them; how many people read it is something it does. */
  CREATE TABLE IF NOT EXISTS visit_daily (
    id    INTEGER PRIMARY KEY,
    day   TEXT NOT NULL,
    path  TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    UNIQUE(day, path)
  );
  CREATE INDEX IF NOT EXISTS idx_visit_daily_day ON visit_daily(day);
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

  /* Referral attribution.
     `referrer` records where a learner first arrived from — the `?ref=` value on
     the URL that created her device (a friend's code, or a channel tag like
     "sun" or "fbgroup"). First-touch: it is written once and never overwritten,
     so a later visit from a different link cannot steal credit.
     `referral_code` is her own code, the one that travels in the links she
     shares, so the chain of introductions is measurable. */
  if (addColumnIfMissing('learners', 'referrer', 'TEXT')) {
    changes.push('learners.referrer');
  }
  if (addColumnIfMissing('learners', 'referral_code', 'TEXT')) {
    changes.push('learners.referral_code');
  }

  /* An operator can switch a category off without deleting it. Disabling hides
     the category from learners AND removes its words from the pool the quiz
     draws on, so "off" means off rather than "hidden but still being tested on".
     Nothing is deleted: the words, and any progress already earned against them,
     survive, and switching it back on restores it exactly as it was. */
  if (addColumnIfMissing('categories', 'enabled', 'INTEGER NOT NULL DEFAULT 1')) {
    changes.push('categories.enabled');
  }

  /* -------------------------------------------------------------------------
     Vocabulary entry types — the schema gap that blocked "scenario phrases".

     Before this, every entry was assumed to be ONE WORD WITH ONE EMOJI. A
     phrase like 「幫我攞杯水」 is not that, and neither is a full sentence, so
     the app could not store the thing the brief actually asked for.

     - type      word | phrase | sentence
                 Lets the quiz engine stop offering match_picture for a
                 sentence (meaningless), lets fill_blank become real, and lets
                 the learner browse "phrases" as a distinct thing.
     - speaker   helper | elderly | either
                 THE field that encodes the whole point of the product. It
                 answers "am I learning to SAY this, or to UNDERSTAND it?"
                 「幫我攞杯水」 is heard; 「我喺度」 is said. Different drills.
     - scenario_id  groups phrases into a situation (see the scenarios table).
     ------------------------------------------------------------------------- */
  if (addColumnIfMissing('vocabulary', 'type', "TEXT NOT NULL DEFAULT 'word'")) {
    changes.push('vocabulary.type');
  }
  if (addColumnIfMissing('vocabulary', 'speaker', "TEXT NOT NULL DEFAULT 'either'")) {
    changes.push('vocabulary.speaker');
  }
  // No NOT NULL here, deliberately: SQLite refuses to ADD a column with a
  // REFERENCES clause unless its default is NULL.
  if (addColumnIfMissing('vocabulary', 'scenario_id', 'INTEGER REFERENCES scenarios(id) ON DELETE SET NULL')) {
    changes.push('vocabulary.scenario_id');
  }

  /* Depth per entry. The schema is the cheap part — these all default to empty
     and every screen already omits a field it has nothing to show for (exactly
     as the learner card already does with an empty `tagalog`). Filling them is
     the expensive part, and it happens incrementally.

     example_*  the word used in a real sentence — this is what makes fill_blank
                an actual question rather than a multiple-choice in disguise.
     usage_note formal? polite? only to children? rude? — matters a lot when the
                person you are speaking to is a frail elderly stranger.
     tags       free-form: "polite", "imperative", "question", "care". */
  if (addColumnIfMissing('vocabulary', 'example_yue', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.example_yue');
  }
  if (addColumnIfMissing('vocabulary', 'example_jyutping', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.example_jyutping');
  }
  if (addColumnIfMissing('vocabulary', 'example_en', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.example_en');
  }
  if (addColumnIfMissing('vocabulary', 'usage_note', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.usage_note');
  }
  if (addColumnIfMissing('vocabulary', 'tags', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.tags');
  }

  /* Review state. Content that reaches a carer of a frail elderly person and is
     WRONG is a safety problem, not a typo — so entries need somewhere to record
     whether a human has checked them. Defaults to 'published' so every existing
     entry, and every entry seeded below, stays visible; the draft-first workflow
     is the next step, not this one. */
  if (addColumnIfMissing('vocabulary', 'status', "TEXT NOT NULL DEFAULT 'published'")) {
    changes.push('vocabulary.status');
  }

  // Explicit curriculum position, so ordering can become a teaching sequence
  // rather than insertion order.
  if (addColumnIfMissing('vocabulary', 'sort_order', 'INTEGER NOT NULL DEFAULT 0')) {
    changes.push('vocabulary.sort_order');
  }

  // Indexes must come AFTER the columns exist — on an existing database the
  // column is only just being added above.
  db.exec('CREATE INDEX IF NOT EXISTS idx_vocab_scenario ON vocabulary(scenario_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_vocab_type     ON vocabulary(type)');

  /* One-time backfill of `type` for the entries that predate the column.
     Length is a serviceable proxy in Cantonese: 你好 is a word, 慢慢行 is a
     phrase, 唔好起身太快 is a sentence.

     Guarded by a meta flag rather than by "does the column look empty" — the
     column has a DEFAULT, so every row looks non-empty the moment it is added,
     and an unguarded UPDATE would keep overwriting whatever the operator had
     deliberately set on every boot. */
  if (!db.prepare("SELECT value FROM meta WHERE key = 'vocab_type_backfilled'").get()) {
    db.exec(`
      UPDATE vocabulary SET type = CASE
        WHEN length(cantonese) >= 5 THEN 'sentence'
        WHEN length(cantonese) >= 3 THEN 'phrase'
        ELSE 'word'
      END
      WHERE type = 'word';
      INSERT OR REPLACE INTO meta (key, value) VALUES ('vocab_type_backfilled', '1');
    `);
    changes.push('vocabulary.type backfilled from entry length');
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

/* Cantonese length is a serviceable proxy for word vs phrase vs sentence, and
   is used only where an entry does not state its own `type` (see the one-time
   backfill in migrateSchema, which must agree with this rule). */
function inferType(cantonese) {
  const n = [...String(cantonese || '')].length; // code points, not UTF-16 units
  if (n >= 5) return 'sentence';
  if (n >= 3) return 'phrase';
  return 'word';
}

// Every column a vocabulary row can carry, in insert order. One list, so the
// initial seed and every later content migration write identical shapes.
const VOCAB_COLUMNS =
  'id, cantonese, jyutping, english, tagalog, emoji, level, category_id, ' +
  'type, speaker, scenario_id, example_yue, example_jyutping, example_en, ' +
  'usage_note, tags, status, sort_order';
const VOCAB_PLACEHOLDERS = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';

function vocabValues(v) {
  return [
    v.id,
    v.cantonese,
    v.jyutping,
    v.english,
    v.tagalog || '',
    v.emoji || '📝',
    v.level || 1,
    v.category_id ?? null,
    v.type || inferType(v.cantonese),
    v.speaker || 'either',
    v.scenario_id ?? null,
    v.example_yue || '',
    v.example_jyutping || '',
    v.example_en || '',
    v.usage_note || '',
    v.tags || '',
    v.status || 'published',
    v.sort_order || 0,
  ];
}

/* Bumped whenever the SEED_* content changes in a way an EXISTING database
   needs to pick up. See migrateContent() below. */
const CONTENT_VERSION = 3; // v1 = the original 64 entries · v2 = Tier A expansion · v3 = coverage top-up (every category ≥5)

function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categories').get();
  if (n > 0) return false;

  const now = new Date().toISOString();
  const insCat = db.prepare(
    'INSERT INTO categories (id, name_en, name_yue, name_fil, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insScenario = db.prepare(
    `INSERT INTO scenarios (id, name_en, name_yue, name_fil, icon, description, sort_order, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insVocab = db.prepare(
    `INSERT INTO vocabulary (${VOCAB_COLUMNS}, created_at, updated_at) VALUES (${VOCAB_PLACEHOLDERS}, ?, ?)`
  );
  const insUser = db.prepare(
    'INSERT INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const generated = [];

  db.exec('BEGIN');
  try {
    SEED_CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.icon || '📁', i));
    SEED_SCENARIOS.forEach((s, i) =>
      insScenario.run(s.id, s.name_en, s.name_yue || '', s.name_fil || '', s.icon || '💬', s.description || '', s.sort_order ?? i, s.enabled ?? 1)
    );
    SEED_VOCABULARY.forEach((v) => insVocab.run(...vocabValues(v), now, now));
    SEED_USERS.forEach((u) => {
      const r = u.password ? { password: u.password, generated: false } : resolveSeedPassword(u.username);
      if (r.generated) generated.push({ username: u.username, password: r.password });
      insUser.run(u.id, u.username, hashPassword(r.password), u.role || 'admin', u.name || '', now);
    });
    // A brand-new file is already at the current content version, so the
    // content migration below has nothing to do on the next boot.
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'content_version',
      String(CONTENT_VERSION)
    );
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
// Content migration — bring an EXISTING database up to the current CONTENT set.
//
// seedIfEmpty() only runs on a brand-new file, so adding entries to data.js
// does nothing for a database that already has rows — which is every real
// deployment, and the production one carries live learner progress. This is
// the path that actually delivers new content to them.
//
// Two rules make it safe to run on the production file every boot:
//
//   1. It only ever ADDS. Existing rows are never updated or deleted, so an
//      operator's edits are preserved. `INSERT OR IGNORE` keys on the primary
//      id, so a row that is already there is left exactly as it is.
//   2. It is versioned. Without the `content_version` guard, a row the operator
//      had deliberately deleted would be resurrected on the next restart. The
//      guard means each content drop runs once and then never again.
//
// A database seeded by an older build has no `content_version` row, which
// reads as v1 — correct, because it holds the original content set.
// ---------------------------------------------------------------------------

function migrateContent() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'content_version'").get();
  const current = row ? Number(row.value) || 1 : 1;
  if (current >= CONTENT_VERSION) return null;

  const changes = [];
  const now = new Date().toISOString();
  const insCat = db.prepare(
    `INSERT OR IGNORE INTO categories (id, name_en, name_yue, name_fil, icon, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insScenario = db.prepare(
    `INSERT OR IGNORE INTO scenarios (id, name_en, name_yue, name_fil, icon, description, sort_order, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insVocab = db.prepare(
    `INSERT OR IGNORE INTO vocabulary (${VOCAB_COLUMNS}, created_at, updated_at)
     VALUES (${VOCAB_PLACEHOLDERS}, ?, ?)`
  );

  db.exec('BEGIN');
  try {
    let cats = 0;
    SEED_CATEGORIES.forEach((c, i) => {
      cats += insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.icon || '📁', c.sort_order ?? i).changes;
    });
    let scens = 0;
    SEED_SCENARIOS.forEach((s, i) => {
      scens += insScenario.run(
        s.id, s.name_en, s.name_yue || '', s.name_fil || '', s.icon || '💬', s.description || '', s.sort_order ?? i, s.enabled ?? 1
      ).changes;
    });
    let words = 0;
    SEED_VOCABULARY.forEach((v) => {
      words += insVocab.run(...vocabValues(v), now, now).changes;
    });
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'content_version',
      String(CONTENT_VERSION)
    );
    db.exec('COMMIT');

    if (words) changes.push(`+${words} vocabulary`);
    if (cats) changes.push(`+${cats} categories`);
    if (scens) changes.push(`+${scens} scenarios`);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return changes.length ? `content v${current} → v${CONTENT_VERSION}: ${changes.join(', ')}` : null;
}

const contentMigration = migrateContent();

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const S = {
  listCategories: db.prepare('SELECT * FROM categories ORDER BY sort_order, id'),
  // What a learner sees: switched-off categories are simply absent.
  listEnabledCategories: db.prepare('SELECT * FROM categories WHERE enabled = 1 ORDER BY sort_order, id'),
  listDisabledCategoryIds: db.prepare('SELECT id FROM categories WHERE enabled = 0'),
  getCategory: db.prepare('SELECT * FROM categories WHERE id = ?'),
  insertCategory: db.prepare(
    'INSERT INTO categories (name_en, name_yue, name_fil, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
  ),
  updateCategory: db.prepare(
    'UPDATE categories SET name_en = ?, name_yue = ?, name_fil = ?, icon = ?, enabled = ? WHERE id = ?'
  ),
  deleteCategory: db.prepare('DELETE FROM categories WHERE id = ?'),
  setCategoryOrder: db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?'),
  maxCategoryOrder: db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories'),

  // Scenarios — deliberately the same shape and the same switch as categories.
  listScenarios: db.prepare('SELECT * FROM scenarios ORDER BY sort_order, id'),
  listEnabledScenarios: db.prepare('SELECT * FROM scenarios WHERE enabled = 1 ORDER BY sort_order, id'),
  listDisabledScenarioIds: db.prepare('SELECT id FROM scenarios WHERE enabled = 0'),
  getScenario: db.prepare('SELECT * FROM scenarios WHERE id = ?'),
  insertScenario: db.prepare(
    'INSERT INTO scenarios (name_en, name_yue, name_fil, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  updateScenario: db.prepare(
    'UPDATE scenarios SET name_en = ?, name_yue = ?, name_fil = ?, icon = ?, description = ?, enabled = ? WHERE id = ?'
  ),
  deleteScenario: db.prepare('DELETE FROM scenarios WHERE id = ?'),
  maxScenarioOrder: db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM scenarios'),
  countScenarios: db.prepare('SELECT COUNT(*) AS n FROM scenarios'),

  listVocabulary: db.prepare('SELECT * FROM vocabulary ORDER BY level, id'),
  listVocabularyByLevel: db.prepare('SELECT * FROM vocabulary WHERE level = ? ORDER BY id'),
  listVocabularyByCategory: db.prepare('SELECT * FROM vocabulary WHERE category_id = ? ORDER BY level, id'),
  listVocabularyByBoth: db.prepare('SELECT * FROM vocabulary WHERE level = ? AND category_id = ? ORDER BY id'),
  listVocabularyByScenario: db.prepare('SELECT * FROM vocabulary WHERE scenario_id = ? ORDER BY level, sort_order, id'),
  listVocabularyByType: db.prepare('SELECT * FROM vocabulary WHERE type = ? ORDER BY level, id'),
  getVocabulary: db.prepare('SELECT * FROM vocabulary WHERE id = ?'),
  insertVocabulary: db.prepare(
    `INSERT INTO vocabulary (${VOCAB_COLUMNS}, created_at, updated_at)
     VALUES (${VOCAB_PLACEHOLDERS}, ?, ?)`
  ),
  updateVocabulary: db.prepare(
    `UPDATE vocabulary SET cantonese = ?, jyutping = ?, english = ?, tagalog = ?, emoji = ?, level = ?,
       category_id = ?, type = ?, speaker = ?, scenario_id = ?, example_yue = ?, example_jyutping = ?,
       example_en = ?, usage_note = ?, tags = ?, status = ?, sort_order = ?, updated_at = ?
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

  // --- operator reporting -------------------------------------------------
  // Per-learner activity, keyed on the device identity. This is the fact table
  // the platform totals, the per-employer engagement and the CSV all read from,
  // so it is computed once per request rather than re-aggregated per view.
  reportPerLearner: db.prepare(`
    SELECT p.learner_id AS learner_id,
           MAX(p.created_at) AS last_activity,
           COUNT(*) AS attempts,
           SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN p.completed = 0 THEN 1 ELSE 0 END) AS partial,
           SUM(p.score) AS correct,
           SUM(p.total) AS questions
      FROM progress p
     WHERE p.learner_id IS NOT NULL
     GROUP BY p.learner_id
  `),
  // One row per day. The +8 hours is not decoration: the helpers are in Hong
  // Kong, so a "day" has to be a Hong Kong day. Without it, everything a helper
  // does before 08:00 local time is counted against the previous date, and the
  // daily chart is quietly wrong for the hours she is most likely to use it.
  reportDaily: db.prepare(`
    SELECT date(p.created_at, '+8 hours') AS day,
           COUNT(*) AS attempts,
           SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) AS completed,
           SUM(p.score) AS correct,
           SUM(p.total) AS questions,
           COUNT(DISTINCT p.learner_id) AS learners
      FROM progress p
     WHERE p.created_at >= ?
     GROUP BY day
     ORDER BY day
  `),
  /* --- visitors and practice -------------------------------------------

     These read the learner_daily rollup rather than progress, which is the
     whole point: a learner who browses forty cards and never opens a quiz
     leaves no progress row at all, and before this table existed she was
     invisible to every report here.

     `day` is already a Hong Kong date (written by hktDate), so unlike the
     progress queries above these need no '+8 hours' conversion — converting
     twice would shift the day by another eight hours. */
  reportVisitorDaily: db.prepare(`
    SELECT day,
           COUNT(DISTINCT learner_id)  AS visitors,
           SUM(visits)                 AS visits,
           SUM(words_viewed)           AS words_viewed,
           SUM(cards_opened)           AS cards_opened,
           SUM(quizzes_started)        AS quizzes_started
      FROM learner_daily
     WHERE day >= ?
     GROUP BY day
     ORDER BY day
  `),
  // Arrivals, by the Hong Kong day they first appeared on. This is the only
  // place `new` comes from — learners.created_at is the true first contact,
  // whereas a first learner_daily row just means the first day we recorded.
  reportNewVisitorsDaily: db.prepare(`
    SELECT date(created_at, '+8 hours') AS day, COUNT(*) AS new_visitors
      FROM learners
     WHERE created_at >= ?
     GROUP BY day
     ORDER BY day
  `),
  // One row per learner who has any recorded activity, all-time. Small by
  // construction: it is one row per person, not one per day.
  reportLearnerEngagement: db.prepare(`
    SELECT learner_id,
           SUM(visits)          AS visits,
           SUM(words_viewed)    AS words_viewed,
           SUM(cards_opened)    AS cards_opened,
           SUM(quizzes_started) AS quizzes_started,
           COUNT(*)             AS days_active,
           MIN(day)             AS first_day,
           MAX(day)             AS last_day
      FROM learner_daily
     GROUP BY learner_id
  `),
  // Who has ever finished a quiz. Kept separate from learner_daily because a
  // quiz start is not the same claim as a quiz result, and the funnel needs
  // to distinguish them.
  reportQuizzedLearners: db.prepare(
    'SELECT DISTINCT learner_id FROM progress WHERE learner_id IS NOT NULL'
  ),
  reportTopPaths: db.prepare(`
    SELECT path, SUM(views) AS views
      FROM visit_daily
     WHERE day >= ?
     GROUP BY path
     ORDER BY views DESC, path
     LIMIT 15
  `),
  countPageViewsSince: db.prepare('SELECT COALESCE(SUM(views), 0) AS n FROM visit_daily WHERE day >= ?'),
  countLearners: db.prepare('SELECT COUNT(*) AS n FROM learners'),

  // Only live consent links: an employer's engagement is about the helpers who
  // can actually see them, not the ones who withdrew.
  reportActiveLinks: db.prepare(
    `SELECT el.employer_id AS employer_id,
            el.learner_id  AS learner_id,
            el.connected_at AS connected_at
       FROM employer_learners el
      WHERE el.revoked_at IS NULL`
  ),
  countLearnersSeenSince: db.prepare('SELECT COUNT(*) AS n FROM learners WHERE last_seen_at >= ?'),
  countLearnersCreatedSince: db.prepare('SELECT COUNT(*) AS n FROM learners WHERE created_at >= ?'),

  /* --- daily rollup: visits and practice -------------------------------

     Both statements UPSERT on (learner_id, day) / (day, path). That is the
     whole reason these are cheap enough to call on every page load: the tenth
     visit of a day updates one row rather than inserting a tenth.

     `first_at` is deliberately absent from the DO UPDATE clause. It has to
     record when the day STARTED, so an evening visit must not overwrite the
     morning one — the operator reads it to tell "opened it once" from "came
     back all day". `last_at` is the one that moves. */
  upsertLearnerDaily: db.prepare(`
    INSERT INTO learner_daily
      (learner_id, day, visits, words_viewed, cards_opened, quizzes_started, first_at, last_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(learner_id, day) DO UPDATE SET
      visits          = visits          + excluded.visits,
      words_viewed    = words_viewed    + excluded.words_viewed,
      cards_opened    = cards_opened    + excluded.cards_opened,
      quizzes_started = quizzes_started + excluded.quizzes_started,
      last_at         = excluded.last_at
  `),
  getLearnerDaily: db.prepare('SELECT * FROM learner_daily WHERE learner_id = ? AND day = ?'),

  upsertVisitDaily: db.prepare(`
    INSERT INTO visit_daily (day, path, views) VALUES (?, ?, ?)
    ON CONFLICT(day, path) DO UPDATE SET views = views + excluded.views
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
    'INSERT INTO learners (public_id, display_name, created_at, last_seen_at, referrer, referral_code) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  getLearnerByReferralCode: db.prepare('SELECT * FROM learners WHERE referral_code = ?'),
  setLearnerReferralCode: db.prepare('UPDATE learners SET referral_code = ? WHERE id = ?'),
  setLearnerReferrer: db.prepare(
    "UPDATE learners SET referrer = ? WHERE id = ? AND (referrer IS NULL OR referrer = '')"
  ),
  countByReferrer: db.prepare(
    `SELECT COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer, COUNT(*) AS n
       FROM learners GROUP BY referrer ORDER BY n DESC, referrer ASC`
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

  /*
   * Learner-scoped reporting — the learner's own view of her practice.
   *
   * Same Hong Kong day bucketing as reportDaily, and for the same reason: she
   * is in Hong Kong, so "yesterday" has to mean yesterday there. In UTC
   * everything she does before 08:00 lands on the previous date, and early
   * morning is exactly when someone caring for an elderly person gets a quiet
   * moment to practise.
   */
  learnerDaily: db.prepare(`
    SELECT date(created_at, '+8 hours') AS day,
           COUNT(*) AS attempts,
           SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
           SUM(score) AS correct,
           SUM(total) AS questions
      FROM progress
     WHERE learner_id = ? AND created_at >= ?
     GROUP BY day
     ORDER BY day
  `),
  /*
   * Every distinct Hong Kong day she has practised on, newest first.
   *
   * Streaks are computed from this and NOT from the windowed daily series, so a
   * long streak is never silently truncated to whatever range the chart happens
   * to be showing. Dates come back as YYYY-MM-DD, which sorts correctly as text.
   */
  learnerActiveDays: db.prepare(`
    SELECT DISTINCT date(created_at, '+8 hours') AS day
      FROM progress
     WHERE learner_id = ?
     ORDER BY day DESC
  `),
  learnerByQuizType: db.prepare(`
    SELECT quiz_type,
           COUNT(*) AS attempts,
           SUM(score) AS score,
           SUM(total) AS max
      FROM progress
     WHERE learner_id = ?
     GROUP BY quiz_type
     ORDER BY attempts DESC, quiz_type
  `),
  learnerSpan: db.prepare(`
    SELECT MIN(created_at) AS first_at,
           MAX(created_at) AS last_at,
           COUNT(*) AS attempts
      FROM progress
     WHERE learner_id = ?
  `),

  countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const listCategories = () => S.listCategories.all();
const listEnabledCategories = () => S.listEnabledCategories.all();
const getCategory = (id) => S.getCategory.get(Number(id));

function createCategory({ name_en, name_yue = '', name_fil = '', icon = '📁' }) {
  const { m } = S.maxCategoryOrder.get();
  const info = S.insertCategory.run(name_en, name_yue, name_fil, icon, m + 1);
  return getCategory(Number(info.lastInsertRowid));
}

function updateCategory(id, patch) {
  const current = getCategory(id);
  if (!current) return null;
  // `enabled` is stored as 0/1. Anything explicitly falsy switches it off; any
  // other value switches it on, so a caller cannot accidentally store a truthy
  // string that never matches `enabled = 1`.
  const enabled =
    patch.enabled === undefined ? (current.enabled ? 1 : 0) : patch.enabled ? 1 : 0;
  S.updateCategory.run(
    patch.name_en ?? current.name_en,
    patch.name_yue ?? current.name_yue,
    patch.name_fil ?? current.name_fil,
    patch.icon ?? current.icon,
    enabled,
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
// Scenarios — a set of phrases for one situation. Same shape and same switch as
// categories, so the admin can treat the two identically.
// ---------------------------------------------------------------------------

const listScenarios = () => S.listScenarios.all();
const listEnabledScenarios = () => S.listEnabledScenarios.all();
const getScenario = (id) => S.getScenario.get(Number(id));

function createScenario({ name_en, name_yue = '', name_fil = '', icon = '💬', description = '' }) {
  const { m } = S.maxScenarioOrder.get();
  const info = S.insertScenario.run(name_en, name_yue, name_fil, icon, description, m + 1);
  return getScenario(Number(info.lastInsertRowid));
}

function updateScenario(id, patch) {
  const current = getScenario(id);
  if (!current) return null;
  // Same 0/1 handling as updateCategory — see the note there.
  const enabled =
    patch.enabled === undefined ? (current.enabled ? 1 : 0) : patch.enabled ? 1 : 0;
  S.updateScenario.run(
    patch.name_en ?? current.name_en,
    patch.name_yue ?? current.name_yue,
    patch.name_fil ?? current.name_fil,
    patch.icon ?? current.icon,
    patch.description ?? current.description,
    enabled,
    Number(id)
  );
  return getScenario(id);
}

function deleteScenario(id) {
  return S.deleteScenario.run(Number(id)).changes > 0;
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Coerce a nullable foreign key: '', null and undefined all mean "none". */
function refOrNull(v) {
  return v != null && v !== '' ? Number(v) : null;
}

/**
 * @param {object}  opts
 * @param {boolean} opts.enabledOnly  Drop words belonging to a switched-off
 *   category. This is what a learner gets, and it matters that it filters the
 *   *vocabulary* and not just the category list: the quiz engine picks questions
 *   from this pool, so hiding a category without filtering here would leave a
 *   learner being tested on a topic the app had removed from the menu.
 *
 *   A switched-off SCENARIO is filtered the same way and for the same reason —
 *   its phrases are still in the pool otherwise.
 *
 *   Words with no category are kept — a category can be deleted, which leaves its
 *   words uncategorised rather than hidden, and those should stay reachable.
 * @param {boolean} opts.publishedOnly  Drop entries still in review (`draft`).
 *   The operator sees everything; a learner should not. Off by default so the
 *   current behaviour is unchanged until the review workflow ships.
 */
function listVocabulary({
  level,
  category_id,
  scenario_id,
  type,
  enabledOnly = false,
  publishedOnly = false,
} = {}) {
  const hasLevel = level != null && level !== '';
  const hasCat = category_id != null && category_id !== '';
  const hasScenario = scenario_id != null && scenario_id !== '';
  let rows;
  if (hasScenario) rows = S.listVocabularyByScenario.all(Number(scenario_id));
  else if (hasLevel && hasCat) rows = S.listVocabularyByBoth.all(Number(level), Number(category_id));
  else if (hasLevel) rows = S.listVocabularyByLevel.all(Number(level));
  else if (hasCat) rows = S.listVocabularyByCategory.all(Number(category_id));
  else if (type) rows = S.listVocabularyByType.all(String(type));
  else rows = S.listVocabulary.all();

  if (publishedOnly) rows = rows.filter((v) => v.status !== 'draft');

  if (!enabledOnly) return rows;
  const offCats = new Set(S.listDisabledCategoryIds.all().map((r) => r.id));
  const offScens = new Set(S.listDisabledScenarioIds.all().map((r) => r.id));
  if (offCats.size === 0 && offScens.size === 0) return rows;
  return rows.filter(
    (v) =>
      (v.category_id == null || !offCats.has(v.category_id)) &&
      (v.scenario_id == null || !offScens.has(v.scenario_id))
  );
}

const getVocabulary = (id) => S.getVocabulary.get(Number(id));

function createVocabulary(b) {
  const now = new Date().toISOString();
  // `id` is passed as null on purpose: it is an INTEGER PRIMARY KEY, so SQLite
  // assigns the next rowid. Keeps one insert statement for both the seed (which
  // supplies explicit ids) and this path (which does not).
  const info = S.insertVocabulary.run(
    null,
    b.cantonese, b.jyutping, b.english,
    b.tagalog || '', b.emoji || '📝',
    Number(b.level) || 1, refOrNull(b.category_id),
    b.type || inferType(b.cantonese),
    b.speaker || 'either',
    refOrNull(b.scenario_id),
    b.example_yue || '', b.example_jyutping || '', b.example_en || '',
    b.usage_note || '', b.tags || '',
    b.status || 'published',
    Number(b.sort_order) || 0,
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
    b.level != null && b.level !== '' ? Number(b.level) : cur.level,
    b.category_id !== undefined ? refOrNull(b.category_id) : cur.category_id,
    b.type ?? cur.type,
    b.speaker ?? cur.speaker,
    b.scenario_id !== undefined ? refOrNull(b.scenario_id) : cur.scenario_id,
    b.example_yue ?? cur.example_yue,
    b.example_jyutping ?? cur.example_jyutping,
    b.example_en ?? cur.example_en,
    b.usage_note ?? cur.usage_note,
    b.tags ?? cur.tags,
    b.status ?? cur.status,
    b.sort_order != null && b.sort_order !== '' ? Number(b.sort_order) : cur.sort_order,
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
/**
 * A short, shareable referral code derived from a device's public_id.
 *
 * Derived rather than stored as a second random secret, because this code
 * travels in share links and must be safe to publish. Hashing makes it one-way:
 * knowing a friend's code cannot be replayed as her public_id against
 * /api/learners/identify, which is the token that controls her display name and
 * her employer consent links.
 *
 * Crockford base32 — no I, L, O or U — so a code read aloud over the phone,
 * which is how this community actually passes things on, is unambiguous.
 */
function referralCodeFor(seed) {
  const h = crypto.createHash('sha256').update(`cantobuddy:ref:${seed}`).digest();
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let out = '';
  for (let i = 0; i < 8; i++) out += A[h[i] % 32];
  return out;
}

/** A referral code no other learner already holds. */
function uniqueReferralCode(publicId) {
  for (let salt = 0; salt < 8; salt++) {
    const code = referralCodeFor(salt ? `${publicId}#${salt}` : publicId);
    const holder = S.getLearnerByReferralCode.get(code);
    if (!holder || holder.public_id === publicId) return code;
  }
  return referralCodeFor(`${publicId}#${Date.now()}`);
}

/** Where learners first arrived from, biggest first. For the admin view. */
function getReferrerCounts() {
  return S.countByReferrer.all().map((r) => ({ referrer: r.referrer, count: r.n }));
}

function identifyLearner({ public_id, display_name, referrer }) {
  const pid = String(public_id || '').trim();
  if (!pid) throw new Error('public_id is required');
  const now = new Date().toISOString();
  const name = (display_name || '').trim();
  // ?ref= is free-form and comes straight off a URL, so bound it before it is
  // stored. The column is only ever read, never executed, but there is no
  // reason to keep an unbounded string from an untrusted query parameter.
  const ref = String(referrer || '').trim().slice(0, 64);

  const existing = getLearnerByPublicId(pid);
  if (existing) {
    if (name && name !== existing.display_name) {
      S.updateLearnerName.run(name, now, existing.id);
    } else {
      S.touchLearner.run(now, existing.id);
    }
    // Backfill. Devices created before referral tracking existed — and rows
    // adopted from the legacy JSON store — have no code yet. Without this their
    // share links would carry no attribution and the chain would break there.
    if (!existing.referral_code) {
      S.setLearnerReferralCode.run(uniqueReferralCode(pid), existing.id);
    }
    // First-touch only: setLearnerReferrer's WHERE clause makes this a no-op if
    // a referrer is already recorded, so a later visit from a different link
    // cannot steal credit from the one that actually brought her in.
    if (ref) S.setLearnerReferrer.run(ref, existing.id);
    return getLearnerById(existing.id);
  }

  // First contact from this device. If a pre-device learner row carries the same
  // name and is still unclaimed, adopt it — otherwise the helper's older
  // progress would sit under a row no device can ever reach again.
  if (name) {
    const legacy = S.getLegacyLearnerByName.get(name);
    if (legacy) {
      S.adoptLearnerPublicId.run(pid, now, legacy.id);
      S.setLearnerReferralCode.run(uniqueReferralCode(pid), legacy.id);
      if (ref) S.setLearnerReferrer.run(ref, legacy.id);
      return getLearnerById(legacy.id);
    }
  }

  const info = S.insertLearner.run(pid, name, now, now, ref || null, uniqueReferralCode(pid));
  return getLearnerById(Number(info.lastInsertRowid));
}

// ---------------------------------------------------------------------------
// Daily activity rollup — visits and practice
//
// The gap this closes: every number the operator could see was derived from
// `progress`, so a learner who studied the vocabulary and never opened a quiz
// was completely invisible. These two writers are what make her visible.
//
// Both are UPSERTS on the day, so they are cheap enough to call on every page
// load, and both are fire-and-forget from the client's point of view — a
// failed count must never break a lesson.
// ---------------------------------------------------------------------------

/**
 * Add activity to today's rollup for one learner.
 *
 * Every field is an increment and every field is optional — the caller sends
 * only what happened. Counts are clamped to positive integers rather than
 * trusted: they come from the client, and a bug there should not be able to
 * write a learner's history backwards.
 *
 * A learner id that does not resolve is IGNORED, not created. Identity is
 * minted by identifyLearner alone, so that one code path owns the
 * public_id ↔ row mapping; a stray id arriving here must not conjure a row.
 */
function recordActivity(learnerId, counts = {}) {
  const id = Number(learnerId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!S.getLearnerById.get(id)) return null;

  const n = (v) => {
    const x = Math.floor(Number(v));
    return Number.isFinite(x) && x > 0 ? x : 0;
  };

  const visits = n(counts.visits);
  const words = n(counts.words_viewed);
  const cards = n(counts.cards_opened);
  const quizzes = n(counts.quizzes_started);
  if (!visits && !words && !cards && !quizzes) return null;

  const now = new Date().toISOString();
  const day = hktDate(Date.now());
  S.upsertLearnerDaily.run(id, day, visits, words, cards, quizzes, now, now);
  return S.getLearnerDaily.get(id, day);
}

/**
 * Record that this device was here today.
 *
 * Called from the identify route, which runs on every app page load — so this
 * is the single write that makes an app visitor countable even when she never
 * touches a quiz. A second visit on the same day increments the row.
 */
const recordVisit = (learnerId, count = 1) => recordActivity(learnerId, { visits: count });

/**
 * A landing-page view: aggregate and anonymous, by design (see visit_daily).
 *
 * No learner id is accepted. The landing pages are public HTML served to
 * search engines, and knowing WHICH page was read is useful while knowing WHO
 * read it is not — so the two are kept apart.
 */
function recordPageView(path, count = 1) {
  // Paths come off a URL, so strip the query and fragment before storing:
  // otherwise every ?utm_ variant becomes its own row and the top-paths list
  // fills with one-visit entries.
  const clean = String(path || '').split('?')[0].split('#')[0].trim().slice(0, 200);
  if (!clean.startsWith('/')) return null;
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n <= 0) return null;
  const day = hktDate(Date.now());
  S.upsertVisitDaily.run(day, clean, n);
  return { day, path: clean };
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

  // Only learners who have actually done something.
  //
  // Now that a landing-page visit registers a device — which is what makes
  // "how many people visited" answerable at all — this list would otherwise
  // fill up with anonymous search arrivals that no employer could ever be
  // connected to. A named learner, or one with any recorded activity, is a
  // person using the app; a bare device row is just a page view.
  const engaged = new Set(S.reportLearnerEngagement.all().map((r) => Number(r.learner_id)));
  const unconnected = S.listLearnersWithoutEmployer
    .all()
    .filter((l) => l.display_name || engaged.has(Number(l.id)))
    .map((l) => ({
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
// Operator reporting
// ---------------------------------------------------------------------------

/** Report windows the operator can pick between, in days. */
const REPORT_RANGES = [7, 30, 90];

/** Every learner's activity, keyed by learner id, from one query. */
const activityByLearner = () =>
  new Map(S.reportPerLearner.all().map((r) => [Number(r.learner_id), r]));

/**
 * Platform totals.
 *
 * `helpers` (learners connected to someone) and `learners` (every device that
 * has ever opened the app) are deliberately different numbers. A helper using
 * the app on her own is the normal case here, not a gap in the data — the whole
 * point of the product is that she never has to connect to an employer.
 */
function getReportTotals() {
  let attempts = 0;
  let completed = 0;
  let partial = 0;
  let correct = 0;
  let questions = 0;
  let stickersUnlocked = 0;
  for (const r of activityByLearner().values()) {
    attempts += r.attempts;
    completed += r.completed;
    partial += r.partial;
    correct += r.correct || 0;
    questions += r.questions || 0;
    // Derived from credits, exactly as credits are derived from scores. The
    // learner_stickers table records only which stickers have been *celebrated*
    // — it stays empty until a helper opens her album — so counting rows there
    // reports 0 for someone who has earned a dozen.
    stickersUnlocked += SEED_STICKERS.filter((s) => (r.correct || 0) >= s.credits).length;
  }

  const links = S.reportActiveLinks.all();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();

  return {
    learners: S.listLearners.all().length,
    helpers: new Set(links.map((l) => Number(l.learner_id))).size,
    employers: S.listEmployers.all().length,
    employersWithHelpers: new Set(links.map((l) => Number(l.employer_id))).size,
    attempts,
    completedAttempts: completed,
    partialAttempts: partial,
    completionRate: attempts ? Math.round((completed / attempts) * 100) : 0,
    correctAnswers: correct,
    questionsAnswered: questions,
    accuracyRate: questions ? Math.round((correct / questions) * 100) : 0,
    stickersUnlocked,
    activeThisWeek: S.countLearnersSeenSince.get(weekAgo).n,
    newThisWeek: S.countLearnersCreatedSince.get(weekAgo).n,
  };
}

/**
 * A daily activity series, gap-filled so there is one bar per day.
 *
 * Quiet days are data, not missing data. Dropping them would make a week with
 * no practice at all look the same as a busy one.
 */
function getReportTrends(days) {
  const span = REPORT_RANGES.includes(Number(days)) ? Number(days) : 30;
  const now = Date.now();
  // Widen the query by a day at each end: the SQL cutoff is an instant while the
  // series is in Hong Kong days, and the fill loop below decides what is in range.
  const rows = S.reportDaily.all(new Date(now - (span + 1) * DAY_MS).toISOString());
  const byDay = new Map(rows.map((r) => [r.day, r]));

  const series = [];
  for (let i = span - 1; i >= 0; i--) {
    const day = hktDate(now - i * DAY_MS);
    const r = byDay.get(day);
    series.push({
      day,
      attempts: r ? r.attempts : 0,
      completed: r ? r.completed : 0,
      correct: r ? (r.correct || 0) : 0,
      questions: r ? (r.questions || 0) : 0,
      learners: r ? r.learners : 0,
    });
  }
  return { days: span, series };
}

/**
 * How engaged each employer's helpers are.
 *
 * A helper working for two families is counted under both, which is the right
 * answer to "are the people who share with this employer practising?" — and
 * exactly why these rows must never be summed into a platform total. Totals
 * come from getReportTotals(), which answers that from its own query.
 */
function getReportEmployers() {
  const perLearner = activityByLearner();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const learnersById = new Map(S.listLearners.all().map((l) => [Number(l.id), l]));

  const linksByEmployer = new Map();
  for (const l of S.reportActiveLinks.all()) {
    const eid = Number(l.employer_id);
    if (!linksByEmployer.has(eid)) linksByEmployer.set(eid, new Set());
    linksByEmployer.get(eid).add(Number(l.learner_id));
  }

  return S.listEmployers.all()
    .map((u) => {
      const ids = [...(linksByEmployer.get(Number(u.id)) || [])];
      let attempts = 0;
      let completed = 0;
      let correct = 0;
      let questions = 0;
      let active = 0;
      let lastActivity = null;

      for (const id of ids) {
        const l = learnersById.get(id);
        if (l && l.last_seen_at && l.last_seen_at >= weekAgo) active++;
        const r = perLearner.get(id);
        if (!r) continue;
        attempts += r.attempts;
        completed += r.completed;
        correct += r.correct || 0;
        questions += r.questions || 0;
        if (r.last_activity && (!lastActivity || r.last_activity > lastActivity)) {
          lastActivity = r.last_activity;
        }
      }

      return {
        employer_id: Number(u.id),
        name: u.name || u.username,
        email: u.email || u.username,
        status: u.status,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        helper_count: ids.length,
        helpers_active_7d: active,
        attempts,
        completed_attempts: completed,
        correct_answers: correct,
        questions_answered: questions,
        accuracy_rate: questions ? Math.round((correct / questions) * 100) : 0,
        last_activity: lastActivity,
      };
    })
    .sort((a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name));
}

/** Every learner, with their activity and who can currently see them. */
function getReportHelpers() {
  const perLearner = activityByLearner();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const employerName = new Map(
    S.listEmployers.all().map((u) => [Number(u.id), u.name || u.username])
  );

  const employersByLearner = new Map();
  for (const l of S.reportActiveLinks.all()) {
    const lid = Number(l.learner_id);
    if (!employersByLearner.has(lid)) employersByLearner.set(lid, []);
    employersByLearner.get(lid).push(employerName.get(Number(l.employer_id)) || '');
  }

  return S.listLearners.all()
    .map((l) => {
      const r = perLearner.get(Number(l.id));
      const employers = (employersByLearner.get(Number(l.id)) || []).filter(Boolean).sort();
      const correct = r ? r.correct || 0 : 0;
      const questions = r ? r.questions || 0 : 0;
      return {
        learner_id: Number(l.id),
        display_name: l.display_name || '',
        created_at: l.created_at,
        last_seen_at: l.last_seen_at,
        active_7d: Boolean(l.last_seen_at && l.last_seen_at >= weekAgo),
        employer_count: employers.length,
        employers: employers.join('; '),
        attempts: r ? r.attempts : 0,
        completed_attempts: r ? r.completed : 0,
        partial_attempts: r ? r.partial : 0,
        correct_answers: correct,
        questions_answered: questions,
        accuracy_rate: questions ? Math.round((correct / questions) * 100) : 0,
        credits: correct,
        last_activity: r ? r.last_activity : null,
      };
    })
    .sort((a, b) => b.attempts - a.attempts || a.display_name.localeCompare(b.display_name));
}

/**
 * Who came, and what they did.
 *
 * This answers the two questions the quiz-only reports could not answer at
 * all, because every number in them was derived from `progress`:
 *
 *   "how many people visit the site?"      → arrived, new, returning
 *   "who practises but never quizzes?"     → practiceOnly, the list below
 *
 * The shape is deliberately a funnel, not four disjoint buckets. Everyone who
 * quizzed also practised, and everyone who practised also arrived, so reading
 * it top-down is the honest way to read it; treating the stages as exclusive
 * groups would undercount every stage above the last.
 */
function getVisitorReport(days) {
  const span = REPORT_RANGES.includes(Number(days)) ? Number(days) : 30;
  const now = Date.now();
  const from = hktDate(now - (span - 1) * DAY_MS);
  // Widened by a day at the far end: `from` is a Hong Kong DATE while the
  // created_at cutoff below is an instant, so the boundary day must be inside.
  const fromIso = new Date(now - (span + 1) * DAY_MS).toISOString();

  const visitorByDay = new Map(S.reportVisitorDaily.all(from).map((r) => [r.day, r]));
  const newByDay = new Map(S.reportNewVisitorsDaily.all(fromIso).map((r) => [r.day, r.new_visitors]));

  // Gap-filled, exactly like the quiz trend. A day with no visitors is data.
  const series = [];
  for (let i = span - 1; i >= 0; i--) {
    const day = hktDate(now - i * DAY_MS);
    const r = visitorByDay.get(day);
    series.push({
      day,
      visitors: r ? r.visitors : 0,
      visits: r ? r.visits : 0,
      new_visitors: newByDay.get(day) || 0,
      words_viewed: r ? r.words_viewed || 0 : 0,
      cards_opened: r ? r.cards_opened || 0 : 0,
      quizzes_started: r ? r.quizzes_started || 0 : 0,
    });
  }

  const learners = S.listLearners.all();
  const quizzed = new Set(S.reportQuizzedLearners.all().map((r) => Number(r.learner_id)));
  const byId = new Map(learners.map((l) => [Number(l.id), l]));

  let arrivedOnly = 0;
  let practisedCards = 0;
  const practiceOnly = [];
  const seen = new Set();

  for (const r of S.reportLearnerEngagement.all()) {
    const id = Number(r.learner_id);
    seen.add(id);
    const didPractise = (r.words_viewed || 0) + (r.cards_opened || 0) > 0;
    const didQuiz = quizzed.has(id) || (r.quizzes_started || 0) > 0;

    if (didPractise) practisedCards++;
    if (!didPractise && !didQuiz) arrivedOnly++;
    if (didPractise && !didQuiz) {
      const l = byId.get(id);
      practiceOnly.push({
        learner_id: id,
        display_name: (l && l.display_name) || '',
        words_viewed: r.words_viewed || 0,
        cards_opened: r.cards_opened || 0,
        days_active: r.days_active || 0,
        first_day: r.first_day,
        last_day: r.last_day,
        last_seen_at: l ? l.last_seen_at : null,
      });
    }
  }

  // A device row with no rollup row at all: she reached the app but nothing
  // was recorded — which is still an arrival, and counting it as one is the
  // difference between "we lost the data" and "she looked and left".
  for (const l of learners) if (!seen.has(Number(l.id))) arrivedOnly++;

  // Most practice first — the operator wants the enthusiastic non-quizzers,
  // not an alphabetical list.
  practiceOnly.sort(
    (a, b) =>
      b.words_viewed + b.cards_opened - (a.words_viewed + a.cards_opened) ||
      (b.last_day || '').localeCompare(a.last_day || '')
  );

  const sum = (k) => series.reduce((n, d) => n + d[k], 0);

  return {
    days: span,
    from,
    // --- the funnel -----------------------------------------------------
    arrived: learners.length,
    arrivedOnly,
    practisedCards,
    practiceOnlyLearners: practiceOnly.length,
    quizzed: quizzed.size,
    // --- this period ----------------------------------------------------
    newVisitors: sum('new_visitors'),
    visits: sum('visits'),
    pageViews: S.countPageViewsSince.get(from).n,
    wordsViewed: sum('words_viewed'),
    cardsOpened: sum('cards_opened'),
    quizzesStarted: sum('quizzes_started'),
    // --- detail ---------------------------------------------------------
    series,
    // Capped, not truncated for display: practiceOnlyLearners above carries
    // the true total, and the CSV export needs the rows themselves. 200 is
    // well past any realistic single-operator workload while keeping the
    // report payload bounded.
    practiceOnly: practiceOnly.slice(0, 200),
    topPaths: S.reportTopPaths.all(from),
  };
}

/** Everything the Reports tab needs, in one read. */
function getReport(days) {
  return {
    generated_at: new Date().toISOString(),
    totals: getReportTotals(),
    trends: getReportTrends(days),
    employers: getReportEmployers(),
    visitors: getVisitorReport(days),
  };
}

// ---------------------------------------------------------------------------
// Learner reporting — what the helper sees about her own practice
// ---------------------------------------------------------------------------

/**
 * Chart windows the learner can pick between, in days.
 *
 * Deliberately the same three as the operator's report. A helper looking at her
 * own numbers and the operator looking at the platform should not have to hold
 * two different meanings of "the last 30 days" in their heads.
 */
const LEARNER_STATS_RANGES = [7, 30, 90];

/**
 * Current and longest run of consecutive days, from a list of YYYY-MM-DD days.
 *
 * A streak stays alive until a whole day has been missed. Practising yesterday
 * but not yet today still counts — that is what every streak counter she has
 * ever seen does, and expiring at midnight would punish her for not having
 * practised *yet* on a day she is about to practise.
 *
 * Callers pass the days newest-first; they are sorted defensively here anyway,
 * because a wrong order silently produces a plausible-looking wrong number.
 */
function streaksFrom(activeDays, now = Date.now()) {
  if (!activeDays.length) return { current: 0, longest: 0 };

  const days = new Set(activeDays);
  const today = hktDate(now);
  const yesterday = hktDate(now - DAY_MS);

  let current = 0;
  const cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (cursor) {
    let ms = Date.parse(`${cursor}T00:00:00Z`);
    while (days.has(hktDate(ms))) {
      current++;
      ms -= DAY_MS;
    }
  }

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const day of [...days].sort()) {
    const ms = Date.parse(`${day}T00:00:00Z`);
    run = prev && ms - Date.parse(`${prev}T00:00:00Z`) === DAY_MS ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }

  return { current, longest };
}

/**
 * One learner's own statistics.
 *
 * Everything is derived from the progress rows she created. There is no stats
 * table that could drift out of step with the quizzes it was built from — the
 * same reasoning that makes credits a SUM rather than a stored balance.
 *
 * `days` sizes the chart only. Totals and streaks come from her whole history,
 * so changing the range never changes the numbers she actually cares about.
 *
 * An unknown or absent learner is not an error: every query matches nothing and
 * the caller gets a well-formed zero. That matters here, because this is reached
 * by device token and a device the server has never seen is the ordinary
 * first-visit case, not a failure worth surfacing.
 */
function getLearnerStats(learnerId, days) {
  const id = Number(learnerId);
  const span = LEARNER_STATS_RANGES.includes(Number(days)) ? Number(days) : 30;
  const now = Date.now();

  const totals = S.statsByLearnerId.get(id) || {};
  const totalScore = totals.totalScore || 0;
  const totalMax = totals.totalMax || 0;

  const byLevel = {};
  for (const r of S.statsByLearnerIdLevel.all(id)) {
    byLevel[r.level] = { attempts: r.attempts, score: r.score || 0, max: r.max || 0 };
  }

  const byQuizType = S.learnerByQuizType.all(id).map((r) => ({
    quiz_type: r.quiz_type,
    attempts: r.attempts,
    score: r.score || 0,
    max: r.max || 0,
    accuracy: r.max ? Math.round(((r.score || 0) / r.max) * 100) : 0,
  }));

  // Widen by a day at each end: the SQL cutoff is an instant while the series is
  // in Hong Kong days, and the fill loop below decides what actually falls in
  // range. Quiet days are filled in as zero — a gap is data, not missing data.
  const rows = S.learnerDaily.all(id, new Date(now - (span + 1) * DAY_MS).toISOString());
  const byDay = new Map(rows.map((r) => [r.day, r]));

  const series = [];
  for (let i = span - 1; i >= 0; i--) {
    const day = hktDate(now - i * DAY_MS);
    const r = byDay.get(day);
    series.push({
      day,
      attempts: r ? r.attempts : 0,
      completed: r ? r.completed : 0,
      correct: r ? (r.correct || 0) : 0,
      questions: r ? (r.questions || 0) : 0,
    });
  }

  // This week against last week: two seven-day Hong Kong windows ending today.
  const recent = S.learnerDaily.all(id, new Date(now - 15 * DAY_MS).toISOString());
  const windowSum = (from, to) => {
    const acc = { attempts: 0, completed: 0, correct: 0, questions: 0, days: 0 };
    for (const r of recent) {
      if (r.day < from || r.day > to) continue;
      acc.attempts += r.attempts;
      acc.completed += r.completed;
      acc.correct += r.correct || 0;
      acc.questions += r.questions || 0;
      // learnerDaily returns exactly one row per day, so the row count in the
      // window is the number of days she turned up on.
      acc.days++;
    }
    return {
      ...acc,
      accuracy: acc.questions ? Math.round((acc.correct / acc.questions) * 100) : 0,
    };
  };
  const thisWeek = windowSum(hktDate(now - 6 * DAY_MS), hktDate(now));
  const lastWeek = windowSum(hktDate(now - 13 * DAY_MS), hktDate(now - 7 * DAY_MS));

  const activeDays = S.learnerActiveDays.all(id).map((r) => r.day);
  const { current, longest } = streaksFrom(activeDays, now);
  const spanRow = S.learnerSpan.get(id) || {};

  return {
    days: span,
    totals: {
      attempts: totals.attempts || 0,
      completedAttempts: totals.completedAttempts || 0,
      partialAttempts: totals.partialAttempts || 0,
      totalScore,
      totalMax,
      accuracy: totalMax ? Math.round((totalScore / totalMax) * 100) : 0,
      firstAt: spanRow.first_at || null,
      lastAt: spanRow.last_at || null,
    },
    streak: {
      current,
      longest,
      daysActive: activeDays.length,
      practisedToday: activeDays.includes(hktDate(now)),
    },
    weeks: { thisWeek, lastWeek },
    byLevel,
    byQuizType,
    series,
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
  contentMigration,
  CONTENT_VERSION,

  hashPassword,
  verifyPassword,
  authenticate,

  listCategories,
  listEnabledCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,

  listScenarios,
  listEnabledScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,

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
  getReferrerCounts,
  recordVisit,
  recordActivity,
  recordPageView,
  listEmployersForLearner,
  listLearnersForEmployer,
  revokeLink,
  getLearnerReport,
  getPeopleOverview,

  getReport,
  getReportTotals,
  getReportTrends,
  getReportEmployers,
  getReportHelpers,
  getVisitorReport,
  REPORT_RANGES,

  // Learner reporting — her own numbers, scoped to one device.
  getLearnerStats,
  LEARNER_STATS_RANGES,

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
