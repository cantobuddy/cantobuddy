/* =============================================================================
   CantoBuddy  —  Admin Dashboard Logic
   ============================================================================= */

const ADMIN = {
  categories: [],
  vocabulary: [],
  stats: null,
  people: null,
  report: null,
  reportDays: 30,
  // Which practice count the daily practice-vs-quiz chart plots. Both are in
  // the report payload already, so switching is a redraw, not a refetch.
  practiceMetric: 'words_viewed',
  feedback: null,
  feedbackFilter: '',
  posts: [],
  postsFilter: '',
  newsCategory: '',
  // Community stories. The queue opens on 'pending', not on everything: this is
  // the one tab whose default view is a to-do list, because a story that is
  // never approved is a story nobody ever reads.
  stories: null,
  storyFilter: 'pending',
};

// ---- API helpers -----------------------------------------------------------

async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${url}: ${r.status}`);
  return r.json();
}

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `API ${url}: ${r.status}`);
  }
  return r.json();
}

async function apiPut(url, body) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `API ${url}: ${r.status}`);
  }
  return r.json();
}

async function apiPatch(url, body) {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `API ${url}: ${r.status}`);
  }
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `API ${url}: ${r.status}`);
  }
  return r.json();
}

// ---- Auth ------------------------------------------------------------------

async function adminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  try {
    const res = await apiPost('/api/auth/login', { username, password });
    if (res.ok) {
      document.getElementById('admin-login').classList.remove('active');
      document.getElementById('admin-dash').classList.add('active');
      document.getElementById('logout-btn').style.display = '';
      await loadAdminData();
    }
  } catch (err) {
    errEl.textContent = 'Invalid username or password.';
  }
}

async function adminLogout() {
  await apiPost('/api/auth/logout', {});
  location.reload();
}

async function checkAdminSession() {
  try {
    const res = await apiGet('/api/auth/check');
    if (res.isAdmin) {
      document.getElementById('admin-login').classList.remove('active');
      document.getElementById('admin-dash').classList.add('active');
      document.getElementById('logout-btn').style.display = '';
      await loadAdminData();
    }
  } catch {
    /* not logged in — fine */
  }
}

// ---- Tab switching ---------------------------------------------------------

function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.admin-tab-content').forEach((c) => {
    c.classList.toggle('active', c.id === 'tab-' + tab);
  });
  if (tab === 'push') renderAdminPush();
}

// ---- Push notifications -----------------------------------------------------
// Browser push to opted-in learners. Summary + two sender actions, all hitting
// the admin push routes in server.js. Auth is the same session cookie the rest
// of the admin uses.
async function renderAdminPush() {
  const sum = document.getElementById('admin-push-summary');
  if (!sum) return;
  try {
    const s = await apiGet('/api/admin/push/stats');
    if (!s.enabled) {
      sum.innerHTML = 'Push is <strong>not configured</strong> on the server (no VAPID keys). ' +
        'Set <code>VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code> and restart to enable.';
      return;
    }
    sum.innerHTML = `<strong>${s.count}</strong> device${s.count === 1 ? '' : 's'} subscribed to notifications.`;
    if (s.keyPairMatches === false) {
      sum.innerHTML += ' <strong style="color:#c1121f">⚠ VAPID public and private keys do not match</strong> — every send will fail with 401/403. Regenerate a matching pair (tools/gen-vapid.cjs) and redeploy.';
    }
    document.getElementById('push-send-result').textContent = '';
    document.getElementById('push-remind-result').textContent = '';
  } catch (e) {
    sum.textContent = 'Could not load push stats: ' + e.message;
  }
}

async function adminSendPush() {
  const title = (document.getElementById('push-title').value || '').trim();
  const err = document.getElementById('push-send-error');
  const res = document.getElementById('push-send-result');
  err.textContent = '';
  res.textContent = 'Sending…';
  if (!title) { err.textContent = 'A title is required.'; res.textContent = ''; return; }
  const body = (document.getElementById('push-body').value || '').trim();
  const url = (document.getElementById('push-url').value || '').trim() || '/';
  const tag = (document.getElementById('push-tag').value || '').trim() || 'admin';
  try {
    const r = await apiPost('/api/admin/push/send', { title, body, url, tag });
    if (r.disabled) { res.textContent = 'Push is disabled on the server.'; return; }
    if (r.noSubs) { res.textContent = 'No subscribers yet — nothing to send.'; return; }
    let msg = `Sent ${r.sent != null ? r.sent : 0}, failed ${r.failed != null ? r.failed : 0}, expired/removed ${r.expired != null ? r.expired : 0}.`;
    // If anything failed, say WHY — a 403 usually means the subscription was
    // created with a different VAPID key than the server is signing with.
    const firstFail = (r.results || []).find((x) => !x.expired);
    if (firstFail) {
      if (firstFail.status) msg += ` First error: HTTP ${firstFail.status}${firstFail.detail ? ' — ' + firstFail.detail : ''}`;
      else if (firstFail.error) msg += ` First error: ${firstFail.error}`;
      else if (firstFail.reason) msg += ` First error: ${firstFail.reason}`;
    }
    res.textContent = msg;
  } catch (e) {
    res.textContent = '';
    err.textContent = e.message;
  }
}

/** Turn a sweep summary into one line the operator can read. */
function reminderSummary(r) {
  if (r.disabled) return 'Push is disabled on the server.';
  if (r.dryRun || r.sent === 0 && r.claimed === 0) {
    const n = (r.planned || []).length;
    return n
      ? `${n} device(s) would be sent to this evening.`
      : 'Nothing to send right now — no device is due a message.';
  }
  const parts = [`Sent ${r.sent}`];
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.expired) parts.push(`${r.expired} gone`);
  return parts.join(' · ');
}

/** Show what the ladder would say tonight, without sending anything. */
async function adminPreviewReminders() {
  const res = document.getElementById('push-remind-result');
  const plan = document.getElementById('push-remind-plan');
  res.textContent = 'Checking…';
  plan.style.display = 'none';
  try {
    const r = await apiPost('/api/admin/push/reminders', { dryRun: true });
    res.textContent = reminderSummary(r);
    const lines = (r.planned || []).map((p) => `• [${p.kind}/${p.lang}] ${p.title}`);
    if (lines.length) {
      plan.textContent = lines.join('\n');
      plan.style.display = 'block';
    }
  } catch (e) {
    res.textContent = 'Error: ' + e.message;
  }
}

async function adminSendReminders() {
  const res = document.getElementById('push-remind-result');
  const plan = document.getElementById('push-remind-plan');
  res.textContent = 'Sending…';
  plan.style.display = 'none';
  try {
    const r = await apiPost('/api/admin/push/reminders', {});
    res.textContent = reminderSummary(r);
  } catch (e) {
    res.textContent = 'Error: ' + e.message;
  }
}

// ---- Load data --------------------------------------------------------------

async function loadAdminData() {
  try {
    const [vocab, cats] = await Promise.all([
      apiGet('/api/vocabulary'),
      apiGet('/api/categories'),
    ]);
    ADMIN.vocabulary = vocab;
    ADMIN.categories = cats;

    renderAdminVocab();
    renderAdminCategories();
    renderAdminStats();
    renderAdminPeople();
    renderAdminReport();
    renderAdminFeedback();
    renderAdminPosts();
    renderAdminStories();

    // Populate category select in vocab form
    const sel = document.getElementById('vf-category');
    sel.innerHTML = cats.map((c) => `<option value="${c.id}">${c.icon} ${c.name_en}</option>`).join('');
  } catch (err) {
    console.error('Admin load error:', err);
  }
}

// ---- Vocabulary management -------------------------------------------------

function renderAdminVocab() {
  const wrap = document.getElementById('admin-vocab-list');
  const levelFilter = document.getElementById('admin-filter-level').value;
  const search = document.getElementById('admin-search').value.toLowerCase().trim();

  let items = ADMIN.vocabulary;
  if (levelFilter !== '0') items = items.filter((v) => v.level === Number(levelFilter));
  if (search) {
    items = items.filter(
      (v) =>
        v.cantonese.toLowerCase().includes(search) ||
        v.english.toLowerCase().includes(search) ||
        v.jyutping.toLowerCase().includes(search)
    );
  }

  if (items.length === 0) {
    wrap.innerHTML = '<div class="progress-empty">No vocabulary found.</div>';
    return;
  }

  const levelNames = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

  wrap.innerHTML = items
    .map((v) => {
      const cat = ADMIN.categories.find((c) => c.id === v.category_id);
      return `
      <div class="admin-vocab-row">
        <div class="admin-vocab-emoji">${v.emoji || '📝'}</div>
        <div class="admin-vocab-body">
          <div class="admin-vocab-yue">${v.cantonese}</div>
          <div class="admin-vocab-en">${v.english} · ${v.jyutping}</div>
          <div class="admin-vocab-meta">
            <span class="admin-vocab-tag tag-${v.level}">${levelNames[v.level]}</span>
            <span class="admin-vocab-tag">${cat ? cat.icon + ' ' + cat.name_en : '—'}</span>
          </div>
        </div>
        <div class="admin-vocab-actions">
          <button class="edit-btn" title="Edit" onclick="openVocabForm(${v.id})">✏️</button>
          <button class="del-btn" title="Delete" onclick="deleteVocab(${v.id})">🗑️</button>
        </div>
      </div>`;
    })
    .join('');
}

// ---- Vocab form (add/edit) -------------------------------------------------

function openVocabForm(id) {
  const modal = document.getElementById('vocab-form-modal');
  const title = document.getElementById('vocab-form-title');
  const form = modal.querySelector('form');

  form.reset();
  document.getElementById('vf-id').value = '';

  if (id) {
    // Edit mode
    const v = ADMIN.vocabulary.find((x) => x.id === id);
    if (!v) return;
    title.textContent = 'Edit Vocabulary';
    document.getElementById('vf-id').value = v.id;
    document.getElementById('vf-cantonese').value = v.cantonese;
    document.getElementById('vf-jyutping').value = v.jyutping;
    document.getElementById('vf-english').value = v.english;
    document.getElementById('vf-tagalog').value = v.tagalog || '';
    document.getElementById('vf-mandarin').value = v.mandarin || '';
    document.getElementById('vf-indonesian').value = v.indonesian || '';
    document.getElementById('vf-emoji').value = v.emoji || '';
    document.getElementById('vf-level').value = v.level;
    document.getElementById('vf-category').value = v.category_id;
  } else {
    title.textContent = 'Add Vocabulary';
  }

  modal.classList.add('show');
}

function closeVocabForm(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('vocab-form-modal').classList.remove('show');
}

async function submitVocabForm(e) {
  e.preventDefault();

  const id = document.getElementById('vf-id').value;
  const body = {
    cantonese: document.getElementById('vf-cantonese').value.trim(),
    jyutping: document.getElementById('vf-jyutping').value.trim(),
    english: document.getElementById('vf-english').value.trim(),
    tagalog: document.getElementById('vf-tagalog').value.trim(),
    mandarin: document.getElementById('vf-mandarin').value.trim(),
    indonesian: document.getElementById('vf-indonesian').value.trim(),
    emoji: document.getElementById('vf-emoji').value.trim() || '📝',
    level: document.getElementById('vf-level').value,
    category_id: document.getElementById('vf-category').value,
  };

  try {
    if (id) {
      await apiPut(`/api/vocabulary/${id}`, body);
    } else {
      await apiPost('/api/vocabulary', body);
    }
    closeVocabForm();
    await loadAdminData();
  } catch (err) {
    alert('Error saving: ' + err.message);
  }
}

async function deleteVocab(id) {
  if (!confirm('Delete this vocabulary entry?')) return;
  try {
    await apiDelete(`/api/vocabulary/${id}`);
    await loadAdminData();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }
}

// ---- Category management ---------------------------------------------------

/**
 * Categories as a single-column listing rather than a tile grid.
 *
 * The grid looked tidy and told the operator nothing: each category got a large
 * tile carrying its name and nothing else. The one number that matters — does
 * this category have enough words to be usable — was nowhere on the screen, so
 * the only way to find a category a learner would bounce off was to open it.
 *
 * Each row now carries the total, the per-level split flagged against the same
 * threshold the quiz engine uses, and a switch that takes the category out of the
 * app without deleting anything.
 *
 * The summary counts only the categories that are switched ON, because those are
 * the ones a learner can actually reach. A total that included hidden categories
 * would be a number about the database rather than about the product.
 */
function renderAdminCategories() {
  const wrap = document.getElementById('admin-cat-list');
  const summaryEl = document.getElementById('admin-cat-summary');

  if (ADMIN.categories.length === 0) {
    wrap.innerHTML = '<div class="progress-empty">No categories yet.</div>';
    if (summaryEl) summaryEl.textContent = '';
    return;
  }

  // Counts are derived from the vocabulary the admin already holds, so this
  // needs no extra request and cannot drift from what the app serves.
  const counts = new Map();
  for (const v of ADMIN.vocabulary) {
    const c = counts.get(v.category_id) || { total: 0, levels: { 1: 0, 2: 0, 3: 0 } };
    c.total += 1;
    if (c.levels[v.level] != null) c.levels[v.level] += 1;
    counts.set(v.category_id, c);
  }

  const last = ADMIN.categories.length - 1;
  let quizReady = 0;
  let liveWords = 0;

  wrap.innerHTML = ADMIN.categories
    .map((c, i) => {
      const n = counts.get(c.id) || { total: 0, levels: { 1: 0, 2: 0, 3: 0 } };
      // SQLite hands back 0/1, and a column added by migration on an existing
      // row could in principle be null — treat anything not truthy as off.
      const on = !!c.enabled;
      if (on) liveWords += n.total;

      const chips = [1, 2, 3]
        .map((lvl) => {
          const k = n.levels[lvl];
          // The quiz engine returns nothing below QUIZ_MIN words, so 0 and 1-3
          // are both unusable — just differently bad.
          const state = k === 0 ? 'empty' : k < QUIZ_MIN ? 'low' : 'ok';
          if (on && state === 'ok') quizReady += 1;
          const label = k === 0 ? 'no words' : `${k} word${k === 1 ? '' : 's'}`;
          return `<span class="cat-level lv-${state}" title="${ADMIN_LEVELS[lvl]} — ${label}">L${lvl} <b>${k}</b></span>`;
        })
        .join('');

      const alt = [c.name_yue, c.name_fil, c.name_zh].filter(Boolean).map(escapeHtml).join(' · ');

      return `
      <div class="admin-cat-row${on ? '' : ' is-off'}">
        <div class="admin-cat-order">${i + 1}</div>
        <div class="admin-cat-icon">${escapeHtml(c.icon || '📁')}</div>
        <div class="admin-cat-body">
          <div class="admin-cat-name">${escapeHtml(c.name_en)}${
            on ? '' : '<span class="cat-off-badge">switched off</span>'
          }</div>
          <div class="admin-cat-name-yue">${alt || '<span class="admin-cat-none">no Cantonese, Filipino or Chinese name</span>'}</div>
        </div>
        <div class="admin-cat-coverage">${chips}</div>
        <div class="admin-cat-total">${n.total}<span> word${n.total === 1 ? '' : 's'}</span></div>
        <button class="cat-switch${on ? ' is-on' : ''}" role="switch" aria-checked="${on}"
          title="${on ? 'Switched on — learners can see this and it feeds quizzes' : 'Switched off — hidden from learners and excluded from quizzes'}"
          onclick="toggleCategory(${c.id})">${on ? 'On' : 'Off'}</button>
        <div class="admin-cat-actions">
          <button class="move-btn" title="Move up" ${i === 0 ? 'disabled' : ''} onclick="moveCategory(${c.id}, -1)">↑</button>
          <button class="move-btn" title="Move down" ${i === last ? 'disabled' : ''} onclick="moveCategory(${c.id}, 1)">↓</button>
          <button class="edit-btn" title="Edit" onclick="openCategoryForm(${c.id})">✏️</button>
          <button class="del-btn" title="Delete" onclick="deleteCategory(${c.id})">🗑️</button>
        </div>
      </div>`;
    })
    .join('');

  if (summaryEl) {
    const onCount = ADMIN.categories.filter((c) => c.enabled).length;
    const offCount = ADMIN.categories.length - onCount;
    summaryEl.innerHTML =
      `<b>${liveWords}</b> words across <b>${onCount}</b> categories · ` +
      `<b>${quizReady}</b> of <b>${onCount * 3}</b> category-and-level combinations can produce a quiz ` +
      `(a quiz needs ${QUIZ_MIN} words)` +
      (offCount ? ` · <b>${offCount}</b> switched off` : '');
  }
}

/**
 * Switch a category on or off.
 *
 * Switching off is not destructive — the words stay, and so does any progress
 * already earned against them — but it does remove the category from the app and
 * from the quiz pool, which is a real change for whoever is using it. So it asks
 * first, and it says what will happen rather than "are you sure?".
 */
async function toggleCategory(id) {
  const cat = ADMIN.categories.find((c) => c.id === id);
  if (!cat) return;
  const turningOff = !!cat.enabled;

  if (turningOff) {
    const n = ADMIN.vocabulary.filter((v) => v.category_id === id).length;
    const words = n === 0
      ? 'It has no words yet.'
      : `Its ${n} word${n === 1 ? '' : 's'} will be hidden from learners and removed from quizzes.`;
    if (!confirm(`Switch off "${cat.name_en}"?\n\n${words}\n\nNothing is deleted — you can switch it back on.`)) {
      return;
    }
  }

  try {
    await apiPut(`/api/categories/${id}`, { enabled: turningOff ? 0 : 1 });
    await loadAdminData();
  } catch (err) {
    alert('Could not change that category: ' + err.message);
  }
}

/**
 * Move a category one position up (-1) or down (+1) and persist the new order.
 * The order set here is the order learners see in the app.
 */
async function moveCategory(id, direction) {
  const idx = ADMIN.categories.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const target = idx + direction;
  if (target < 0 || target >= ADMIN.categories.length) return;

  const ids = ADMIN.categories.map((c) => c.id);
  [ids[idx], ids[target]] = [ids[target], ids[idx]];

  try {
    await apiPut('/api/categories/reorder', { order: ids });
    await loadAdminData();
  } catch (err) {
    alert('Error reordering: ' + err.message);
  }
}

function openCategoryForm(id) {
  const modal = document.getElementById('cat-form-modal');
  const title = document.getElementById('cat-form-title');
  const form = modal.querySelector('form');
  form.reset();
  document.getElementById('cf-id').value = '';

  if (id) {
    const c = ADMIN.categories.find((x) => x.id === id);
    if (!c) return;
    title.textContent = 'Edit Category';
    document.getElementById('cf-id').value = c.id;
    document.getElementById('cf-name-en').value = c.name_en;
    document.getElementById('cf-name-yue').value = c.name_yue || '';
    document.getElementById('cf-name-fil').value = c.name_fil || '';
    document.getElementById('cf-name-zh').value = c.name_zh || '';
    document.getElementById('cf-name-id').value = c.name_id || '';
    document.getElementById('cf-icon').value = c.icon || '';
  } else {
    title.textContent = 'Add Category';
  }

  modal.classList.add('show');
}

function closeCatForm(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('cat-form-modal').classList.remove('show');
}

async function submitCatForm(e) {
  e.preventDefault();
  const id = document.getElementById('cf-id').value;
  const body = {
    name_en: document.getElementById('cf-name-en').value.trim(),
    name_yue: document.getElementById('cf-name-yue').value.trim(),
    name_fil: document.getElementById('cf-name-fil').value.trim(),
    name_zh: document.getElementById('cf-name-zh').value.trim(),
    name_id: document.getElementById('cf-name-id').value.trim(),
    icon: document.getElementById('cf-icon').value.trim() || '📁',
  };

  try {
    if (id) {
      await apiPut(`/api/categories/${id}`, body);
    } else {
      await apiPost('/api/categories', body);
    }
    closeCatForm();
    await loadAdminData();
  } catch (err) {
    alert('Error saving: ' + err.message);
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? Vocabulary in it will remain but be uncategorised.')) return;
  try {
    await apiDelete(`/api/categories/${id}`);
    await loadAdminData();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }
}

// ---- Stats / progress -----------------------------------------------------

async function renderAdminStats() {
  const wrap = document.getElementById('admin-stats');
  try {
    const stats = await apiGet('/api/stats');
    ADMIN.stats = stats;

    let html = `
      <div class="stat-card">
        <h4>Total Vocabulary</h4>
        <div class="stat-number">${stats.totalVocabulary}</div>
      </div>
      <div class="stat-card">
        <h4>Categories</h4>
        <div class="stat-number">${stats.totalCategories}</div>
      </div>
      <div class="stat-card">
        <h4>Quiz Attempts</h4>
        <div class="stat-number">${stats.totalQuizAttempts}</div>
        ${stats.totalPartialAttempts ? `<div style="font-size:0.72rem;color:#8a5a00;font-weight:600">${stats.totalPartialAttempts} incomplete</div>` : ''}
      </div>
    `;

    if (stats.learners.length === 0) {
      html += '<div class="progress-empty" style="grid-column:1/-1">No learner activity yet.</div>';
    } else {
      for (const l of stats.learners) {
        const pct = l.totalMax > 0 ? Math.round((l.totalScore / l.totalMax) * 100) : 0;
        const levelNames = { 1: '🌱 Beginner', 2: '🌿 Intermediate', 3: '🌳 Advanced' };
        html += `
          <div class="learner-stat" style="grid-column:1/-1">
            <div class="learner-stat-name">👤 ${l.learner}</div>
            <div style="font-size:0.85rem;color:#6c757d">${l.attempts} quiz attempt(s)${l.partialAttempts ? ` · <span style="color:#8a5a00;font-weight:600">${l.partialAttempts} incomplete</span>` : ''} · ${l.totalScore}/${l.totalMax} correct (${pct}%)</div>
            <div class="learner-stat-level">
        `;
        for (const lvl of [1, 2, 3]) {
          const d = l.byLevel[lvl];
          if (d) {
            const lpct = d.max > 0 ? Math.round((d.score / d.max) * 100) : 0;
            html += `<span>${levelNames[lvl]}: ${d.score}/${d.max} (${lpct}%)</span>`;
          }
        }
        html += '</div></div>';
      }
    }

    html += '</div>';
    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = '<div class="progress-empty">Could not load stats.</div>';
  }
}

// ---- People: employers, their helpers, and learners with no employer --------
//
// Read-only. The operator runs the service but is not a party to the consent
// relationship, so this screen shows who is connected to whom and nothing more
// — there is deliberately no way to create or break a link from here.

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A transient confirmation. The admin shell has no toast element, so make one. */
function adminToast(msg) {
  let el = document.getElementById('admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    el.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'background:rgba(28,28,30,.92);color:#fff;padding:10px 16px;border-radius:8px;' +
      'font-size:14px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

function pct(score, max) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

const ADMIN_LEVELS = { 1: '🌱 Beginner', 2: '🌿 Intermediate', 3: '🌳 Advanced' };

/**
 * The fewest words the quiz engine will build a question set from — it is
 * `if (pool.length < 4) return []` in app.js. Kept here as a named constant so
 * the coverage flags on the Categories tab mean the same thing the learner
 * experiences, rather than a number someone guessed.
 */
const QUIZ_MIN = 4;

function levelChips(byLevel) {
  const parts = [];
  for (const lvl of [1, 2, 3]) {
    const d = byLevel && byLevel[lvl];
    if (!d) continue;
    parts.push(`<span>${ADMIN_LEVELS[lvl]}: ${d.score}/${d.max} (${pct(d.score, d.max)}%)</span>`);
  }
  return parts.length ? `<div class="learner-stat-level">${parts.join('')}</div>` : '';
}

/** "3 attempt(s) · 1 incomplete · 42/60 correct (70%)" */
function learnerLine(summary) {
  const s = summary || {};
  const bits = [`${s.attempts || 0} attempt(s)`];
  if (s.partialAttempts) bits.push(`<span class="stat-warn">${s.partialAttempts} incomplete</span>`);
  bits.push(`${s.totalScore || 0}/${s.totalMax || 0} correct (${pct(s.totalScore, s.totalMax)}%)`);
  return bits.join(' · ');
}

function employerCard(e) {
  const meta = [
    `joined ${fmtDate(e.created_at)}`,
    e.last_login_at ? `last login ${fmtDate(e.last_login_at)}` : 'never signed in',
    `${e.invitations_sent} invitation(s)${e.invitations_pending ? ` · ${e.invitations_pending} pending` : ''}`,
    `${e.device_count || 0} trusted device(s)`,
  ];
  if (e.disconnected_count) meta.push(`${e.disconnected_count} disconnected`);

  const helpers = e.helpers.length
    ? e.helpers.map((h) => `
        <div class="helper-row">
          <div class="helper-name">👤 ${escapeHtml(h.display_name || 'Unnamed helper')}</div>
          <div class="helper-meta">connected ${fmtDate(h.connected_at)} · last active ${fmtDate(h.last_seen_at)}</div>
          <div class="helper-stats">${learnerLine(h.summary)}</div>
          ${levelChips(h.summary && h.summary.byLevel)}
        </div>`).join('')
    : '<div class="helper-none">No helpers connected yet.</div>';

  const deviceChip = e.reauth_open
    ? ' <span class="status-chip status-accepted">pairing open</span>'
    : '';

  return `
    <div class="employer-card">
      <div class="employer-head">
        <div>
          <div class="employer-name">🏠 ${escapeHtml(e.name)}</div>
          <div class="employer-email">${escapeHtml(e.email || e.username)}</div>
        </div>
        <div class="employer-count">${e.helper_count} helper(s)</div>
      </div>
      <div class="employer-meta">${meta.join(' · ')}${deviceChip}</div>
      <div class="employer-actions">
        <button class="btn btn-outline btn-sm" onclick="openDeviceReauth(${e.id})">Allow new device</button>
      </div>
      ${helpers}
    </div>`;
}

/**
 * Open a 15-minute pairing window so an employer who forgot their device (or
 * switched phones) can sign in by name alone on the new device and have it
 * linked. This is the only recovery that needs the employer to remember nothing,
 * and it is deliberately an operator action rather than self-service.
 */
async function openDeviceReauth(employerId) {
  if (!confirm(
    'Open a 15-minute window so this employer can sign in on a new device?\n\n' +
    'They will sign in with their name on that device; no code needed. The window closes as soon as they do.'
  )) return;
  try {
    await apiPost(`/api/admin/employers/${employerId}/open-device-reauth`, { minutes: 15 });
    adminToast('Pairing window open — ask them to sign in now');
    await renderAdminPeople();
  } catch (err) {
    alert('Could not open pairing: ' + (err.message || 'error'));
  }
}

async function renderAdminPeople() {
  const summaryEl = document.getElementById('admin-people-summary');
  const empEl = document.getElementById('admin-employers');
  const unEl = document.getElementById('admin-unconnected');
  if (!empEl) return;

  empEl.innerHTML = '<div class="progress-empty">Loading…</div>';
  unEl.innerHTML = '';

  try {
    const data = await apiGet('/api/admin/people');
    ADMIN.people = data;
    const t = data.totals;

    summaryEl.innerHTML = `
      <div class="stat-card">
        <h4>Employers</h4>
        <div class="stat-number">${t.employers}</div>
        <div class="stat-label">${t.employersWithHelpers} with helpers</div>
      </div>
      <div class="stat-card">
        <h4>Helpers connected</h4>
        <div class="stat-number">${t.helpers}</div>
        <div class="stat-label">linked to an employer</div>
      </div>
      <div class="stat-card">
        <h4>No employer</h4>
        <div class="stat-number">${t.unconnected}</div>
        <div class="stat-label">using the app alone</div>
      </div>`;

    empEl.innerHTML = data.employers.length
      ? data.employers.map(employerCard).join('')
      : '<div class="progress-empty">No employer accounts yet.</div>';

    unEl.innerHTML = data.unconnected.length
      ? data.unconnected.map((l) => `
          <div class="learner-stat">
            <div class="learner-stat-name">👤 ${escapeHtml(l.display_name || 'Unnamed learner')}</div>
            <div class="learner-stat-sub">last active ${fmtDate(l.last_seen_at)} · ${learnerLine(l.summary)}</div>
            ${levelChips(l.summary && l.summary.byLevel)}
          </div>`).join('')
      : '<div class="progress-empty">Every learner is connected to an employer.</div>';
  } catch (err) {
    empEl.innerHTML = '<div class="progress-empty">Could not load the people overview.</div>';
    unEl.innerHTML = '';
  }
}

// ---- Statistics & reporting -------------------------------------------------
//
// Everything here reads /api/admin/report, which keys on the device identity.
// Two helpers who share a name are two people in every number on this tab.

function setReportDays(days) {
  ADMIN.reportDays = Number(days) || 30;
  document.querySelectorAll('#admin-report-range .chip').forEach((c) => {
    c.classList.toggle('active', Number(c.dataset.days) === ADMIN.reportDays);
  });
  renderAdminReport();
}

function setPracticeMetric(metric) {
  ADMIN.practiceMetric = metric === 'cards_opened' ? 'cards_opened' : 'words_viewed';
  document.querySelectorAll('#admin-practice-metric .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.metric === ADMIN.practiceMetric);
  });
  // Redraw from the report already in memory — no second round trip.
  renderPracticeChart((ADMIN.report && ADMIN.report.visitors) || {});
}

async function renderAdminReport() {
  const totalsEl = document.getElementById('admin-report-totals');
  const chartEl = document.getElementById('admin-report-chart');
  const notesEl = document.getElementById('admin-report-notes');
  const empEl = document.getElementById('admin-report-employers');
  const stampEl = document.getElementById('admin-report-stamp');
  const vTotalsEl = document.getElementById('admin-visitor-totals');
  const vChartEl = document.getElementById('admin-visitor-chart');
  const vNotesEl = document.getElementById('admin-visitor-notes');
  const pathsEl = document.getElementById('admin-top-paths');
  const gTotalsEl = document.getElementById('admin-games-totals');
  const gChartEl = document.getElementById('admin-games-chart');
  const gNotesEl = document.getElementById('admin-games-notes');
  const gTableEl = document.getElementById('admin-games-table');
  if (!totalsEl) return;

  chartEl.innerHTML = '<div class="progress-empty">Loading…</div>';
  empEl.innerHTML = '';
  notesEl.innerHTML = '';
  vChartEl.innerHTML = '<div class="progress-empty">Loading…</div>';
  vNotesEl.innerHTML = '';
  const pChartEl = document.getElementById('admin-practice-chart');
  const pNotesEl = document.getElementById('admin-practice-notes');
  if (pChartEl) pChartEl.innerHTML = '<div class="progress-empty">Loading…</div>';
  if (pNotesEl) pNotesEl.innerHTML = '';
  pathsEl.innerHTML = '';
  if (gTotalsEl) gTotalsEl.innerHTML = '';
  if (gChartEl) gChartEl.innerHTML = '<div class="progress-empty">Loading…</div>';
  if (gNotesEl) gNotesEl.innerHTML = '';
  if (gTableEl) gTableEl.innerHTML = '';

  try {
    const data = await apiGet(`/api/admin/report?days=${ADMIN.reportDays}`);
    ADMIN.report = data;
    const t = data.totals;
    const v = data.visitors || {};

    stampEl.textContent = `Generated ${new Date(data.generated_at).toLocaleString()}`;

    totalsEl.innerHTML = [
      reportCard('Learners', t.learners, `${t.helpers} connected to an employer`),
      reportCard('Active this week', t.activeThisWeek, `${t.newThisWeek} joined this week`),
      reportCard('Quiz attempts', t.attempts, `${t.completionRate}% finished`),
      reportCard('Correct answers', t.correctAnswers,
        `${t.accuracyRate}% of ${t.questionsAnswered} questions`),
      reportCard('Employers', t.employers, `${t.employersWithHelpers} with helpers`),
      reportCard('Stickers unlocked', t.stickersUnlocked,
        `${t.partialAttempts} quiz(zes) left unfinished`),
    ].join('');

    // --- visitors and practice.
    // Kept in their own grid rather than added to the six above, so the two
    // sets can be read separately: the cards above are all derived from
    // `progress`, and these are the ones that are not.
    vTotalsEl.innerHTML = [
      reportCard('Visitors', v.arrived, `${v.newVisitors} new in ${v.days} days`),
      reportCard('Practised', v.practisedCards, `${v.wordsViewed} words viewed`),
      reportCard('Quizzed', v.quizzed, `${v.quizzesStarted} started in ${v.days} days`),
      reportCard('Visited, did nothing', v.arrivedOnly, 'arrived but recorded no practice'),
      reportCard('Practice, no quiz', v.practiceOnlyLearners, 'invisible to the quiz reports'),
      reportCard('Landing page views', v.pageViews, `${v.visits} app visits`),
    ].join('');

    vChartEl.innerHTML = visitorChart(v.series);
    vNotesEl.innerHTML = visitorNotes(v);

    renderPracticeChart(v);

    pathsEl.innerHTML = (v.topPaths && v.topPaths.length)
      ? v.topPaths.map(topPathRow).join('')
      : '<div class="progress-empty">No landing-page views recorded yet.</div>';

    renderAdminGames(data.games);

    chartEl.innerHTML = trendChart(data.trends);
    notesEl.innerHTML = trendNotes(data.trends);

    empEl.innerHTML = data.employers.length
      ? data.employers.map(engagementRow).join('')
      : '<div class="progress-empty">No employer accounts yet.</div>';
  } catch (err) {
    chartEl.innerHTML = '<div class="progress-empty">Could not load the report.</div>';
    empEl.innerHTML = '';
  }
}

function reportCard(title, value, sub) {
  return `<div class="stat-card">
    <h4>${escapeHtml(title)}</h4>
    <div class="stat-number">${escapeHtml(String(value))}</div>
    <div class="stat-label">${escapeHtml(sub)}</div>
  </div>`;
}

// ---- Games -----------------------------------------------------------------
//
// Three questions the operator asks about games, and the honest answer to each:
//
//   how many people play     distinct devices with a finished game
//   alone or together        the `players` column, which is the table size
//   how long they stay       repeat play (games per device) and the app-wide
//                            session span — NOT a game timer, because there is
//                            no rooms table to time. The copy says so.
//
// The chart is grouped bars rather than one series per game, because the
// finding the operator is looking for is the split between playing alone and
// playing at a table, and that split is invisible in a total.

function renderAdminGames(g) {
  const totalsEl = document.getElementById('admin-games-totals');
  const chartEl = document.getElementById('admin-games-chart');
  const notesEl = document.getElementById('admin-games-notes');
  const tableEl = document.getElementById('admin-games-table');
  if (!totalsEl) return;

  ADMIN.games = g || null;

  if (!g || !g.gamesAllTime) {
    totalsEl.innerHTML = reportCard('Players', 0, 'no finished games recorded yet');
    chartEl.innerHTML = '<div class="progress-empty">No games recorded yet. This fills in as soon as someone finishes one.</div>';
    notesEl.innerHTML = '<div class="report-note">Nothing recorded yet. A row is written per player the moment a game finishes — win or lose, solo or at a table.</div>';
    tableEl.innerHTML = '';
    return;
  }

  const span = g.sessionSpan;
  const per = g.gamesPerPlayer;
  totalsEl.innerHTML = [
    reportCard('Players, all time', g.playersAllTime,
      `${g.playersThisPeriod} played in the last ${g.days} days`),
    reportCard('Games finished', g.gamesAllTime,
      `${g.soloGames} alone · ${g.groupGames} at a table`),
    reportCard('Playing alone', g.soloShare === null ? '—' : `${g.soloShare}%`,
      `${g.soloGames} of ${g.soloGames + g.groupGames} games`),
    reportCard('Games per player', per.median === null ? '—' : per.median,
      `median · ${per.cameBack} came back, ${per.playedOnce} played once`),
    reportCard('Session length', span.medianMinutes === null ? '—' : `${span.medianMinutes} min`,
      `median, whole app · ${span.sampleDays} days sampled`),
    reportCard('Credits earned', g.credits.devicesWithAny,
      `devices · ceiling ${g.credits.dailyCeiling}/day`),
  ].join('');

  chartEl.innerHTML = gamesChart(g.series);
  notesEl.innerHTML = gamesNotes(g);

  tableEl.innerHTML = g.byGame
    .filter((row) => row.played > 0)
    .map(gamesRow)
    .join('') || '<div class="progress-empty">No games finished in this period.</div>';
}

function gamesRow(row) {
  const label = GAME_LABELS[row.game] || row.game;
  // Games and player-results are different numbers for every table game, and
  // the row says both. The win rate is per player-result, so it reads "of the
  // times someone finished this, how often did she win" — never "how often did
  // the table produce a winner", which would be near-always 100%.
  const win = row.winRate === null ? '—' : `${row.winRate}% (${row.wins} of ${row.results})`;
  const mode = row.soloGames && row.groupGames
    ? `${row.soloGames} alone · ${row.groupGames} at a table`
    : row.groupGames
      ? `${row.groupGames} at a table (up to ${row.biggestTable})`
      : `${row.soloGames} alone`;
  return `<div class="learner-stat">
    <div class="learner-stat-name">🎮 ${escapeHtml(label)}</div>
    <div class="learner-stat-sub">
      ${row.played} game(s) · ${row.results} player-result(s) · ${row.players} player(s) · ${escapeHtml(win)} · ${escapeHtml(mode)}
    </div>
  </div>`;
}

const GAME_LABELS = {
  uno: 'UNO',
  bigtwo: 'Big Two',
  wordmatch: 'Word Match',
  sudoku: 'Sudoku',
};

/**
 * Alone vs at a table, one day at a time.
 *
 * Same geometry as the practice chart on purpose — the three charts on this tab
 * are one set, and a reader who has learned to read one should not have to
 * learn a second. The two series are stacked rather than side by side because
 * the question is "of the games that day, how many were company", and a stack
 * answers that with the total height.
 */
function gamesChart(series) {
  const s = (series || []).filter((d) => d.games > 0);
  if (!s.length) return '<div class="progress-empty">No games finished in this period.</div>';

  const W = 680, H = 200, PAD_L = 34, PAD_B = 22, PAD_T = 10;
  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_B - PAD_T;
  const max = Math.max(...s.map((d) => d.games), 1);
  const step = plotW / s.length;
  const barW = Math.max(2, Math.min(18, step - 3));

  const bars = s.map((d, i) => {
    const x = PAD_L + i * step + (step - barW) / 2;
    const totalH = (d.games / max) * plotH;
    const soloH = d.games ? (d.solo / d.games) * totalH : 0;
    const groupH = totalH - soloH;
    const yTotal = PAD_T + plotH - totalH;
    const ySolo = PAD_T + plotH - soloH;
    return `<rect x="${x.toFixed(1)}" y="${ySolo.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(soloH, d.solo ? 1 : 0).toFixed(1)}" fill="#2a9d8f"><title>${d.day}: ${d.solo} alone</title></rect>
      <rect x="${x.toFixed(1)}" y="${yTotal.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(groupH, d.grouped ? 1 : 0).toFixed(1)}" fill="#e76f51"><title>${d.day}: ${d.grouped} at a table</title></rect>`;
  }).join('');

  const ticks = [0, Math.round(max / 2), max].map((v) => {
    const y = PAD_T + plotH - (v / max) * plotH;
    return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - 8}" y2="${y.toFixed(1)}" stroke="var(--c-border)" stroke-width="1"/>
      <text x="${PAD_L - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--c-text-soft)">${v}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="report-svg" role="img" aria-label="Games finished per day, alone versus at a table" style="width:100%;height:auto">
    ${ticks}${bars}
    <line x1="${PAD_L}" y1="${PAD_T + plotH}" x2="${W - 8}" y2="${PAD_T + plotH}" stroke="var(--c-border)" stroke-width="1"/>
  </svg>
  <div class="report-legend">
    <span><i style="background:#2a9d8f"></i>played alone</span>
    <span><i style="background:#e76f51"></i>at a table</span>
  </div>`;
}

