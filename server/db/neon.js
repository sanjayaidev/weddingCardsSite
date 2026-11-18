/**
 * Neon (serverless Postgres) data store.
 * Uses @neondatabase/serverless over plain HTTP/fetch — no persistent connections needed.
 */
const { neon } = require('@neondatabase/serverless');

function createNeonStore(connectionString) {
  const sql = neon(connectionString);

  return {
    kind: 'neon',

    async init() {
      await sql.query(`
        CREATE TABLE IF NOT EXISTS site_config (
          key        TEXT PRIMARY KEY,
          value      JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS rsvps (
          id         BIGSERIAL PRIMARY KEY,
          name       TEXT NOT NULL,
          "from"     TEXT,
          events     TEXT,
          guests     TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS invitation_users (
          id            UUID PRIMARY KEY,
          email         TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id    UUID NOT NULL REFERENCES invitation_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS invitation_cards (
          user_id      UUID PRIMARY KEY REFERENCES invitation_users(id) ON DELETE CASCADE,
          slug         TEXT UNIQUE,
          content      JSONB NOT NULL,
          themes       JSONB NOT NULL,
          presets      JSONB NOT NULL,
          published_at TIMESTAMPTZ,
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
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

    async createAccount(user, card) {
      const rows = await sql.query(
        `WITH new_user AS (
           INSERT INTO invitation_users (id, email, password_hash)
           VALUES ($1, $2, $3) RETURNING id, email
         )
         INSERT INTO invitation_cards (user_id, content, themes, presets)
         SELECT id, $4::jsonb, $5::jsonb, $6::jsonb FROM new_user
         RETURNING user_id`,
        [user.id, user.email, user.passwordHash, JSON.stringify(card.content), JSON.stringify(card.themes), JSON.stringify(card.presets)]
      );
      return { id: rows[0].user_id, email: user.email };
    },

    async getUserByEmail(email) {
      const rows = await sql.query(
        'SELECT id, email, password_hash FROM invitation_users WHERE email = $1',
        [email]
      );
      return rows[0] || null;
    },

    async createSession(tokenHash, userId, expiresAt) {
      await sql.query(
        `INSERT INTO user_sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [tokenHash, userId, expiresAt]
      );
      await sql.query('DELETE FROM user_sessions WHERE expires_at <= now()');
    },

    async getSession(tokenHash) {
      const rows = await sql.query(
        `SELECT s.user_id, u.email
         FROM user_sessions s
         JOIN invitation_users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [tokenHash]
      );
      return rows[0] || null;
    },

    async deleteSession(tokenHash) {
      await sql.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
    },

    async getCard(userId) {
      const rows = await sql.query(
        `SELECT content, themes, presets, slug, published_at
         FROM invitation_cards WHERE user_id = $1`,
        [userId]
      );
      return rows[0] || null;
    },

    async saveCard(userId, card) {
      await sql.query(
        `UPDATE invitation_cards
         SET content = $2::jsonb, themes = $3::jsonb, presets = $4::jsonb, updated_at = now()
         WHERE user_id = $1`,
        [userId, JSON.stringify(card.content), JSON.stringify(card.themes), JSON.stringify(card.presets)]
      );
    },

    async publishCard(userId, slug) {
      const rows = await sql.query(
        `UPDATE invitation_cards
         SET slug = $2, published_at = now(), updated_at = now()
         WHERE user_id = $1
         RETURNING slug, published_at`,
        [userId, slug]
      );
      return rows[0] || null;
    },

    async getPublishedCard(slug) {
      const rows = await sql.query(
        `SELECT content, themes, presets, slug
         FROM invitation_cards WHERE slug = $1 AND published_at IS NOT NULL`,
        [slug]
      );
      return rows[0] || null;
    },
  };
}

module.exports = { createNeonStore };
