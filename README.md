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

On Vercel, add `DATABASE_URL` and `ADMIN_TOKEN` under **Project Settings →
Environment Variables**, then redeploy. The API function creates the tables
and seeds the config on its first request. The admin token is a shared secret:
it authorizes config edits and RSVP viewing; it does not connect to Neon or
create tables. In the admin page, enter the same value as `ADMIN_TOKEN`.

The admin page keeps unsaved changes in that browser's local storage. Click
**Live Preview** to open the invitation with those draft changes; click
**Save to Server** to publish them for all visitors.

## Neon setup

1. Create a project at https://console.neon.tech
2. Copy the **connection string** into `.env`:
   `DATABASE_URL=postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`
3. Restart the local server (or make the first API request on Vercel) — tables are created and seeded from `config/*.json`.

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