function gamesNotes(g) {
  const per = g.gamesPerPlayer;
  const span = g.sessionSpan;
  const notes = [
    `${g.playersAllTime} device(s) have finished a game; ${g.playersThisPeriod} in the last ${g.days} days.`,
  ];
  if (g.soloGames + g.groupGames) {
    notes.push(`${g.soloGames} finished alone and ${g.groupGames} at a table — ${g.soloShare}% of games were played solo.`);
  }
  if (per.cameBack) {
    notes.push(`${per.cameBack} came back for a second game; ${per.playedOnce} played exactly once. Median ${per.median} game(s) per player, most ${per.most}.`);
  } else if (per.playedOnce) {
    notes.push(`Every player so far has played exactly once — nobody has come back for a second game yet.`);
  }
  if (span.medianMinutes !== null) {
    notes.push(`Session length is the whole app, not a game: median ${span.medianMinutes} minutes between the first and last thing she did that day, over ${span.sampleDays} recorded day(s). There is no rooms table, so there is no game timer and this number should not be quoted as one.`);
  }
  const gameCredit = g.credits.byKind.game;
  if (gameCredit && gameCredit.events) {
    notes.push(`${gameCredit.devices} device(s) earned the game credit in this period (${gameCredit.events} credit(s) of ${g.credits.devicesWithAny} total). ${g.credits.deviceDaysAtCeiling} day(s) hit all ${g.credits.dailyCeiling} available credits.`);
  }
  return notes.map((n) => `<div class="report-note">${escapeHtml(n)}</div>`).join('');
}

