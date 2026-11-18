# 💍 Wedding Invitation — Node.js + Express + Neon

A real Node.js server that serves the wedding invitation site and stores
configuration (content / themes / layouts) in a **Neon serverless Postgres**
database. Visitors can create accounts, design personal invitations, and
publish each one at a unique URL.

## Quick start

```bash
npm install
cp .env.example .env    # add your Neon DATABASE_URL + ADMIN_TOKEN
npm start               # http://localhost:3000
```

- Invitation: `http://localhost:3000/`
- Admin panel and account invitation builder: `http://localhost:3000/admin.html`

Without a `DATABASE_URL`, the server automatically falls back to a local
file store in `data/` so you can develop offline. As soon as you set your
Neon connection string, everything is persisted in Postgres instead. The
`site_config`, `rsvps`, `invitation_users`, `user_sessions`, and
`invitation_cards` tables are created automatically on boot.

On Vercel, add `DATABASE_URL` and, if using shared admin tools, `ADMIN_TOKEN`
under **Project Settings → Environment Variables**, then redeploy. The API
function creates the tables and seeds the config on its first request. The
admin token is a shared secret for shared config edits and legacy RSVP viewing;
it does not connect to Neon or create tables.

Create an account in the admin page to get a private invitation editor. Its
drafts are isolated by account in that browser. **Save Draft** saves locally
when signed out and privately to the account when signed in. Enter a desired
URL slug and choose **Save & publish** to make it public. Slugs are unique
across accounts; leave the slug blank to generate one automatically. The live
invitation is available at `/?card=<slug>`.

The invitation content editor exposes all configured text, dates, lists, and
other content fields. The Events tab lets you edit event details and add or
remove event days and events. Images and music are edited in their own tab.

The media editor supports the gate, hero, story background, banner, venue,
gallery photos (including add/remove), gallery feature photo, and each event's
photo. RSVP submissions open WhatsApp directly; the host number is stored
with that account's invitation, so each published card uses its own number.
New replies are not written to the RSVP database table.

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
| POST   | `/api/rsvp`        | Legacy endpoint to store an RSVP                    |
| GET    | `/api/rsvps`      | List previously stored RSVPs (admin token required) |
| GET    | `/api/health`    | Server + DB status |

## Images

The admin media panel accepts asset paths or image URLs for the gate, hero,
story, banner, venue, gallery, and each event. Local imagery lives in
`assets/`; add files there and reference them in the editor.
