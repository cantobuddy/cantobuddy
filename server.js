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
const crypto = require('crypto');

const store = require('./db');
const SqliteSessionStore = require('./session-store');
const seo = require('./seo');
const news = require('./news');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind all interfaces (needed for containers + LAN/phone access)

/**
 * Session signing key.
 *
 * A hard-coded fallback would let anyone who has read this source forge an
 * admin session cookie on a publicly reachable deployment — so when the
 * environment does not supply one, generate a strong random key for this boot
 * instead of falling back to a constant. The cost is that sessions do not
 * survive a restart; that is the right trade for a preview, and production
 * should set SESSION_SECRET so they do.
 */
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('  !  SESSION_SECRET is not set — generated a random key for this boot.');
  console.warn('     Everyone is signed out on restart. Set SESSION_SECRET in production.');
}

// Behind a reverse proxy (Render, Fly, Koyeb, Cloud Run, Cloudflare Tunnel…)
// this makes client IPs and secure cookies behave correctly.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// The admin area is operator-only. There is no link to it from the learner app
// (see public/index.html) — it is reached by typing /admin.html — so make sure
// search engines never index it either. robots.txt asks; this header enforces.
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// The admin and employer-portal pages must never be cached. They show live
// account and progress data, and express.static's default `max-age=0` still
// leaves the browser free to serve a stored copy — which is exactly how a
// notice that was deleted in a deploy kept showing on a returning visitor's
// phone (2026-10-17). Registered BEFORE express.static so the header lands on
// the static file response itself, not just on the routes that come after it.
//
// `/reset` serves the portal's HTML, so it carries the same rule.
const NO_STORE_PATHS = new Set([
  '/portal', '/portal.html', '/portal.js',
  '/admin', '/admin.html', '/admin.js',
  '/reset',
]);
app.use((req, res, next) => {
  if (NO_STORE_PATHS.has(req.path)) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    // Set SESSION_SECRET in production so sessions can't be forged and survive
    // a restart. See the note where SESSION_SECRET is resolved above.
    secret: SESSION_SECRET,
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

// ---------------------------------------------------------------------------
// Access control
//
// Three roles: admin (operator), employer, learner. The session carries the
// role; these guards are the only thing standing between a route and the data,
// so they are checked on every write.
// ---------------------------------------------------------------------------

/** The signed-in account behind this request, or null. */
function sessionUser(req) {
  const s = req.session;
  if (!s) return null;
  // `isAdmin` is the pre-Phase-1 flag; sessions created before the upgrade
  // still carry it, and falling back keeps them working rather than logging
  // the operator out on deploy.
  const role = s.role || (s.isAdmin ? 'admin' : null);
  if (!role) return null;
  return {
    id: s.userId ?? null,
    role,
    name: s.name || '',
    email: s.email || '',
    envAdmin: !!s.envAdmin,
  };
}

function requireAuth(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized – please log in.' });
  req.user = user;
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = sessionUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized – please log in.' });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'This account does not have access to that.' });
    }
    req.user = user;
    return next();
  };
}

// Every existing content route already calls requireAdmin, so the name stays.
const requireAdmin = requireRole('admin');
const requireEmployer = requireRole('employer', 'admin');

// ---------------------------------------------------------------------------
// Rate limiting
//
// Only the unauthenticated endpoints that can grant access or create accounts
// need this. In-memory is fine: a single process, and a restart resets it.
// ---------------------------------------------------------------------------

function makeRateLimit({ windowMs, max, message }) {
  const buckets = new Map(); // ip -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of buckets) if (now > entry.resetAt) buckets.delete(ip);
  }, windowMs).unref();

  function middleware(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = buckets.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, entry);
    }
    if (entry.count >= max) {
      const msLeft = entry.resetAt - now;
      res.setHeader('Retry-After', String(Math.ceil(msLeft / 1000)));
      return res.status(429).json({ error: message(Math.ceil(msLeft / 60000)) });
    }
    entry.count += 1;
    next();
  }

  middleware.clear = (req) => buckets.delete(req.ip || req.socket.remoteAddress || 'unknown');
  return middleware;
}

const loginRateLimit = makeRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: (m) => `Too many login attempts. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
});

const registerRateLimit = makeRateLimit({
  windowMs: 60 * 60 * 1000,
  // A test suite legitimately makes more sign-ins in a second than a person
  // does in an hour, and a throttled 429 would hide the behaviour under test.
  // Read from the environment so the limit can be raised for a harness only —
  // production never sets this, so the shipped limit is unchanged.
  max: Number(process.env.SIGNUP_RATE_MAX) || 5,
  message: (m) => `Too many sign-up attempts from this connection. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
});

const resetRateLimit = makeRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: (m) => `Too many reset requests. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
});

/**
 * Feedback is public — a helper has no account and must never need one — which
 * makes it the one place a stranger can put text in front of the operator.
 * A person sends a handful of messages; a spammer sends hundreds.
 *
 * Read from the environment for the same reason as the sign-up limit: a harness
 * makes more calls in a second than a user does in an hour, and a throttled 429
 * would hide the behaviour under test. Production never sets it.
 */
const feedbackRateLimit = makeRateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.FEEDBACK_RATE_MAX) || 20,
  message: (m) => `You have sent a lot of messages. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
});

/**
 * Stories are the second public write, and a heavier one: a story is up to 6000
 * characters of text that a human then has to read. The database already caps a
 * single device at STORY_DAILY_LIMIT (3) per rolling 24h, which is the limit
 * that actually matters to a person. This one is per connection and sits above
 * it, so a script that mints fresh device ids still cannot bury the queue.
 *
 * Read from the environment for the same reason as the others: a harness
 * legitimately makes more submissions in a second than a user does in a day,
 * and a throttled 429 would hide the behaviour under test.
 */
