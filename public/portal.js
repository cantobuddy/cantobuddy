/* =============================================================================
   CantoBuddy  —  Employer Portal Logic
   -----------------------------------------------------------------------------
   The employer side of Phase 2. An employer signs in, invites a helper by link
   or code, and sees that helper's learning progress. Nothing here can read a
   helper's data unless the helper accepted an invitation and has not revoked
   it — the server enforces that, this file only draws what it is given.
   ============================================================================= */

const PORTAL = {
  helpers: [],
  invites: [],
  authMode: 'login',
  created: null, // { link, code } for the "invitation ready" modal
};

// ---- Small helpers ---------------------------------------------------------

/** Escape anything that came from user input before it touches innerHTML. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LEVEL_NAMES = { 1: '🌱 Beginner', 2: '🌿 Intermediate', 3: '🌳 Advanced' };
const QUIZ_LABELS = {
  multiple_choice: 'Multiple choice',
  listen_choose: 'Listen & choose',
  match_picture: 'Match the picture',
  fill_blank: 'Fill in the blank',
};

function timeAgo(iso) {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} w ago`;
  return new Date(t).toLocaleDateString();
}

function shortDate(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Percentage correct, or 0 when nothing has been attempted yet. */
function accuracy(totals) {
  if (!totals || !totals.totalMax) return 0;
  return Math.round((totals.totalScore / totals.totalMax) * 100);
}

