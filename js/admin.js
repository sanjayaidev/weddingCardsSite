/**
 * Admin panel — loads all configs, lets user edit, saves to localStorage & GitHub.
 */
let CONTENT, THEMES, PRESETS;

// === INITIALIZATION ===
(async function initAdmin() {
  // Try to load from localStorage first (previous edits), else from files
  const storedContent = localStorage.getItem('config_content');
  const storedThemes = localStorage.getItem('config_themes');
  const storedPresets = localStorage.getItem('config_presets');

  [CONTENT, THEMES, PRESETS] = await Promise.all([
    storedContent ? Promise.resolve(JSON.parse(storedContent)) : fetch('config-content.json').then(r => r.json()),
    storedThemes ? Promise.resolve(JSON.parse(storedThemes)) : fetch('config-themes.json').then(r => r.json()),
    storedPresets ? Promise.resolve(JSON.parse(storedPresets)) : fetch('config-presets.json').then(r => r.json())
  ]);

  renderThemes();
  renderLayouts();
  loadContentFields();
  loadMediaFields();
  loadGithubFields();

  if (storedContent || storedThemes || storedPresets) {
    showStatus('Loaded from browser storage. Click "Reset to Original Files" to discard changes.', 'info');
  }
})();

// === TABS ===
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// === PERSIST TO LOCALSTORAGE ===
function persistToStorage() {
  localStorage.setItem('config_content', JSON.stringify(CONTENT));
  localStorage.setItem('config_themes', JSON.stringify(THEMES));
  localStorage.setItem('config_presets', JSON.stringify(PRESETS));
}

// === THEMES ===
function renderThemes() {
  const list = document.getElementById('themes-list');
  list.innerHTML = THEMES.themes.map(t => `
    <div class="preset-card ${PRESETS.active.theme === t.id ? 'selected' : ''}" data-theme="${t.id}">
      <h4>${t.name}</h4>
      <p>${t.description}</p>
      <div class="color-swatches">
        ${Object.values(t.colors).map(c => `<div class="swatch" style="background:${c}" title="${c}"></div>`).join('')}
      </div>
      <div class="meta">Fonts: ${t.fonts.heading.split(',')[0].replace(/'/g, '')}</div>
    </div>
  `).join('');

  list.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
      PRESETS.active.theme = card.dataset.theme;
      renderThemes();
      persistToStorage();
      showStatus('✅ Theme selected: ' + card.querySelector('h4').textContent + '. Click "Live Preview" to see it!', 'success');
    });
  });
}

// === LAYOUTS ===
function renderLayouts() {
  const list = document.getElementById('layouts-list');
  list.innerHTML = PRESETS.layouts.map(l => `
    <div class="preset-card ${PRESETS.active.layout === l.id ? 'selected' : ''}" data-layout="${l.id}">
      <h4>${l.name}</h4>
      <p>${l.description}</p>
      <div class="meta">CSS: ${l.cssFile} · Animation: ${l.animation}</div>
    </div>
  `).join('');

  list.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
      PRESETS.active.layout = card.dataset.layout;
      renderLayouts();
      persistToStorage();
      showStatus('✅ Layout selected: ' + card.querySelector('h4').textContent + '. Click "Live Preview" to see it!', 'success');
    });
  });
}

// === CONTENT FIELDS ===
function loadContentFields() {
  document.getElementById('content-title').value = CONTENT.meta?.title || '';
  document.getElementById('content-name1').value = CONTENT.hero?.name1 || '';
  document.getElementById('content-name2').value = CONTENT.hero?.name2 || '';
  document.getElementById('content-tagline').value = CONTENT.hero?.tagline || '';
  document.getElementById('content-story-heading').value = CONTENT.story?.heading || '';
  document.getElementById('content-story-quote').value = CONTENT.story?.quote || '';
  document.getElementById('content-venue-name').value = CONTENT.venue?.name || '';
  document.getElementById('content-whatsapp').value = CONTENT.rsvp?.whatsapp || '';
}

function saveContentFields() {
  CONTENT.meta.title = document.getElementById('content-title').value;
  CONTENT.hero.name1 = document.getElementById('content-name1').value;
  CONTENT.hero.name2 = document.getElementById('content-name2').value;
  CONTENT.hero.tagline = document.getElementById('content-tagline').value;
  CONTENT.story.heading = document.getElementById('content-story-heading').value;
  CONTENT.story.quote = document.getElementById('content-story-quote').value;
  CONTENT.venue.name = document.getElementById('content-venue-name').value;
  CONTENT.rsvp.whatsapp = document.getElementById('content-whatsapp').value;
  persistToStorage();
}

