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
const {
  SEED_CATEGORIES, SEED_VOCABULARY, SEED_SCENARIOS, SEED_USERS,
  MANDARIN_GLOSSES, CATEGORY_ZH_NAMES,
  INDONESIAN_GLOSSES, CATEGORY_ID_NAMES,
  SEED_POSTS,
  SEED_LIVING,
} = require('./data');
const { SEED_STICKERS } = require('./stickers');
// The news taxonomy and the keyword classifier that fills it. Required here
// rather than in news.js because the migration has to classify posts that were
// imported by an EARLIER build, and the backfill has to live next to the
// column it fills.
const newsCategory = require('./news-category');

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

/* A short, human-readable access code for employer re-login. No 0/O/1/I/l so it
   cannot be misread — the same convention as the helper invitation codes. */
function generateAccessCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
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
    name_zh    TEXT NOT NULL DEFAULT '',
    name_id    TEXT NOT NULL DEFAULT '',
    icon       TEXT NOT NULL DEFAULT '📁',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vocabulary (
    id          INTEGER PRIMARY KEY,
    cantonese   TEXT NOT NULL,
    jyutping    TEXT NOT NULL,
    english     TEXT NOT NULL,
    tagalog     TEXT NOT NULL DEFAULT '',
    mandarin    TEXT NOT NULL DEFAULT '',
    indonesian  TEXT NOT NULL DEFAULT '',
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
    created_at    TEXT,
    access_code_hash         TEXT,
    device_reauth_open_until TEXT
  );

  /* Trusted devices for employer sign-in.
     The portal signs an employer in by NAME plus a device token held in that
     browser's localStorage. There is no standing password or access code to
     forget: the token IS the credential, and it is bound to the one browser the
     employer normally uses. A brand-new device (no token) cannot read helpers
     until the operator opens a short pairing window from /admin — that is the
     only escape hatch, and it is deliberate, so a stranger who merely guesses
     "Mrs Chan" on a foreign machine gets nothing. */
  CREATE TABLE IF NOT EXISTS employer_devices (
    id           INTEGER PRIMARY KEY,
    employer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL,
    label        TEXT NOT NULL DEFAULT '',
    created_at   TEXT,
    last_seen_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_emp_devices_employer ON employer_devices(employer_id);

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

  /* Something a helper or an employer typed and sent to the operator.

     ANONYMITY IS THE POINT for a helper. She is a live-in worker whose employer
     can already see her progress, so a complaint about the app — or about the
     family — has to be unattributable or it will not be written at all. So a
     learner row stores NO learner_id and NO user_id: the role is kept (the
     operator needs to know which half of the product is being talked about) but
     the person is not. An employer row does carry user_id, because an employer
     is already signed in to her own dashboard and expects a reply.

     contact is empty unless the sender chose to type one in. That is the only
     route back to a learner, and it is opt-in by construction — we never fill it
     in on their behalf.

     status is operator workflow, not visibility: new -> reviewing -> resolved.
     Nothing here is ever shown to another learner or employer. */
  CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY,
    role       TEXT NOT NULL DEFAULT 'learner',
    message    TEXT NOT NULL,
    contact    TEXT NOT NULL DEFAULT '',
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    lang       TEXT NOT NULL DEFAULT 'en',
    page       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_status  ON feedback(status);
  CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

  /* A dated post in the "Discover" feed — one row per article a learner can read.

     WHY A NEW TABLE rather than reusing the guides in content.js: a guide is
     written once, ships with the code, and changes only on a deploy. These are
     a FEED — something posted repeatedly, in date order, without a release.
     "Regularly post" and "deploy a new build" are different rhythms, and the
     guide array cannot express the first one.

     TWO CHANNELS, ONE TABLE. The channel column is 'culture' or 'news' and is
     the only thing that separates them; the shape of a post is identical, so
     they share a table and every query, rather than being two near-identical
     tables that would drift. The learner app shows them as two tabs of one
     screen.

     MEANING IS PER LANGUAGE (title/summary/body x en/fil/zh/id), matching the
     rule the rest of the app already follows: a Filipino reader is not reading
     a translation of the English, she is reading her own page. English is the
     base — a blank column falls back to it — because a feed has to keep moving
     and demanding four translations before a post can appear would stop it.

     ATTRIBUTION IS NOT OPTIONAL FOR IMPORTED ITEMS. source_name + source_url
     are written by the importer on every news row and rendered on every card,
     because the news channel summarises other people's journalism and links to
     it. The body columns are deliberately NEVER filled from a feed — a feed
     carries the whole article in its description, and republishing that (in any
     language) would be a copyright problem. See news.js.

     source_key is the feed's own id, and the UNIQUE index on it is what makes
     re-running the importer idempotent: the same item twice is one row, not two. */
  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    channel      TEXT NOT NULL DEFAULT 'culture',
    icon         TEXT NOT NULL DEFAULT '📰',
    title_en     TEXT NOT NULL DEFAULT '',
    title_fil    TEXT NOT NULL DEFAULT '',
    title_zh     TEXT NOT NULL DEFAULT '',
    title_id     TEXT NOT NULL DEFAULT '',
    summary_en   TEXT NOT NULL DEFAULT '',
    summary_fil  TEXT NOT NULL DEFAULT '',
    summary_zh   TEXT NOT NULL DEFAULT '',
    summary_id   TEXT NOT NULL DEFAULT '',
    body_en      TEXT NOT NULL DEFAULT '',
    body_fil     TEXT NOT NULL DEFAULT '',
    body_zh      TEXT NOT NULL DEFAULT '',
    body_id      TEXT NOT NULL DEFAULT '',
    source_name  TEXT NOT NULL DEFAULT '',
    source_url   TEXT NOT NULL DEFAULT '',
    source_key   TEXT,
    source_lang  TEXT NOT NULL DEFAULT '',
    origin       TEXT NOT NULL DEFAULT 'manual',
    status       TEXT NOT NULL DEFAULT 'draft',
    /* Which topic this post belongs to — a news category key (see
       news-category.js), or '' when it has none. Culture posts never carry
       one: the culture channel is small enough to read, and giving it a
       taxonomy would be a taxonomy nobody uses. News is the channel that
       grows without bound, so that is the channel that needs sifting. */
    category     TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    created_at   TEXT,
    updated_at   TEXT
  );
  /* Partial unique index: manual posts have no source_key and must not collide
     with each other, so only rows that HAVE one are constrained. */
  CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_source_key
    ON posts(source_key) WHERE source_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(status, channel, published_at DESC);

  /* A helper's own story, submitted for publication.

     THE PRIVACY DECISION, AND WHY IT LIVES IN THE SCHEMA. A story is the first
     thing a learner writes that is meant to be read by OTHER PEOPLE. The
     feedback inbox next door is private by design, precisely because a helper
     lives with the person who can see her data — so publication is opt-in here,
     and both halves of that are enforced by the shape of the table rather than
     by the screen that happens to render it:

       display_name  is EMPTY unless she ticked "show my name". An empty name
                     publishes as Anonymous, and there is no other column a name
                     could leak out of.
       learner_id    is kept — it is needed to rate-limit submissions and to let
                     her see the status of her own — but the PUBLIC queries never
                     select it, and the moderation screen shows only the name she
                     chose. listPublishedStories and listStoriesForModeration
                     select different columns on purpose; do not "simplify" them
                     into one.

     status is the moderation queue: pending -> published | rejected. A story
     that is not 'published' is a 404 to a reader, absent from the API list and
     absent from the sitemap — exactly like a draft post.

     lang is the language she WROTE it in, not a language it is available in. A
     Tagalog story is shown to everyone and LABELLED as Tagalog; it is not
     translated, because machine-translating a person's life story would put
     words in her mouth. gloss_en is the single exception: the operator may add
     a short English summary by hand while approving.

     NO IMAGE COLUMN, deliberately. A photo of a helper's room can identify the
     household she works for, and there is no upload storage to moderate. */
  CREATE TABLE IF NOT EXISTS stories (
    id            INTEGER PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    learner_id    INTEGER REFERENCES learners(id) ON DELETE SET NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    lang          TEXT NOT NULL DEFAULT 'en',
    topic         TEXT NOT NULL DEFAULT 'daily',
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,
    gloss_en      TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending',
    reviewer_note TEXT NOT NULL DEFAULT '',
    published_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_stories_queue  ON stories(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_stories_feed   ON stories(status, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(learner_id, created_at DESC);

  /* Living — supportive passages about life in Hong Kong, grouped by situation.

     Unlike Stories (a helper's own life story, moderated before it is read),
     Living is EDITORIAL: passages the operator writes to meet a helper where she
     is — sick, homesick, short of money, lonely on a rest day. They are seeded
     and curated, never user-submitted, so there is no moderation queue and no
     learner identity on the row.

     PER-LANGUAGE like the posts table: title/body/sub x en/fil/zh/id. A blank
     column falls back to English on the client, because the point is to meet her
     in her own language, not to gate content on four translations existing.

     category is one of: medical, holiday, entertainment, homesick, food,
     transport, churches. sub_key + sub_* name the sub-resource (a clinic, a
     church, a budget tip) so the UI can group finely; only category drives the
     section heading. */

  CREATE TABLE IF NOT EXISTS living_posts (
    id           INTEGER PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    category     TEXT NOT NULL,
    sub_key      TEXT NOT NULL DEFAULT '',
    icon         TEXT NOT NULL DEFAULT '🏠',
    title_en     TEXT NOT NULL DEFAULT '',
    title_fil    TEXT NOT NULL DEFAULT '',
    title_zh     TEXT NOT NULL DEFAULT '',
    title_id     TEXT NOT NULL DEFAULT '',
    body_en      TEXT NOT NULL DEFAULT '',
    body_fil     TEXT NOT NULL DEFAULT '',
    body_zh      TEXT NOT NULL DEFAULT '',
    body_id      TEXT NOT NULL DEFAULT '',
    sub_en       TEXT NOT NULL DEFAULT '',
    sub_fil      TEXT NOT NULL DEFAULT '',
    sub_zh       TEXT NOT NULL DEFAULT '',
    sub_id       TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'published',
    published_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_living_cat  ON living_posts(category, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_living_slug ON living_posts(slug);

  /* Reactions, Facebook-style: one row per (post, emoji) holding the aggregate
     count. The seven emojis are like/love/care/haha/wow/sad/angry — the client
     shows only emojis with count > 0, so a fresh post simply has none. */
  CREATE TABLE IF NOT EXISTS living_reactions (
    post_id INTEGER NOT NULL REFERENCES living_posts(id) ON DELETE CASCADE,
    emoji   TEXT NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, emoji)
  );
  CREATE INDEX IF NOT EXISTS idx_living_react_post ON living_reactions(post_id);

  /* A device's CURRENT reaction to a post — exactly one per device, like
     Facebook. Picking a different emoji moves the count from the old to the new;
     picking the same one again toggles it off. Keyed on public_id (the device
     token), never on anything the helper typed. */
  CREATE TABLE IF NOT EXISTS living_user_reactions (
    post_id   INTEGER NOT NULL REFERENCES living_posts(id) ON DELETE CASCADE,
    public_id TEXT NOT NULL,
    emoji     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, public_id)
  );

  /* Comments — a supportive thread under each passage. Published immediately
     (plain text, HTML-escaped on render) so a helper who reaches out gets an
     answer now, not after a queue. display_name is optional; blank means
     "Anonymous". Length is bounded so the thread stays readable. */
  CREATE TABLE IF NOT EXISTS living_comments (
    id           INTEGER PRIMARY KEY,
    post_id      INTEGER NOT NULL REFERENCES living_posts(id) ON DELETE CASCADE,
    public_id    TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    body         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'published',
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_living_comments_post ON living_comments(post_id, created_at DESC);

  /* Web Push subscriptions.

     A subscription is a browser's device token (endpoint) plus the two keys the
     server needs to encrypt a message to it — NOTHING the learner typed. last_active_at
     is touched on every app/landing-page load so the practice-reminder job can find
     devices that have gone quiet, and last_reminded_at stops the same device being
     nudged again before it has had a chance to come back. learner_id is optional and
     only used to tie a reminder to a known device; it is never required. */
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id               INTEGER PRIMARY KEY,
    endpoint         TEXT NOT NULL UNIQUE,
    p256dh           TEXT NOT NULL,
    auth             TEXT NOT NULL,
    learner_id       INTEGER REFERENCES learners(id) ON DELETE SET NULL,
    source           TEXT NOT NULL DEFAULT 'web',
    last_active_at   TEXT,
    last_reminded_at TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_push_last_active ON push_subscriptions(last_active_at);
  CREATE INDEX IF NOT EXISTS idx_push_reminded   ON push_subscriptions(last_reminded_at);
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

/**
 * Shift imported news rows that are dated in the FUTURE back into the past.
 *
 * WHY. The Philippine Daily Inquirer's RSS writes Manila wall-clock time and
 * labels it `+0000`, so every import before 2026-10-18 stored those rows eight
 * hours ahead of the truth. A future timestamp does not merely look odd — it
 * sorts ABOVE genuinely newer stories, so the newest Inquirer article sat on
 * top of the whole News channel for hours after it stopped being news.
 *
 * news.js now corrects the timestamp at the source (correctLocalStampedAsUtc),
 * but the importer only ever INSERTs: rows already on disk kept their wrong
 * dates and would have stayed mis-ordered until the 3-day window removed them.
 * This is that repair, and it runs once.
 *
 * IDEMPOTENT TWICE OVER. The `published_at > now` test is the real guard —
 * after the shift those rows are in the past and no longer match, so running it
 * again does nothing. The meta flag only stops the scan from repeating on every
 * boot. That ordering matters: if the flag were the only guard, clearing it
 * would shift the rows a second time.
 *
 * Deliberately narrow — channel 'news', origin 'auto', the one source that
 * mislabels, and only rows that are impossible. A hand-written post is never
 * touched, and neither is a source that dates itself correctly.
 *
 * @param {object} [opts]
 * @param {number} [opts.shiftMinutes] how much the label is short by
 * @param {number} [opts.toleranceMinutes] clock drift still considered sane
 * @returns {{shifted:number}}
 */
function repairFutureDatedNews(opts = {}) {
  const shiftMs = (opts.shiftMinutes === undefined ? 480 : opts.shiftMinutes) * 60000;
  const tolMs = (opts.toleranceMinutes === undefined ? 10 : opts.toleranceMinutes) * 60000;
  const nowMs = Date.now();

  // Filtered in JS rather than SQL: published_at is an ISO string, and
  // comparing it lexicographically in SQL only works while every row happens to
  // be in the same format. Date.parse does not care.
  const rows = db
    .prepare(
      `SELECT id, published_at FROM posts
        WHERE channel = 'news' AND origin = 'auto' AND source_key LIKE 'ph:%'`
    )
    .all();

  const upd = db.prepare('UPDATE posts SET published_at = ? WHERE id = ?');
  let shifted = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const t = Date.parse(row.published_at);
      if (!Number.isFinite(t) || t <= nowMs + tolMs) continue;
      // Subtract the missing offset, but never leave the row in the future: a
      // row further ahead than the shift itself would otherwise survive the
      // repair still future-dated, and the meta flag would stop a second pass
      // from ever fixing it. Observed skew is ~7.3h against an 8h shift, so
      // this clamp is a safety net, not the normal path.
      const shiftedMs = Math.min(t - shiftMs, nowMs);
      upd.run(new Date(shiftedMs).toISOString(), Number(row.id));
      shifted += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { shifted };
}

function migrateSchema() {
  const changes = [];

  if (addColumnIfMissing('users', 'email', 'TEXT')) changes.push('users.email');
  if (addColumnIfMissing('users', 'status', "TEXT NOT NULL DEFAULT 'active'")) changes.push('users.status');
  if (addColumnIfMissing('users', 'last_login_at', 'TEXT')) changes.push('users.last_login_at');
  if (addColumnIfMissing('users', 'learner_id', 'INTEGER REFERENCES learners(id) ON DELETE SET NULL')) {
    changes.push('users.learner_id');
  }
  /* Employer access code. The portal used to sign an employer in by NAME ONLY —
     anyone who could guess "Mrs Chan" could log in as that employer and read the
     helpers she had connected. We keep "no email, no password to remember", but a
     first sign-in now mints a 6-char access code that the employer saves; re-login
     requires it. Stored hashed, never shown again. */
  if (addColumnIfMissing('users', 'access_code_hash', 'TEXT')) {
    changes.push('users.access_code_hash');
  }
  if (addColumnIfMissing('users', 'device_reauth_open_until', 'TEXT')) {
    changes.push('users.device_reauth_open_until');
  }

  /* Device-based employer sign-in migration.
     Before this change the portal required a per-employer access code that was
     shown once and never recoverable, so a forgotten code meant permanent
     lock-out. Sign-in is now name + a device token stored in the browser. To
     avoid stranding every existing employer at deploy, any employer who has no
     trusted device yet is given a 90-day pairing window: their next name-only
     sign-in on their own browser links that device and closes the window. The
     window is the only reason a foreign machine typing the name gets in during
     the gap, and it shuts the moment the real employer signs in once. */
  if (!db.prepare("SELECT value FROM meta WHERE key = 'employer_device_migration'").get()) {
    const openUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const migrated = db
      .prepare(
        `UPDATE users
           SET device_reauth_open_until = ?
         WHERE role = 'employer'
           AND device_reauth_open_until IS NULL
           AND id NOT IN (SELECT DISTINCT employer_id FROM employer_devices)`
      )
      .run(openUntil);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('employer_device_migration', '1')").run();
    if (migrated.changes) changes.push(`opened device pairing for ${migrated.changes} existing employer(s)`);
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

  /* The Chinese display name for a category.
     
     `name_yue` is NOT a substitute. It holds the CANTONESE name in Traditional
     characters (長者照顧, 食藥覆診) — readable to a Mandarin reader but the wrong
     register, and Traditional rather than Simplified. A zh learner needs a
     genuine Simplified Mandarin name (长者照顾, 吃药复诊).
     
     Backfilled from CATEGORY_ZH_NAMES in data.js by the same guarded-UPDATE
     pattern the vocabulary glosses use, and for the same reason: these 17 rows
     already exist, so migrateContent()'s INSERT OR IGNORE would be a no-op. */
  if (addColumnIfMissing('categories', 'name_zh', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('categories.name_zh');
  }
  const catZhCount = String(Object.keys(CATEGORY_ZH_NAMES).length);
  const catZhState = db.prepare("SELECT value FROM meta WHERE key = 'categories_zh_backfilled'").get();
  if (!catZhState || Number(catZhState.value) < Number(catZhCount)) {
    const upd = db.prepare("UPDATE categories SET name_zh = ? WHERE id = ? AND name_zh = ''");
    let filled = 0;
    for (const [id, name] of Object.entries(CATEGORY_ZH_NAMES)) {
      filled += upd.run(name, Number(id)).changes;
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('categories_zh_backfilled', ?)")
      .run(catZhCount);
    if (filled) changes.push(`categories.name_zh filled for ${filled} categor${filled === 1 ? 'y' : 'ies'}`);
  }

  /* The category name in Bahasa Indonesia, for the third audience.

     Same column, same reason, same guarded pattern as name_zh immediately above
     — and it is a genuinely separate name, not a variant of the Filipino one:
     「清潔」 is Kebersihan, not Paglilinis; 「照顧老人」 is Merawat Lansia, not
     Pag-aalaga sa nakatatanda. */
  if (addColumnIfMissing('categories', 'name_id', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('categories.name_id');
  }
  const catIdCount = String(Object.keys(CATEGORY_ID_NAMES).length);
  const catIdState = db.prepare("SELECT value FROM meta WHERE key = 'categories_id_backfilled'").get();
  if (!catIdState || Number(catIdState.value) < Number(catIdCount)) {
    const upd = db.prepare("UPDATE categories SET name_id = ? WHERE id = ? AND name_id = ''");
    let filled = 0;
    for (const [id, name] of Object.entries(CATEGORY_ID_NAMES)) {
      filled += upd.run(name, Number(id)).changes;
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('categories_id_backfilled', ?)")
      .run(catIdCount);
    if (filled) changes.push(`categories.name_id filled for ${filled} categor${filled === 1 ? 'y' : 'ies'}`);
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

  /* The meaning in Simplified Chinese, for learners who arrived in Hong Kong
     speaking Mandarin rather than English or Filipino.

     This is a MEANING column, not a translation of the Cantonese — the same
     slot `english` and `tagalog` occupy. It exists because the quiz engine
     draws its multiple-choice options from `english`, so a Mandarin speaker
     without this column would be choosing between English words to prove she
     understood a Cantonese one.

     Simplified, deliberately: the audience is people who came from the
     mainland, and 繁体 would recreate the reading barrier this column is
     meant to remove. */
  if (addColumnIfMissing('vocabulary', 'mandarin', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.mandarin');
  }

  /* The meaning in Bahasa Indonesia — the third audience, and the second-largest
     group of domestic helpers in Hong Kong after the Filipino community.

     A MEANING column like `english` and `tagalog`, not a translation of the
     Cantonese. It has to exist for the same reason `mandarin` does: the quiz
     draws its multiple-choice options from `english`, so an Indonesian speaker
     without this column would be picking between English words to prove she
     understood a Cantonese one.

     Deliberately NOT derived from `tagalog`. The two languages are related
     enough that a Tagalog gloss reads as *nearly* right to an Indonesian
     speaker, which is worse than obviously wrong — 「藥」 is obat, not gamot, and
     a near-miss here would teach the wrong word. tools/content-migration-test.js
     asserts the two columns are never silently identical. */
  if (addColumnIfMissing('vocabulary', 'indonesian', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('vocabulary.indonesian');
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

  /* Fill in the Simplified Chinese gloss for entries that do not have one yet.

     This cannot ride along with migrateContent(), and the reason is worth
     recording: migrateContent() only ever INSERTs (INSERT OR IGNORE on the
     primary id), which is exactly right for ADDING entries and exactly wrong
     for ENRICHING them — every one of these 132 rows already exists, so an
     INSERT OR IGNORE is a no-op and the column would stay empty forever.

     Guarded by a meta flag rather than by "is mandarin empty", for the same
     reason as the `type` backfill above: once the operator has typed her own
     gloss into the admin form, a boot-time UPDATE keyed on emptiness would
     silently overwrite it on every restart.

     The flag stores the SIZE of the gloss overlay rather than '1'. A plain
     boolean guard would mean the very first boot that ran it bricked every
     later gloss addition — the 30-entry sample would have permanently blocked
     the remaining 102, with the only fix being a manual SQL edit in production.
     Keying on the count makes "the overlay grew" the trigger, so adding glosses
     to data.js keeps working forever while a boot with nothing new still does
     no writes at all. `made` also reports the delta, so the boot log says how
     many entries a content drop actually reached. */
  const glossCount = String(Object.keys(MANDARIN_GLOSSES).length);
  const glossState = db.prepare("SELECT value FROM meta WHERE key = 'vocab_mandarin_backfilled'").get();
  if (!glossState || Number(glossState.value) < Number(glossCount)) {
    const upd = db.prepare("UPDATE vocabulary SET mandarin = ?, updated_at = ? WHERE id = ? AND mandarin = ''");
    const now = new Date().toISOString();
    let filled = 0;
    for (const [id, gloss] of Object.entries(MANDARIN_GLOSSES)) {
      filled += upd.run(gloss, now, Number(id)).changes;
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('vocab_mandarin_backfilled', ?)")
      .run(glossCount);
    if (filled) changes.push(`vocabulary.mandarin filled for ${filled} entr${filled === 1 ? 'y' : 'ies'}`);
  }

  /* The same backfill for the Indonesian glosses, on the same terms: guarded by
     a meta flag that stores the SIZE of the overlay rather than a boolean, so a
     later content drop keeps working while a boot with nothing new writes
     nothing. See the long note above — every word of it applies here.

     The flag also carries the review state. These glosses are machine-drafted
     and have NOT been checked by a native speaker, which is exactly the honesty
     the Tier A elder-care drafts and the Mandarin glosses shipped with: a gloss
     for every entry, and a marker so the whole set can be reviewed in one pass.
     A wrong gloss is a correction; it is not a correctness risk to the Cantonese,
     which is already verified. */
  const idGlossCount = String(Object.keys(INDONESIAN_GLOSSES).length);
  const idGlossState = db.prepare("SELECT value FROM meta WHERE key = 'vocab_indonesian_backfilled'").get();
  if (!idGlossState || Number(idGlossState.value) < Number(idGlossCount)) {
    const upd = db.prepare("UPDATE vocabulary SET indonesian = ?, updated_at = ? WHERE id = ? AND indonesian = ''");
    const now = new Date().toISOString();
    let filled = 0;
    for (const [id, gloss] of Object.entries(INDONESIAN_GLOSSES)) {
      filled += upd.run(gloss, now, Number(id)).changes;
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('vocab_indonesian_backfilled', ?)")
      .run(idGlossCount);
    if (filled) changes.push(`vocabulary.indonesian filled for ${filled} entr${filled === 1 ? 'y' : 'ies'}`);
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

  /* ---- posts.category ---------------------------------------------------- */
  /* A topic for the News channel, so a reader can narrow an endless list to
     what she came for (see news-category.js for the taxonomy and the
     classifier). Added to the live table because the column was introduced
     after the first posts were already imported — 50 of them had a category
     of nothing, and a filter chip that silently hides them would be worse
     than no chip at all. */
  if (addColumnIfMissing('posts', 'category', "TEXT NOT NULL DEFAULT ''")) {
    changes.push('posts.category');
    const filled = backfillNewsCategories();
    if (filled > 0) changes.push(`classified ${filled} existing post(s)`);
  }

  // The single seeded admin predates the email/status columns.
  db.exec("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''");

  /* ---- news rows dated in the future -------------------------------------- */
  /* One-time repair for the Inquirer's mislabelled timezone. See
     repairFutureDatedNews for why the `published_at > now` test, not this flag,
     is the real idempotency guard. */
  if (!db.prepare("SELECT value FROM meta WHERE key = 'news_future_dates_repaired'").get()) {
    const { shifted } = repairFutureDatedNews();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('news_future_dates_repaired', '1')").run();
    if (shifted) changes.push(`shifted ${shifted} future-dated Inquirer post(s) back 8h`);
  }

  return changes;
}

/**
 * Classify every post that has no category yet.
 *
 * Runs on the migration that adds the column, and again whenever the operator
 * asks ("Re-classify news" in the dashboard) — the keyword list in
 * news-category.js is a guess, and a guess made with a shorter keyword list
 * yesterday is worth redoing with a better one today. Only ever touches rows
 * with an EMPTY category, so a correction the operator made in the admin form
 * survives every future run. That is the whole point of the emptiness test:
 * "classified" and "classified wrongly" both look like a non-empty category.
 *
 * @returns {number} how many rows were written
 */
function backfillNewsCategories() {
  // Prepared here rather than in S: this runs from migrateSchema(), which is
  // called long before the statement table is built. Same reason the learner
  // backfill above prepares its own.
  const rows = db
    .prepare(
      `SELECT id, channel, title_en, summary_en, source_key FROM posts
        WHERE category IS NULL OR category = ''`
    )
    .all();
  const set = db.prepare('UPDATE posts SET category = ? WHERE id = ?');
  let n = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const category = newsCategory.classifyNews({
        title: row.title_en,
        summary: row.summary_en,
        source_key: row.source_key,
      });
      // Culture posts get no topic on purpose — the channel is read, not
      // sifted — so a culture row is left alone even by a re-run.
      if (row.channel !== 'news') continue;
      set.run(category, Number(row.id));
      n += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return n;
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
  'id, cantonese, jyutping, english, tagalog, mandarin, indonesian, emoji, level, category_id, ' +
  'type, speaker, scenario_id, example_yue, example_jyutping, example_en, ' +
  'usage_note, tags, status, sort_order';
const VOCAB_PLACEHOLDERS = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';

function vocabValues(v) {
  return [
    v.id,
    v.cantonese,
    v.jyutping,
    v.english,
    v.tagalog || '',
    v.mandarin || '',
    v.indonesian || '',
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
const CONTENT_VERSION = 9; // v1 = original 64 · v2 = Tier A expansion · v3 = coverage top-up (every category ≥5) · v4 = Simplified Chinese glosses (all 132) · v5 = Restaurant category + 10 entries (all 142 glossed) · v6 = the 9 empty (category x level) combinations filled, +38 entries (all 180 glossed) · v7 = Festivals category (id 19, 節日/Festivals) + 36 vocabulary rows (ids 181–216), all four languages · v8 = festival coverage completed: +24 rows (ids 217–240) for the five events that had no words at all (Ching Ming, Buddha's Birthday, Chongyang, Winter Solstice, Christmas), plus 龍舟, all four languages · v9 = five everyday categories (ids 20–24: Food, Fruit, Colours, Money, Counting) + 94 vocabulary rows (ids 241–334), all four languages, every new category filling all three levels

// Living passages content version. Unlike the vocabulary/category migration,
// living_posts are purely editorial (no operator-edit UI exists for them), so
// each bump UPSERTs the full seeded set — updating existing passages in place and
// inserting any new slugs. The UPDATE path preserves each row's `id`, so user
// reactions and comments (foreign-keyed on living_posts(id) with ON DELETE
// CASCADE) survive untouched. Guarded so a content drop runs exactly once per
// version on every deployment, including the production database that already
// carries the original 14 short passages.
const LIVING_CONTENT_VERSION = 4; // v1 = original 14 short passages · v2 = expanded 18 passages (English, ~500 words each) via the Living upgrade · v3 = wage correction: FDW Minimum Allowable Wage stated as HK$5,220/month (was wrong HK$42.1/hr) · v4 = prominent MAW effective date: HK$5,220 applies to contracts signed on/after 3 Oct 2026
// NOTE: the Simplified glosses (vocabulary.mandarin), the Indonesian glosses
// (vocabulary.indonesian) and BOTH per-language category name sets
// (categories.name_zh, categories.name_id) are NOT applied by migrateContent() —
// it only ever INSERTs, so it cannot enrich a row that already exists. All four
// travel through guarded UPDATEs in migrateSchema() instead, keyed on meta flags
// (vocab_mandarin_backfilled, vocab_indonesian_backfilled, categories_zh_backfilled,
// categories_id_backfilled) that store the overlay SIZE. Bumping CONTENT_VERSION
// would do nothing for them.
//
// ORDERING NOTE for v5 (and for any future category drop): the guarded UPDATEs
// for categories.name_zh / name_id run inside migrateSchema(), which runs BEFORE
// migrateContent() inserts the new category row. That is fine here only because
// migrateContent() inserts the category WITH both names already merged (see
// insCat below: `c.name_zh || ''`, `c.name_id || ''`, and data.js merges
// CATEGORY_ZH_NAMES / CATEGORY_ID_NAMES into SEED_CATEGORIES at load). A new
// category therefore never relies on the backfill UPDATE — it arrives complete.
// If that ever stops being true, those UPDATEs must move to AFTER the category
// insert.

function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categories').get();
  if (n > 0) return false;

  const now = new Date().toISOString();
  const insCat = db.prepare(
    'INSERT INTO categories (id, name_en, name_yue, name_fil, name_zh, name_id, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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
    // `c.sort_order ?? i`, NOT bare `i`. migrateContent() below already honours
    // an explicit sort_order and falls back to the array index; this path used
    // only the index, so the two disagreed the moment a category carried one.
    // v9 shipped Food..Counting with sort_order 19-23 appended after Festivals,
    // and a fresh database ordered them 18..23 with Festivals last while a
    // migrated one ordered them 19..23 with Festivals before them — same seed,
    // two different apps. The scenarios line below always did this correctly.
    SEED_CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.name_zh || '', c.name_id || '', c.icon || '📁', c.sort_order ?? i));
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
// Discover feed seed — the culture channel's opening articles.
//
// DELIBERATELY SEPARATE from CONTENT_VERSION. That counter guards the vocabulary
// library, and bumping it is a statement that the words changed — which this is
// not. Adding the first posts to a table that did not exist yesterday should
// not re-run the vocabulary migration or make every content test re-derive its
// expected counts. So posts get their own flag in `meta`.
//
// Guarded on the SEED SIZE, not a boolean, following the overlay rule already
// used for the meaning columns: when SEED_POSTS grows, the flag no longer
// matches and the new entries are inserted. `INSERT OR IGNORE` keys on slug, so
// a post the operator has edited is left exactly as it is.
// ---------------------------------------------------------------------------

function seedPostsIfNeeded() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'posts_seeded'").get();
  const current = row ? Number(row.value) || 0 : 0;
  if (current >= SEED_POSTS.length) return 0;

  const now = new Date().toISOString();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO posts
      (slug, channel, icon,
       title_en, title_fil, title_zh, title_id,
       summary_en, summary_fil, summary_zh, summary_id,
       body_en, body_fil, body_zh, body_id,
       source_name, source_url, source_key, source_lang, origin, status,
       published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', NULL, '', 'manual', ?, ?, ?, ?)
  `);

  let added = 0;
  db.exec('BEGIN');
  try {
    for (const p of SEED_POSTS) {
      added += ins.run(
        p.slug,
        p.channel || 'culture',
        p.icon || '🏮',
        p.title_en || '',
        p.title_fil || '',
        p.title_zh || '',
        p.title_id || '',
        p.summary_en || '',
        p.summary_fil || '',
        p.summary_zh || '',
        p.summary_id || '',
        p.body_en || '',
        p.body_fil || '',
        p.body_zh || '',
        p.body_id || '',
        p.status === 'published' ? 'published' : 'draft',
        p.published_at || now,
        now,
        now
      ).changes;
    }
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'posts_seeded',
      String(SEED_POSTS.length)
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return added;
}

const postsSeeded = seedPostsIfNeeded();

/**
 * Seed the Living passages. Guarded on the SEED size (like seedPostsIfNeeded)
 * so re-running on an existing database never re-inserts and never clobbers an
 * operator's edits — INSERT OR IGNORE keys on slug, and this only runs while the
 * seeded count is below the seed array length.
 */
// Living passages are editorial, curated content — there is no operator-edit UI
// for them — so when the seeded set changes we UPSERT the whole thing: existing
// slugs are UPDATEd in place (preserving their `id` and therefore every user
// reaction and comment foreign-keyed on that id), and brand-new slugs are
// INSERTed. The migration is versioned on `living_content_version` so a content
// drop runs exactly once per version on every boot, including the production
// database that already holds the original 14 short passages.
function seedLivingIfNeeded() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'living_content_version'").get();
  const current = row ? Number(row.value) || 0 : 0;
  if (current >= LIVING_CONTENT_VERSION) return 0;

  const now = new Date().toISOString();
  const upsertExisting = db.prepare(`
    UPDATE living_posts SET
      category     = ?,
      sub_key      = ?,
      icon         = ?,
      title_en     = ?, title_fil = ?, title_zh = ?, title_id = ?,
      body_en      = ?, body_fil  = ?, body_zh  = ?, body_id  = ?,
      sub_en       = ?, sub_fil   = ?, sub_zh   = ?, sub_id   = ?,
      status       = ?,
      published_at = ?,
      updated_at   = ?
    WHERE slug = ?
  `);
  const insertNew = db.prepare(`
    INSERT OR IGNORE INTO living_posts
      (slug, category, sub_key, icon,
       title_en, title_fil, title_zh, title_id,
       body_en, body_fil, body_zh, body_id,
       sub_en, sub_fil, sub_zh, sub_id,
       status, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const findSlug = db.prepare('SELECT id FROM living_posts WHERE slug = ?');

  let added = 0, refreshed = 0;
  db.exec('BEGIN');
  try {
    for (const p of SEED_LIVING) {
      const existing = findSlug.get(p.slug);
      if (existing) {
        refreshed += upsertExisting.run(
          p.category || 'medical',
          p.sub_key || '',
          p.icon || '🏠',
          p.title_en || '', p.title_fil || '', p.title_zh || '', p.title_id || '',
          p.body_en || '', p.body_fil || '', p.body_zh || '', p.body_id || '',
          p.sub_en || '', p.sub_fil || '', p.sub_zh || '', p.sub_id || '',
          p.status === 'draft' ? 'draft' : 'published',
          p.published_at || now,
          now,
          p.slug
        ).changes;
      } else {
        added += insertNew.run(
          p.slug,
          p.category || 'medical',
          p.sub_key || '',
          p.icon || '🏠',
          p.title_en || '', p.title_fil || '', p.title_zh || '', p.title_id || '',
          p.body_en || '', p.body_fil || '', p.body_zh || '', p.body_id || '',
          p.sub_en || '', p.sub_fil || '', p.sub_zh || '', p.sub_id || '',
          p.status === 'draft' ? 'draft' : 'published',
          p.published_at || now,
          now,
          now
        ).changes;
      }
    }
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'living_content_version',
      String(LIVING_CONTENT_VERSION)
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return added + refreshed;
}

const livingSeeded = seedLivingIfNeeded();

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
    `INSERT OR IGNORE INTO categories (id, name_en, name_yue, name_fil, name_zh, name_id, icon, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
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
      cats += insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.name_zh || '', c.name_id || '', c.icon || '📁', c.sort_order ?? i).changes;
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
    'INSERT INTO categories (name_en, name_yue, name_fil, name_zh, name_id, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  updateCategory: db.prepare(
    'UPDATE categories SET name_en = ?, name_yue = ?, name_fil = ?, name_zh = ?, name_id = ?, icon = ?, enabled = ? WHERE id = ?'
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
    `UPDATE vocabulary SET cantonese = ?, jyutping = ?, english = ?, tagalog = ?, mandarin = ?, indonesian = ?, emoji = ?, level = ?,
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
  // An employer is identified by the NAME they typed, not a login id. The name
  // is stored on `users.name`; `username` holds a synthetic key derived from it
  // so the UNIQUE constraint still does the deduplication.
  getEmployerByName: db.prepare(
    "SELECT * FROM users WHERE role = 'employer' AND name = ? COLLATE NOCASE ORDER BY id LIMIT 1"
  ),
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
  setUserAccessCode: db.prepare('UPDATE users SET access_code_hash = ? WHERE id = ?'),
  touchUserLogin: db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?'),

  // --- employer trusted devices ---
  getDevicesByEmployer: db.prepare(
    'SELECT id, employer_id, token_hash, label, created_at, last_seen_at FROM employer_devices WHERE employer_id = ? ORDER BY id DESC'
  ),
  countDevicesByEmployer: db.prepare('SELECT COUNT(*) AS n FROM employer_devices WHERE employer_id = ?'),
  insertDevice: db.prepare(
    'INSERT INTO employer_devices (employer_id, token_hash, label, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
  ),
  touchDevice: db.prepare('UPDATE employer_devices SET last_seen_at = ? WHERE id = ?'),
  deleteDevicesByEmployer: db.prepare('DELETE FROM employer_devices WHERE employer_id = ?'),
  updateUserReauth: db.prepare('UPDATE users SET device_reauth_open_until = ? WHERE id = ?'),
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

  /*
   * Feedback inbox. `user_id` is written only for an employer — see the
   * feedback table comment for why a learner row stays unattributable.
   *
   * listFeedback takes the status twice because the same value is used both to
   * decide whether the filter applies and to match it; a NULL status means
   * "everything", which is what the operator's default view wants.
   */
  insertFeedback: db.prepare(`
    INSERT INTO feedback (role, message, contact, user_id, lang, page, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
  `),
  getFeedbackById: db.prepare(`
    SELECT f.*, u.name AS employer_name
      FROM feedback f
      LEFT JOIN users u ON u.id = f.user_id
     WHERE f.id = ?
  `),
  // The join is what makes an employer's message actionable: without a name the
  // operator sees "Employer" and has no way to tell which one wrote in, so the
  // message cannot be answered — which is the whole reason an employer's row is
  // attributed in the first place. A learner's row has no user_id, so the LEFT
  // JOIN yields NULL and nothing about her is joined in.
  listFeedback: db.prepare(`
    SELECT f.*, u.name AS employer_name
      FROM feedback f
      LEFT JOIN users u ON u.id = f.user_id
     WHERE (? IS NULL OR f.status = ?)
     ORDER BY f.created_at DESC, f.id DESC
     LIMIT ?
  `),
  feedbackCounts: db.prepare(`
    SELECT status, COUNT(*) AS n FROM feedback GROUP BY status
  `),
  countFeedback: db.prepare('SELECT COUNT(*) AS n FROM feedback'),
  setFeedbackStatus: db.prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?'),
  deleteFeedback: db.prepare('DELETE FROM feedback WHERE id = ?'),

  countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),

  /* ---- Discover feed ---------------------------------------------------- */
  // The learner-facing feed. `status` is a hard filter here (unlike vocabulary,
  // where 'draft' is a review flag that still serves) because a post is a dated
  // publication: an unfinished one must not appear in the feed at all.
  listPosts: db.prepare(`
    SELECT * FROM posts
     WHERE status = ?
       AND (? IS NULL OR channel = ?)
       AND (? IS NULL OR category = ?)
       AND (? IS NULL OR source_key LIKE ?)
     ORDER BY COALESCE(published_at, created_at) DESC, id DESC
     LIMIT ?
  `),
  // Operator view — every status, newest first.
  listAllPosts: db.prepare(`
    SELECT * FROM posts
     WHERE (? IS NULL OR channel = ?)
       AND (? IS NULL OR category = ?)
     ORDER BY COALESCE(published_at, created_at) DESC, id DESC
     LIMIT ?
  `),
  getPostById: db.prepare('SELECT * FROM posts WHERE id = ?'),
  getPostBySlug: db.prepare('SELECT * FROM posts WHERE slug = ?'),
  /* The same feed with a retention cut. Two statements rather than one with a
     nullable cutoff because `? IS NULL OR ...` cannot use an index, and this
     query runs on every Discover load.

     `origin` is in the WHERE for the reason in listPosts(): the age cut governs
     imported news, while something an operator published by hand does not
     expire. So it is `origin != 'auto' OR … >= ?` — the manual row always
     passes, and the imported row has to be inside the window. */
  listPostsInWindow: db.prepare(`
    SELECT * FROM posts
     WHERE status = ?
       AND (? IS NULL OR channel = ?)
       AND (origin != 'auto' OR COALESCE(published_at, created_at) >= ?)
       AND (? IS NULL OR category = ?)
       AND (? IS NULL OR source_key LIKE ?)
     ORDER BY COALESCE(published_at, created_at) DESC, id DESC
     LIMIT ?
  `),
  countPosts: db.prepare('SELECT COUNT(*) AS n FROM posts'),
  countPostsByChannel: db.prepare('SELECT channel, COUNT(*) AS n FROM posts WHERE status = ? GROUP BY channel'),
  /* Everything past the retention window, oldest first — what pruneNewsPast()
     is about to delete. Oldest-first matters for a human reading the report,
     and for a test that wants to know WHICH rows went. */
  listExpiredNews: db.prepare(
    `SELECT id, slug, title_en, published_at, created_at FROM posts
      WHERE channel = 'news' AND origin = 'auto'
        AND COALESCE(published_at, created_at) < ?
      ORDER BY COALESCE(published_at, created_at) ASC, id ASC`
  ),
  deleteNewsOlderThan: db.prepare(
    `DELETE FROM posts
      WHERE channel = 'news' AND origin = 'auto'
        AND COALESCE(published_at, created_at) < ?`
  ),
  /* Published news counts per category, for the filter chips. 'all' is every
     published news row a learner can actually read, so the chip row can show
     "All news 41" beside "Work 12" — and a number that does not match the list
     under it is a number she learns to distrust. So the count is scoped exactly
     like the feed: imported news inside the retention window, plus anything an
     operator published by hand, which does not expire (see listPosts).
     A category with nothing in it is deliberately still returned as 0 — a chip
     that appears only once it has content is a chip she cannot learn. */
  countPublishedNewsByCategory: db.prepare(
    `SELECT category, COUNT(*) AS n FROM posts
      WHERE status = 'published' AND channel = 'news'
        AND (origin != 'auto' OR COALESCE(published_at, created_at) >= ?)
      GROUP BY category`
  ),
  /* Same scope as countPublishedNewsByCategory, but grouped by the feed that
     produced the item (rthk / ph / id). The source_key is stored as
     "<source>:<guid>", so the prefix before the colon is the region key. */
  countPublishedNewsBySource: db.prepare(
    `SELECT substr(source_key, 1, instr(source_key, ':') - 1) AS src, COUNT(*) AS n
       FROM posts
      WHERE status = 'published' AND channel = 'news'
        AND (origin != 'auto' OR COALESCE(published_at, created_at) >= ?)
        AND source_key IS NOT NULL AND source_key != ''
        AND instr(source_key, ':') > 0
      GROUP BY src`
  ),
  /* Everything still unclassified, newest last so a backfill reads the rows in
     a stable order. The classifier is a pure function of the row, so the order
     only matters for a human reading a debug log. */
  postsMissingCategory: db.prepare(
    `SELECT id, channel, title_en, summary_en, source_key FROM posts
      WHERE category IS NULL OR category = ''`
  ),
  setPostCategory: db.prepare('UPDATE posts SET category = ? WHERE id = ?'),
  insertPost: db.prepare(`
    INSERT INTO posts
      (slug, channel, icon, category,
       title_en, title_fil, title_zh, title_id,
       summary_en, summary_fil, summary_zh, summary_id,
       body_en, body_fil, body_zh, body_id,
       source_name, source_url, source_key, source_lang, origin, status,
       published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  // The importer's insert. INSERT OR IGNORE keyed on the partial unique index
  // over source_key is what makes a re-run idempotent: the same feed item is a
  // no-op the second time, so `changes` is exactly "how many were new".
  insertPostIfNew: db.prepare(`
    INSERT OR IGNORE INTO posts
      (slug, channel, icon, category,
       title_en, title_fil, title_zh, title_id,
       summary_en, summary_fil, summary_zh, summary_id,
       body_en, body_fil, body_zh, body_id,
       source_name, source_url, source_key, source_lang, origin, status,
       published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updatePost: db.prepare(`
    UPDATE posts SET
      slug = ?, channel = ?, icon = ?, category = ?,
      title_en = ?, title_fil = ?, title_zh = ?, title_id = ?,
      summary_en = ?, summary_fil = ?, summary_zh = ?, summary_id = ?,
      body_en = ?, body_fil = ?, body_zh = ?, body_id = ?,
      source_name = ?, source_url = ?, status = ?, published_at = ?, updated_at = ?
    WHERE id = ?
  `),
  deletePost: db.prepare('DELETE FROM posts WHERE id = ?'),
  // Retiring a source. See deleteNewsPostsFromSourcesNotIn for why these are
  // scoped to channel 'news' AND origin 'auto' — that pair is what makes it
  // impossible for a mis-set source list to delete editorial content.
  listAutoNewsSourceKeys: db.prepare(
    `SELECT DISTINCT source_key FROM posts
      WHERE channel = 'news' AND origin = 'auto' AND source_key IS NOT NULL AND source_key != ''`
  ),
  deleteAutoNewsPostsBySourcePrefix: db.prepare(
    `DELETE FROM posts WHERE channel = 'news' AND origin = 'auto' AND source_key LIKE ?`
  ),

  // -------------------------------------------------------------------------
  // Stories
  //
  // NOTE THE COLUMN LISTS. None of the PUBLIC statements below selects
  // learner_id — that is the whole point of listing columns instead of using
  // `SELECT *`, and it is why these cannot be collapsed into one query with a
  // status filter. learner_id exists for rate-limiting and for a learner to see
  // her own submissions; it must never reach a reader.
  // -------------------------------------------------------------------------
  insertStory: db.prepare(`
    INSERT INTO stories
      (slug, learner_id, display_name, lang, topic, title, body, gloss_en, status, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  /** Public list. No learner_id, no body — a list only needs the card. */
  listPublishedStories: db.prepare(`
    SELECT id, slug, display_name, lang, topic, title, gloss_en, published_at
      FROM stories
     WHERE status = 'published'
     ORDER BY published_at DESC, id DESC
     LIMIT ?
  `),
  /** Public reader. No learner_id. */
  getPublishedStoryBySlug: db.prepare(`
    SELECT id, slug, display_name, lang, topic, title, body, gloss_en, published_at
      FROM stories
     WHERE slug = ? AND status = 'published'
  `),
  /** Moderation queue. Still no learner_id — see the note above. */
  listStoriesForModeration: db.prepare(`
    SELECT id, slug, display_name, lang, topic, title, body, gloss_en, status,
           reviewer_note, published_at, created_at, updated_at
      FROM stories
     WHERE (? = '' OR status = ?)
     ORDER BY
       CASE status WHEN 'pending' THEN 0 ELSE 1 END,
       created_at ASC
     LIMIT ?
  `),
  getStoryForModeration: db.prepare(`
    SELECT id, slug, display_name, lang, topic, title, body, gloss_en, status,
           reviewer_note, published_at, created_at, updated_at
      FROM stories WHERE id = ?
  `),
  /** Slug uniqueness has to consider EVERY story, not just published ones. */
  getStoryIdBySlug: db.prepare('SELECT id FROM stories WHERE slug = ?'),
  setStoryStatus: db.prepare(`
    UPDATE stories SET status = ?, reviewer_note = ?, published_at = ?, updated_at = ? WHERE id = ?
  `),
  /** The operator may fix a typo or remove an identifying detail before publishing. */
  setStoryContent: db.prepare(`
    UPDATE stories SET title = ?, body = ?, gloss_en = ?, display_name = ?, updated_at = ? WHERE id = ?
  `),
  deleteStory: db.prepare('DELETE FROM stories WHERE id = ?'),
  storyCounts: db.prepare('SELECT status, COUNT(*) AS n FROM stories GROUP BY status'),
  countStoriesSince: db.prepare(
    'SELECT COUNT(*) AS n FROM stories WHERE learner_id = ? AND created_at >= ?'
  ),
  listStoriesByLearner: db.prepare(`
    SELECT id, slug, title, lang, topic, status, reviewer_note, published_at, created_at
      FROM stories WHERE learner_id = ? ORDER BY created_at DESC LIMIT ?
  `),
  /** For the sitemap: only published stories, and only the dates it needs. */
  listPublishedStorySlugs: db.prepare(`
    SELECT slug, published_at, updated_at FROM stories
     WHERE status = 'published' ORDER BY published_at DESC
  `),

  // --- Web Push subscriptions ---
  listPushSubscriptions: db.prepare('SELECT * FROM push_subscriptions ORDER BY created_at DESC'),
  getPushSubscription: db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?'),
  upsertPushSubscription: db.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, learner_id, source, last_active_at, created_at, updated_at)
    VALUES (@endpoint, @p256dh, @auth, @learner_id, @source, @now, @now, @now)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      learner_id = COALESCE(excluded.learner_id, push_subscriptions.learner_id),
      last_active_at = excluded.last_active_at,
      updated_at = excluded.updated_at
  `),
  deletePushSubscription: db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?'),
  countPushSubscriptions: db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions'),
  touchPushSubscription: db.prepare('UPDATE push_subscriptions SET last_active_at = ?, updated_at = ? WHERE endpoint = ?'),
  markPushReminded: db.prepare('UPDATE push_subscriptions SET last_reminded_at = ?, updated_at = ? WHERE endpoint = ?'),
  stalePushSubscriptions: db.prepare(`
    SELECT * FROM push_subscriptions
     WHERE last_active_at IS NOT NULL AND last_active_at < ?
       AND (last_reminded_at IS NULL OR last_reminded_at < ?)
  `),

  // --- Living: supportive passages about life in Hong Kong ---
  listLivingPosts: db.prepare(`
    SELECT id, slug, category, sub_key, icon,
           title_en, title_fil, title_zh, title_id,
           sub_en, sub_fil, sub_zh, sub_id,
           published_at,
           (SELECT COALESCE(SUM(count), 0) FROM living_reactions WHERE post_id = living_posts.id) AS reaction_count,
           (SELECT COUNT(*) FROM living_comments WHERE post_id = living_posts.id AND status = 'published') AS comment_count
      FROM living_posts
     WHERE status = 'published'
     ORDER BY published_at DESC, id DESC
     LIMIT ?
  `),
  listLivingByCategory: db.prepare(`
    SELECT id, slug, category, sub_key, icon,
           title_en, title_fil, title_zh, title_id,
           sub_en, sub_fil, sub_zh, sub_id,
           published_at,
           (SELECT COALESCE(SUM(count), 0) FROM living_reactions WHERE post_id = living_posts.id) AS reaction_count,
           (SELECT COUNT(*) FROM living_comments WHERE post_id = living_posts.id AND status = 'published') AS comment_count
      FROM living_posts
     WHERE status = 'published' AND category = ?
     ORDER BY published_at DESC, id DESC
     LIMIT ?
  `),
  listLivingCategories: db.prepare(`
    SELECT category, COUNT(*) AS n
      FROM living_posts
     WHERE status = 'published'
     GROUP BY category
     ORDER BY category ASC
  `),
  getLivingPostBySlug: db.prepare(`
    SELECT * FROM living_posts
     WHERE slug = ? AND status = 'published'
  `),
  insertLivingPost: db.prepare(`
    INSERT INTO living_posts
      (slug, category, sub_key, icon,
       title_en, title_fil, title_zh, title_id,
       body_en, body_fil, body_zh, body_id,
       sub_en, sub_fil, sub_zh, sub_id,
       status, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getLivingReactions: db.prepare('SELECT emoji, count FROM living_reactions WHERE post_id = ?'),
  getLivingUserReaction: db.prepare(
    'SELECT emoji FROM living_user_reactions WHERE post_id = ? AND public_id = ?'
  ),
  incLivingReaction: db.prepare(`
    INSERT INTO living_reactions (post_id, emoji, count)
    VALUES (?, ?, 1)
    ON CONFLICT(post_id, emoji) DO UPDATE SET count = count + 1
  `),
  decLivingReaction: db.prepare(`
    UPDATE living_reactions SET count = MAX(0, count - 1)
     WHERE post_id = ? AND emoji = ?
  `),
  upsertLivingUserReaction: db.prepare(`
    INSERT INTO living_user_reactions (post_id, public_id, emoji, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(post_id, public_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at
  `),
  delLivingUserReaction: db.prepare(
    'DELETE FROM living_user_reactions WHERE post_id = ? AND public_id = ?'
  ),
  listLivingComments: db.prepare(`
    SELECT id, post_id, display_name, body, created_at
      FROM living_comments
     WHERE post_id = ? AND status = 'published'
     ORDER BY created_at ASC, id ASC
  `),
  insertLivingComment: db.prepare(`
    INSERT INTO living_comments (post_id, public_id, display_name, body, status, created_at)
    VALUES (?, ?, ?, ?, 'published', ?)
  `),
  getLivingComment: db.prepare(`
    SELECT id, post_id, display_name, body, created_at
      FROM living_comments WHERE id = ?
  `),
};

// ---------------------------------------------------------------------------
// Web Push subscriptions
// ---------------------------------------------------------------------------
function insertSubscription({ endpoint, p256dh, auth, learnerId = null, source = 'web' }) {
  if (!endpoint) return null;
  const now = new Date().toISOString();
  try {
    S.upsertPushSubscription.run({
      endpoint,
      p256dh,
      auth,
      learner_id: learnerId ? Number(learnerId) : null,
      source,
      now,
    });
    return S.getPushSubscription.get(endpoint);
  } catch (e) {
    console.error('insertSubscription failed:', e.message);
    return null;
  }
}

function removeSubscription(endpoint) {
  return S.deletePushSubscription.run(endpoint).changes > 0;
}

function listSubscriptions() {
  return S.listPushSubscriptions.all();
}

function updateLastActive(endpoint) {
  if (!endpoint) return;
  const now = new Date().toISOString();
  S.touchPushSubscription.run(now, now, endpoint);
}

// Devices that have not interacted for `days` and were not reminded recently —
// used by the practice-reminder job so a quiet helper gets a gentle nudge.
function listStaleForReminder(days) {
  const since = Math.max(1, Number(days) || 3);
  const cutoff = new Date(Date.now() - since * 86400000).toISOString();
  const remindCutoff = new Date(Date.now() - since * 86400000).toISOString();
  return S.stalePushSubscriptions.all(cutoff, remindCutoff);
}

function markReminded(endpoint) {
  if (!endpoint) return;
  const now = new Date().toISOString();
  S.markPushReminded.run(now, now, endpoint);
}

function countSubscriptions() {
  const row = S.countPushSubscriptions.get();
  return row ? Number(row.n) || 0 : 0;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const listCategories = () => S.listCategories.all();
const listEnabledCategories = () => S.listEnabledCategories.all();
const getCategory = (id) => S.getCategory.get(Number(id));

function createCategory({ name_en, name_yue = '', name_fil = '', name_zh = '', name_id = '', icon = '📁' }) {
  const { m } = S.maxCategoryOrder.get();
  const info = S.insertCategory.run(name_en, name_yue, name_fil, name_zh, name_id, icon, m + 1);
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
    patch.name_zh ?? current.name_zh,
    patch.name_id ?? current.name_id,
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
    b.tagalog || '', b.mandarin || '', b.indonesian || '', b.emoji || '📝',
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
    b.mandarin ?? cur.mandarin,
    b.indonesian ?? cur.indonesian,
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

/**
 * Find or create the employer account for a name, and sign them in.
 *
 * Sign-in is NAME + a device token stored in that browser's localStorage. There
 * is no password and no standing access code to forget — the token IS the
 * credential, bound to the one browser the employer normally uses. A stranger
 * who guesses "Mrs Chan" on a foreign machine gets nothing, because they hold no
 * token for that account.
 *
 * Returns one of:
 *   { user, firstTime: true,  deviceToken }  — account just created, OR a device
 *                                              was linked via an open pairing
 *                                              window. `deviceToken` is returned
 *                                              ONCE; the caller must store it.
 *   { user, firstTime: false }               — re-login with a recognised device.
 *
 * Behaviour:
 *   - Name does not exist → create the employer, mint a device token, store its
 *     hash, hand the token back. Nothing to remember.
 *   - Name exists + a token matching a stored device → success.
 *   - Name exists + no / unmatched token + the operator has opened a pairing
 *     window (device_reauth_open_until in the future) → link THIS device: mint a
 *     token, store it, return it as firstTime, and close the window. This is the
 *     recovery path for a forgotten token or a new phone, and it asks the
 *     employer to remember nothing.
 *   - Name exists + no / unmatched token + no open window → throw needsLink so
 *     the UI can tell the employer to use a known device or ask the operator to
 *     open pairing.
 */
function loginOrCreateEmployer(rawName, rawDeviceToken) {
  const name = String(rawName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!name) throw new Error('A name is required.');

  const existing = S.getEmployerByName.get(name);
  if (existing) {
    if (existing.status && existing.status !== 'active') {
      throw new Error('That account is not active.');
    }

    const token = String(rawDeviceToken || '').trim();
    // Re-login with a recognised device token.
    if (token && verifyDeviceToken(existing.id, token)) {
      S.touchUserLogin.run(new Date().toISOString(), existing.id);
      return { user: getUserById(existing.id), firstTime: false };
    }

    // No token, or one we don't recognise. If the operator has opened a pairing
    // window, link this device now — the recovery path for a forgotten token or
    // a new phone that needs the employer to remember nothing.
    if (isDeviceReauthOpen(existing.id)) {
      const deviceToken = mintDeviceToken(existing.id);
      S.touchUserLogin.run(new Date().toISOString(), existing.id);
      closeDeviceReauth(existing.id);
      return { user: getUserById(existing.id), firstTime: true, deviceToken };
    }

    const err = new Error(
      'This device is not recognised. Sign in on a device you have used before, or ask the operator to allow a new device.'
    );
    err.needsLink = true;
    err.status = 401;
    throw err;
  }

  const now = new Date().toISOString();
  // A stable, URL-safe key from the name. Two different names can slug to the
  // same string (Mrs Chan / Mrs  Chan), so a numeric suffix disambiguates
  // without ever colliding.
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'employer';
  let username = `emp:${base}`;
  let n = 1;
  while (S.getUserByUsername.get(username)) {
    username = `emp:${base}-${++n}`;
  }

  const info = S.insertUser.run(
    username,
    // Never used to authenticate; kept non-empty and unguessable so the column
    // cannot be satisfied by an empty string.
    hashPassword(crypto.randomBytes(32).toString('base64url')),
    'employer',
    name,
    null,
    'active',
    now
  );
  const id = Number(info.lastInsertRowid);
  const deviceToken = mintDeviceToken(id);
  return { user: getUserById(id), firstTime: true, deviceToken };
}

/** Mint a fresh device token, store its hash, and return the plaintext once. */
function mintDeviceToken(employerId) {
  const token = crypto.randomBytes(24).toString('base64url');
  S.insertDevice.run(
    employerId,
    hashPassword(token),
    '',
    new Date().toISOString(),
    new Date().toISOString()
  );
  return token;
}

/** True when the presented token matches a stored device for this employer. */
function verifyDeviceToken(employerId, token) {
  const devices = S.getDevicesByEmployer.all(employerId);
  for (const d of devices) {
    if (verifyPassword(token, d.token_hash)) {
      S.touchDevice.run(new Date().toISOString(), d.id);
      return true;
    }
  }
  return false;
}

function countDevices(employerId) {
  return S.countDevicesByEmployer.get(employerId).n;
}

/** Open a pairing window for `minutes` so an unrecognised device can link. */
function openDeviceReauth(employerId, minutes) {
  const until = new Date(Date.now() + (Number(minutes) || 15) * 60000).toISOString();
  S.updateUserReauth.run(until, employerId);
  return until;
}

function isDeviceReauthOpen(employerId) {
  const u = S.getUserById.get(employerId);
  if (!u || !u.device_reauth_open_until) return false;
  return Date.parse(u.device_reauth_open_until) > Date.now();
}

function closeDeviceReauth(employerId) {
  S.updateUserReauth.run(null, employerId);
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

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const FEEDBACK_MAX = 2000;
const FEEDBACK_STATUSES = ['new', 'reviewing', 'resolved'];

/**
 * Records one piece of feedback from a learner or an employer.
 *
 * `user_id` is deliberately dropped for a learner even when the caller passes
 * one. The route knows who is asking — the whole point of this table is that the
 * row does not. An employer's id is kept: her dashboard is already hers, and she
 * expects an answer.
 *
 * Returns the stored row (so the caller can echo the id back) or null when the
 * message is empty after trimming — an empty submission is a mis-tap, not
 * feedback, and storing it would only add noise to the inbox.
 */
function createFeedback({ role = 'learner', message, contact = '', user_id = null, lang = 'en', page = '' } = {}) {
  const text = String(message ?? '').trim().slice(0, FEEDBACK_MAX);
  if (!text) return null;
  const r = role === 'employer' ? 'employer' : 'learner';
  // Only keep an employer id that resolves. A session can outlive the user it
  // points at (the account was deleted mid-visit), and a foreign-key failure
  // here would turn "thanks for your feedback" into a 500 — losing the very
  // message we were trying to collect. An unresolvable id is stored as null.
  let who = r === 'employer' && user_id != null ? Number(user_id) : null;
  if (who != null && !S.getUserById.get(who)) who = null;
  const info = S.insertFeedback.run(
    r,
    text,
    String(contact ?? '').trim().slice(0, 200),
    who,
    String(lang || 'en').slice(0, 8),
    String(page || '').slice(0, 120),
    new Date().toISOString()
  );
  return S.getFeedbackById.get(Number(info.lastInsertRowid));
}

/** The inbox, newest first. A null/unknown status means "everything". */
function listFeedback({ status = null, limit = 200 } = {}) {
  const s = FEEDBACK_STATUSES.includes(status) ? status : null;
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 200, 1), 500);
  return S.listFeedback.all(s, s, n);
}

/** Counts per status plus a total, so the tab can show a badge without a second call. */
function getFeedbackCounts() {
  const counts = { new: 0, reviewing: 0, resolved: 0, total: S.countFeedback.get().n };
  for (const row of S.feedbackCounts.all()) {
    if (row.status in counts) counts[row.status] = row.n;
  }
  return counts;
}

/**
 * Moves one item along the workflow. An unknown status is refused rather than
 * written — a typo must not create a fourth state nothing can filter on.
 */
function setFeedbackStatus(id, status) {
  if (!FEEDBACK_STATUSES.includes(status)) return null;
  const n = Number(id);
  if (!S.getFeedbackById.get(n)) return null;
  S.setFeedbackStatus.run(status, new Date().toISOString(), n);
  return S.getFeedbackById.get(n);
}

function deleteFeedback(id) {
  return S.deleteFeedback.run(Number(id)).changes > 0;
}

// ---------------------------------------------------------------------------
// Discover feed (posts)
// ---------------------------------------------------------------------------

const POST_CHANNELS = ['culture', 'news'];
const POST_STATUSES = ['draft', 'published'];
const POST_TITLE_MAX = 200;
const POST_SUMMARY_MAX = 700;
const POST_BODY_MAX = 20000;

/**
 * How long an imported news item stays in the feed. Three days.
 *
 * WHY THERE IS A WINDOW AT ALL. The importer runs hourly, so the News channel
 * is the one channel that grows without bound. Left unbounded it becomes a
 * scrolling archive of last week's typhoon, which is exactly the "not user
 * friendly, long scroll down" complaint that also produced the topic filter and
 * the pager. News is dated on purpose — its value is in being current — so an
 * expiry is the correct treatment rather than a loss of data.
 *
 * WHY THREE DAYS. Long enough that someone who opens the app once a day on her
 * day off has not missed anything, short enough that the channel still reads
 * as "this week". A helper who works six days a week should be able to catch up
 * in one sitting.
 *
 * Overridable with NEWS_MAX_AGE_DAYS so the number is a setting, not a rebuild:
 * 0 disables the window entirely (news never expires).
 */
const DEFAULT_NEWS_MAX_AGE_DAYS = 3;

const newsMaxAgeDays = () => {
  const raw = process.env.NEWS_MAX_AGE_DAYS;
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_NEWS_MAX_AGE_DAYS;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_NEWS_MAX_AGE_DAYS;
};

/**
 * The window a caller asked for, defaulted to the configured one.
 *
 * THREE cases, and the distinction between the first two is load-bearing:
 *   - omitted  → the configured window (the ordinary feed)
 *   - 0        → no window at all (how the admin list sees everything)
 *   - a number → that number, honoured
 *
 * An earlier version returned the configured window for any positive request,
 * so `pruneNewsPast({ days: 500 })` silently pruned at three days and deleted a
 * row the caller had explicitly said to keep. A parameter that is accepted and
 * then ignored is worse than no parameter: it reads as agreement.
 */
const newsRetentionDays = (requested) => {
  if (requested === undefined || requested === null) return newsMaxAgeDays();
  const n = Math.floor(Number(requested));
  return Number.isFinite(n) && n >= 0 ? n : newsMaxAgeDays();
};

/** An ISO instant `days` ago. Comparing strings works because ISO sorts. */
const beforeIso = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const trimPost = (v, max) => String(v ?? '').trim().slice(0, max);
const pickPost = (v, fallback, max) => (v == null ? fallback : trimPost(v, max));

function iconForPost(b, channel) {
  const given = String(b.icon || '').trim();
  if (given) return given.slice(0, 8);
  return channel === 'news' ? '📰' : '🏮';
}

/** URL-safe slug. CJK titles produce an empty root, which uniquePostSlug repairs. */
function slugifyPost(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** A slug no other post holds, by appending -2, -3, … (excluding one id, for edits). */
function uniquePostSlug(base, excludeId = null) {
  const root = slugifyPost(base) || 'post';
  let slug = root;
  let n = 1;
  for (;;) {
    const row = S.getPostBySlug.get(slug);
    if (!row || (excludeId != null && Number(row.id) === Number(excludeId))) return slug;
    n += 1;
    slug = `${root}-${n}`;
  }
}

/** The learner-facing feed — published only, newest first. */
function listPosts({ channel = null, status = 'published', limit = 50, category = null, source = null, maxAgeDays } = {}) {
  const ch = POST_CHANNELS.includes(channel) ? channel : null;
  const st = POST_STATUSES.includes(status) ? status : 'published';
  // A category is only meaningful for news; asking for one on the culture
  // channel is a caller mistake, not a filter, so it is dropped rather than
  // silently returning nothing.
  const cat = ch === 'news' && newsCategory.isValidCategory(category) ? category : null;
  // A source filter narrows news by its origin feed (rthk / ph / id). The
  // stored source_key is "<source>:<guid>", so matching the prefix finds one
  // feed. Unknown values are ignored so a stale chip cannot zero the list.
  const src = ch === 'news' && ['rthk', 'ph', 'id'].includes(source) ? `${source}:%` : null;
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 50, 1), 200);
  // Read-time retention, so the guarantee holds even if the sweep has not run
  // yet on a freshly booted instance. Two limits on WHAT expires, both from the
  // same rule — imported news has a shelf life, an operator's writing does not:
  //   - the NEWS channel only (a culture post has no expiry date)
  //   - `origin = 'auto'` only (a hand-written news post is not deleted after
  //     three days either; see the guard in listPostsInWindow)
  // The prune uses the same pair, so the feed and the table cannot disagree.
  const windowDays = newsRetentionDays(maxAgeDays);
  const cutoff = ch === 'news' && windowDays > 0 ? beforeIso(windowDays) : null;
  // The source clause is `(? IS NULL OR source_key LIKE ?)` — two placeholders,
  // so the pattern is passed twice (null when there is no filter).
  return cutoff
    ? S.listPostsInWindow.all(st, ch, ch, cutoff, cat, cat, src, src, n)
    : S.listPosts.all(st, ch, ch, cat, cat, src, src, n);
}

/** The operator view — every status. */
function listAllPosts({ channel = null, limit = 200, category = null } = {}) {
  const ch = POST_CHANNELS.includes(channel) ? channel : null;
  const cat = ch === 'news' && newsCategory.isValidCategory(category) ? category : null;
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 200, 1), 500);
  return S.listAllPosts.all(ch, ch, cat, cat, n);
}

const getPostById = (id) => S.getPostById.get(Number(id));
const getPostBySlug = (slug) => S.getPostBySlug.get(String(slug || ''));

/** Per-channel published counts, for the admin tab header. */
function getPostCounts() {
  const out = { culture: 0, news: 0, published: 0, total: S.countPosts.get().n };
  for (const row of S.countPostsByChannel.all('published')) {
    if (POST_CHANNELS.includes(row.channel)) out[row.channel] = row.n;
    out.published += row.n;
  }
  return out;
}

/**
 * Published news counts per category, plus the total — what the filter chips
 * are built from. Always includes every category key, even at zero.
 *
 * Scoped to the same window the feed reads through (see listPosts), so the chip
 * row and the list underneath it can never disagree.
 */
function getNewsCategoryCounts() {
  const counts = { all: 0, regions: { rthk: 0, ph: 0, id: 0 } };
  for (const key of newsCategory.NEWS_CATEGORY_KEYS) counts[key] = 0;
  // The same cut the feed reads through, so a chip count is the number of
  // stories actually waiting under it. With the window disabled the cutoff has
  // to be an instant everything is newer than — `beforeIso(0)` is "now", which
  // would exclude the whole channel, so it is the epoch instead.
  const cutoff = newsMaxAgeDays() > 0
    ? beforeIso(newsMaxAgeDays())
    : new Date(0).toISOString();
  for (const row of S.countPublishedNewsByCategory.all(cutoff)) {
    const key = newsCategory.isValidCategory(row.category) ? row.category : 'other';
    counts[key] += row.n;
    counts.all += row.n;
  }
  for (const row of S.countPublishedNewsBySource.all(cutoff)) {
    if (counts.regions[row.src] != null) counts.regions[row.src] = row.n;
  }
  return counts;
}

/**
 * Creates a post. English title is the one required field — a post with no
 * title has nothing to show in the feed — and every other language column may
 * be blank, falling back to English at render time.
 */
function createPost(b = {}) {
  const channel = POST_CHANNELS.includes(b.channel) ? b.channel : 'culture';
  const status = POST_STATUSES.includes(b.status) ? b.status : 'draft';
  const title_en = trimPost(b.title_en, POST_TITLE_MAX);
  if (!title_en) return null;
  const now = new Date().toISOString();
  const published_at = status === 'published' ? b.published_at || now : b.published_at || null;
  const info = S.insertPost.run(
    uniquePostSlug(b.slug || title_en),
    channel,
    iconForPost(b, channel),
    // A hand-written post may pick any category; a news post written here by
    // the operator is classified like an imported one, because it still has to
    // answer to the same filter chips.
    b.category
      ? newsCategory.normaliseCategory(b.category)
      : channel === 'news'
        ? newsCategory.classifyNews({ title: title_en, summary: b.summary_en, tags: b.tags })
        : '',
    title_en,
    trimPost(b.title_fil, POST_TITLE_MAX),
    trimPost(b.title_zh, POST_TITLE_MAX),
    trimPost(b.title_id, POST_TITLE_MAX),
    trimPost(b.summary_en, POST_SUMMARY_MAX),
    trimPost(b.summary_fil, POST_SUMMARY_MAX),
    trimPost(b.summary_zh, POST_SUMMARY_MAX),
    trimPost(b.summary_id, POST_SUMMARY_MAX),
    trimPost(b.body_en, POST_BODY_MAX),
    trimPost(b.body_fil, POST_BODY_MAX),
    trimPost(b.body_zh, POST_BODY_MAX),
    trimPost(b.body_id, POST_BODY_MAX),
    trimPost(b.source_name, 120),
    trimPost(b.source_url, 500),
    b.source_key != null ? String(b.source_key).slice(0, 300) : null,
    trimPost(b.source_lang, 12),
    b.origin === 'auto' ? 'auto' : 'manual',
    status,
    published_at,
    now,
    now
  );
  return S.getPostById.get(Number(info.lastInsertRowid));
}

/** Partial update. Anything the caller omits keeps its current value. */
function updatePost(id, b = {}) {
  const n = Number(id);
  const cur = S.getPostById.get(n);
  if (!cur) return null;
  const channel = POST_CHANNELS.includes(b.channel) ? b.channel : cur.channel;
  const status = POST_STATUSES.includes(b.status) ? b.status : cur.status;
  const title_en = pickPost(b.title_en, cur.title_en, POST_TITLE_MAX);
  if (!title_en) return null;
  const now = new Date().toISOString();
  // Publishing something that has never been published stamps it now, so it
  // lands at the top of the feed rather than sorting by its creation time.
  let published_at = b.published_at !== undefined ? b.published_at : cur.published_at;
  if (status === 'published' && !published_at) published_at = now;
  // A category the operator did not touch keeps its current value; one she did
  // set wins, even to clear it (an explicit '' is a decision, not an omission).
  // Re-classification is a separate, explicit act — see backfillNewsCategories.
  const category = b.category !== undefined
    ? newsCategory.normaliseCategory(b.category)
    : cur.category;
  S.updatePost.run(
    b.slug ? uniquePostSlug(b.slug, n) : cur.slug,
    channel,
    b.icon ? String(b.icon).trim().slice(0, 8) : cur.icon,
    channel === 'news' ? category : '',
    title_en,
    pickPost(b.title_fil, cur.title_fil, POST_TITLE_MAX),
    pickPost(b.title_zh, cur.title_zh, POST_TITLE_MAX),
    pickPost(b.title_id, cur.title_id, POST_TITLE_MAX),
    pickPost(b.summary_en, cur.summary_en, POST_SUMMARY_MAX),
    pickPost(b.summary_fil, cur.summary_fil, POST_SUMMARY_MAX),
    pickPost(b.summary_zh, cur.summary_zh, POST_SUMMARY_MAX),
    pickPost(b.summary_id, cur.summary_id, POST_SUMMARY_MAX),
    pickPost(b.body_en, cur.body_en, POST_BODY_MAX),
    pickPost(b.body_fil, cur.body_fil, POST_BODY_MAX),
    pickPost(b.body_zh, cur.body_zh, POST_BODY_MAX),
    pickPost(b.body_id, cur.body_id, POST_BODY_MAX),
    pickPost(b.source_name, cur.source_name, 120),
    pickPost(b.source_url, cur.source_url, 500),
    status,
    published_at,
    now,
    n
  );
  return S.getPostById.get(n);
}

function deletePost(id) {
  return S.deletePost.run(Number(id)).changes > 0;
}

/**
 * Retire imported posts whose source this build no longer ships.
 *
 * WHY THIS EXISTS. `importPost` only ever INSERTs, so removing a source from
 * `news.SOURCES` stops NEW items arriving but leaves everything that source
 * already imported sitting in the feed for ever. That is not hypothetical: when
 * the HK Government Press Releases feed was replaced by the Philippine and
 * Indonesian ones (2026-10-16), 40 government press releases stayed live in
 * production after the source was gone, and only a check against the live feed
 * caught it. The code was right and the feed was wrong.
 *
 * Deliberately narrow. It only ever touches a row that is ALL of:
 *   - channel 'news'   (never a culture post)
 *   - origin 'auto'    (never a hand-written post, and never an admin draft)
 *   - carrying a non-empty source_key
 * so no mis-set source list can delete editorial content. A hand-written post
 * that happens to carry a source_url is not a candidate either, because
 * createPost writes origin 'manual' unless explicitly told otherwise.
 *
 * @param {string[]} keep the source keys still shipped
 * @returns {{removed:number, retired:string[]}} what it deleted, and whose
 */
function deleteNewsPostsFromSourcesNotIn(keep = []) {
  const shipped = new Set(keep.map((k) => String(k)));
  const stale = [
    ...new Set(
      S.listAutoNewsSourceKeys.all()
        .map((r) => String(r.source_key || '').split(':')[0])
        .filter((prefix) => prefix && !shipped.has(prefix))
    ),
  ];
  let removed = 0;
  for (const prefix of stale) {
    removed += S.deleteAutoNewsPostsBySourcePrefix.run(`${prefix}:%`).changes;
  }
  return { removed, retired: stale };
}

/**
 * Delete imported news that has fallen out of the retention window.
 *
 * WHY THIS EXISTS. The feed is meant to read as "this week", not as an archive:
 * a helper who opens the app on her day off should be able to catch up in one
 * sitting. Age is also the only automatic way a feed stays fresh when the
 * sources keep republishing — Inquirer's RSS always has 40 items, so without a
 * cut the Discover channel just grows and the news section is, after a month,
 * 90% stories nobody will read.
 *
 * `listPosts` already applies the window at READ time (db.js listPosts), so the
 * learner-facing feed is correct the moment a row goes stale. This deletes the
 * rows themselves, which is what keeps the table from growing without bound and
 * what stops old slugs lingering in sitemaps and search results.
 *
 * Deliberately narrow — the same guard as deleteNewsPostsFromSourcesNotIn, and
 * for the same reason. It only ever touches a row that is ALL of:
 *   - channel 'news'    (never a culture post — those are editorial, evergreen)
 *   - origin 'auto'     (never a hand-written post, and never an admin draft)
 * A hand-written news post is not expiry-limited because an operator wrote it
 * on purpose; only the importer's rows are.
 *
 * @param {{days?:number}} [opts] `days: 0` disables the window entirely
 * @returns {{removed:number, pruned:object[], days:number}} deleted rows, and
 *   which ones went (oldest first) so a caller can log or assert them.
 */
function pruneNewsPast({ days } = {}) {
  const windowDays = newsRetentionDays(days);
  if (windowDays <= 0) return { removed: 0, pruned: [], days: 0, disabled: true };
  const cutoff = beforeIso(windowDays);
  // Ask first, so the report can name the rows even though the DELETE cannot.
  const pruned = S.listExpiredNews.all(cutoff).map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    title: r.title_en,
    published_at: r.published_at || r.created_at,
  }));
  if (!pruned.length) return { removed: 0, pruned, days: windowDays };
  S.deleteNewsOlderThan.run(cutoff);
  return { removed: pruned.length, pruned, days: windowDays };
}

/**
 * Insert used by the news importer. Idempotent on `source_key`: re-importing
 * the same feed item is a no-op, so the caller's "inserted" count is exactly
 * the number of genuinely new stories. Never throws on a duplicate.
 */
function importPost(b = {}) {
  const channel = POST_CHANNELS.includes(b.channel) ? b.channel : 'news';
  const key = b.source_key != null ? String(b.source_key).trim().slice(0, 300) : '';
  if (!key) return { inserted: false, reason: 'missing source_key' };
  const title_en = trimPost(b.title_en, POST_TITLE_MAX);
  if (!title_en) return { inserted: false, reason: 'missing title_en' };
  const now = new Date().toISOString();
  const info = S.insertPostIfNew.run(
    uniquePostSlug(b.slug || title_en),
    channel,
    iconForPost(b, channel),
    // An importer's category is the classifier's, unless the source said
    // otherwise — and a source only ever gets to say so through `category`,
    // which news.js fills from the feed's own <category> tags.
    b.category
      ? newsCategory.normaliseCategory(b.category)
      : newsCategory.classifyNews({
        title: title_en,
        summary: b.summary_en,
        tags: b.tags,
        source_key: key,
      }),
    title_en,
    trimPost(b.title_fil, POST_TITLE_MAX),
    trimPost(b.title_zh, POST_TITLE_MAX),
    trimPost(b.title_id, POST_TITLE_MAX),
    trimPost(b.summary_en, POST_SUMMARY_MAX),
    trimPost(b.summary_fil, POST_SUMMARY_MAX),
    trimPost(b.summary_zh, POST_SUMMARY_MAX),
    trimPost(b.summary_id, POST_SUMMARY_MAX),
    '', '', '', '',
    trimPost(b.source_name, 120),
    trimPost(b.source_url, 500),
    key,
    trimPost(b.source_lang, 12),
    'auto',
    'published',
    b.published_at || now,
    now,
    now
  );
  return { inserted: info.changes > 0, id: info.changes > 0 ? Number(info.lastInsertRowid) : null };
}

// ---------------------------------------------------------------------------
// Stories — a helper's own writing, moderated before it is published
// ---------------------------------------------------------------------------

/**
 * What a story can be about. Broad on purpose — "my daily life", "where I come
 * from", "something that happened". She should not have to work out which box
 * her life fits in, so the picker is short and the reader shows the topic as a
 * label rather than filtering on it.
 */
const STORY_TOPICS = ['daily', 'background', 'interesting'];

/** The moderation queue. 'pending' is the only state a submission can start in. */
const STORY_STATUSES = ['pending', 'published', 'rejected'];

const STORY_TITLE_MAX = 120;
const STORY_BODY_MAX = 6000;
const STORY_GLOSS_MAX = 400;
const STORY_NAME_MAX = 40;
const STORY_NOTE_MAX = 300;
/** Per device, rolling 24h. Generous for one person, tight for a script. */
const STORY_DAILY_LIMIT = 3;

function slugifyStory(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** A slug no other story holds, by appending -2, -3, … */
function uniqueStorySlug(base) {
  const root = slugifyStory(base) || 'story';
  let slug = root;
  let n = 1;
  for (;;) {
    if (!S.getPublishedStoryBySlug.get(slug) && !S.getStoryIdBySlug.get(slug)) return slug;
    n += 1;
    slug = `${root}-${n}`;
  }
}

/**
 * Stores a submission as PENDING. Nothing in this function can publish — only
 * setStoryStatus can, and only the admin route calls it.
 *
 * `sign` is the whole privacy decision, and it is applied HERE rather than at
 * render time: when it is false the display name is thrown away before the row
 * is written, so an unsigned story has no name stored anywhere that could leak
 * later, in any query, in any future feature.
 *
 * @returns {object|null} the stored row (learner_id excluded — see the schema
 *   note), or null when the title or body is empty after trimming.
 */
function createStory({ learner_id = null, title, body, lang = 'en', topic = 'daily', sign = false, display_name = '' } = {}) {
  const t = String(title ?? '').trim().slice(0, STORY_TITLE_MAX);
  const b = String(body ?? '').trim().slice(0, STORY_BODY_MAX);
  if (!t || !b) return null;
  const now = new Date().toISOString();
  const info = S.insertStory.run(
    uniqueStorySlug(t),
    learner_id != null ? Number(learner_id) : null,
    sign ? String(display_name ?? '').trim().slice(0, STORY_NAME_MAX) : '',
    ['en', 'fil', 'zh', 'id'].includes(lang) ? lang : 'en',
    STORY_TOPICS.includes(topic) ? topic : 'daily',
    t,
    b,
    '',
    'pending',
    null,
    now,
    now
  );
  return S.getStoryForModeration.get(Number(info.lastInsertRowid));
}

/** The public list: published only, newest first, no learner identity. */
function listPublishedStories({ limit = 50 } = {}) {
  return S.listPublishedStories.all(Math.max(1, Math.min(Number(limit) || 50, 200)));
}

/** One published story by slug, or null. A pending or rejected story is null. */
function getPublishedStoryBySlug(slug) {
  return S.getPublishedStoryBySlug.get(String(slug || '')) || null;
}

/** The moderation queue. A null/unknown status means every state, pending first. */
function listStoriesForModeration({ status = null, limit = 200 } = {}) {
  const s = STORY_STATUSES.includes(status) ? status : '';
  return S.listStoriesForModeration.all(s, s, Math.max(1, Math.min(Number(limit) || 200, 500)));
}

function getStoryForModeration(id) {
  return S.getStoryForModeration.get(Number(id)) || null;
}

function getStoryCounts() {
  const out = { pending: 0, published: 0, rejected: 0, total: 0 };
  for (const row of S.storyCounts.all()) {
    if (STORY_STATUSES.includes(row.status)) out[row.status] = row.n;
    out.total += row.n;
  }
  return out;
}

/**
 * The ONLY function that can publish a story.
 *
 * Approving stamps `published_at` the first time and keeps it afterwards, so a
 * story that is un-published and re-approved does not jump back to the top of
 * the feed with a fresh date — the date is when it was first published, which is
 * what a reader assumes it means.
 *
 * Rejecting records why, because the note is shown back to the author on her own
 * submissions screen. A rejection with no reason reads as "nobody looked".
 */
function setStoryStatus(id, status, note = '') {
  if (!STORY_STATUSES.includes(status)) return null;
  const cur = S.getStoryForModeration.get(Number(id));
  if (!cur) return null;
  const now = new Date().toISOString();
  const publishedAt = status === 'published' ? cur.published_at || now : cur.published_at;
  S.setStoryStatus.run(status, String(note ?? '').trim().slice(0, STORY_NOTE_MAX), publishedAt, now, Number(id));
  return S.getStoryForModeration.get(Number(id));
}

/** The operator editing a submission: a typo, an identifying detail, a gloss. */
function updateStoryContent(id, patch = {}) {
  const cur = S.getStoryForModeration.get(Number(id));
  if (!cur) return null;
  const title = patch.title != null ? String(patch.title).trim().slice(0, STORY_TITLE_MAX) : cur.title;
  const body = patch.body != null ? String(patch.body).trim().slice(0, STORY_BODY_MAX) : cur.body;
  if (!title || !body) return null;
  S.setStoryContent.run(
    title,
    body,
    patch.gloss_en != null ? String(patch.gloss_en).trim().slice(0, STORY_GLOSS_MAX) : cur.gloss_en,
    patch.display_name != null ? String(patch.display_name).trim().slice(0, STORY_NAME_MAX) : cur.display_name,
    new Date().toISOString(),
    Number(id)
  );
  return S.getStoryForModeration.get(Number(id));
}

function deleteStory(id) {
  return S.deleteStory.run(Number(id)).changes > 0;
}

/**
 * Has this device hit its daily submission limit? Counted over a rolling 24h
 * rather than a calendar day, so the limit cannot be reset by waiting for
 * midnight.
 */
function storyQuotaFor(learnerId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = S.countStoriesSince.get(Number(learnerId), since).n;
  return { count, limit: STORY_DAILY_LIMIT, allowed: count < STORY_DAILY_LIMIT };
}

/** A learner's own submissions, so she can see what happened to them. */
function listStoriesByLearner(learnerId, { limit = 50 } = {}) {
  return S.listStoriesByLearner.all(Number(learnerId), Math.max(1, Math.min(Number(limit) || 50, 200)));
}

/** Published slugs and their dates, for the sitemap. */
function listPublishedStorySlugs() {
  return S.listPublishedStorySlugs.all();
}

// ---- Living: supportive passages about life in Hong Kong --------------------

/** The public shelf of published passages, optionally narrowed to one category,
 *  newest first. No body — a list only needs the card. */
function listLivingPosts({ category = null, limit = 300 } = {}) {
  const lim = Math.max(1, Math.min(Number(limit) || 300, 500));
  if (category) return S.listLivingByCategory.all(String(category), lim);
  return S.listLivingPosts.all(lim);
}

/** The categories that actually have published passages, with their counts. */
function listLivingCategories() {
  return S.listLivingCategories.all();
}

/** One published passage with every column, or null. */
function getLivingPostBySlug(slug) {
  return S.getLivingPostBySlug.get(String(slug || '')) || null;
}

/** Aggregated reaction counts for a post: { emoji: count } for counts > 0. */
function getLivingReactions(postId) {
  const out = {};
  for (const r of S.getLivingReactions.all(Number(postId))) {
    if (r.count > 0) out[r.emoji] = r.count;
  }
  return out;
}

/** The emoji this device currently has on the post, or null. */
function getLivingUserReaction(postId, publicId) {
  const row = S.getLivingUserReaction.get(Number(postId), String(publicId || ''));
  return row ? row.emoji : null;
}

/**
 * React (or change/toggle a reaction) on a post. Returns the post's full
 * reaction state and the device's current reaction, so the client can repaint
 * without another fetch. Exactly one reaction per device: picking a second emoji
 * moves the old count down and the new one up; picking the same one again clears
 * it.
 */
function setLivingReaction(postId, publicId, emoji) {
  const pid = Number(postId);
  const pub = String(publicId || '');
  if (!pub || !emoji) return null;
  const now = new Date().toISOString();
  const prev = getLivingUserReaction(pid, pub);
  if (prev === emoji) {
    S.decLivingReaction.run(pid, emoji);
    S.delLivingUserReaction.run(pid, pub);
  } else {
    S.upsertLivingUserReaction.run(pid, pub, emoji, now);
    S.incLivingReaction.run(pid, emoji);
    if (prev) S.decLivingReaction.run(pid, prev);
  }
  return {
    reactions: getLivingReactions(pid),
    myReaction: getLivingUserReaction(pid, pub),
  };
}

/** The published comment thread for a post, oldest first. */
function listLivingComments(postId) {
  return S.listLivingComments.all(Number(postId));
}

/** Add a comment. `displayName` is optional (blank => Anonymous). Returns the
 *  new row, or null if the body was empty after trimming. */
function addLivingComment(postId, { publicId, displayName, body } = {}) {
  const pid = Number(postId);
  const pub = String(publicId || '');
  const name = String(displayName || '').trim().slice(0, 80);
  const text = String(body || '').trim().slice(0, 500);
  if (!pub || !text) return null;
  const now = new Date().toISOString();
  const info = S.insertLivingComment.run(pid, pub, name, text, now);
  return S.getLivingComment.get(info.lastInsertRowid);
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
      device_count: countDevices(u.id),
      reauth_open: isDeviceReauthOpen(u.id),
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
  postsSeeded,
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
  loginOrCreateEmployer,
  mintDeviceToken,
  verifyDeviceToken,
  countDevices,
  openDeviceReauth,
  isDeviceReauthOpen,
  closeDeviceReauth,
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

  // Feedback inbox — helper submissions are anonymous by design.
  createFeedback,
  listFeedback,
  getFeedbackCounts,
  setFeedbackStatus,
  deleteFeedback,
  FEEDBACK_STATUSES,
  FEEDBACK_MAX,

  // Learner reporting — her own numbers, scoped to one device.
  getLearnerStats,
  LEARNER_STATS_RANGES,

  createResetToken,
  peekResetToken,
  consumeResetToken,
  purgeExpiredResets,

  listPosts,
  listAllPosts,
  getPostById,
  getPostBySlug,
  getPostCounts,
  getNewsCategoryCounts,
  backfillNewsCategories,
  repairFutureDatedNews,
  createPost,
  updatePost,
  deletePost,
  deleteNewsPostsFromSourcesNotIn,
  pruneNewsPast,
  importPost,
  POST_CHANNELS,
  POST_STATUSES,
  NEWS_CATEGORIES: newsCategory.NEWS_CATEGORY_KEYS,

  // Community stories — a helper's own life story, moderated before it is read.
  // Only setStoryStatus publishes; the public queries never select learner_id.
  createStory,
  listPublishedStories,
  getPublishedStoryBySlug,
  listStoriesForModeration,

  // Web Push — opt-in browser subscriptions. The endpoint is a device token, not
  // anything the learner typed; last_active_at drives the reminder job.
  insertSubscription,
  removeSubscription,
  listSubscriptions,
  countSubscriptions,
  updateLastActive,
  listStaleForReminder,
  markReminded,
  getStoryForModeration,
  getStoryCounts,
  setStoryStatus,
  updateStoryContent,
  deleteStory,
  storyQuotaFor,
  listStoriesByLearner,
  listPublishedStorySlugs,

  // Living — supportive passages about life in Hong Kong, grouped by situation.
  listLivingPosts,
  listLivingCategories,
  getLivingPostBySlug,
  getLivingReactions,
  getLivingUserReaction,
  setLivingReaction,
  listLivingComments,
  addLivingComment,
  slugifyStory,
  STORY_TOPICS,
  STORY_STATUSES,
  STORY_TITLE_MAX,
  STORY_BODY_MAX,
  STORY_GLOSS_MAX,
  STORY_NAME_MAX,
  STORY_NOTE_MAX,
  STORY_DAILY_LIMIT,

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
