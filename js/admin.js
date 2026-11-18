/**
 * Admin panel — loads config from the server API (Neon-backed),
 * edits locally with autosave, and publishes to the database with "Save to Server".
 */
let CONTENT, THEMES, PRESETS;
let USER = null;
let ACCOUNT_MODE = false;
let currentSlug = '';

// === INITIALIZATION ===
(async function initAdmin() {
  try {
    const res = await fetch('api/config');
    if (!res.ok) throw new Error('api/config -> ' + res.status);
    const data = await res.json();
    [CONTENT, THEMES, PRESETS] = [data.content, data.themes, data.presets];
    showStatus('✅ Loaded current configuration from the server (Neon).', 'success');
  } catch (err) {
    // Fallback: static seed files
    try {
      [CONTENT, THEMES, PRESETS] = await Promise.all([
        fetch('config/content.json').then(r => r.json()),
        fetch('config/themes.json').then(r => r.json()),
        fetch('config/presets.json').then(r => r.json()),
      ]);
      showStatus('⚠️ Could not reach the API — loaded bundled seed files. Edits can still be saved.', 'info');
    } catch (e2) {
      showStatus('❌ Failed to load configuration: ' + e2.message, 'error');
      return;
    }
  }

  await initializeAccount();
  renderThemes();
  renderLayouts();
  loadContentFields();
  loadMediaFields();
  loadAdminToken();
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

// === LOCAL DRAFT PERSISTENCE (unsaved edits survive refresh) ===
function persistDraft() {
  localStorage.setItem(`draft_content_${draftUser()}`, JSON.stringify(CONTENT));
  localStorage.setItem(`draft_themes_${draftUser()}`, JSON.stringify(THEMES));
  localStorage.setItem(`draft_presets_${draftUser()}`, JSON.stringify(PRESETS));
}

function clearDraft() {
  localStorage.removeItem(`draft_content_${draftUser()}`);
  localStorage.removeItem(`draft_themes_${draftUser()}`);
  localStorage.removeItem(`draft_presets_${draftUser()}`);
  if (draftUser() === 'admin') {
    ['content', 'themes', 'presets'].forEach((key) => localStorage.removeItem(`draft_${key}`));
  }
}

function draftUser() {
  return USER?.id || 'admin';
}

function restoreDraft() {
  try {
    let draft = ['content', 'themes', 'presets'].map((key) =>
      JSON.parse(localStorage.getItem(`draft_${key}_${draftUser()}`))
    );
    if (draftUser() === 'admin' && !draft.some(Boolean)) {
      draft = ['content', 'themes', 'presets'].map((key) =>
        JSON.parse(localStorage.getItem(`draft_${key}`))
      );
    }
    if (draft.every(Boolean)) {
      [CONTENT, THEMES, PRESETS] = draft;
      if (draftUser() === 'admin') {
        persistDraft();
        ['content', 'themes', 'presets'].forEach((key) => localStorage.removeItem(`draft_${key}`));
      }
    }
  } catch (err) {
    showStatus('⚠️ Could not restore the saved draft: ' + err.message, 'error');
  }
}

async function initializeAccount() {
  document.getElementById('account-form').addEventListener('submit', (event) => {
    event.preventDefault();
    authenticate('login');
  });
  document.getElementById('account-register').addEventListener('click', () => authenticate('register'));
  document.getElementById('account-login').addEventListener('click', () => authenticate('login'));
  document.getElementById('account-logout').addEventListener('click', logout);
  document.getElementById('publish-card').addEventListener('click', publishCard);
  document.getElementById('add-gallery-image').addEventListener('click', () => {
    CONTENT.gallery.images.push({ src: '', alt: '' });
    renderGalleryFields();
    persistDraft();
  });

  try {
    const response = await fetch('/api/auth/session');
    if (!response.ok) throw new Error('Could not check account session.');
    const { user } = await response.json();
    if (user) {
      await useAccount(user);
      setAccountMessage('Your invitation is private until you publish it.');
    } else {
      restoreDraft();
    }
  } catch (err) {
    restoreDraft();
    setAccountMessage(err.message);
  }
}

async function authenticate(action) {
  if (!document.getElementById('account-form').reportValidity()) return;
  const email = document.getElementById('account-email').value.trim();
  const password = document.getElementById('account-password').value;
  try {
    setAccountMessage(action === 'register' ? 'Creating your account…' : 'Logging in…');
    const response = await fetch(`/api/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Account request failed.');
    await useAccount(data.user);
    setAccountMessage('Your private invitation is ready to design.');
    showStatus('✅ Your personal invitation is loaded. Changes are saved privately to your account.', 'success');
  } catch (err) {
    setAccountMessage(err.message);
  }
}

async function useAccount(user) {
  const response = await fetch('/api/me/card');
  const card = await response.json();
  if (!response.ok) throw new Error(card.error || 'Could not load your invitation.');
  USER = user;
  ACCOUNT_MODE = true;
  CONTENT = card.content;
  THEMES = card.themes;
  PRESETS = card.presets;
  currentSlug = card.slug || '';
  restoreDraft();
  renderThemes();
  renderLayouts();
  loadContentFields();
  loadMediaFields();
  document.getElementById('account-auth-actions').classList.add('hidden');
  document.getElementById('account-form').classList.add('hidden');
  document.getElementById('account-signed-in').classList.remove('hidden');
  document.getElementById('account-identity').textContent = user.email;
  document.getElementById('account-description').textContent = 'Design your own invitation. Only your account can edit it.';
  document.getElementById('publish-controls').classList.remove('hidden');
  document.getElementById('card-slug').value = currentSlug;
  const link = document.getElementById('published-link');
  if (currentSlug) {
    link.href = `${location.origin}/?card=${encodeURIComponent(currentSlug)}`;
    link.textContent = `Published invitation: ${link.href}`;
    link.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
  }
}

async function logout() {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Could not log out.');
    location.reload();
  } catch (err) {
    setAccountMessage(err.message);
  }
}

function setAccountMessage(message) {
  document.getElementById('account-status').textContent = message;
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
      persistDraft();
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
      persistDraft();
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
  persistDraft();
}

// Auto-save content fields on input
document.querySelectorAll('#panel-content input, #panel-content textarea').forEach(input => {
  input.addEventListener('input', () => saveContentFields());
});

// === MEDIA FIELDS ===
function loadMediaFields() {
  document.getElementById('media-gate').value = CONTENT.gate?.image || '';
  document.getElementById('media-hero').value = CONTENT.hero?.image || '';
  document.getElementById('media-story').value = CONTENT.story?.image || '';
  document.getElementById('media-venue').value = CONTENT.venue?.image || '';
  document.getElementById('media-banner').value = CONTENT.banner?.image || '';
  document.getElementById('media-gallery-single').value = CONTENT.gallery?.single?.image || '';
  document.getElementById('media-music').value = CONTENT.music?.src || '';
  document.getElementById('media-volume').value = CONTENT.music?.volume ?? 0.6;
  document.getElementById('vol-label').textContent = Math.round((CONTENT.music?.volume ?? 0.6) * 100) + '%';
  renderGalleryFields();
  renderEventImageFields();
}

function saveMediaFields() {
  CONTENT.gate.image = document.getElementById('media-gate').value;
  CONTENT.hero.image = document.getElementById('media-hero').value;
  CONTENT.story.image = document.getElementById('media-story').value;
  CONTENT.venue.image = document.getElementById('media-venue').value;
  CONTENT.banner.image = document.getElementById('media-banner').value;
  CONTENT.gallery.single.image = document.getElementById('media-gallery-single').value;
  CONTENT.music.src = document.getElementById('media-music').value;
  CONTENT.music.volume = parseFloat(document.getElementById('media-volume').value);
  persistDraft();
}

function renderGalleryFields() {
  const list = document.getElementById('gallery-image-fields');
  CONTENT.gallery.images = Array.isArray(CONTENT.gallery.images) ? CONTENT.gallery.images : [];
  list.replaceChildren();

  CONTENT.gallery.images.forEach((image, index) => {
    const row = document.createElement('div');
    row.className = 'image-editor-row';

    const urlField = document.createElement('div');
    urlField.className = 'field';
    const urlLabel = document.createElement('label');
    urlLabel.textContent = `Photo ${index + 1} URL`;
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = image.src || '';
    urlInput.placeholder = 'https://... or assets/gallery/photo.jpg';
    urlInput.addEventListener('input', () => {
      image.src = urlInput.value;
      persistDraft();
    });
    urlField.append(urlLabel, urlInput);

    const altField = document.createElement('div');
    altField.className = 'field';
    const altLabel = document.createElement('label');
    altLabel.textContent = 'Alt text';
    const altInput = document.createElement('input');
    altInput.type = 'text';
    altInput.value = image.alt || '';
    altInput.placeholder = 'Describe the photo';
    altInput.addEventListener('input', () => {
      image.alt = altInput.value;
      persistDraft();
    });
    altField.append(altLabel, altInput);

    const removeButton = document.createElement('button');
    removeButton.className = 'btn btn-danger';
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      CONTENT.gallery.images.splice(index, 1);
      renderGalleryFields();
      persistDraft();
    });

    row.append(urlField, altField, removeButton);
    list.appendChild(row);
  });
}

function renderEventImageFields() {
  const list = document.getElementById('event-image-fields');
  list.replaceChildren();

  (CONTENT.events?.days || []).forEach((day) => {
    const heading = document.createElement('h4');
    heading.textContent = day.date;
    list.appendChild(heading);
    (day.items || []).forEach((event) => {
      const field = document.createElement('div');
      field.className = 'field';
      const label = document.createElement('label');
      label.textContent = `${event.title} image URL`;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = event.image || '';
      input.placeholder = 'https://... or assets/events/photo.jpg';
      input.addEventListener('input', () => {
        event.image = input.value;
        persistDraft();
      });
      field.append(label, input);
      list.appendChild(field);
    });
  });
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

// === ADMIN TOKEN ===
function loadAdminToken() {
  document.getElementById('admin-token').value = localStorage.getItem('admin_token') || '';
}

function getAdminToken() {
  const t = document.getElementById('admin-token').value.trim();
  if (t) localStorage.setItem('admin_token', t);
  return t;
}

// === SAVE TO SERVER (Neon) ===
async function saveAll() {
  saveContentFields();
  saveMediaFields();

  if (ACCOUNT_MODE) {
    try {
      await savePersonalCard();
      showStatus('✅ Your invitation is saved privately to your account.', 'success');
    } catch (err) {
      showStatus('❌ ' + err.message, 'error');
    }
    return;
  }

  const token = getAdminToken();
  const sections = [['content', CONTENT], ['themes', THEMES], ['presets', PRESETS]];

  try {
    showStatus('⏳ Saving to server…', 'info');
    for (const [key, data] of sections) {
      const res = await fetch('api/config/' + key, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-admin-token': token } : {})
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Saving "${key}" failed: ${res.status} ${err.error || ''}`);
      }
    }
    clearDraft();
    showStatus('✅ All configs saved to the database! The invitation now reflects these changes for everyone.', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

async function savePersonalCard() {
  const response = await fetch('/api/me/card', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: CONTENT, themes: THEMES, presets: PRESETS }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save your invitation.');
  clearDraft();
}

async function publishCard() {
  saveContentFields();
  saveMediaFields();
  const slug = document.getElementById('card-slug').value.trim();
  try {
    setAccountMessage('Saving and publishing your invitation…');
    await savePersonalCard();
    const response = await fetch('/api/me/card/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not publish your invitation.');
    currentSlug = data.slug;
    document.getElementById('card-slug').value = data.slug;
    const link = document.getElementById('published-link');
    const publishedUrl = `${location.origin}${data.path}`;
    link.href = publishedUrl;
    link.textContent = `Published invitation: ${publishedUrl}`;
    link.classList.remove('hidden');
    setAccountMessage('Your invitation is live at the link below.');
  } catch (err) {
    setAccountMessage(err.message);
  }
}

// === LOAD RSVPs ===
async function loadRsvps() {
  const token = getAdminToken();
  const tbody = document.getElementById('rsvp-rows');
  try {
    const res = await fetch('api/rsvps', { headers: token ? { 'x-admin-token': token } : {} });
    if (res.status === 401) throw new Error('Wrong admin token.');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ('HTTP ' + res.status));
    }
    const rows = await res.json();
    document.getElementById('rsvp-count').textContent = rows.length;
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>#${r.id}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.from_side || r.from || '')}</td>
        <td>${escapeHtml(r.events || '')}</td>
        <td>${escapeHtml(r.guests || '')}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
      </tr>`).join('') || '<tr><td colspan="6">No RSVPs yet.</td></tr>';
  } catch (err) {
    showStatus('❌ Could not load RSVPs: ' + err.message, 'error');
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// === PREVIEW ===
function openPreview() {
  saveContentFields();
  saveMediaFields();
  window.open(`index.html?preview=1&draftUser=${encodeURIComponent(draftUser())}&t=${Date.now()}`, '_blank');
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
  if (confirm('This will discard unsaved draft edits and reload from the server database. Continue?')) {
    clearDraft();
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
