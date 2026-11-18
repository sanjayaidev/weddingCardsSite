/**
 * Wedding Invitation — real Node.js server (Express) with Neon Postgres storage.
 *
 * - Serves the static frontend (index.html, admin.html, css/, js/, assets/)
 * - GET  /api/config          -> { content, themes, presets } (from Neon, seeded from config/*.json on first run)
 * - PUT  /api/config/:key     -> save a config section (used by the admin panel)
 * - POST /api/rsvp            -> store an RSVP in Neon
 * - GET  /api/rsvps           -> list RSVPs (simple ADMIN_TOKEN protection)
 *
 * Env vars (.env):
 *   DATABASE_URL or NEON_CONNECTION_STRING  - Neon connection string
 *                                             (postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require)
 *   ADMIN_TOKEN                             - token required for writing config / reading RSVPs
 *   PORT                                    - default 3000
 */
require('dotenv').config();

const path = require('path');
const express = require('express');
const crypto = require('crypto');
const { promisify } = require('util');

const { createNeonStore } = require('./db/neon');
const { createFileStore } = require('./db/fileStore');

const ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const DATA_DIR = path.join(ROOT, 'data');

const CONFIG_KEYS = ['content', 'themes', 'presets'];
const SESSION_COOKIE = 'invitation_session';
const SESSION_DAYS = 30;
const scrypt = promisify(crypto.scrypt);

// ---------- Store selection (Neon if configured, else local file fallback) ----------
const connectionString = process.env.DATABASE_URL
  || process.env.NEON_CONNECTION_STRING
  || process.env.POSTGRES_URL
  || '';
const store = connectionString
  ? createNeonStore(connectionString)
  : (process.env.VERCEL ? null : createFileStore(DATA_DIR));

// ---------- Seed helpers ----------
function readSeedFile(key) {
  return require(path.join(CONFIG_DIR, `${key}.json`));
}

async function ensureSeeded(targetStore) {
  for (const key of CONFIG_KEYS) {
    const existing = await targetStore.getConfig(key);
    if (!existing) {
      await targetStore.setConfig(key, readSeedFile(key));
      console.log(`[seed] config "${key}" loaded into ${targetStore.kind} store`);
    }
  }
}

let initialization;
async function initializeStore() {
  if (!initialization) {
    initialization = (async () => {
      if (!store) {
        throw new Error('DATABASE_URL is required when running on Vercel.');
      }
      if (store.kind === 'neon') {
        await store.init();
        console.log('[db] Connected to Neon, schema ready');
      } else {
        console.log('[db] No DATABASE_URL set — using local file store (data/). Set it in .env to enable Neon.');
      }
      await ensureSeeded(store);
    })();
  }
  return initialization;
}

async function getConfigSafe(key) {
  try {
    const val = await store.getConfig(key);
    if (val) return val;
  } catch (err) {
    console.error(`[store] failed to read ${key}:`, err.message);
  }
  // fall back to bundled seed file so the site always renders
  try { return readSeedFile(key); } catch { return null; }
}

// ---------- Admin auth ----------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    if (process.env.VERCEL) {
      return res.status(503).json({ error: 'ADMIN_TOKEN is not configured on the server.' });
    }
    return next();
  }
  const given = req.headers['x-admin-token'] || req.query.token || '';
  if (given !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — provide x-admin-token header' });
  }
  next();
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sessionCookieOptions(req) {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

async function authenticatedUser(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return store.getSession(hashToken(token));
}

function requireUser(req, res, next) {
  authenticatedUser(req).then((user) => {
    if (!user) return res.status(401).json({ error: 'Please log in to continue.' });
    req.user = user;
    next();
  }).catch((err) => {
    console.error('[auth] session lookup failed:', err.message);
    res.status(500).json({ error: 'Could not verify your session.' });
  });
}

async function setSession(user, req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await store.createSession(hashToken(token), user.id, expiresAt);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
}

async function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [saltHex, hashHex] = String(encoded || '').split(':');
  if (!/^[\da-f]{32}$/i.test(saltHex || '') || !/^[\da-f]{128}$/i.test(hashHex || '')) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hashHex, 'hex'));
}

function makeSlug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/g, '');
}

// ---------- App ----------
const app = express();
app.use(express.json({ limit: '2mb' }));

// API ---------------------------------------------------
app.use('/api', async (req, res, next) => {
  try {
    await initializeStore();
    next();
  } catch (err) {
    console.error('[db] initialization failed:', err.message);
    res.status(503).json({ error: 'Database is not configured or is unavailable.' });
  }
});
app.use(['/api/auth', '/api/me'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try { await store.getConfig('content'); } catch (e) { db = 'error: ' + e.message; }
  res.json({ ok: true, store: store.kind, db });
});

