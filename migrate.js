#!/usr/bin/env node
/**
 * One-shot migration: legacy db.json  ->  SQLite (cantobuddy.db).
 *
 * Run this ONCE against the live data directory before deploying the SQLite
 * build. It is deliberately a script and not startup logic — otherwise every
 * boot would re-import and duplicate everything.
 *
 *   node migrate.js              # migrate (refuses if SQLite already has data)
 *   node migrate.js --force      # wipe the SQLite tables and re-import
 *   node migrate.js --dry-run    # report what would happen, change nothing
 *
 * Reads  DATA_DIR/db.json          (or DB_PATH)
 * Writes DATA_DIR/cantobuddy.db    (or DB_FILE)
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry-run');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const JSON_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'db.json');

function readLegacy() {
  if (!fs.existsSync(JSON_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  } catch (err) {
    console.error(`Could not parse ${JSON_PATH}: ${err.message}`);
    process.exit(1);
  }
}

const legacy = readLegacy();

if (!legacy) {
  console.log(`No legacy file at ${JSON_PATH} — nothing to migrate.`);
  console.log('A fresh SQLite database will be seeded from data.js on first start.');
  process.exit(0);
}

const store = require('./db');

const counts = {
  categories: (legacy.categories || []).length,
  vocabulary: (legacy.vocabulary || []).length,
  users: (legacy.users || []).length,
  progress: (legacy.progress || []).length,
};

console.log(`\nLegacy file:  ${JSON_PATH}`);
console.log(`SQLite file:  ${store.DB_PATH}\n`);
console.log('Found in db.json:');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(12)} ${v}`);

const existing = store.listVocabulary().length;
// Requiring db.js seeds a brand-new database as a side effect. That is not real
// data, so it must not block the migration — only a pre-existing, populated
// database should.
const justSeeded = store.seeded;

if (existing > 0 && !justSeeded && !FORCE) {
  console.log(`\nSQLite already holds ${existing} vocabulary entries.`);
  console.log('Refusing to overwrite. Re-run with --force to wipe and re-import.\n');
  process.exit(1);
}

if (justSeeded && existing > 0) {
  console.log(`\n(Replacing ${existing} seeded entries with the contents of db.json.)`);
}

if (DRY) {
  console.log('\n--dry-run: no changes made.\n');
  process.exit(0);
}

const now = new Date().toISOString();
const { db } = store;

db.exec('BEGIN');
try {
  db.exec('DELETE FROM vocabulary; DELETE FROM categories; DELETE FROM progress; DELETE FROM users;');

  const insCat = db.prepare(
    'INSERT INTO categories (id, name_en, name_yue, name_fil, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  (legacy.categories || []).forEach((c, i) =>
    insCat.run(c.id, c.name_en, c.name_yue || '', c.name_fil || '', c.icon || '📁', i)
  );

  const insVocab = db.prepare(
    `INSERT INTO vocabulary (id, cantonese, jyutping, english, tagalog, emoji, level, category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  (legacy.vocabulary || []).forEach((v) =>
    insVocab.run(
      v.id, v.cantonese, v.jyutping, v.english, v.tagalog || '', v.emoji || '📝',
      Number(v.level) || 1, v.category_id != null ? Number(v.category_id) : null, now, now
    )
  );

  // Passwords were stored in plaintext by the JSON build — hash them on the way in.
  const insUser = db.prepare(
    'INSERT INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  (legacy.users || []).forEach((u) =>
    insUser.run(u.id, u.username, store.hashPassword(u.password), u.role || 'admin', u.name || '', now)
  );

  const insProg = db.prepare(
    `INSERT INTO progress (id, session_id, learner, learner_id, level, category_id, quiz_type, score, total, answered, completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  (legacy.progress || []).forEach((p) =>
    insProg.run(
      p.id, p.session_id || null, p.learner,
      p.learner_id != null ? Number(p.learner_id) : null,
      Number(p.level) || 1, Number(p.category_id) || 0,
      p.quiz_type || 'multiple_choice',
      Number(p.score) || 0, Number(p.total) || 0, Number(p.answered) || 0,
      p.completed === false ? 0 : 1,
      p.created_at || now, p.updated_at || now
    )
  );

  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('\nMigration failed, nothing was changed:', err.message);
  store.close();
  process.exit(1);
}

// ---- Verify -----------------------------------------------------------------
const after = {
  categories: store.listCategories().length,
  vocabulary: store.listVocabulary().length,
  progress: store.listProgress().length,
};

console.log('\nMigrated:');
for (const [k, v] of Object.entries(after)) {
  const expected = counts[k];
  const ok = v === expected ? 'OK' : `MISMATCH (expected ${expected})`;
  console.log(`  ${k.padEnd(12)} ${String(v).padEnd(6)} ${ok}`);
}

// Take a snapshot straight away — the JSON file is the only other copy.
const backup = path.join(DATA_DIR, `cantobuddy-after-migration-${Date.now()}.db`);
try {
  store.snapshot(backup);
  console.log(`\nSnapshot written: ${backup}`);
} catch (err) {
  console.log(`\nSnapshot skipped: ${err.message}`);
}

console.log(`\nThe legacy file has NOT been deleted: ${JSON_PATH}`);
console.log('Keep it until the SQLite build has run in production for a few days.\n');

store.close();
