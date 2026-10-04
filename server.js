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
  max: 5,
  message: (m) => `Too many sign-up attempts from this connection. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
});

const resetRateLimit = makeRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: (m) => `Too many reset requests. Try again in ${m} minute${m === 1 ? '' : 's'}.`,
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
  const learner = store.identifyLearner({ public_id: b.public_id, display_name: b.display_name || '' });
  res.json({
    learner: { id: learner.id, display_name: learner.display_name },
    employers: store.listEmployersForLearner(learner.id),
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
