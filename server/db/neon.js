/**
 * Neon (serverless Postgres) data store.
 * Uses @neondatabase/serverless over plain HTTP/fetch — no persistent connections needed.
 */
const { neon } = require('@neondatabase/serverless');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rsvps (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  "from"     TEXT,
  events     TEXT,
  guests     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

function createNeonStore(connectionString) {
  const sql = neon(connectionString);

  return {
    kind: 'neon',

    async init() {
      await sql.query(SCHEMA);
    },

    async getConfig(key) {
      const rows = await sql.query(
        'SELECT value FROM site_config WHERE key = $1',
        [key]
      );
      if (!rows.length) return null;
      const v = rows[0].value;
      return typeof v === 'string' ? JSON.parse(v) : v;
    },

    async setConfig(key, value) {
      await sql.query(
        `INSERT INTO site_config (key, value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
    },

    async addRsvp(r) {
      const rows = await sql.query(
        `INSERT INTO rsvps (name, "from", events, guests)
         VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [r.name, r.from || null, r.events || null, r.guests || null]
      );
      return { id: rows[0].id, createdAt: rows[0].created_at };
    },

    async listRsvps(limit = 500) {
      const rows = await sql.query(
        'SELECT id, name, "from" AS from_side, events, guests, created_at FROM rsvps ORDER BY id DESC LIMIT $1',
        [Number(limit) || 500]
      );
      return rows;
    },
  };
}

module.exports = { createNeonStore };
