/**
 * CantoBuddy Server
 * Express backend serving the learner app, admin area, and REST API.
 *
 * Storage is SQLite (see db.js) — no JSON file, no external database service.
 * Sessions are persisted in the same database, so a redeploy no longer logs
 * the admin out.
 */
const express = require('express');
const session = require('express-session');
const path = require('path');

const store = require('./db');
const SqliteSessionStore = require('./session-store');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind all interfaces (needed for containers + LAN/phone access)

// Behind a reverse proxy (Render, Fly, Koyeb, Cloud Run, Cloudflare Tunnel…)
// this makes client IPs and secure cookies behave correctly.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    // Set SESSION_SECRET in production so sessions can't be forged.
    secret: process.env.SESSION_SECRET || 'cantobuddy-secret-2024',
    store: new SqliteSessionStore({ ttl: 24 * 60 * 60 * 1000 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 h — keep in step with the store TTL
      sameSite: 'lax',
      // Set COOKIE_SECURE=true when served over HTTPS (recommended in production).
      secure: process.env.COOKIE_SECURE === 'true',
    },
  })
);

// CORS-lite: allow fetch from same origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Admin guard
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized – please log in.' });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  // In production the admin credentials can be supplied through environment
  // variables (ADMIN_USER / ADMIN_PASSWORD) so no password has to be stored in
  // the repository or the database. When they are not set, fall back to the
  // users table (local development / future employer accounts).
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD;

  let user = null;
  if (envUser && envPass) {
    if (username === envUser && password === envPass) {
      user = { id: 0, username: envUser, name: 'Employer', role: 'admin' };
    }
  } else {
    user = store.authenticate(username, password);
    if (user && user.role !== 'admin') user = null;
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.isAdmin = true;
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;
  return res.json({ ok: true, name: user.name });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------------------------------------------------------------------------
// Vocabulary (public read, admin write)
// ---------------------------------------------------------------------------

app.get('/api/vocabulary', (req, res) => {
  const { level, category_id } = req.query;
  res.json(store.listVocabulary({ level, category_id }));
});

app.get('/api/vocabulary/:id', (req, res) => {
  const item = store.getVocabulary(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/vocabulary', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.cantonese || !b.jyutping || !b.english) {
    return res.status(400).json({ error: 'Cantonese, Jyutping, and English are required.' });
  }
  res.status(201).json(store.createVocabulary(b));
});

app.put('/api/vocabulary/:id', requireAdmin, (req, res) => {
  const item = store.updateVocabulary(req.params.id, req.body || {});
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/vocabulary/:id', requireAdmin, (req, res) => {
  const ok = store.deleteVocabulary(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Categories (public read, admin write)
// ---------------------------------------------------------------------------

app.get('/api/categories', (req, res) => {
  res.json(store.listCategories());
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.name_en) return res.status(400).json({ error: 'English name is required.' });
  res.status(201).json(store.createCategory(b));
});

// Reorder categories — must be declared BEFORE '/api/categories/:id'
// so that "reorder" isn't matched as an id parameter.
app.put('/api/categories/reorder', requireAdmin, (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of category ids.' });
  }
  res.json(store.reorderCategories(order));
});

app.put('/api/categories/:id', requireAdmin, (req, res) => {
  const cat = store.updateCategory(req.params.id, req.body || {});
  if (!cat) return res.status(404).json({ error: 'Not found' });
  res.json(cat);
});

app.delete('/api/categories/:id', requireAdmin, (req, res) => {
  const ok = store.deleteCategory(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Progress (learner saves scores; admin can view all)
// ---------------------------------------------------------------------------

app.get('/api/progress', (req, res) => {
  const { learner, level, category_id } = req.query;
  res.json(store.listProgress({ learner, level, category_id }));
});

app.post('/api/progress', (req, res) => {
  const b = req.body || {};
  if (!b.learner) return res.status(400).json({ error: 'Learner name required.' });

  const { row, created } = store.saveProgress(b);
  res.status(created ? 201 : 200).json(row);
});

// Aggregate stats for admin dashboard
app.get('/api/stats', requireAdmin, (req, res) => {
  res.json(store.getStats());
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  CantoBuddy is running!`);
  console.log(`  Learner app:  http://localhost:${PORT}`);
  console.log(`  Admin login:  http://localhost:${PORT}/admin.html\n`);
  console.log(`  Admin user:   admin  (password is stored in the database — not printed here)`);
  console.log(`  Database:     ${store.DB_PATH}`);
  if (store.seeded) console.log(`  Seeded a fresh database from data.js.`);
  console.log('');
});

// Close the database cleanly so WAL is checkpointed on shutdown.
function shutdown(signal) {
  console.log(`\n${signal} received — closing database.`);
  // Idle keep-alive sockets would otherwise hold `close()` open until the
  // timeout. Dropping them lets the process exit promptly on a redeploy.
  if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  // Don't hang forever if a request is still in flight.
  setTimeout(() => { store.close(); process.exit(0); }, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