const storyRateLimit = makeRateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.STORY_RATE_MAX) || 10,
  message: (m) => `You have shared a lot of stories. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= MIN_PASSWORD;
}

function startSession(req, user, extra = {}) {
  req.session.isAdmin = user.role === 'admin';
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name || '';
  req.session.email = user.email || '';
  req.session.envAdmin = !!extra.envAdmin;
}

/** POST /api/auth/register — employer self-signup. */
app.post('/api/auth/register', registerRateLimit, (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!validPassword(b.password)) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }
  if (store.findUserByUsername(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = store.createUser({
    username: email,
    password: b.password,
    role: 'employer',
    name: name || email.split('@')[0],
    email,
  });
  startSession(req, user);
  return res.status(201).json({ ok: true, role: user.role, name: user.name, email: user.email });
});

/**
 * POST /api/auth/employer — employer sign-in with a per-employer access code.
 *
 * The first sign-in for a name creates the employer and mints a 6-char access
 * code, returned once in `accessCode`. The employer saves it. Every later sign-in
 * for that name requires the code, so a stranger who merely guesses "Mrs Chan"
 * cannot read the helpers she connected. The consent gate (the invitation a
 * helper accepts) still governs *which* helpers an employer sees — the access
 * code governs *which employer session this is*.
 */
app.post('/api/auth/employer', registerRateLimit, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const code = b.code ? String(b.code).trim() : '';

  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (name.length > 60) return res.status(400).json({ error: 'That name is too long.' });

  try {
    const { user, firstTime, accessCode } = store.loginOrCreateEmployer(name, code);
    loginRateLimit.clear(req);
    startSession(req, user);
    return res.json({
      ok: true,
      role: user.role,
      name: user.name,
      email: user.email,
      firstTime: !!firstTime,
      accessCode: firstTime ? accessCode : undefined,
    });
  } catch (err) {
    const status = err.status || (err.needsCode ? 401 : 400);
    return res.status(status).json({ error: err.message, needsCode: !!err.needsCode });
  }
});

app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};

  // Break-glass path: ADMIN_USER / ADMIN_PASSWORD let the operator get in even
  // if the accounts table is unusable. Only consulted when BOTH are set, so a
  // half-configured environment cannot open a hole.
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD;

  let user = null;
  let envAdmin = false;
  if (envUser && envPass && username === envUser && password === envPass) {
    user = { id: 0, username: envUser, name: 'Operator', role: 'admin', email: '' };
    envAdmin = true;
  } else {
    user = store.authenticate(username, password);
    // When the operator credential is managed by the environment, no *other*
    // admin row may act as a way in. That is precisely how a password left
    // behind by an earlier deployment stays alive without anyone noticing.
    // Employer accounts are unaffected: only a mismatched admin is refused.
    if (user && user.role === 'admin' && envUser && envPass &&
        String(user.username).trim().toLowerCase() !== String(envUser).trim().toLowerCase()) {
      user = null;
    }
  }

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  // A successful login clears the window, so a few mistyped attempts do not
  // lock a legitimate user out.
  loginRateLimit.clear(req);
  startSession(req, user, { envAdmin });
  return res.json({ ok: true, role: user.role, name: user.name, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

/** GET /api/auth/me — who am I, according to the session. */
app.get('/api/auth/me', (req, res) => {
  const user = sessionUser(req);
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, id: user.id, role: user.role, name: user.name, email: user.email });
});

/** POST /api/auth/password — change your own password. */
app.post('/api/auth/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const user = sessionUser(req);
  if (user.envAdmin) {
    return res.status(400).json({ error: 'The operator account is configured by environment variable, not here.' });
  }
  if (!validPassword(next)) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD} characters.` });
  }
  const record = store.getUserById(user.id);
  if (!record || !store.verifyPassword(current, record.password_hash)) {
    return res.status(400).json({ error: 'Your current password is not correct.' });
  }
  store.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(store.hashPassword(next), record.id);
  res.json({ ok: true });
});

/**
 * POST /api/auth/password/reset-request
 *
 * There is no mail provider, so nothing is emailed. The token is minted and
 * waits for the operator to hand it over (see /api/admin/reset-requests).
 * The response is IDENTICAL whether or not the email exists — otherwise this
 * endpoint becomes a way to discover who has an account.
 */
app.post('/api/auth/password/reset-request', resetRateLimit, (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const generic = {
    ok: true,
    message: 'If that email has an account, a reset link has been created. Ask the CantoBuddy operator to send it to you.',
  };
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  const user = store.findUserByUsername(email);
  if (user && user.status === 'active') store.createResetToken(user.id);
  return res.json(generic);
});

