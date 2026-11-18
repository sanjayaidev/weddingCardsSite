# 💍 Wedding Invitation — Node.js + Express + Neon

A real Node.js server that serves the wedding invitation site, stores all
configuration (content / themes / layouts) and guest RSVPs in a **Neon
serverless Postgres** database. Visitors can create accounts, design personal
invitations, and publish each one at a unique URL.

## Quick start

```bash
npm install
cp .env.example .env    # add your Neon DATABASE_URL + ADMIN_TOKEN
npm start               # http://localhost:3000
```

- Invitation: `http://localhost:3000/`
- Admin panel: `http://localhost:3000/admin.html`
- Account sign-up, login, and invitation builder: `http://localhost:3000/admin.html`

Without a `DATABASE_URL`, the server automatically falls back to a local
file store in `data/` so you can develop offline. As soon as you set your
Neon connection string, everything is persisted in Postgres instead. The
`site_config`, `rsvps`, `invitation_users`, `user_sessions`, and
`invitation_cards` tables are created automatically on boot.

On Vercel, add `DATABASE_URL` and `ADMIN_TOKEN` under **Project Settings →
Environment Variables**, then redeploy. The API function creates the tables
and seeds the config on its first request. The admin token is a shared secret:
it authorizes config edits and RSVP viewing; it does not connect to Neon or
create tables. In the admin page, enter the same value as `ADMIN_TOKEN`.

Create an account in the admin page to get a private invitation editor. Its
drafts are isolated by account in that browser; **Save to Server** saves your
personal design privately. Enter a desired URL slug and choose **Save &
publish** to make it public. Slugs are unique across accounts; leave the slug
blank to generate one automatically. The live invitation is available at
`/?card=<slug>`. Admin-token editing of the shared default configuration
continues to work separately.

Passwords are hashed on the server and account sessions are stored as
hashed, expiring tokens in Neon. The browser session token is held in an
HttpOnly, SameSite=Lax cookie.

## Neon setup

1. Create a project at https://console.neon.tech
2. Copy the **connection string** into `.env`:
   `DATABASE_URL=postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`
3. Restart the local server (or make the first API request on Vercel) — tables are created and seeded from `config/*.json`.

## API

| Method | Route              | Description                                        |
|--------|--------------------|----------------------------------------------------|
| POST   | `/api/auth/register` | Create an account and private invitation |
| POST   | `/api/auth/login` | Log in and start a session |
| POST   | `/api/auth/logout` | End the current session |
| GET    | `/api/auth/session` | Check the current account session |
| GET/PUT | `/api/me/card` | Load or save the signed-in user's invitation |
| POST   | `/api/me/card/publish` | Publish at a unique slug |
| GET    | `/api/cards/:slug` | Load a published invitation |
| GET    | `/api/config`      | `{ content, themes, presets }` from the shared config |
| PUT    | `/api/config/:key` | Save shared config (`x-admin-token` header) |
| POST   | `/api/rsvp`        | Store an RSVP `{ name, from, events, guests }` |
| GET    | `/api/rsvps`      | List RSVPs (admin token required) |
| GET    | `/api/health`    | Server + DB status |

## Images

All imagery comes from the local `assets/` folder — `assets/ganesh.jpg`
is the cover/gate image, plus couple, temple, venue, gallery and event
photos. Add more media by dropping files into `assets/` and referencing
them from the admin panel.
