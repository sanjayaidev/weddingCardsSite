/**
 * File-based fallback store (used when DATABASE_URL / NEON connection is not configured).
 * Behaves with the same async API as the Neon store so the rest of the app doesn't care.
 */
const fs = require('fs');
const path = require('path');

function createFileStore(dataDir) {
  const configDir = path.join(dataDir, 'config');
  const rsvpFile = path.join(dataDir, 'rsvps.json');

  fs.mkdirSync(configDir, { recursive: true });
  if (!fs.existsSync(rsvpFile)) fs.writeFileSync(rsvpFile, '[]');

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
  };
}

module.exports = { createFileStore };
