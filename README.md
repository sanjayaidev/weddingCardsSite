# 💍 Wedding Invitation — Node.js + Express + Neon

A real Node.js server that serves the wedding invitation site, stores all
configuration (content / themes / layouts) and guest RSVPs in a **Neon
serverless Postgres** database.

## Quick start

```bash
npm install
cp .env.example .env    # add your Neon DATABASE_URL + ADMIN_TOKEN
npm start               # http://localhost:3000
```

- Invitation: `http://localhost:3000/`
- Admin panel: `http://localhost:3000/admin.html`

Without a `DATABASE_URL`, the server automatically falls back to a local
file store in `data/` so you can develop offline. As soon as you set your
Neon connection string, everything is persisted in Postgres instead
(schema `site_config` + `rsvps` is created automatically on boot).

## Neon setup

1. Create a project at https://console.neon.tech
2. Copy the **connection string** into `.env`:
   `DATABASE_URL=postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`
3. Restart the server — tables are created and seeded from `config/*.json` on first run.

## API

| Method | Route              | Description                                        |
|--------|--------------------|----------------------------------------------------|
| GET    | `/api/config`      | `{ content, themes, presets }` from the database   |
| PUT    | `/api/config/:key` | Save a config section (`x-admin-token` header)     |
| POST   | `/api/rsvp`        | Store an RSVP `{ name, from, events, guests }`     |
| GET    | `/api/rsvps`       | List RSVPs (admin token required)                  |
| GET    | `/api/health`      | Server + DB status                                 |

## Images

All imagery comes from the local `assets/` folder — `assets/ganesh.jpg`
is the cover/gate image, plus couple, temple, venue, gallery and event
photos. Add more media by dropping files into `assets/` and referencing
them from the admin panel.
