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
const fs = require('fs');
const express = require('express');

const { createNeonStore } = require('./db/neon');
const { createFileStore } = require('./db/fileStore');

const ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const DATA_DIR = path.join(ROOT, 'data');

const CONFIG_KEYS = ['content', 'themes', 'presets'];

// ---------- Store selection (Neon if configured, else local file fallback) ----------
const connectionString = process.env.DATABASE_URL || process.env.NEON_CONNECTION_STRING || '';
const store = connectionString ? createNeonStore(connectionString) : createFileStore(DATA_DIR);

// ---------- Seed helpers ----------
function readSeedFile(key) {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${key}.json`), 'utf8'));
}

async function ensureSeeded() {
  for (const key of CONFIG_KEYS) {
    const existing = await store.getConfig(key);
    if (!existing) {
      await store.setConfig(key, readSeedFile(key));
      console.log(`[seed] config "${key}" loaded into ${store.kind} store`);
    }
  }
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
  if (!ADMIN_TOKEN) return next(); // no token configured -> open (local dev)
  const given = req.headers['x-admin-token'] || req.query.token || '';
  if (given !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — provide x-admin-token header' });
  }
  next();
}

// ---------- App ----------
const app = express();
app.use(express.json({ limit: '2mb' }));

// API ---------------------------------------------------
app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try { await store.getConfig('content'); } catch (e) { db = 'error: ' + e.message; }
  res.json({ ok: true, store: store.kind, db });
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

(async () => {
  try {
    if (store.kind === 'neon') {
      await store.init();
      console.log('[db] Connected to Neon, schema ready');
    } else {
      console.log('[db] No DATABASE_URL set — using local file store (data/). Set it in .env to enable Neon.');
    }
    await ensureSeeded();
  } catch (err) {
    console.error('[db] init failed, falling back to file store:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`   Invitation: http://localhost:${PORT}/`);
    console.log(`   Admin:      http://localhost:${PORT}/admin.html`);
  });
})();
