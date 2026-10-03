/* =============================================================================
   CantoBuddy  —  Admin Dashboard Logic
   ============================================================================= */

const ADMIN = {
  categories: [],
  vocabulary: [],
  stats: null,
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

function renderAdminCategories() {
  const wrap = document.getElementById('admin-cat-list');
  if (ADMIN.categories.length === 0) {
    wrap.innerHTML = '<div class="progress-empty">No categories yet.</div>';
    return;
  }
  const last = ADMIN.categories.length - 1;
  wrap.innerHTML = ADMIN.categories
    .map(
      (c, i) => `
    <div class="admin-cat-card">
      <div class="admin-cat-order">${i + 1}</div>
      <div class="admin-cat-icon">${c.icon}</div>
      <div class="admin-cat-name">${c.name_en}</div>
      <div class="admin-cat-name-yue">${c.name_yue || ''}</div>
      <div class="admin-cat-actions">
        <button class="move-btn" title="Move up" ${i === 0 ? 'disabled' : ''} onclick="moveCategory(${c.id}, -1)">↑</button>
        <button class="move-btn" title="Move down" ${i === last ? 'disabled' : ''} onclick="moveCategory(${c.id}, 1)">↓</button>
        <button class="edit-btn" title="Edit" onclick="openCategoryForm(${c.id})">✏️</button>
        <button class="del-btn" title="Delete" onclick="deleteCategory(${c.id})">🗑️</button>
      </div>
    </div>`
    )
    .join('');
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

// ---- Init ------------------------------------------------------------------

checkAdminSession();