/** POST /api/auth/password/reset — consume the token and set a new password. */
app.post('/api/auth/password/reset', (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing reset token.' });
  if (!validPassword(password)) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }
  const found = store.peekResetToken(token);
  if (!found) return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
  try {
    const user = store.consumeResetToken(token, password);
    return res.json({ ok: true, email: user.username });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Vocabulary (public read, admin write)
// ---------------------------------------------------------------------------

app.get('/api/vocabulary', (req, res) => {
  const { level, category_id, scenario_id, type } = req.query;
  const user = sessionUser(req);
  const isAdmin = !!user && user.role === 'admin';
  // Filtering the pool is what makes a switched-off category genuinely off: the
  // quiz picks its questions from here, so hiding the category alone would leave
  // learners still being tested on it. A switched-off scenario is filtered the
  // same way, for the same reason.
  const rows = store.listVocabulary({ level, category_id, scenario_id, type, enabledOnly: !isAdmin });

  // Attach the same slug the server-rendered page uses, so the app can share a
  // link to /words/<slug> — a real page the recipient can open — rather than
  // the app root. Derived from the same index as seo.js, so the two cannot
  // disagree about which slug belongs to which word.
  const slugs = seo.wordSlugMap();
  res.json(rows.map((v) => ({ ...v, slug: slugs.get(v.id) || null })));
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

/**
 * A learner receives only the categories that are switched on. The operator
 * receives every category, including the ones they have turned off — otherwise
 * they would have no way to turn them back on.
 */
app.get('/api/categories', (req, res) => {
  const user = sessionUser(req);
  const isAdmin = !!user && user.role === 'admin';
  res.json(isAdmin ? store.listCategories() : store.listEnabledCategories());
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
// Scenarios (public read, admin write)
//
// A scenario is a set of phrases for one situation — "asking for help", "at the
// clinic". Same shape and same switch as a category, so the two are handled
// identically: a learner sees only the enabled ones, the operator sees all.
// ---------------------------------------------------------------------------

app.get('/api/scenarios', (req, res) => {
  const user = sessionUser(req);
  const isAdmin = !!user && user.role === 'admin';
  res.json(isAdmin ? store.listScenarios() : store.listEnabledScenarios());
});

app.post('/api/scenarios', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.name_en) return res.status(400).json({ error: 'English name is required.' });
  res.status(201).json(store.createScenario(b));
});

app.put('/api/scenarios/:id', requireAdmin, (req, res) => {
  const scen = store.updateScenario(req.params.id, req.body || {});
  if (!scen) return res.status(404).json({ error: 'Not found' });
  res.json(scen);
});

app.delete('/api/scenarios/:id', requireAdmin, (req, res) => {
  const ok = store.deleteScenario(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Discover feed — posts (public read, admin write)
//
// Two channels over one table: 'culture' (written by the operator) and 'news'
// (imported from public sources — see news.js). A learner sees PUBLISHED posts
// only; a draft is invisible here, which is the difference from vocabulary,
// where 'draft' is a review flag that still serves. A post is a dated
// publication, so an unfinished one must not appear in the feed at all.
//
// `category` narrows the NEWS channel by topic (see news-category.js). It is
// validated by the store, not here: an unrecognised value is dropped rather
// than turned into an empty result, so a stale link or a typo in a bookmark
// shows the whole channel instead of a blank screen.
// ---------------------------------------------------------------------------

app.get('/api/posts', (req, res) => {
  const { channel, limit, category } = req.query;
  res.json(store.listPosts({ channel: channel || null, status: 'published', limit, category: category || null }));
});

/**
 * How many published news items each category has — what the filter chips are
 * built from, so a chip can say "Work 12" and a category with nothing in it
 * still appears at zero. Returning `all` as well means the client never has to
 * add the buckets up and risk disagreeing with the server.
 */
app.get('/api/posts/categories', (req, res) => {
  res.json(store.getNewsCategoryCounts());
});

/**
 * One culture post per day, chosen deterministically by date so every
 * device shows the same article on the same day with no storage or call.
 *
 * REGISTERED BEFORE /api/posts/:slug — Express matches in registration order,
 * so a literal route placed after a parameter one is dead code that answers
 * 404. This route sat below :slug until the category work made someone read
 * the block; the home screen's "Today's Culture" card had been quietly
 * swallowing the 404 the whole time.
 */
app.get('/api/posts/daily-culture', (req, res) => {
  const posts = store.listPosts({ channel: 'culture', status: 'published', limit: 200 });
  if (!posts.length) return res.status(404).json({ error: 'No culture posts yet.' });
  // Same deterministic hash the client uses for the word of the day.
  const dayKey = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let h = 0x811c9dc5;
  const s = 'cb-culture-' + dayKey;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const pick = posts[(h >>> 0) % posts.length];
  res.json(pick);
});

app.get('/api/posts/:slug', (req, res) => {
  const post = store.getPostBySlug(req.params.slug);
  // A draft is a 404 to a learner, exactly as if it did not exist.
  if (!post || post.status !== 'published') return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

app.get('/api/admin/posts', requireAdmin, (req, res) => {
  const { channel, limit, category } = req.query;
  res.json({
    posts: store.listAllPosts({ channel: channel || null, limit, category: category || null }),
    counts: store.getPostCounts(),
    newsCategories: store.getNewsCategoryCounts(),
  });
});

app.post('/api/admin/posts', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.title_en || !String(b.title_en).trim()) {
    return res.status(400).json({ error: 'An English title is required.' });
  }
  const post = store.createPost(b);
  if (!post) return res.status(400).json({ error: 'Could not create the post.' });
  res.status(201).json(post);
});

app.put('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const post = store.updatePost(req.params.id, req.body || {});
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const ok = store.deletePost(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

/**
 * Runs the news importer on demand — the "Fetch news now" button.
 *
 * Admin-only, and deliberately synchronous in its response: the operator asked
 * for it and should see what happened (how many stories, from where, and any
 * feed that failed), not a job id. It is idempotent, so pressing it twice does
 * not duplicate anything — see importPost in db.js.
 */
app.post('/api/admin/posts/import', requireAdmin, async (req, res) => {
  try {
    const report = await news.importNews({ limitPerSource: Number(req.body && req.body.limit) || 0 });
    res.json({ ...report, counts: store.getPostCounts() });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : 'Import failed' });
  }
});

/**
 * Re-run the classifier over every post that has no category yet.
 *
 * Admin-only and deliberately narrow: it only fills EMPTY categories, so a
 * correction the operator made by hand in the post form is never overwritten.
 * That is what makes it safe to press after the keyword list has improved —
 * and the keyword list will improve, because it is a guess (see
 * news-category.js). Deliberately NOT part of the import, so a fetch that
 * happens to run on a build with a better classifier does not silently
 * rewrite topics the operator has already fixed.
 */
app.post('/api/admin/posts/classify', requireAdmin, (req, res) => {
  try {
    const classified = store.backfillNewsCategories();
    res.json({ classified, counts: store.getPostCounts(), newsCategories: store.getNewsCategoryCounts() });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : 'Classification failed' });
  }
});

// ---------------------------------------------------------------------------
// Stories — a helper's own life story, read by everyone, published by the
// operator
//
// The whole feature turns on one rule: NOTHING a helper writes is readable by
// anyone until the operator has read it and approved it. So the public routes
// below can only ever return `status = 'published'`, and the only function in
// the data layer that can set that status is setStoryStatus, which only the
// admin routes here call. A pending story is a 404, exactly as a draft post is.
//
// Anonymity is the default and it is applied at WRITE time (see createStory):
// when she does not tick "show my name", the name is discarded before the row
// is written, so there is nothing stored to leak later. The client cannot make
// a story anonymous on someone else's behalf and cannot attribute one that was
// submitted unsigned — the second half of that is what the queue is for, since
// a signature is only ever a claim the operator can check before publishing.
// ---------------------------------------------------------------------------

/** GET /api/stories — the public shelf: published only, newest first. */
app.get('/api/stories', (req, res) => {
  res.json(store.listPublishedStories({ limit: req.query.limit }));
});

/**
 * GET /api/stories/mine — what happened to HER submissions.
 *
 * Declared before /api/stories/:slug on purpose: Express matches in order, and
 * a later `mine` route would be swallowed by the slug route as a story called
 * "mine". Scoped by device token, resolved server-side, so this can only ever
 * return that device's own stories — the reviewer's note included, because a
 * rejection she cannot read is a rejection that teaches her nothing.
 */
app.get('/api/stories/mine', (req, res) => {
  const publicId = req.query.public_id;
  if (!publicId) return res.status(400).json({ error: 'Missing device id.' });
  const learner = store.getLearnerByPublicId(publicId);
  // A device the server has never seen has written nothing — an empty shelf,
  // not an error.
  if (!learner) return res.json({ stories: [], quota: { count: 0, limit: 0, allowed: true } });
  res.json({
    stories: store.listStoriesByLearner(learner.id),
    quota: store.storyQuotaFor(learner.id),
  });
});

/** GET /api/stories/:slug — one published story, or a 404. */
app.get('/api/stories/:slug', (req, res) => {
  const story = store.getPublishedStoryBySlug(req.params.slug);
  if (!story) return res.status(404).json({ error: 'Not found' });
  res.json(story);
});

/**
 * POST /api/stories — a helper shares her story.
 *
 * Public by necessity, exactly like feedback: she has no account, and making
 * her create one before she can tell her story guarantees it is never told.
 *
 * The submission is stored PENDING and returns 201 — the response says "we have
 * it", never "it is live", because at that moment a human has not yet read it.
 * The client shows her that plainly; see the Stories tab.
 */
app.post('/api/stories', storyRateLimit, (req, res) => {
  const b = req.body || {};
  const publicId = String(b.public_id || '').trim();
  if (!publicId) return res.status(400).json({ error: 'Missing device id.' });

  // Resolve the device to a learner row. This creates one on first contact,
  // which is deliberate: the daily quota is keyed on learner_id, so a device
  // with no row would otherwise have no limit at all. identifyLearner is
  // already public via /api/identify and is bounded by this route's limiter.
  const learner = store.identifyLearner({ public_id: publicId });

  const quota = store.storyQuotaFor(learner.id);
  if (!quota.allowed) {
    return res.status(429).json({
      error: 'You have shared several stories today. Please try again tomorrow.',
      quota,
    });
  }

  const story = store.createStory({
    learner_id: learner.id,
    title: b.title,
    body: b.body,
    lang: b.lang,
    topic: b.topic,
    // The privacy decision, straight through. `sign` is only ever true when she
    // ticked the box herself; anything else stores no name at all.
    sign: b.sign === true,
    display_name: b.display_name,
  });

  // An empty title or body is a mis-tap, not a story.
  if (!story) return res.status(400).json({ error: 'Please write a title and your story.' });

  res.status(201).json({ ok: true, id: story.id, slug: story.slug, status: story.status, quota: store.storyQuotaFor(learner.id) });
});

// ---------------------------------------------------------------------------
// Progress
//
// A learner reads and writes their OWN rows by presenting their device token.
// The server resolves the token, so a client can never claim someone else's
// learner_id. Admins may query across learners; nobody else may.
// ---------------------------------------------------------------------------

app.get('/api/progress', (req, res) => {
  const { learner, learner_id, level, category_id, public_id } = req.query;

  if (public_id) {
    const found = store.getLearnerByPublicId(public_id);
    if (!found) return res.json([]);
    return res.json(store.listProgress({ learner_id: found.id, level, category_id }));
  }

  const user = sessionUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized – please log in.' });
  }
  return res.json(store.listProgress({ learner, learner_id, level, category_id }));
});

app.post('/api/progress', (req, res) => {
  const b = req.body || {};
  if (!b.learner && !b.public_id) {
    return res.status(400).json({ error: 'Learner name required.' });
  }

  let learnerId = null;
  if (b.public_id) {
    // Resolve server-side. A client-supplied learner_id is never trusted.
    const found = store.identifyLearner({ public_id: b.public_id, display_name: b.learner });
    learnerId = found.id;
  }

  const { row, created } = store.saveProgress({
    ...b,
    learner: b.learner || 'Learner',
    learner_id: learnerId,
  });
  res.status(created ? 201 : 200).json(row);
});

// Aggregate stats for admin dashboard
app.get('/api/stats', requireAdmin, (req, res) => {
  res.json(store.getStats());
});

// ---------------------------------------------------------------------------
// Learners — a device identity, no account required
//
// This is the heart of "helpers must be able to use the app fully without ever
// connecting": identity comes from a token in localStorage, not a login.
// ---------------------------------------------------------------------------

app.post('/api/learners/identify', (req, res) => {
  const b = req.body || {};
  if (!b.public_id) return res.status(400).json({ error: 'Missing device id.' });
  const learner = store.identifyLearner({
    public_id: b.public_id,
    display_name: b.display_name || '',
    // ?ref= from the link that brought this device here, if any. Recorded
    // first-touch only — see identifyLearner.
    referrer: b.referrer || '',
  });

  // A visit is recorded HERE, on the identify call, because this route runs on
  // every app page load. It is what makes a visitor countable even when she
  // never opens a quiz — the case the quiz-only reports could not see at all.
  // A failure here must not break the page load, so it is caught and ignored:
  // a missed count is a missing statistic, not a broken lesson.
  try {
    store.recordVisit(learner.id);
  } catch (err) {
    console.warn('Could not record visit:', err.message);
  }

  res.json({
    learner: { id: learner.id, display_name: learner.display_name },
    // Her own code, so the app can put it on the links she shares. Derived from
    // public_id and one-way, so it is safe to publish — unlike public_id, which
    // is the token that controls her name and her employer links.
    referral_code: learner.referral_code || null,
    employers: store.listEmployersForLearner(learner.id),
  });
});

/**
 * POST /api/learners/activity — practice that is not a quiz.
 *
 * The gap this fills: browsing the vocabulary wrote nothing at all, so a
 * learner who studied forty cards and never opened a quiz left no trace. The
 * app batches counts locally and flushes them here (and on pagehide), so one
 * request covers a stretch of reading rather than one request per card.
 *
 * Trust model is the same as rewards and stats: the device token is resolved
 * server-side to a learner row, so a caller can only ever add activity to the
 * device it already holds. The counts are clamped in db.js — they come from
 * the client and must not be able to write history backwards.
 */
app.post('/api/learners/activity', (req, res) => {
  const b = req.body || {};
  const learner = b.public_id ? store.getLearnerByPublicId(b.public_id) : null;
  // An unknown device has nothing to attribute activity to. Answer 204 rather
  // than 404: the client is fire-and-forget and must not retry or surface this.
  if (!learner) return res.status(204).end();

  const row = store.recordActivity(learner.id, {
    words_viewed: b.words_viewed,
    cards_opened: b.cards_opened,
    quizzes_started: b.quizzes_started,
  });
  res.json({ ok: true, day: row ? row.day : null });
});

/**
 * POST /api/visit — the landing-page beacon.
 *
 * The 159 server-rendered pages in seo.js carry no app runtime, so a visitor
 * arriving from a search engine was invisible to every report. This is the
 * smallest thing that fixes that: a page view, and a visit against the device.
 *
 * Public by necessity — these pages are read before anyone has an account —
 * so it is deliberately narrow. It takes a path and a device token and nothing
 * else, it ignores any client-supplied count, and it writes one page view and
 * at most one visit. There is nothing here worth abusing: the worst case is an
 * inflated visitor count on a free app.
 */
app.post('/api/visit', (req, res) => {
  const b = req.body || {};

  // Only paths this app actually serves. Anything else is a typo or a probe,
  // and letting arbitrary strings through would let one caller fill the
  // top-paths list with junk.
  const path = String(b.path || '').split('?')[0].split('#')[0].trim().slice(0, 200);
  if (!path.startsWith('/')) return res.status(400).json({ error: 'Invalid path.' });

  store.recordPageView(path);

  // The device token is optional: a visitor who has never loaded the app has
  // none yet, and the page view above still counts. When it IS present, the
  // visit is attributed so "how many people visited" has a real answer rather
  // than a page-view proxy. Same shape the app itself uses, so a landing
  // visitor and an app user are the same kind of identity.
  const pid = String(b.public_id || '').trim();
  if (/^[A-Za-z0-9_-]{8,64}$/.test(pid)) {
    try {
      const learner = store.identifyLearner({ public_id: pid });
      store.recordVisit(learner.id);
    } catch (err) {
      console.warn('Could not record landing visit:', err.message);
    }
  }

  res.status(204).end();
});

/**
 * POST /api/feedback — a helper or an employer writes to the operator.
 *
 * Public by necessity: a helper has no account, and asking her to make one
 * before she can say "the audio does not work" guarantees she never says it.
 *
 * WHO IS ASKED, NEVER WHO IS TOLD. The role comes from the session, not from the
 * body, so a caller cannot promote itself into an attributed submission. An
 * employer is signed in to her own dashboard and is recorded (she expects an
 * answer); everyone else lands anonymously and the client cannot opt out of that
 * by lying. A learner who wants a reply must type a contact address — that is
 * the only route back to her, and it is opt-in by construction.
 */
app.post('/api/feedback', feedbackRateLimit, (req, res) => {
  const b = req.body || {};
  const user = sessionUser(req);
  const isEmployer = !!user && user.role === 'employer';

  const row = store.createFeedback({
    role: isEmployer ? 'employer' : 'learner',
    message: b.message,
    contact: b.contact,
    user_id: isEmployer ? user.id : null,
    lang: b.lang,
    page: b.page,
  });

  // An empty message is a mis-tap. Answer 400 rather than a cheerful 204 so the
  // form can say something useful instead of pretending it sent.
  if (!row) return res.status(400).json({ error: 'Please write something first.' });

  res.status(201).json({ ok: true, id: row.id });
});

/**
 * Where learners came from — the operator's view of which channel is working.
 *
 * Read-only, and counts only: no device ids, no names. The point is to answer
 * "did the newspaper, the Sunday QR code, or a friend's link bring people in",
 * not to profile anyone.
 */
app.get('/api/admin/referrers', requireAdmin, (req, res) => {
  const rows = store.getReferrerCounts();
  res.json({
    referrers: rows,
    total: rows.reduce((n, r) => n + r.count, 0),
  });
});

/**
 * Disconnect from an employer.
 *
 * Deliberately one tap with no confirmation dance and no notification to the
 * employer — a helper may not feel free to refuse an employer's invitation, so
 * leaving has to be frictionless and quiet. Progress history is untouched;
 * only the visibility is withdrawn.
 */
app.delete('/api/learners/employers/:linkId', (req, res) => {
  const publicId = req.query.public_id || (req.body && req.body.public_id);
  const learner = publicId ? store.getLearnerByPublicId(publicId) : null;
  if (!learner) return res.status(400).json({ error: 'Missing or unknown device id.' });

  const link = store.listEmployersForLearner(learner.id).find((l) => l.id === Number(req.params.linkId));
  if (!link) return res.status(404).json({ error: 'Not found.' });

  store.revokeLink(link.id, 'learner');
  res.json({ ok: true, employers: store.listEmployersForLearner(learner.id) });
});

// ---------------------------------------------------------------------------
// Rewards — credits and stickers
// ---------------------------------------------------------------------------

/**
 * A device's credit balance and sticker album.
 *
 * Read by device token, exactly like progress: the server resolves the token to
 * a learner row itself, so this can only ever return that device's own rewards.
 * Unlocking happens here as a side effect, and anything newly earned comes back
 * in `newly_unlocked` so the app can celebrate it once and not again.
 */
app.get('/api/learners/rewards', (req, res) => {
  const publicId = req.query.public_id;
  if (!publicId) return res.status(400).json({ error: 'Missing device id.' });

  const learner = store.getLearnerByPublicId(publicId);
  // An unknown device simply has no rewards yet — not an error worth failing on.
  if (!learner) return res.json({ credits: 0, stickers: [], newly_unlocked: [], next: null });

  res.json(store.getRewards(learner.id));
});

/**
 * A device's own learning statistics — streaks, activity over time, and how she
 * does on each kind of quiz.
 *
 * Same trust model as rewards above: the token is resolved to a learner row
 * server-side, so this can only ever return that device's own practice. There is
 * no learner_id in the query string, deliberately — a client-supplied id is
 * never trusted anywhere in this app, and this is no exception.
 *
 * An unknown device gets a well-formed empty set rather than an error, because
 * a device the server has not seen yet is the ordinary first-visit case. -1
 * matches no learner, so every aggregate comes back as a zero and the client
 * never has to special-case the shape.
 */
app.get('/api/learners/stats', (req, res) => {
  const publicId = req.query.public_id;
  if (!publicId) return res.status(400).json({ error: 'Missing device id.' });

  const learner = store.getLearnerByPublicId(publicId);
  res.json(store.getLearnerStats(learner ? learner.id : -1, req.query.days));
});

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/** Public lookup so the join screen can say who is inviting before accepting. */
app.get('/api/invitations/:code', (req, res) => {
  const inv = store.getInvitationByCode(req.params.code);
  const status = store.invitationStatus(inv);
  if (!inv || status === 'revoked') {
    return res.status(404).json({ error: 'This invitation link is not valid.' });
  }
  const employer = store.getUserById(inv.employer_id);
  res.json({
    code: inv.code,
    status,
    employer_name: employer ? employer.name : 'An employer',
    helper_label: inv.helper_label,
    note: inv.note,
    expires_at: inv.expires_at,
  });
});

app.post('/api/invitations/:code/accept', (req, res) => {
  const b = req.body || {};
  if (!b.public_id) return res.status(400).json({ error: 'Missing device id.' });
  try {
    const learner = store.identifyLearner({ public_id: b.public_id, display_name: b.display_name || '' });
    const result = store.acceptInvitation({ code: req.params.code, learner });
    const employer = store.getUserById(result.invitation.employer_id);
    res.json({
      ok: true,
      employer: { name: employer ? employer.name : '' },
      employers: store.listEmployersForLearner(learner.id),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Employer portal
// ---------------------------------------------------------------------------

app.get('/api/employer/helpers', requireEmployer, (req, res) => {
  res.json(
    store.listLearnersForEmployer(req.user.id).map((link) => {
      const report = store.getLearnerReport(link.learner_id);
      return {
        link_id: link.id,
        learner_id: link.learner_id,
        display_name: link.display_name,
        connected_at: link.connected_at,
        last_seen_at: link.last_seen_at,
        totals: report ? report.totals : null,
        byLevel: report ? report.byLevel : {},
      };
    })
  );
});

app.get('/api/employer/helpers/:learnerId', requireEmployer, (req, res) => {
  const link = store
    .listLearnersForEmployer(req.user.id)
    .find((l) => l.learner_id === Number(req.params.learnerId));
  if (!link) return res.status(404).json({ error: 'That helper is not connected to your account.' });
  res.json({
    ...store.getLearnerReport(link.learner_id),
    link_id: link.id,
    connected_at: link.connected_at,
  });
});

app.delete('/api/employer/helpers/:learnerId', requireEmployer, (req, res) => {
  const link = store
    .listLearnersForEmployer(req.user.id)
    .find((l) => l.learner_id === Number(req.params.learnerId));
  if (!link) return res.status(404).json({ error: 'Not found.' });
  store.revokeLink(link.id, 'employer');
  res.json({ ok: true });
});

app.get('/api/employer/invitations', requireEmployer, (req, res) => {
  res.json(
    store.listInvitations(req.user.id).map((inv) => ({
      id: inv.id,
      code: inv.code,
      helper_label: inv.helper_label,
      note: inv.note,
      status: store.invitationStatus(inv),
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      accepted_at: inv.accepted_at,
    }))
  );
});

app.post('/api/employer/invitations', requireEmployer, (req, res) => {
  const b = req.body || {};
  const inv = store.createInvitation({
    employer_id: req.user.id,
    helper_label: b.helper_label || '',
    note: b.note || '',
  });
  res.status(201).json({ ...inv, status: store.invitationStatus(inv), path: '/join/' + inv.code });
});

app.delete('/api/employer/invitations/:id', requireEmployer, (req, res) => {
  if (!store.revokeInvitation(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin — accounts and reset links
// ---------------------------------------------------------------------------

/** Never leak password_hash, even to an admin. */
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(store.listUsers().map(publicUser));
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const b = req.body || {};
  const email = String(b.email || b.username || '').trim().toLowerCase();
  const role = ['admin', 'employer', 'learner'].includes(b.role) ? b.role : 'employer';
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!validPassword(b.password)) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }
  if (store.findUserByUsername(email)) {
    return res.status(409).json({ error: 'That email already has an account.' });
  }
  const created = store.createUser({ username: email, password: b.password, role, name: b.name || '', email });
  res.status(201).json(publicUser(created));
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  const target = store.getUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found.' });

  // Do not let the last active admin demote or disable themselves — that would
  // leave nobody able to administer the app.
  if (target.role === 'admin' && store.countActiveAdmins() <= 1) {
    const demoting = (b.role && b.role !== 'admin') || (b.status && b.status !== 'active');
    if (demoting) {
      return res.status(400).json({ error: 'This is the last active admin — it cannot be demoted or disabled.' });
    }
  }
  res.json(publicUser(store.updateUser(target.id, b)));
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    if (!store.deleteUser(req.params.id)) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** Mint a reset link for a locked-out account and hand it to the operator. */
app.post('/api/admin/users/:id/reset-link', requireAdmin, (req, res) => {
  const made = store.createResetToken(req.params.id);
  if (!made) return res.status(404).json({ error: 'Not found.' });
  res.json({
    ok: true,
    email: made.user.username,
    name: made.user.name,
    link: '/reset?token=' + made.token,
    expires_at: made.expires_at,
  });
});

/** Reset requests waiting for someone to deliver the link. */
app.get('/api/admin/reset-requests', requireAdmin, (req, res) => {
  const rows = store.db
    .prepare(
      `SELECT r.token, r.created_at, r.expires_at,
              u.id AS user_id, u.username, u.name, u.role
         FROM password_resets r
         JOIN users u ON u.id = r.user_id
        WHERE r.used_at IS NULL AND r.expires_at > ?
        ORDER BY r.created_at DESC`
    )
    .all(new Date().toISOString());
  res.json(rows.map((r) => ({ ...r, link: '/reset?token=' + r.token })));
});

/**
 * GET /api/admin/people — the whole platform in one read.
 *
 * Every employer with the helpers connected to them, plus the learners who are
 * connected to nobody. Read-only: an operator can see who is connected to whom,
 * but cannot create or break a consent link from here.
 */
app.get('/api/admin/people', requireAdmin, (req, res) => {
  res.json(store.getPeopleOverview());
});

/** GET /api/admin/learners/:id — full report for one learner, for drill-down. */
app.get('/api/admin/learners/:id', requireAdmin, (req, res) => {
  const report = store.getLearnerReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'No such learner.' });
  res.json(report);
});

/**
 * GET /api/admin/feedback — the inbox, with the counts the tab badge needs.
 *
 * `status` filters to new / reviewing / resolved. Omitted or unrecognised means
 * everything, so a stale bookmark or a hand-typed query cannot present an empty
 * inbox as if there were no feedback at all.
 */
app.get('/api/admin/feedback', requireAdmin, (req, res) => {
  res.json({
    items: store.listFeedback({ status: req.query.status, limit: req.query.limit }),
    counts: store.getFeedbackCounts(),
  });
});

/** PATCH /api/admin/feedback/:id — move one item along new → reviewing → resolved. */
app.patch('/api/admin/feedback/:id', requireAdmin, (req, res) => {
  const row = store.setFeedbackStatus(req.params.id, String((req.body || {}).status || ''));
  if (!row) return res.status(400).json({ error: 'Unknown feedback, or unknown status.' });
  res.json(row);
});

/**
 * DELETE /api/admin/feedback/:id — for spam, which a public form will attract.
 * Deleting is irreversible, so the admin UI confirms before it calls this.
 */
app.delete('/api/admin/feedback/:id', requireAdmin, (req, res) => {
  if (!store.deleteFeedback(req.params.id)) return res.status(404).json({ error: 'No such feedback.' });
  res.json({ ok: true });
});

/**
 * GET /api/admin/stories — the moderation queue, with the counts the tab badge
 * needs.
 *
 * `status` filters to pending / published / rejected. Omitted or unrecognised
 * means everything, so a stale bookmark cannot present an empty queue as if
 * nothing had been submitted — the same rule as the feedback inbox.
 */
app.get('/api/admin/stories', requireAdmin, (req, res) => {
  res.json({
    stories: store.listStoriesForModeration({ status: req.query.status, limit: req.query.limit }),
    counts: store.getStoryCounts(),
  });
});

/**
 * PATCH /api/admin/stories/:id — approve, reject, or take one back down.
 *
 * The ONLY way a story becomes readable. `note` is the reason a rejection
 * carries back to its author, so it is kept when one is supplied and the
 * existing note is preserved otherwise — approving after fixing a typo should
 * not silently erase the record of what was said.
 */
app.patch('/api/admin/stories/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  const status = String(b.status || '');
  const current = store.getStoryForModeration(req.params.id);
  if (!current) return res.status(400).json({ error: 'Unknown story, or unknown status.' });
  const note = b.note != null ? b.note : current.reviewer_note;
  const row = store.setStoryStatus(req.params.id, status, note);
  if (!row) return res.status(400).json({ error: 'Unknown story, or unknown status.' });
  res.json(row);
});

/**
 * PUT /api/admin/stories/:id — the operator editing a submission.
 *
 * For a typo, an identifying detail that must come out before this can be
 * published, or the hand-written English gloss that lets a story written in
 * Filipino reach a reader who does not speak it. Editing never changes the
 * status — publishing is setStoryStatus's job alone.
 */
app.put('/api/admin/stories/:id', requireAdmin, (req, res) => {
  const row = store.updateStoryContent(req.params.id, req.body || {});
  if (!row) return res.status(404).json({ error: 'Not found, or the title and story cannot both be empty.' });
  res.json(row);
});

/** DELETE /api/admin/stories/:id — irreversible, so the admin UI confirms. */
app.delete('/api/admin/stories/:id', requireAdmin, (req, res) => {
  if (!store.deleteStory(req.params.id)) return res.status(404).json({ error: 'No such story.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/report — the operator's numbers.
 *
 * `days` picks the trend window (7 / 30 / 90, default 30). Everything is keyed
 * on the device identity, so two helpers who share a name stay two people.
 */
app.get('/api/admin/report', requireAdmin, (req, res) => {
  res.json(store.getReport(req.query.days));
});

/**
 * Escape one CSV cell.
 *
 * Two things matter beyond the obvious quoting:
 *
 *  - A cell starting with =, +, - or @ is run as a formula by Excel and Sheets.
 *    Helper names are user-supplied, so a name is all it takes to execute
 *    something on the operator's machine when they open the export. Prefixing
 *    with an apostrophe forces it to text.
 *  - toCsv() adds a leading BOM. Without it Excel on Windows reads the file as
 *    the local code page and mangles any non-ASCII name.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** The export shapes. Each is a header row plus a row mapper. */
const CSV_EXPORTS = {
  employers: {
    header: ['employer', 'email', 'status', 'joined', 'last_login', 'helpers',
      'helpers_active_7d', 'attempts', 'completed', 'correct', 'questions',
      'accuracy_pct', 'last_activity'],
    rows: () => store.getReportEmployers().map((e) => [
      e.name, e.email, e.status, e.created_at, e.last_login_at, e.helper_count,
      e.helpers_active_7d, e.attempts, e.completed_attempts, e.correct_answers,
      e.questions_answered, e.accuracy_rate, e.last_activity,
    ]),
  },
  helpers: {
    header: ['helper', 'learner_id', 'employers', 'employer_count', 'joined',
      'last_seen', 'active_7d', 'attempts', 'completed', 'partial', 'correct',
      'questions', 'accuracy_pct', 'credits', 'last_activity'],
    rows: () => store.getReportHelpers().map((h) => [
      h.display_name, h.learner_id, h.employers, h.employer_count, h.created_at,
      h.last_seen_at, h.active_7d ? 'yes' : 'no', h.attempts, h.completed_attempts,
      h.partial_attempts, h.correct_answers, h.questions_answered, h.accuracy_rate,
      h.credits, h.last_activity,
    ]),
  },
  daily: {
    header: ['day', 'attempts', 'completed', 'correct', 'questions', 'helpers_active'],
    rows: () => store.getReportTrends(90).series.map((d) => [
      d.day, d.attempts, d.completed, d.correct, d.questions, d.learners,
    ]),
  },
  summary: {
    header: ['metric', 'value'],
    rows: () => Object.entries(store.getReportTotals()).map(([k, v]) => [k, v]),
  },
  /* Visitors and practice. `daily` above is quiz-only — it reads `progress` —
     so a learner who studied the vocabulary without quizzing appears nowhere
     in it. These two are the ones that can see her. */
  visitors: {
    header: ['day', 'visitors', 'new_visitors', 'visits', 'words_viewed',
      'cards_opened', 'quizzes_started'],
    rows: () => store.getVisitorReport(90).series.map((d) => [
      d.day, d.visitors, d.new_visitors, d.visits, d.words_viewed,
      d.cards_opened, d.quizzes_started,
    ]),
  },
  practice_only: {
    header: ['learner_id', 'name', 'words_viewed', 'cards_opened', 'days_active',
      'first_day', 'last_day', 'last_seen'],
    rows: () => store.getVisitorReport(90).practiceOnly.map((p) => [
      p.learner_id, p.display_name, p.words_viewed, p.cards_opened,
      p.days_active, p.first_day, p.last_day, p.last_seen_at,
    ]),
  },
};

/**
 * GET /api/admin/report.csv?type=employers|helpers|daily|summary
 *
 * Built on the server rather than in the browser so the file arrives with a
 * filename and the right encoding, and so the numbers in the export are the
 * same numbers the tab shows.
 */
app.get('/api/admin/report.csv', requireAdmin, (req, res) => {
  const type = String(req.query.type || 'employers');
  const shape = CSV_EXPORTS[type];
  if (!shape) {
    return res.status(400).json({ error: 'Unknown report type.', types: Object.keys(CSV_EXPORTS) });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cantobuddy-${type}-${stamp}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(toCsv(shape.header, shape.rows()));
});

// ---------------------------------------------------------------------------
// Deep links
//
// The learner app is one static HTML file, so its non-file routes have to be
// routed to it explicitly. Registered after express.static, so real assets and
// /portal.html still win.
//
//   /join/<code>  a helper accepting an invitation — she has no account, so
//                 this lands in the learner app.
//   /reset        setting a new password — that is an account action, so it
//                 belongs in the employer portal, not the learner app.
// ---------------------------------------------------------------------------

app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));
app.get('/reset', (req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));
app.get('/join/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ---------------------------------------------------------------------------
// SEO
//
// The learner app is a single-page app: every view renders into `/`, and the
// vocabulary arrives from /api/vocabulary at runtime. A crawler therefore sees
// an empty shell. seo.js server-renders the same SQLite content as plain HTML
// at /learn, /learn/:category, /words/:word and /level/:n (plus a /fil mirror)
// and generates sitemap.xml + robots.txt from live data.
//
// Mounted after express.static so real files still win, and it deliberately
// does not touch the SPA — `/` keeps serving public/index.html.
// ---------------------------------------------------------------------------
seo.mount(app);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  CantoBuddy is running!`);
  console.log(`  Learner app:  http://localhost:${PORT}`);
  console.log(`  Admin login:  http://localhost:${PORT}/admin.html\n`);
  console.log(
    store.envAdmin && store.envAdmin.configured
      ? `  Operator:     ${store.envAdmin.username} — from ADMIN_USER / ADMIN_PASSWORD (${store.envAdmin.action})`
      : '  Operator:     no ADMIN_USER / ADMIN_PASSWORD set — see the generated password above'
  );
  console.log(`  Database:     ${store.DB_PATH}`);
  if (store.seeded) console.log(`  Seeded a fresh database from data.js.`);
  console.log('');
});

// ---------------------------------------------------------------------------
// News importer schedule
//
// ON BY DEFAULT: an hourly pull. The importer is idempotent (it only ever
// inserts posts it does not already have, keyed on the source GUID), so running
// it costs nothing but a couple of HTTP requests and the feed stays current
// without the operator pressing "Fetch news now" in the admin Posts tab. The
// 3-day retention (see db.js pruneExpiredNews) keeps the schedule harmless —
// a stale item is gone after 72h and re-fetched fresh when the feed moves.
//
// OVERRIDE:
//   NEWS_FETCH_INTERVAL_HOURS=6   -> pull every 6 hours instead
//   NEWS_FETCH_INTERVAL_HOURS=0   -> off (revert to manual-only)
//
// ON A SLEEPING HOST this timer does not fire while the instance is asleep
// (Render's free tier sleeps after inactivity), so it is a convenience, not a
// hard guarantee. A Render Cron Job hitting POST /api/admin/posts/import is the
// reliable version; the startup pull below is the belt-and-braces one. Both
// exist. When the var is unset we default to 1h; when it is explicitly "0" we
// honour the opt-out (Number('0') is 0, so the `|| 1` must not swallow it).
// ---------------------------------------------------------------------------
const rawNewsInterval = process.env.NEWS_FETCH_INTERVAL_HOURS;
const NEWS_FETCH_INTERVAL_HOURS =
  rawNewsInterval === undefined ? 1 : Number(rawNewsInterval);

if (NEWS_FETCH_INTERVAL_HOURS > 0) {
  const everyMs = Math.max(NEWS_FETCH_INTERVAL_HOURS, 0.25) * 60 * 60 * 1000;

  const runImport = async (why) => {
    try {
      const r = await news.importNews();
      console.log(
        `  News import (${why}): fetched ${r.fetched}, new ${r.inserted}, already had ${r.skipped}` +
          // A retired source is a real event, not a detail: it means the feed
          // just lost stories because the code stopped shipping their feed.
          (r.removed ? `, retired ${r.removed} from ${r.retired.join(', ')}` : '') +
          (r.prunedRemoved ? `, pruned ${r.prunedRemoved} older than ${Number(process.env.NEWS_MAX_AGE_DAYS) || 3}d` : '') +
          (r.errors.length ? ` — errors: ${r.errors.join('; ')}` : '')
      );
    } catch (err) {
      // A feed being down must never take the app with it.
      console.error(`  News import (${why}) failed:`, err && err.message ? err.message : err);
    }
  };

  const timer = setInterval(() => runImport('scheduled'), everyMs);
  timer.unref(); // never hold the process open
  // One run shortly after boot, so a redeploy refreshes the feed without
  // waiting a whole interval.
  setTimeout(() => runImport('startup'), 15000).unref();
  console.log(`  News import: every ${NEWS_FETCH_INTERVAL_HOURS}h (NEWS_FETCH_INTERVAL_HOURS)`);
}

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
