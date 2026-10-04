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
 * Each row now carries the total and the per-level split, flagged against the
 * same threshold the quiz engine uses, so a category that cannot produce a quiz
 * says so instead of waiting to be discovered.
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

  wrap.innerHTML = ADMIN.categories
    .map((c, i) => {
      const n = counts.get(c.id) || { total: 0, levels: { 1: 0, 2: 0, 3: 0 } };

      const chips = [1, 2, 3]
        .map((lvl) => {
          const k = n.levels[lvl];
          // The quiz engine returns nothing below QUIZ_MIN words, so 0 and 1-3
          // are both unusable — just differently bad.
          const state = k === 0 ? 'empty' : k < QUIZ_MIN ? 'low' : 'ok';
          if (state === 'ok') quizReady += 1;
          const label = k === 0 ? 'no words' : `${k} word${k === 1 ? '' : 's'}`;
          return `<span class="cat-level lv-${state}" title="${ADMIN_LEVELS[lvl]} — ${label}">L${lvl} <b>${k}</b></span>`;
        })
        .join('');

      const alt = [c.name_yue, c.name_fil].filter(Boolean).map(escapeHtml).join(' · ');

      return `
      <div class="admin-cat-row">
        <div class="admin-cat-order">${i + 1}</div>
        <div class="admin-cat-icon">${escapeHtml(c.icon || '📁')}</div>
        <div class="admin-cat-body">
          <div class="admin-cat-name">${escapeHtml(c.name_en)}</div>
          <div class="admin-cat-name-yue">${alt || '<span class="admin-cat-none">no Cantonese or Filipino name</span>'}</div>
        </div>
        <div class="admin-cat-coverage">${chips}</div>
        <div class="admin-cat-total">${n.total}<span> word${n.total === 1 ? '' : 's'}</span></div>
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
    const cells = ADMIN.categories.length * 3;
    summaryEl.innerHTML =
      `<b>${ADMIN.vocabulary.length}</b> words across <b>${ADMIN.categories.length}</b> categories · ` +
      `<b>${quizReady}</b> of <b>${cells}</b> category-and-level combinations can produce a quiz ` +
      `(a quiz needs ${QUIZ_MIN} words)`;
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

  return `
    <div class="employer-card">
      <div class="employer-head">
        <div>
          <div class="employer-name">🏠 ${escapeHtml(e.name)}</div>
          <div class="employer-email">${escapeHtml(e.email || e.username)}</div>
        </div>
        <div class="employer-count">${e.helper_count} helper(s)</div>
      </div>
      <div class="employer-meta">${meta.join(' · ')}</div>
      ${helpers}
    </div>`;
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

async function renderAdminReport() {
  const totalsEl = document.getElementById('admin-report-totals');
  const chartEl = document.getElementById('admin-report-chart');
  const notesEl = document.getElementById('admin-report-notes');
  const empEl = document.getElementById('admin-report-employers');
  const stampEl = document.getElementById('admin-report-stamp');
  if (!totalsEl) return;

  chartEl.innerHTML = '<div class="progress-empty">Loading…</div>';
  empEl.innerHTML = '';
  notesEl.innerHTML = '';

  try {
    const data = await apiGet(`/api/admin/report?days=${ADMIN.reportDays}`);
    ADMIN.report = data;
    const t = data.totals;

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

/**
 * A bar chart of daily quizzes, drawn inline as SVG.
 *
 * No charting library: this app has no build step and no CDN dependency, and a
 * bar chart of at most 90 values does not need one. The SVG scales with its
 * container, so the same markup works at 320px and on a desktop.
 *
 * Days with no activity get a flat stub rather than nothing, because "she did
 * not practise that day" is the finding — a gap would read as missing data.
 */
function trendChart(trends) {
  const series = (trends && trends.series) || [];
  if (!series.length) return '<div class="progress-empty">No activity in this period.</div>';

  const max = Math.max(1, ...series.map((d) => d.attempts));
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
    const title = `<title>${escapeHtml(`${d.day}: ${d.attempts} quiz(zes), ${d.learners} helper(s) active`)}</title>`;
    if (!d.attempts) {
      return `<rect x="${x.toFixed(1)}" y="${(base - 2).toFixed(1)}" width="${barW.toFixed(1)}" height="2" rx="1" fill="#e9ecef">${title}</rect>`;
    }
    const h = Math.max(3, Math.round((d.attempts / max) * plotH));
    return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h}" rx="2" fill="#52b788">${title}</rect>`;
  }).join('');

  // Three labels only — more would collide on a phone.
  const ticks = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])]
    .map((i) => {
      const x = padL + i * slot + slot / 2;
      return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6c757d">${escapeHtml(series[i].day.slice(5))}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="report-svg" role="img"
      aria-label="Daily quiz attempts over the last ${escapeHtml(String(trends.days))} days">
    <line x1="${padL}" y1="${base}" x2="${W - padR}" y2="${base}" stroke="#dee2e6" stroke-width="1"/>
    <text x="${padL}" y="${padT - 5}" font-size="11" fill="#6c757d">peak ${max} per day</text>
    ${bars}${ticks}
  </svg>`;
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

// ---- Init ------------------------------------------------------------------

checkAdminSession();