// Auto-save content fields on input
document.querySelectorAll('#panel-content input, #panel-content textarea').forEach(input => {
  input.addEventListener('input', () => {
    saveContentFields();
  });
});

// === MEDIA FIELDS ===
function loadMediaFields() {
  document.getElementById('media-gate').value = CONTENT.gate?.image || '';
  document.getElementById('media-hero').value = CONTENT.hero?.image || '';
  document.getElementById('media-story').value = CONTENT.story?.image || '';
  document.getElementById('media-venue').value = CONTENT.venue?.image || '';
  document.getElementById('media-music').value = CONTENT.music?.src || '';
  document.getElementById('media-volume').value = CONTENT.music?.volume ?? 0.6;
  document.getElementById('vol-label').textContent = Math.round((CONTENT.music?.volume ?? 0.6) * 100) + '%';
}

function saveMediaFields() {
  CONTENT.gate.image = document.getElementById('media-gate').value;
  CONTENT.hero.image = document.getElementById('media-hero').value;
  CONTENT.story.image = document.getElementById('media-story').value;
  CONTENT.venue.image = document.getElementById('media-venue').value;
  CONTENT.music.src = document.getElementById('media-music').value;
  CONTENT.music.volume = parseFloat(document.getElementById('media-volume').value);
  persistToStorage();
}

document.getElementById('media-volume').addEventListener('input', (e) => {
  document.getElementById('vol-label').textContent = Math.round(e.target.value * 100) + '%';
  saveMediaFields();
});

// Auto-save media fields on input
document.querySelectorAll('#panel-media input').forEach(input => {
  if (input.type !== 'range') {
    input.addEventListener('input', () => saveMediaFields());
  }
});

// === GITHUB ===
function loadGithubFields() {
  document.getElementById('gh-repo').value = localStorage.getItem('gh_repo') || '';
  document.getElementById('gh-branch').value = localStorage.getItem('gh_branch') || 'main';
  document.getElementById('gh-token').value = localStorage.getItem('gh_token') || '';
  document.getElementById('gh-remember').checked = !!localStorage.getItem('gh_token');
}

// === PREVIEW ===
function openPreview() {
  persistToStorage();
  window.open('index.html?preview=1&t=' + Date.now(), '_blank');
}

// === SAVE TO GITHUB ===
async function saveAll() {
  saveContentFields();
  saveMediaFields();

  const repo = document.getElementById('gh-repo').value.trim();
  const branch = document.getElementById('gh-branch').value.trim() || 'main';
  const token = document.getElementById('gh-token').value.trim();

  if (document.getElementById('gh-remember').checked) {
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_branch', branch);
    if (token) localStorage.setItem('gh_token', token);
  } else {
    localStorage.removeItem('gh_token');
  }

  if (!repo || !token) {
    showStatus('❌ Please enter GitHub repository and token.', 'error');
    return;
  }

  try {
    showStatus('⏳ Saving to GitHub...', 'info');
    await pushToGithub(repo, branch, token, 'config-content.json', CONTENT);
    await pushToGithub(repo, branch, token, 'config-themes.json', THEMES);
    await pushToGithub(repo, branch, token, 'config-presets.json', PRESETS);
    showStatus('✅ All 3 configs saved to GitHub! Site will update after redeploy (usually under a minute).', 'success');
  } catch (err) {
    showStatus('❌ Save failed: ' + err.message, 'error');
  }
}

async function pushToGithub(repo, branch, token, path, data) {
  const getUrl = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  let sha = null;
  
  try {
    const res = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const cur = await res.json();
      sha = cur.sha;
    }
  } catch (e) {}

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const body = {
    message: `Update ${path}`,
    content,
    branch,
    ...(sha ? { sha } : {})
  };

  const res = await fetch(getUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`GitHub API error on ${path}: ${res.status} ${errData.message || ''}`);
  }
}

// === DOWNLOAD ===
function downloadConfigs() {
  saveContentFields();
  saveMediaFields();
  download('config-content.json', CONTENT);
  download('config-themes.json', THEMES);
  download('config-presets.json', PRESETS);
  showStatus('✅ All 3 config files downloaded!', 'success');
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// === RESET ===
function resetStorage() {
  if (confirm('This will discard all unsaved changes and reload from the original JSON files. Continue?')) {
    localStorage.removeItem('config_content');
    localStorage.removeItem('config_themes');
    localStorage.removeItem('config_presets');
    location.reload();
  }
}

// === STATUS ===
function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + type;
  if (type !== 'info') {
    setTimeout(() => { el.className = 'status'; }, 6000);
  }
}