/**
 * A bar chart of one value per day, drawn inline as SVG.
 *
 * No charting library: this app has no build step and no CDN dependency, and a
 * bar chart of at most 90 values does not need one. The SVG scales with its
 * container, so the same markup works at 320px and on a desktop.
 *
 * Days with no activity get a flat stub rather than nothing, because "she did
 * not practise that day" is the finding — a gap would read as missing data.
 *
 * Shared by the quiz trend and the visitor trend. They differ only in which
 * value they plot and what the tooltip says, and two copies of this geometry
 * would drift apart the first time one of them was adjusted.
 */
function svgDailyBars(series, { value, title, ariaLabel, color = '#52b788' }) {
  const max = Math.max(1, ...series.map(value));
  const W = 680;
  const H = 180;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slot = plotW / series.length;
  const barW = Math.max(2, Math.min(26, slot * 0.72));
  const base = padT + plotH;

  const bars = series.map((d, i) => {
    const x = padL + i * slot + (slot - barW) / 2;
    const tip = `<title>${escapeHtml(title(d))}</title>`;
    const v = value(d);
    if (!v) {
      return `<rect x="${x.toFixed(1)}" y="${(base - 2).toFixed(1)}" width="${barW.toFixed(1)}" height="2" rx="1" fill="#e9ecef">${tip}</rect>`;
    }
    const h = Math.max(3, Math.round((v / max) * plotH));
    return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h}" rx="2" fill="${color}">${tip}</rect>`;
  }).join('');

  // Three labels only — more would collide on a phone.
  const ticks = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])]
    .map((i) => {
      const x = padL + i * slot + slot / 2;
      return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6c757d">${escapeHtml(series[i].day.slice(5))}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="report-svg" role="img"
      aria-label="${escapeHtml(ariaLabel)}">
    <line x1="${padL}" y1="${base}" x2="${W - padR}" y2="${base}" stroke="#dee2e6" stroke-width="1"/>
    <text x="${padL}" y="${padT - 5}" font-size="11" fill="#6c757d">peak ${max} per day</text>
    ${bars}${ticks}
  </svg>`;
}

function trendChart(trends) {
  const series = (trends && trends.series) || [];
  if (!series.length) return '<div class="progress-empty">No activity in this period.</div>';
  return svgDailyBars(series, {
    value: (d) => d.attempts,
    title: (d) => `${d.day}: ${d.attempts} quiz(zes), ${d.learners} helper(s) active`,
    ariaLabel: `Daily quiz attempts over the last ${trends.days} days`,
  });
}

/**
 * Visitors per day — a different question from quiz attempts, and a different
 * colour so the two charts are never confused at a glance. Note this plots
 * VISITORS (distinct devices) rather than visits: the interesting shape is how
 * many separate people turned up, not how often one of them refreshed.
 */
function visitorChart(series) {
  const s = series || [];
  if (!s.length) return '<div class="progress-empty">No visitors in this period.</div>';
  return svgDailyBars(s, {
    value: (d) => d.visitors,
    title: (d) => `${d.day}: ${d.visitors} visitor(s), ${d.visits} visit(s), ${d.new_visitors} new`,
    ariaLabel: `Daily visitors over the last ${s.length} days`,
    color: '#f4a261',
  });
}

function visitorNotes(v) {
  if (!v || !v.arrived) {
    return '<div class="report-note">No visitors recorded yet. This fills in as soon as someone loads the app or a landing page.</div>';
  }
  const notes = [
    `${v.arrived} device(s) have visited in total; ${v.newVisitors} were new in the last ${v.days} days.`,
  ];
  if (v.arrivedOnly) {
    notes.push(`${v.arrivedOnly} arrived and recorded nothing further — a page load and no more.`);
  }
  if (v.practiceOnlyLearners) {
    notes.push(`${v.practiceOnlyLearners} studied the vocabulary without ever starting a quiz.`);
  } else {
    notes.push('Everyone who has practised has also started a quiz.');
  }
  if (v.wordsViewed) {
    notes.push(`${v.wordsViewed} words viewed and ${v.cardsOpened} cards opened in this period.`);
  }
  return notes.map((n) => `<div class="report-note">${escapeHtml(n)}</div>`).join('');
}

/**
 * Practising vs quizzing, one day at a time.
 *
 * A grouped bar chart: for each day, two bars — how much was studied, and how
 * many quizzes were started. The gap between them is the finding. A day with a
 * tall practice bar and no quiz bar is a learner reading the vocabulary and
 * never testing herself.
 *
 * Two series rather than one, so this cannot reuse svgDailyBars — that draws a
 * single value per day. The geometry below is deliberately the same (same
 * viewBox, same padding, same stub-for-zero rule) so the three charts on this
 * tab read as one set.
 *
 * Everything it plots is already in `v.series`, which db.js builds from
 * learner_daily. That rollup is per day and anonymous, so a bar can never be
 * traced to a learner — which is why this is a chart and the named list is an
 * export.
 */
function practiceChart(series) {
  const s = series || [];
  if (!s.length) return '<div class="progress-empty">No practice recorded in this period.</div>';

  const metric = ADMIN.practiceMetric === 'cards_opened' ? 'cards_opened' : 'words_viewed';
  const metricLabel = metric === 'cards_opened' ? 'card(s) opened' : 'word(s) viewed';

  const practice = s.map((d) => d[metric] || 0);
  const quizzes = s.map((d) => d.quizzes_started || 0);
  const max = Math.max(1, ...practice, ...quizzes);

  const W = 680;
  const H = 180;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slot = plotW / s.length;
  // Two bars per slot with a small gutter; never narrower than 1px each or a
  // 90-day view turns into a solid block.
  const pairW = Math.max(3, Math.min(28, slot * 0.78));
  const barW = Math.max(1, (pairW - 1) / 2);
  const base = padT + plotH;

  const bar = (d, i, value, fill, offset, label) => {
    const x = padL + i * slot + (slot - pairW) / 2 + offset;
    const tip = `<title>${escapeHtml(`${d.day}: ${value} ${label}`)}</title>`;
    if (!value) {
      return `<rect x="${x.toFixed(1)}" y="${(base - 2).toFixed(1)}" width="${barW.toFixed(1)}" height="2" rx="1" fill="#e9ecef">${tip}</rect>`;
    }
    const h = Math.max(3, Math.round((value / max) * plotH));
    return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h}" rx="2" fill="${fill}">${tip}</rect>`;
  };

  const bars = s.map((d, i) => (
    bar(d, i, d[metric] || 0, '#2a9d8f', 0, metricLabel)
    + bar(d, i, d.quizzes_started || 0, '#52b788', barW + 1, 'quiz(zes) started')
  )).join('');

  const ticks = [...new Set([0, Math.floor((s.length - 1) / 2), s.length - 1])]
    .map((i) => {
      const x = padL + i * slot + slot / 2;
      return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6c757d">${escapeHtml(s[i].day.slice(5))}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="report-svg" role="img"
      aria-label="Daily practice and quiz starts over the last ${s.length} days">
    <line x1="${padL}" y1="${base}" x2="${W - padR}" y2="${base}" stroke="#dee2e6" stroke-width="1"/>
    <text x="${padL}" y="${padT - 5}" font-size="11" fill="#6c757d">peak ${max} per day</text>
    ${bars}${ticks}
  </svg>`;
}

function practiceNotes(v) {
  const s = (v && v.series) || [];
  if (!s.length) return '';
  const days = s.length;
  const totalPractice = s.reduce((n, d) => n + (d.words_viewed || 0), 0);
  const totalCards = s.reduce((n, d) => n + (d.cards_opened || 0), 0);
  const totalQuizzes = s.reduce((n, d) => n + (d.quizzes_started || 0), 0);

  // The number the original list was really trying to convey, now over time.
  const practiceDays = s.filter((d) => (d.words_viewed || 0) + (d.cards_opened || 0) > 0).length;
  const quizDays = s.filter((d) => (d.quizzes_started || 0) > 0).length;
  const silentDays = practiceDays - quizDays;

  const notes = [
    `<strong>${totalPractice}</strong> words viewed and <strong>${totalCards}</strong> cards opened, against <strong>${totalQuizzes}</strong> quiz(zes) started, over ${days} days.`,
    `Studied on <strong>${practiceDays}</strong> of ${days} days; quizzed on <strong>${quizDays}</strong>.`,
  ];
  if (silentDays > 0) {
    notes.push(`${silentDays} day(s) had practice but no quiz at all.`);
  } else if (practiceDays > 0) {
    notes.push('Every day with practice also had a quiz.');
  }
  if (v.practiceOnlyLearners) {
    notes.push(`${v.practiceOnlyLearners} learner(s) have never started a quiz — named in the <em>Practice only</em> export below.`);
  } else {
    notes.push('Everyone who has practised has also started a quiz.');
  }
  return notes.map((n) => `<div class="report-note">${n}</div>`).join('');
}

function renderPracticeChart(v) {
  const chartEl = document.getElementById('admin-practice-chart');
  const notesEl = document.getElementById('admin-practice-notes');
  if (!chartEl) return;
  const series = (v && v.series) || [];
  chartEl.innerHTML = practiceChart(series);
  if (notesEl) notesEl.innerHTML = practiceNotes(v || {});
}

/** One landing page, by views. Path only — no visitor is attached to a path. */
function topPathRow(p) {
  return `<div class="learner-stat">
    <div class="learner-stat-name">🔗 ${escapeHtml(p.path)}</div>
    <div class="learner-stat-sub">${escapeHtml(`${p.views} view(s)`)}</div>
  </div>`;
}

function trendNotes(trends) {
  const series = (trends && trends.series) || [];
  if (!series.length) return '';
  const total = series.reduce((s, d) => s + d.attempts, 0);
  const activeDays = series.filter((d) => d.attempts > 0).length;
  const busiest = series.reduce((a, b) => (b.attempts > a.attempts ? b : a), series[0]);
  const avg = Math.round((total / series.length) * 10) / 10;

  return `<div class="report-note"><strong>${total}</strong> quiz(zes) over ${escapeHtml(String(trends.days))} days</div>
    <div class="report-note">Practised on <strong>${activeDays}</strong> of ${series.length} days · average <strong>${avg}</strong> per day</div>
    <div class="report-note">Busiest day: <strong>${escapeHtml(busiest.day)}</strong> (${busiest.attempts})</div>`;
}

function engagementRow(e) {
  const bits = [
    `${e.helper_count} helper(s)`,
    `${e.helpers_active_7d} active this week`,
    `${e.attempts} attempt(s)`,
    `${e.accuracy_rate}% correct`,
  ];
  return `<div class="learner-stat">
    <div class="learner-stat-name">🏠 ${escapeHtml(e.name)}</div>
    <div class="learner-stat-sub">${escapeHtml(e.email)} · ${bits.join(' · ')}</div>
    <div class="learner-stat-sub">joined ${fmtDate(e.created_at)} · ${e.last_login_at ? `last login ${fmtDate(e.last_login_at)}` : 'never signed in'} · last activity ${fmtDate(e.last_activity)}</div>
  </div>`;
}

// ---- Feedback ---------------------------------------------------------------
//
// What PROPOSAL.md specifies for Phase 5 and what proposal/prototype.html
// sketches: an inbox for the messages helpers and employers send from inside the
// app, with status tracking.
//
// THE ASYMMETRY ON SCREEN IS THE DESIGN, not a bug to be fixed. An employer's row
// carries her account, because she signed in to write it and expects an answer.
// A helper's row carries NOTHING — no id, no name, not even a device token (see
// createFeedback in db.js). She is a live-in worker whose employer can already see
// her progress, so a complaint that could be traced back to her would simply not
// be written; an inbox of safe, flattering messages is worse than no inbox. So
// "Anonymous" below is a promise being kept, not a field that failed to load.

/** How long ago, in words. An inbox is read fresh, so an exact date adds nothing. */
function agoText(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(iso);
}

function setFeedbackFilter(status) {
  ADMIN.feedbackFilter = status || '';
  document.querySelectorAll('#admin-feedback-filter .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.status === ADMIN.feedbackFilter);
  });
  renderAdminFeedback();
}

async function renderAdminFeedback() {
  const listEl = document.getElementById('admin-feedback-list');
  const sumEl = document.getElementById('admin-feedback-summary');
  if (!listEl) return;

  listEl.innerHTML = '<div class="progress-empty">Loading…</div>';

  try {
    const q = ADMIN.feedbackFilter ? '?status=' + encodeURIComponent(ADMIN.feedbackFilter) : '';
    const data = await apiGet('/api/admin/feedback' + q);
    ADMIN.feedback = data;

    const c = data.counts;
    sumEl.innerHTML = `
      <div class="stat-card">
        <h4>Waiting</h4>
        <div class="stat-number">${c.new}</div>
        <div class="stat-label">not read yet</div>
      </div>
      <div class="stat-card">
        <h4>Being looked at</h4>
        <div class="stat-number">${c.reviewing}</div>
        <div class="stat-label">in progress</div>
      </div>
      <div class="stat-card">
        <h4>Resolved</h4>
        <div class="stat-number">${c.resolved}</div>
        <div class="stat-label">answered or fixed</div>
      </div>
      <div class="stat-card">
        <h4>All time</h4>
        <div class="stat-number">${c.total}</div>
        <div class="stat-label">messages received</div>
      </div>`;

    // The tab badge is the count of unread, so the operator can tell there is
    // something waiting without opening the tab. Counts come from the unfiltered
    // totals, so filtering the list does not make the badge lie.
    const badge = document.getElementById('admin-feedback-badge');
    if (badge) {
      badge.textContent = c.new ? String(c.new) : '';
      badge.style.display = c.new ? '' : 'none';
    }

    listEl.innerHTML = data.items.length
      ? data.items.map(feedbackCard).join('')
      : `<div class="progress-empty">${
          ADMIN.feedbackFilter
            ? 'Nothing with that status.'
            : 'No feedback yet. It appears here the moment someone writes in.'
        }</div>`;
  } catch (err) {
    listEl.innerHTML = '<div class="progress-empty">Could not load feedback.</div>';
    sumEl.innerHTML = '';
  }
}

function feedbackCard(f) {
  const isEmployer = f.role === 'employer';
  // "Anonymous" is the honest label for a helper row: there is no name to look
  // up, by design. An employer row carries her account name, because without it
  // the operator sees "Employer" and cannot tell which one wrote in — which
  // would make the attribution pointless.
  const who = isEmployer
    ? `👔 ${escapeHtml(f.employer_name || 'Employer account')}`
    : '👤 Helper · Anonymous';
  // "cannot reply" is only true of a helper. Saying it on an employer's card
  // would be wrong twice over: she IS identified, and a reply is the point.
  const reach = isEmployer
    ? `signed in as ${escapeHtml(f.employer_name || 'an employer')}`
    : (f.contact ? `↩ ${escapeHtml(f.contact)}` : 'no contact left — cannot reply');
  const pill = { new: 'New', reviewing: 'Reviewing', resolved: 'Resolved' }[f.status] || f.status;
  return `<div class="feedback-item">
    <div class="feedback-item-head">
      <span class="fb-role">${who}</span>
      <span class="fb-status fb-status-${escapeHtml(f.status)}">${escapeHtml(pill)}</span>
      <span class="fb-when">${escapeHtml(agoText(f.created_at))}</span>
    </div>
    <p class="fb-quote">${escapeHtml(f.message)}</p>
    <div class="fb-meta">
      ${reach}
      ${f.lang ? ` · written in ${escapeHtml(f.lang)}` : ''}
      ${f.page ? ` · from ${escapeHtml(f.page)}` : ''}
    </div>
    <div class="fb-actions">
      ${f.status !== 'reviewing' ? `<button class="btn btn-outline btn-sm" onclick="markFeedback(${Number(f.id)}, 'reviewing')">Mark reviewing</button>` : ''}
      ${f.status !== 'resolved' ? `<button class="btn btn-primary btn-sm" onclick="markFeedback(${Number(f.id)}, 'resolved')">Mark resolved</button>` : ''}
      ${f.status !== 'new' ? `<button class="btn btn-outline btn-sm" onclick="markFeedback(${Number(f.id)}, 'new')">Back to new</button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="deleteFeedbackItem(${Number(f.id)})">Delete</button>
    </div>
  </div>`;
}

/** Move one message along. The server refuses an unknown status, so a typo here
 *  cannot invent a fourth state nothing can filter on. */
async function markFeedback(id, status) {
  try {
    await apiPatch(`/api/admin/feedback/${id}`, { status });
    await renderAdminFeedback();
  } catch (err) {
    alert('Could not update: ' + err.message);
  }
}

/** Deleting is irreversible and there is no undo, so it asks first. */
async function deleteFeedbackItem(id) {
  if (!confirm('Delete this message? This cannot be undone.')) return;
  try {
    await apiDelete(`/api/admin/feedback/${id}`);
    await renderAdminFeedback();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
}

// ---- Stories (moderation) --------------------------------------------------
//
// The queue that stands between a helper's story and the public. Nothing a
// helper writes is readable by anyone until it is approved from this tab — the
// public API can only ever return `status = 'published'`, and the only function
// in the data layer that can set that is the one this tab calls.
//
// What the operator sees here and what she does NOT are both deliberate. She
// sees the body, the language, the byline and the topic, because moderating a
// story means reading it. She never sees the device identity: the job is to
// judge the words, not to know who wrote them, and a helper who suspects this
// screen shows her name is a helper who does not write honestly.

function setStoryFilter(status) {
  ADMIN.storyFilter = status || '';
  document.querySelectorAll('#admin-stories-filter .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.status === ADMIN.storyFilter);
  });
  renderAdminStories();
}

async function renderAdminStories() {
  const listEl = document.getElementById('admin-stories-list');
  const sumEl = document.getElementById('admin-stories-summary');
  if (!listEl) return;

  listEl.innerHTML = '<div class="progress-empty">Loading…</div>';

  try {
    const q = ADMIN.storyFilter ? '?status=' + encodeURIComponent(ADMIN.storyFilter) : '';
    const data = await apiGet('/api/admin/stories' + q);
    ADMIN.stories = data;

    const c = data.counts;
    sumEl.innerHTML = `
      <div class="stat-card">
        <h4>Waiting</h4>
        <div class="stat-number">${c.pending}</div>
        <div class="stat-label">nobody can read these yet</div>
      </div>
      <div class="stat-card">
        <h4>Published</h4>
        <div class="stat-number">${c.published}</div>
        <div class="stat-label">live on the site</div>
      </div>
      <div class="stat-card">
        <h4>Not published</h4>
        <div class="stat-number">${c.rejected}</div>
        <div class="stat-label">declined, with a reason</div>
      </div>
      <div class="stat-card">
        <h4>All time</h4>
        <div class="stat-number">${c.total}</div>
        <div class="stat-label">stories received</div>
      </div>`;

    // The badge counts what is WAITING, from the unfiltered totals — so
    // filtering the list cannot make the badge lie about the backlog.
    const badge = document.getElementById('admin-stories-badge');
    if (badge) {
      badge.textContent = c.pending ? String(c.pending) : '';
      badge.style.display = c.pending ? '' : 'none';
    }

    listEl.innerHTML = data.stories.length
      ? data.stories.map(storyCard).join('')
      : `<div class="progress-empty">${
          ADMIN.storyFilter === 'pending'
            ? 'Nothing waiting. A story appears here the moment a helper sends one.'
            : ADMIN.storyFilter
              ? 'Nothing with that status.'
              : 'No stories yet.'
        }</div>`;
  } catch (err) {
    listEl.innerHTML = '<div class="progress-empty">Could not load stories.</div>';
    sumEl.innerHTML = '';
  }
}

const STORY_TOPIC_LABEL = { daily: 'Daily life', background: 'Where she comes from', interesting: 'Something that happened' };
const STORY_LANG_LABEL = { en: 'English', fil: 'Filipino', zh: '中文', id: 'Bahasa Indonesia' };

function storyCard(s) {
  // An unsigned story has an empty display_name in the database — the name was
  // never stored, so there is nothing to hide. Saying so plainly is the point:
  // the operator must not go looking for an identity that does not exist.
  const byline = String(s.display_name || '').trim()
    ? `✍️ ${escapeHtml(s.display_name)}`
    : '✍️ Unsigned — no name stored';
  const pill = { pending: 'Waiting', published: 'Published', rejected: 'Not published' }[s.status] || s.status;

  // The body is shown in full and as PLAIN TEXT. It is escaped, never rendered
  // as HTML: this is a stranger's writing, and the one page in the admin area
  // that must never execute anything.
  const paragraphs = String(s.body || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="story-quote">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<div class="feedback-item story-item">
    <div class="feedback-item-head">
      <span class="fb-role">${byline}</span>
      <span class="fb-status fb-status-${escapeHtml(s.status)}">${escapeHtml(pill)}</span>
      <span class="fb-when">${escapeHtml(agoText(s.created_at))}</span>
    </div>
    <h4 class="story-item-title">${escapeHtml(s.title)}</h4>
    <div class="fb-meta">
      ${escapeHtml(STORY_LANG_LABEL[s.lang] || s.lang)}
      · ${escapeHtml(STORY_TOPIC_LABEL[s.topic] || s.topic)}
      · <a href="/stories/${escapeHtml(s.slug)}" target="_blank" rel="noopener noreferrer">/stories/${escapeHtml(s.slug)}</a>
    </div>
    ${paragraphs}
    ${s.reviewer_note ? `<div class="fb-meta">Your note to her: ${escapeHtml(s.reviewer_note)}</div>` : ''}

    <div class="story-edit" id="story-edit-${Number(s.id)}" hidden>
      <div class="form-field">
        <label>Title</label>
        <input type="text" id="se-title-${Number(s.id)}" maxlength="120" value="${escapeHtml(s.title)}" />
      </div>
      <div class="form-field">
        <label>Story</label>
        <textarea id="se-body-${Number(s.id)}" rows="10" maxlength="6000">${escapeHtml(s.body)}</textarea>
      </div>
      <div class="form-field">
        <label>English gloss (optional)</label>
        <textarea id="se-gloss-${Number(s.id)}" rows="4" maxlength="400"
                  placeholder="Your own English version, so a reader who does not speak her language can follow it.">${escapeHtml(s.gloss_en || '')}</textarea>
      </div>
      <div class="form-field">
        <label>Name shown with the story</label>
        <input type="text" id="se-name-${Number(s.id)}" maxlength="40" value="${escapeHtml(s.display_name || '')}"
               placeholder="Leave empty to publish unsigned" />
        <p class="form-hint">Clearing this publishes the story without a name. The name she typed
          is not kept anywhere else — if she did not sign it, this field is already empty.</p>
      </div>
      <div class="fb-actions">
        <button class="btn btn-primary btn-sm" onclick="saveStoryEdit(${Number(s.id)})">Save changes</button>
        <button class="btn btn-outline btn-sm" onclick="toggleStoryEdit(${Number(s.id)})">Cancel</button>
      </div>
    </div>

    <div class="fb-actions">
      <button class="btn btn-outline btn-sm" onclick="toggleStoryEdit(${Number(s.id)})">Edit / add gloss</button>
      ${s.status !== 'published' ? `<button class="btn btn-primary btn-sm" onclick="approveStory(${Number(s.id)})">Approve &amp; publish</button>` : ''}
      ${s.status !== 'rejected' ? `<button class="btn btn-outline btn-sm" onclick="rejectStory(${Number(s.id)})">Not publish</button>` : ''}
      ${s.status === 'published' ? `<button class="btn btn-outline btn-sm" onclick="unpublishStory(${Number(s.id)})">Take down</button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="deleteStoryItem(${Number(s.id)})">Delete</button>
    </div>
  </div>`;
}

function toggleStoryEdit(id) {
  const box = document.getElementById('story-edit-' + id);
  if (box) box.hidden = !box.hidden;
}

/**
 * Approve. The one action in the whole app that makes a helper's words public.
 *
 * No confirmation dialog: it is reversible (Take down), and a modal between the
 * operator and every single approval would be noise she learns to dismiss.
 */
async function approveStory(id) {
  try {
    await apiPatch(`/api/admin/stories/${id}`, { status: 'published' });
    await renderAdminStories();
  } catch (err) {
    alert('Could not publish: ' + err.message);
  }
}

/**
 * Decline. Asks for a reason first, because the reason is shown back to the
 * author on her own submissions screen — a rejection with no reason reads as
 * "nobody looked", which is worse than no answer at all.
 */
async function rejectStory(id) {
  const note = prompt('Why not? She will see this.\n\nFor example: "Please remove the address of the family."');
  if (note === null) return;
  try {
    await apiPatch(`/api/admin/stories/${id}`, { status: 'rejected', note });
    await renderAdminStories();
  } catch (err) {
    alert('Could not update: ' + err.message);
  }
}

async function unpublishStory(id) {
  if (!confirm('Take this story down? It stops being readable immediately.')) return;
  try {
    await apiPatch(`/api/admin/stories/${id}`, { status: 'pending' });
    await renderAdminStories();
  } catch (err) {
    alert('Could not update: ' + err.message);
  }
}

/** Save an edit. Editing never changes the status — publishing is its own button. */
async function saveStoryEdit(id) {
  const val = (pre) => {
    const el = document.getElementById(pre + id);
    return el ? el.value : undefined;
  };
  try {
    await apiPut(`/api/admin/stories/${id}`, {
      title: val('se-title-'),
      body: val('se-body-'),
      gloss_en: val('se-gloss-'),
      display_name: val('se-name-'),
    });
    await renderAdminStories();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
}

/** Deleting is irreversible and there is no undo, so it asks first. */
async function deleteStoryItem(id) {
  if (!confirm('Delete this story? This cannot be undone.')) return;
  try {
    await apiDelete(`/api/admin/stories/${id}`);
    await renderAdminStories();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
}

// ---- Discover feed (posts) -------------------------------------------------
//
// One list for both channels. Culture posts are written here; news posts are
// imported from public Hong Kong sources and are READ-ONLY in spirit — the
// operator can hide or delete one, but editing an imported headline would put
// words in a source's mouth, so the form says so rather than pretending.

function setPostFilter(channel) {
  ADMIN.postsFilter = channel;
  document.querySelectorAll('#admin-posts-filter .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.channel === channel);
  });
  // The topic row belongs to the News channel only. Leaving it visible on
  // Culture would be a control that does nothing, which is worse than no
  // control — and clearing the topic filter here stops a stale news topic
  // from hiding an imported post she is looking for under Culture.
  const topicRow = document.getElementById('admin-posts-category');
  if (topicRow) topicRow.hidden = channel !== 'news';
  if (channel !== 'news') ADMIN.newsCategory = '';
  renderAdminPosts();
}

/** Narrows the News list to one topic. '' is every topic. */
function setNewsCategoryFilter(category) {
  ADMIN.newsCategory = category || '';
  document.querySelectorAll('#admin-posts-category .chip').forEach((c) => {
    c.classList.toggle('active', (c.dataset.category || '') === ADMIN.newsCategory);
  });
  renderAdminPosts();
}

async function renderAdminPosts() {
  const wrap = document.getElementById('admin-posts-list');
  if (!wrap) return;
  let data;
  try {
    const q = new URLSearchParams();
    if (ADMIN.postsFilter) q.set('channel', ADMIN.postsFilter);
    // The topic filter is only ever sent for the News channel; sending it
    // anywhere else would be asking the server for a category that does not
    // exist there and getting an empty list back.
    if (ADMIN.postsFilter === 'news' && ADMIN.newsCategory) q.set('category', ADMIN.newsCategory);
    data = await apiGet(`/api/admin/posts${q.toString() ? `?${q}` : ''}`);
  } catch (err) {
    wrap.innerHTML = `<p class="admin-hint">Could not load the feed: ${escapeHtml(err.message)}</p>`;
    return;
  }
  ADMIN.posts = data.posts || [];

  const summary = document.getElementById('admin-posts-summary');
  if (summary && data.counts) {
    const cats = data.newsCategories || {};
    const byTopic = Object.entries(cats)
      .filter(([k]) => k !== 'all')
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
    summary.textContent =
      `${data.counts.published} published (${data.counts.culture} culture, ${data.counts.news} news) · ` +
      `${data.counts.total} total.` +
      (byTopic ? ` News by topic — ${byTopic}.` : ' News is imported; culture is written here.');
  }

  if (!ADMIN.posts.length) {
    wrap.innerHTML = '<p class="admin-hint">Nothing here yet.</p>';
    return;
  }

  wrap.innerHTML = ADMIN.posts
    .map((p) => {
      const date = (p.published_at || p.created_at || '').slice(0, 10);
      const badge =
        p.status === 'published'
          ? '<span class="post-badge published">Published</span>'
          : '<span class="post-badge draft">Draft</span>';
      const origin = p.origin === 'auto' ? '<span class="post-badge auto">Imported</span>' : '';
      // The topic, so a mis-classified item is visible as one rather than
      // something that has to be discovered by opening the form. A culture post
      // has no topic and shows nothing.
      const topic = p.channel === 'news'
        ? `<span class="post-badge topic">${escapeHtml(p.category || 'no topic')}</span>`
        : '';
      const src = p.source_name
        ? `<a class="post-src" href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener">${escapeHtml(p.source_name)}</a>`
        : '';
      return `<div class="post-row">
        <div class="post-row-main">
          <div class="post-row-title">${escapeHtml(p.icon || '')} ${escapeHtml(p.title_en)}</div>
          <div class="post-row-meta">${escapeHtml(date)} · ${escapeHtml(p.channel)} · ${escapeHtml(p.slug)} ${src}</div>
        </div>
        <div class="post-row-badges">${badge}${origin}${topic}</div>
        <div class="post-row-actions">
          <button class="btn btn-sm btn-outline" onclick="openPostForm(${p.id})">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="deleteAdminPost(${p.id})">Delete</button>
        </div>
      </div>`;
    })
    .join('');
}

/**
 * The topic row follows the channel. A culture post has no topics at all, so
 * showing the select for one would invite a choice the server then ignores.
 */
function togglePostCategoryRow() {
  const channel = document.getElementById('pf-channel').value;
  document.getElementById('pf-category-row').hidden = channel !== 'news';
}

function openPostForm(id) {
  const p = id ? ADMIN.posts.find((x) => x.id === Number(id)) : null;
  document.getElementById('post-form-title').textContent = p ? 'Edit post' : 'New post';
  document.getElementById('pf-id').value = p ? p.id : '';
  const channel = p ? p.channel : 'culture';
  document.getElementById('pf-channel').value = channel;
  document.getElementById('pf-status').value = p ? p.status : 'draft';
  // The topic row exists for the News channel only, so it is shown or hidden
  // with the channel the form is about rather than always being on screen.
  document.getElementById('pf-category-row').hidden = channel !== 'news';
  document.getElementById('pf-category').value = (p && p.category) || '';
  const set = (field, value) => { document.getElementById(field).value = value || ''; };
  set('pf-icon', p && p.icon);
  set('pf-title-en', p && p.title_en);
  set('pf-title-zh', p && p.title_zh);
  set('pf-title-fil', p && p.title_fil);
  set('pf-title-id', p && p.title_id);
  set('pf-summary-en', p && p.summary_en);
  set('pf-summary-zh', p && p.summary_zh);
  set('pf-body-en', p && p.body_en);
  set('pf-source-name', p && p.source_name);
  set('pf-source-url', p && p.source_url);
  document.getElementById('post-form-modal').classList.add('show');
}

function closePostForm(e) {
  if (e && e.target && e.target.id !== 'post-form-modal') return;
  document.getElementById('post-form-modal').classList.remove('show');
}

async function submitPostForm(e) {
  e.preventDefault();
  const id = document.getElementById('pf-id').value;
  const channel = document.getElementById('pf-channel').value;
  const body = {
    channel,
    status: document.getElementById('pf-status').value,
    icon: document.getElementById('pf-icon').value,
    // Only sent for the News channel. An empty value means "leave the topic
    // alone on edit / let the importer guess on create" — which is exactly the
    // select's blank option, and exactly what an edit of a culture post should
    // never carry at all.
    ...(channel === 'news' ? { category: document.getElementById('pf-category').value } : {}),
    title_en: document.getElementById('pf-title-en').value,
    title_zh: document.getElementById('pf-title-zh').value,
    title_fil: document.getElementById('pf-title-fil').value,
    title_id: document.getElementById('pf-title-id').value,
    summary_en: document.getElementById('pf-summary-en').value,
    summary_zh: document.getElementById('pf-summary-zh').value,
    body_en: document.getElementById('pf-body-en').value,
    source_name: document.getElementById('pf-source-name').value,
    source_url: document.getElementById('pf-source-url').value,
  };
  try {
    if (id) await apiPut(`/api/admin/posts/${id}`, body);
    else await apiPost('/api/admin/posts', body);
    closePostForm();
    await renderAdminPosts();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
}

/** Deleting a post is irreversible and there is no undo, so it asks first. */
async function deleteAdminPost(id) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await apiDelete(`/api/admin/posts/${id}`);
    await renderAdminPosts();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
}

/**
 * Runs the news importer now. Reports what actually happened — how many were
 * new, and which feed failed if one did — rather than a bare "done", because a
 * silent zero is the one result worth noticing.
 */async function fetchNewsNow() {
  const btn = event && event.target ? event.target : null;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Fetching…'; }
  try {
    const r = await apiPost('/api/admin/posts/import', {});
    await renderAdminPosts();
    const errs = (r.errors || []).length ? `\n\nFeed problems:\n${r.errors.join('\n')}` : '';
    // A retirement is shown rather than hidden: it means the feed just LOST
    // stories, because this build no longer ships the source they came from.
    const gone = r.removed
      ? `\nRetired ${r.removed} item(s) from a source no longer in use (${(r.retired || []).join(', ')}).`
      : '';
    alert(`Fetched ${r.fetched} items · ${r.inserted} new · ${r.skipped} already had.${gone}${errs}`);
  } catch (err) {
    alert('Import failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Fetch news now'; }
  }
}

/**
 * Fills in the topic of every news item that has none.
 *
 * Reports a zero honestly rather than as a failure — "nothing needed it" is
 * the expected result most of the time, and a button that says done whether it
 * worked or not is a button she learns to ignore. It never overwrites a topic
 * she has already corrected by hand, which is the only reason it is safe to
 * have on a toolbar at all.
 */
async function classifyNewsPosts() {
  const btn = event && event.target ? event.target : null;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Classifying…'; }
  try {
    const r = await apiPost('/api/admin/posts/classify', {});
    await renderAdminPosts();
    alert(r.classified
      ? `Gave ${r.classified} news item(s) a topic.`
      : 'Nothing needed a topic — every news item already has one.');
  } catch (err) {
    alert('Re-classification failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🏷 Re-classify news'; }
  }
}

// ---- Init ------------------------------------------------------------------

checkAdminSession();