/** A level chip is green when strong, amber when middling, grey when untouched. */
function levelClass(pct, attempts) {
  if (!attempts) return '';
  return pct >= 80 ? 'good' : pct >= 50 ? 'mid' : '';
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---- API helpers -----------------------------------------------------------

async function apiGet(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

async function apiSend(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

const apiPost = (url, body) => apiSend('POST', url, body);
const apiDelete = (url) => apiSend('DELETE', url);

// ---- Auth ------------------------------------------------------------------

function setAuthMode(mode) {
  PORTAL.authMode = mode;
  const isRegister = mode === 'register';

  document.querySelectorAll('.portal-auth-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.getElementById('field-name').style.display = isRegister ? '' : 'none';
  document.getElementById('pass-hint').style.display = isRegister ? '' : 'none';
  document.getElementById('auth-title').textContent = isRegister ? 'Create Employer Account' : 'Employer Sign In';
  document.getElementById('auth-hint').textContent = isRegister
    ? 'Set up an account to invite your helper and follow her progress.'
    : "See how your helper's Cantonese is coming along.";
  document.getElementById('auth-submit').textContent = isRegister ? 'Create Account' : 'Sign In';
  document.getElementById('auth-pass').setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
  document.getElementById('auth-error').textContent = '';
}

async function submitAuth(e) {
  e.preventDefault();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-pass').value;
  const name = document.getElementById('auth-name').value.trim();
  const submit = document.getElementById('auth-submit');
  submit.disabled = true;

  try {
    if (PORTAL.authMode === 'register') {
      await apiPost('/api/auth/register', { email, name, password });
    } else {
      await apiPost('/api/auth/login', { username: email, password });
    }
    document.getElementById('auth-form').reset();
    await showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}

async function portalLogout() {
  try {
    await apiPost('/api/auth/logout', {});
  } catch {
    /* logging out locally is enough even if the call fails */
  }
  location.reload();
}

/** If the session belongs to an employer (or the operator), go straight in. */
async function checkSession() {
  try {
    const me = await apiGet('/api/auth/me');
    if (me.authenticated && (me.role === 'employer' || me.role === 'admin')) {
      await showDashboard(me);
    }
  } catch {
    /* not signed in — the auth card is already showing */
  }
}

async function showDashboard(me) {
  document.getElementById('portal-auth').classList.remove('active');
  document.getElementById('portal-dash').classList.add('active');
  document.getElementById('logout-btn').style.display = '';

  if (!me) me = await apiGet('/api/auth/me').catch(() => ({}));
  const who = me.name || me.email || 'there';
  document.getElementById('hello-name').textContent = `Hello, ${who}`;

  await loadPortal();
}

// ---- Load ------------------------------------------------------------------

async function loadPortal() {
  try {
    const [helpers, invites] = await Promise.all([
      apiGet('/api/employer/helpers'),
      apiGet('/api/employer/invitations'),
    ]);
    PORTAL.helpers = helpers;
    PORTAL.invites = invites;
    renderHelpers();
    renderInvites();
  } catch (err) {
    document.getElementById('helpers-list').innerHTML =
      `<div class="portal-empty"><div class="portal-empty-icon">⚠️</div><p>${esc(err.message)}</p></div>`;
    document.getElementById('invites-list').innerHTML = '';
  }
}

// ---- Helpers list ----------------------------------------------------------

function renderHelpers() {
  const wrap = document.getElementById('helpers-list');
  const list = PORTAL.helpers;

  if (!list.length) {
    wrap.innerHTML = `
      <div class="portal-empty">
        <div class="portal-empty-icon">👋</div>
        <p><strong>No helper connected yet.</strong><br />
        Tap “Invite a Helper” to create a link or code. Your helper opens it once —
        no account or password — and her practice shows up here.</p>
      </div>`;
    return;
  }

  wrap.innerHTML = list
    .map((h) => {
      const name = h.display_name || 'Your helper';
      const initial = (name.trim()[0] || '?').toUpperCase();
      const pct = accuracy(h.totals);
      const attempts = (h.totals && h.totals.attempts) || 0;

      const levelChips = [1, 2, 3]
        .map((lvl) => {
          const d = h.byLevel && h.byLevel[lvl];
          if (!d || !d.attempts) return '';
          const lp = d.max ? Math.round((d.score / d.max) * 100) : 0;
          return `<span class="helper-level ${levelClass(lp, d.attempts)}">${LEVEL_NAMES[lvl]} ${d.score}/${d.max}</span>`;
        })
        .join('');

      return `
        <div class="helper-card">
          <div class="helper-head">
            <div class="helper-avatar">${esc(initial)}</div>
            <div style="min-width:0">
              <div class="helper-name">${esc(name)}</div>
              <div class="helper-meta">
                Connected ${esc(timeAgo(h.connected_at))} · Last practised ${esc(timeAgo(h.last_seen_at))}
              </div>
            </div>
          </div>

          <div class="helper-stats">
            <div>
              <div class="helper-stat-num">${attempts}</div>
              <div class="helper-stat-lbl">Quiz attempts</div>
            </div>
            <div>
              <div class="helper-stat-num">${pct}%</div>
              <div class="helper-stat-lbl">Correct</div>
            </div>
            <div>
              <div class="helper-stat-num">${(h.totals && h.totals.totalScore) || 0}</div>
              <div class="helper-stat-lbl">Right answers</div>
            </div>
          </div>

          <div class="helper-progress">
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>

          ${levelChips ? `<div class="helper-levels">${levelChips}</div>` : ''}

          <div class="helper-actions">
            <button class="btn btn-primary btn-sm" onclick="openHelperDetail(${h.learner_id})">View progress</button>
            <button class="btn btn-outline btn-sm" onclick="disconnectHelper(${h.learner_id}, '${esc(name).replace(/'/g, '&#39;')}')">Disconnect</button>
          </div>
        </div>`;
    })
    .join('');
}

async function disconnectHelper(learnerId, name) {
  const ok = confirm(
    `Disconnect from ${name}?\n\nYou will stop seeing her progress. She keeps all of her learning, ` +
      `and she can reconnect later with a new invite.`
  );
  if (!ok) return;
  try {
    await apiDelete(`/api/employer/helpers/${learnerId}`);
    showToast('Disconnected');
    await loadPortal();
  } catch (err) {
    alert('Could not disconnect: ' + err.message);
  }
}

// ---- Helper detail ---------------------------------------------------------

async function openHelperDetail(learnerId) {
  const modal = document.getElementById('helper-modal');
  const body = document.getElementById('helper-detail');
  body.innerHTML = '<p class="modal-hint">Loading…</p>';
  modal.classList.add('show');

  try {
    const r = await apiGet(`/api/employer/helpers/${learnerId}`);
    const name = (r.learner && r.learner.display_name) || 'Your helper';
    const totals = r.totals || {};
    const pct = accuracy(totals);

    const levels = [1, 2, 3]
      .map((lvl) => {
        const d = r.byLevel && r.byLevel[lvl];
        if (!d || !d.attempts) return '';
        const lp = d.max ? Math.round((d.score / d.max) * 100) : 0;
        return `<span class="helper-level ${levelClass(lp, d.attempts)}">${LEVEL_NAMES[lvl]} ${d.score}/${d.max}</span>`;
      })
      .join('');

    const recent = (r.recent || [])
      .map((row) => {
        const p = row.total ? Math.round((row.score / row.total) * 100) : 0;
        const cls = row.completed ? (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low') : '';
        const label = QUIZ_LABELS[row.quiz_type] || 'Quiz';
        const incomplete = row.completed
          ? ''
          : ` <span class="recent-incomplete">· ${row.answered || 0}/${row.total || 0} done</span>`;
        return `
          <div class="recent-row">
            <div>
              <div>${LEVEL_NAMES[row.level] || 'Level ' + row.level} · ${esc(label)}${incomplete}</div>
              <div class="recent-row-when">${esc(timeAgo(row.updated_at))}</div>
            </div>
            <div class="recent-score ${cls}">${row.score}/${row.total}</div>
          </div>`;
      })
      .join('');

    body.innerHTML = `
      <div class="helper-detail-head">
        <h3>${esc(name)}</h3>
        <p>Connected since ${esc(shortDate(r.connected_at))} · Last practised ${esc(timeAgo(r.learner && r.learner.last_seen_at))}</p>
      </div>

      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-num">${totals.attempts || 0}</div>
          <div class="detail-stat-lbl">Attempts</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-num">${totals.totalScore || 0}</div>
          <div class="detail-stat-lbl">Right</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-num">${pct}%</div>
          <div class="detail-stat-lbl">Correct</div>
        </div>
      </div>

      ${levels ? `<div class="helper-levels" style="margin-top:0;margin-bottom:18px">${levels}</div>` : ''}

      <div class="recent-title">Recent practice</div>
      ${recent ? `<div class="recent-list">${recent}</div>` : '<p class="modal-hint">No quiz attempts yet.</p>'}

      <div class="modal-actions" style="margin-top:20px">
        <button type="button" class="btn btn-outline" onclick="closeHelper()">Close</button>
      </div>`;
  } catch (err) {
    body.innerHTML = `<p class="form-error">${esc(err.message)}</p>
      <div class="modal-actions"><button type="button" class="btn btn-outline" onclick="closeHelper()">Close</button></div>`;
  }
}

function closeHelper(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('helper-modal').classList.remove('show');
}

// ---- Invitations -----------------------------------------------------------

function renderInvites() {
  const wrap = document.getElementById('invites-list');
  const list = PORTAL.invites;

  if (!list.length) {
    wrap.innerHTML = `
      <div class="portal-empty">
        <div class="portal-empty-icon">✉️</div>
        <p>No invitations yet.</p>
      </div>`;
    return;
  }

  wrap.innerHTML = list
    .map((inv) => {
      const title = inv.helper_label ? esc(inv.helper_label) : 'Untitled invite';
      const canRevoke = inv.status === 'pending';
      const meta =
        inv.status === 'accepted'
          ? `Accepted ${esc(timeAgo(inv.accepted_at))}`
          : inv.status === 'expired'
            ? `Expired ${esc(shortDate(inv.expires_at))}`
            : inv.status === 'revoked'
              ? 'Cancelled'
              : `Expires ${esc(shortDate(inv.expires_at))}`;

      return `
        <div class="invite-card">
          <div class="invite-card-body">
            <div class="invite-card-title">
              ${title}
              <span class="status-chip status-${esc(inv.status)}">${esc(inv.status)}</span>
            </div>
            <div class="invite-card-meta">
              Code <span class="code-pill">${esc(inv.code)}</span> · ${meta}
            </div>
          </div>
          <div class="invite-card-actions">
            ${
              canRevoke
                ? `<button class="btn btn-outline btn-sm" onclick="revokeInvite(${inv.id})">Cancel</button>`
                : ''
            }
          </div>
        </div>`;
    })
    .join('');
}

function openInviteForm() {
  document.getElementById('invite-modal').classList.add('show');
  document.getElementById('inv-error').textContent = '';
  setTimeout(() => document.getElementById('inv-label').focus(), 50);
}

function closeInviteForm(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('invite-modal').classList.remove('show');
}

async function submitInvite(e) {
  e.preventDefault();
  const errEl = document.getElementById('inv-error');
  errEl.textContent = '';
  const helper_label = document.getElementById('inv-label').value.trim();
  const note = document.getElementById('inv-note').value.trim();

  try {
    const inv = await apiPost('/api/employer/invitations', { helper_label, note });
    // Build the link from the origin here. The server returns a path only, so
    // it never has to know which host it is being served from.
    PORTAL.created = { link: location.origin + inv.path, code: inv.code };

    document.getElementById('inv-label').value = '';
    document.getElementById('inv-note').value = '';
    closeInviteForm();

    document.getElementById('created-link').value = PORTAL.created.link;
    document.getElementById('created-code').textContent = PORTAL.created.code;
    document.getElementById('created-modal').classList.add('show');

    await loadPortal();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function closeCreated(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('created-modal').classList.remove('show');
}

async function copyCreated() {
  if (!PORTAL.created) return;
  const text = PORTAL.created.link;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Link copied');
  } catch {
    // Clipboard API needs a secure context; fall back to selecting the field.
    const input = document.getElementById('created-link');
    input.focus();
    input.select();
    try {
      document.execCommand('copy');
      showToast('Link copied');
    } catch {
      showToast('Copy the link above');
    }
  }
}

async function revokeInvite(id) {
  if (!confirm('Cancel this invitation? The link will stop working.')) return;
  try {
    await apiDelete(`/api/employer/invitations/${id}`);
    showToast('Invitation cancelled');
    await loadPortal();
  } catch (err) {
    alert('Could not cancel: ' + err.message);
  }
}

// ---- Password reset (/reset?token=…) ---------------------------------------
//
// The reset link is minted by the operator (there is no mail provider) and
// handed to the account holder. Opening it lands here, on the portal, because
// resetting a password is an account action — not something a helper does.

const RESET_TOKEN = new URLSearchParams(location.search).get('token');

function showResetCard() {
  document.getElementById('portal-auth').classList.remove('active');
  document.getElementById('portal-dash').classList.remove('active');
  document.getElementById('portal-reset').classList.add('active');
}

async function submitReset(e) {
  e.preventDefault();
  const errEl = document.getElementById('reset-error');
  errEl.textContent = '';

  const p1 = document.getElementById('reset-pass').value;
  const p2 = document.getElementById('reset-pass2').value;
  if (p1 !== p2) {
    errEl.textContent = 'The two passwords do not match.';
    return;
  }

  const submit = document.getElementById('reset-submit');
  submit.disabled = true;
  try {
    await apiPost('/api/auth/password/reset', { token: RESET_TOKEN, password: p1 });
    showToast('Password updated');
    setTimeout(() => { location.href = '/portal'; }, 900);
  } catch (err) {
    errEl.textContent = err.message;
    submit.disabled = false;
  }
}

// ---- Init ------------------------------------------------------------------

setAuthMode('login');
if (RESET_TOKEN) {
  showResetCard();
} else {
  checkSession();
}
