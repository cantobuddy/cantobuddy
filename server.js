/**
 * CantoBuddy Server
 * Express backend serving the learner app, admin area, and REST API.
 */
const express = require('express');
const session = require('express-session');
const path = require('path');
const { load, save, nextId } = require('./data');

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
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 h
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
  const { username, password } = req.body;

  // In production the admin credentials can be supplied through environment
  // variables (ADMIN_USER / ADMIN_PASSWORD) so no password has to be stored in
  // the repository or the data file. When they are not set, fall back to the
  // users stored in the data file (local development).
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD;

  let user = null;
  if (envUser && envPass) {
    if (username === envUser && password === envPass) {
      user = { id: 0, username: envUser, name: 'Employer', role: 'admin' };
    }
  } else {
    const db = load();
    user = db.users.find(
      (u) => u.username === username && u.password === password && u.role === 'admin'
    );
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.isAdmin = true;
  req.session.userId = user.id;
  req.session.name = user.name;
  return res.json({ ok: true, name: user.name });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------------------------------------------------------------------------
// Vocabulary (public read, admin write)
// ---------------------------------------------------------------------------

app.get('/api/vocabulary', (req, res) => {
  const db = load();
  const { level, category_id } = req.query;
  let items = db.vocabulary;
  if (level) items = items.filter((v) => v.level === Number(level));
  if (category_id) items = items.filter((v) => v.category_id === Number(category_id));
  res.json(items);
});

app.get('/api/vocabulary/:id', (req, res) => {
  const db = load();
  const item = db.vocabulary.find((v) => v.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/vocabulary', requireAdmin, (req, res) => {
  const db = load();
  const b = req.body;
  if (!b.cantonese || !b.jyutping || !b.english) {
    return res.status(400).json({ error: 'Cantonese, Jyutping, and English are required.' });
  }
  const item = {
    id: nextId(db.vocabulary),
    cantonese: b.cantonese,
    jyutping: b.jyutping,
    english: b.english,
    tagalog: b.tagalog || '',
    emoji: b.emoji || '📝',
    level: Number(b.level) || 1,
    category_id: Number(b.category_id) || 1,
  };
  db.vocabulary.push(item);
  save(db);
  res.status(201).json(item);
});

app.put('/api/vocabulary/:id', requireAdmin, (req, res) => {
  const db = load();
  const item = db.vocabulary.find((v) => v.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  Object.assign(item, {
    cantonese: b.cantonese ?? item.cantonese,
    jyutping: b.jyutping ?? item.jyutping,
    english: b.english ?? item.english,
    tagalog: b.tagalog ?? item.tagalog,
    emoji: b.emoji ?? item.emoji,
    level: b.level != null ? Number(b.level) : item.level,
    category_id: b.category_id != null ? Number(b.category_id) : item.category_id,
  });
  save(db);
  res.json(item);
});

app.delete('/api/vocabulary/:id', requireAdmin, (req, res) => {
  const db = load();
  const idx = db.vocabulary.findIndex((v) => v.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.vocabulary.splice(idx, 1);
  save(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Categories (public read, admin write)
// ---------------------------------------------------------------------------

app.get('/api/categories', (req, res) => {
  const db = load();
  res.json(db.categories);
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const db = load();
  const b = req.body;
  if (!b.name_en) return res.status(400).json({ error: 'English name is required.' });
  const cat = {
    id: nextId(db.categories),
    name_en: b.name_en,
    name_yue: b.name_yue || '',
    name_fil: b.name_fil || '',
    icon: b.icon || '📁',
  };
  db.categories.push(cat);
  save(db);
  res.status(201).json(cat);
});

// Reorder categories — must be declared BEFORE '/api/categories/:id'
// so that "reorder" isn't matched as an id parameter.
app.put('/api/categories/reorder', requireAdmin, (req, res) => {
  const db = load();
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of category ids.' });
  }
  const byId = new Map(db.categories.map((c) => [c.id, c]));
  const reordered = [];
  for (const rawId of order) {
    const id = Number(rawId);
    const cat = byId.get(id);
    if (cat) {
      reordered.push(cat);
      byId.delete(id);
    }
  }
  // Safety: keep any categories not mentioned in the payload, at the end
  for (const leftover of byId.values()) reordered.push(leftover);
  db.categories = reordered;
  save(db);
  res.json(db.categories);
});

app.put('/api/categories/:id', requireAdmin, (req, res) => {
  const db = load();
  const cat = db.categories.find((c) => c.id === Number(req.params.id));
  if (!cat) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  Object.assign(cat, {
    name_en: b.name_en ?? cat.name_en,
    name_yue: b.name_yue ?? cat.name_yue,
    name_fil: b.name_fil ?? cat.name_fil,
    icon: b.icon ?? cat.icon,
  });
  save(db);
  res.json(cat);
});

app.delete('/api/categories/:id', requireAdmin, (req, res) => {
  const db = load();
  const idx = db.categories.findIndex((c) => c.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.categories.splice(idx, 1);
  save(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Progress (learner saves scores; admin can view all)
// ---------------------------------------------------------------------------

app.get('/api/progress', (req, res) => {
  const db = load();
  const { learner, level, category_id } = req.query;
  let items = db.progress;
  if (learner) items = items.filter((p) => p.learner === learner);
  if (level) items = items.filter((p) => p.level === Number(level));
  if (category_id) items = items.filter((p) => p.category_id === Number(category_id));
  res.json(items);
});

app.post('/api/progress', (req, res) => {
  const db = load();
  const b = req.body;
  if (!b.learner) return res.status(400).json({ error: 'Learner name required.' });

  const now = new Date().toISOString();
  const sessionId = b.session_id ? String(b.session_id) : null;
  const completed = b.completed !== false; // legacy callers omit it → treat as finished

  // A quiz is saved repeatedly while it is in progress (once after every
  // answered question) and once more when it finishes. Writes are therefore
  // UPSERTED on `session_id`, so one quiz always occupies exactly ONE row no
  // matter how many times it is saved — and a quiz the learner abandons
  // halfway still leaves a record instead of nothing.
  if (sessionId) {
    const existing = db.progress.find((p) => p.session_id === sessionId);
    if (existing) {
      existing.score = Number(b.score) || 0;
      existing.total = Number(b.total) || 0;
      existing.answered = Number(b.answered) || 0;
      existing.completed = completed;
      existing.updated_at = now;
      save(db);
      return res.json(existing);
    }
  }

  const entry = {
    id: nextId(db.progress),
    learner: b.learner,
    level: Number(b.level) || 1,
    category_id: Number(b.category_id) || 0,
    quiz_type: b.quiz_type || 'multiple_choice',
    score: Number(b.score) || 0,
    total: Number(b.total) || 0,
    answered: Number(b.answered) || 0,
    completed,
    session_id: sessionId,
    created_at: now,
    updated_at: now,
  };
  db.progress.push(entry);
  save(db);
  res.status(201).json(entry);
});

// Aggregate stats for admin dashboard
app.get('/api/stats', requireAdmin, (req, res) => {
  const db = load();
  const learnerMap = {};
  for (const p of db.progress) {
    if (!learnerMap[p.learner]) {
      learnerMap[p.learner] = {
        learner: p.learner,
        attempts: 0,
        completedAttempts: 0,
        partialAttempts: 0,
        totalScore: 0,
        totalMax: 0,
        byLevel: {},
      };
    }
    const l = learnerMap[p.learner];
    const finished = p.completed !== false; // records predating this field count as finished
    l.attempts++;
    if (finished) l.completedAttempts++;
    else l.partialAttempts++;
    l.totalScore += p.score;
    l.totalMax += p.total;
    if (!l.byLevel[p.level]) l.byLevel[p.level] = { attempts: 0, score: 0, max: 0 };
    l.byLevel[p.level].attempts++;
    l.byLevel[p.level].score += p.score;
    l.byLevel[p.level].max += p.total;
  }
  res.json({
    totalVocabulary: db.vocabulary.length,
    totalCategories: db.categories.length,
    totalQuizAttempts: db.progress.length,
    totalPartialAttempts: db.progress.filter((p) => p.completed === false).length,
    learners: Object.values(learnerMap),
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, HOST, () => {
  const dataDir = process.env.DATA_DIR || __dirname;
  console.log(`\n  CantoBuddy is running!`);
  console.log(`  Learner app:  http://localhost:${PORT}`);
  console.log(`  Admin login:  http://localhost:${PORT}/admin.html\n`);
  console.log(`  Admin user:   admin  (password is stored in db.json — not printed here)`);
  console.log(`  Data file:    ${require('path').join(dataDir, 'db.json')}\n`);
});