app.post('/api/auth/register', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }

  try {
    const user = await store.createAccount(
      { id: crypto.randomUUID(), email, passwordHash: await passwordHash(password) },
      {
        content: readSeedFile('content'),
        themes: readSeedFile('themes'),
        presets: readSeedFile('presets'),
      }
    );
    await setSession(user, req, res);
    res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('[auth] account creation failed:', err.message);
    res.status(500).json({ error: 'Could not create your account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  try {
    const user = await store.getUserByEmail(email);
    if (password.length > 128 || !user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await setSession(user, req, res);
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[auth] login failed:', err.message);
    res.status(500).json({ error: 'Could not log in.' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const user = await authenticatedUser(req);
    res.json({ user: user ? { id: user.user_id, email: user.email } : null });
  } catch (err) {
    console.error('[auth] session lookup failed:', err.message);
    res.status(500).json({ error: 'Could not verify your session.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getCookie(req, SESSION_COOKIE);
    if (token) await store.deleteSession(hashToken(token));
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(req));
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] logout failed:', err.message);
    res.status(500).json({ error: 'Could not log out.' });
  }
});

app.get('/api/me/card', requireUser, async (req, res) => {
  try {
    const card = await store.getCard(req.user.user_id);
    if (!card) return res.status(404).json({ error: 'Invitation card not found.' });
    res.json(card);
  } catch (err) {
    console.error('[cards] failed to load user card:', err.message);
    res.status(500).json({ error: 'Could not load your invitation.' });
  }
});

app.put('/api/me/card', requireUser, async (req, res) => {
  const card = req.body;
  if (!card || typeof card !== 'object' || Array.isArray(card)
    || !['content', 'themes', 'presets'].every((key) => card[key] && typeof card[key] === 'object' && !Array.isArray(card[key]))) {
    return res.status(400).json({ error: 'Provide content, themes, and presets objects.' });
  }
  try {
    await store.saveCard(req.user.user_id, card);
    res.json({ ok: true });
  } catch (err) {
    console.error('[cards] failed to save user card:', err.message);
    res.status(500).json({ error: 'Could not save your invitation.' });
  }
});

app.post('/api/me/card/publish', requireUser, async (req, res) => {
  try {
    const card = await store.getCard(req.user.user_id);
    if (!card) return res.status(404).json({ error: 'Invitation card not found.' });
    const proposed = typeof req.body?.slug === 'string' && req.body.slug.trim()
      ? makeSlug(req.body.slug)
      : `${makeSlug(`${card.content.hero?.name1 || ''}-${card.content.hero?.name2 || ''}`) || 'invitation'}-${crypto.randomBytes(3).toString('hex')}`;
    if (proposed.length < 3 || proposed.length > 60) {
      return res.status(400).json({ error: 'URL must contain 3 to 60 letters or numbers.' });
    }
    const published = await store.publishCard(req.user.user_id, proposed);
    res.json({ slug: published.slug, path: `/?card=${encodeURIComponent(published.slug)}` });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That invitation URL is already taken. Try another one.' });
    console.error('[cards] failed to publish user card:', err.message);
    res.status(500).json({ error: 'Could not publish your invitation.' });
  }
});

app.get('/api/cards/:slug', async (req, res) => {
  try {
    const card = await store.getPublishedCard(req.params.slug);
    if (!card) return res.status(404).json({ error: 'Invitation not found.' });
    res.json(card);
  } catch (err) {
    console.error('[cards] failed to load published card:', err.message);
    res.status(500).json({ error: 'Could not load invitation.' });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const [content, themes, presets] = await Promise.all(CONFIG_KEYS.map(getConfigSafe));
    res.json({ content, themes, presets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

app.put('/api/config/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!CONFIG_KEYS.includes(key)) return res.status(400).json({ error: `Unknown config key "${key}"` });
  const data = req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Body must be a JSON object' });
  }
  try {
    await store.setConfig(key, data);
    res.json({ ok: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.post('/api/rsvp', async (req, res) => {
  const { name, from, events, guests } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  const clean = (v) => (typeof v === 'string' ? v.slice(0, 200).trim() : null);
  try {
    const r = await store.addRsvp({
      name: clean(String(name)),
      from: clean(from),
      events: clean(events),
      guests: clean(guests),
    });
    res.status(201).json({ ok: true, id: r.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save RSVP' });
  }
});

app.get('/api/rsvps', requireAdmin, async (req, res) => {
  try {
    res.json(await store.listRsvps(req.query.limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load RSVPs' });
  }
});

// Static frontend ---------------------------------------
app.use(express.static(ROOT, { extensions: ['html'], maxAge: '1h' }));

// ---------- Boot ----------
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  initializeStore().then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
      console.log(`   Invitation: http://localhost:${PORT}/`);
      console.log(`   Admin:      http://localhost:${PORT}/admin.html`);
    });
  }).catch((err) => {
    console.error('[db] initialization failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = app;
