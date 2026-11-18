/**
 * File-based fallback store (used when DATABASE_URL / NEON connection is not configured).
 * Behaves with the same async API as the Neon store so the rest of the app doesn't care.
 */
const fs = require('fs');
const path = require('path');

function createFileStore(dataDir) {
  const configDir = path.join(dataDir, 'config');
  const rsvpFile = path.join(dataDir, 'rsvps.json');
  const accountsFile = path.join(dataDir, 'accounts.json');

  fs.mkdirSync(configDir, { recursive: true });
  if (!fs.existsSync(rsvpFile)) fs.writeFileSync(rsvpFile, '[]');
  if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, JSON.stringify({ users: [], sessions: [], cards: [] }));

  const cfgPath = (key) => path.join(configDir, `${key}.json`);

  return {
    kind: 'file',

    async init() {},

    async getConfig(key) {
      try {
        return JSON.parse(fs.readFileSync(cfgPath(key), 'utf8'));
      } catch {
        return null;
      }
    },

    async setConfig(key, value) {
      fs.writeFileSync(cfgPath(key), JSON.stringify(value, null, 2));
    },

    async addRsvp(r) {
      const list = JSON.parse(fs.readFileSync(rsvpFile, 'utf8'));
      const entry = {
        id: list.length ? list[list.length - 1].id + 1 : 1,
        name: r.name,
        from: r.from || null,
        events: r.events || null,
        guests: r.guests || null,
        created_at: new Date().toISOString(),
      };
      list.push(entry);
      fs.writeFileSync(rsvpFile, JSON.stringify(list, null, 2));
      return { id: entry.id, createdAt: entry.created_at };
    },

    async listRsvps(limit = 500) {
      const list = JSON.parse(fs.readFileSync(rsvpFile, 'utf8'));
      return list.slice(-limit).reverse();
    },

    async createAccount(user, card) {
      const data = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      if (data.users.some((entry) => entry.email === user.email)) {
        const error = new Error('Email already registered');
        error.code = '23505';
        throw error;
      }
      data.users.push({ id: user.id, email: user.email, password_hash: user.passwordHash });
      data.cards.push({ user_id: user.id, ...card, slug: null, published_at: null });
      fs.writeFileSync(accountsFile, JSON.stringify(data, null, 2));
      return { id: user.id, email: user.email };
    },

    async getUserByEmail(email) {
      const { users } = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      const user = users.find((entry) => entry.email === email);
      return user ? { id: user.id, email: user.email, password_hash: user.password_hash } : null;
    },

    async createSession(tokenHash, userId, expiresAt) {
      const data = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      data.sessions = data.sessions.filter((session) => Date.parse(session.expires_at) > Date.now());
      data.sessions.push({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt });
      fs.writeFileSync(accountsFile, JSON.stringify(data, null, 2));
    },

    async getSession(tokenHash) {
      const { users, sessions } = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      const session = sessions.find((entry) => entry.token_hash === tokenHash && Date.parse(entry.expires_at) > Date.now());
      const user = session && users.find((entry) => entry.id === session.user_id);
      return user ? { user_id: user.id, email: user.email } : null;
    },

    async deleteSession(tokenHash) {
      const data = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      data.sessions = data.sessions.filter((session) => session.token_hash !== tokenHash);
      fs.writeFileSync(accountsFile, JSON.stringify(data, null, 2));
    },

    async getCard(userId) {
      const { cards } = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      return cards.find((card) => card.user_id === userId) || null;
    },

    async saveCard(userId, card) {
      const data = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      const saved = data.cards.find((entry) => entry.user_id === userId);
      if (!saved) throw new Error('Invitation card not found');
      Object.assign(saved, card);
      fs.writeFileSync(accountsFile, JSON.stringify(data, null, 2));
    },

    async publishCard(userId, slug) {
      const data = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      if (data.cards.some((card) => card.slug === slug && card.user_id !== userId)) {
        const error = new Error('Invitation URL is already taken');
        error.code = '23505';
        throw error;
      }
      const card = data.cards.find((entry) => entry.user_id === userId);
      if (!card) throw new Error('Invitation card not found');
      card.slug = slug;
      card.published_at = new Date().toISOString();
      fs.writeFileSync(accountsFile, JSON.stringify(data, null, 2));
      return { slug: card.slug, published_at: card.published_at };
    },

    async getPublishedCard(slug) {
      const { cards } = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      return cards.find((card) => card.slug === slug && card.published_at) || null;
    },
  };
}

module.exports = { createFileStore };
