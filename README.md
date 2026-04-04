# ConnectBC — developer setup

Internal notes for running and hacking on the repo locally.

## Stack

| Layer | Tech |
|--------|------|
| Monorepo | npm workspaces (`client`, `server`) |
| Frontend | Vite, React, react-map-gl, Mapbox GL |
| API | Node, Express, `pg` pool |
| Data | PostgreSQL + PostGIS (`GEOGRAPHY`), bcrypt, JWT (Bearer) |

Auth: **`users`** (visitors) and **`orgs`** (nonprofits); login resolves by email; JWT includes **`role`** (`user` \| `organizer`). Protected routes use `Authorization: Bearer <token>` (`server/middleware/requireAuth.js`).

## Requirements

- Node **18+**
- **Docker** with Compose (easiest DB) or Postgres **14+** with **PostGIS** + a shell/GUI to run SQL
- Mapbox **public** token for the client map (`pk.…`)

## Clone and install

```bash
git clone <repo-url>
cd <repo-folder>
npm install
```

## Environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

| File | Variables (dev) |
|------|-------------------|
| `server/.env` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_ORIGIN`; `MAPBOX_TOKEN` optional for seed geocoding |
| `client/.env` | `VITE_MAPBOX_ACCESS_TOKEN` (required for map tiles) |

Do not commit `.env` files.

## Database

**Docker** (from repo root):

```bash
npm run db:up
```

Creates DB **`connectbc`**, user/password **`postgres`/`postgres`** (see `docker-compose.yml`). Apply migrations in order:

```powershell
# PowerShell, repo root
Get-Content server\migrations\001_initial.sql -Raw | docker compose exec -T db psql -U postgres -d connectbc
Get-Content server\migrations\002_users.sql -Raw | docker compose exec -T db psql -U postgres -d connectbc
```

```bash
# macOS / Linux
docker compose exec -T db psql -U postgres -d connectbc -f server/migrations/001_initial.sql
docker compose exec -T db psql -U postgres -d connectbc -f server/migrations/002_users.sql
```

`npm run db:down` stops containers (add `-v` to `docker compose` if you need a clean volume).

**Hosted Postgres:** set `DATABASE_URL`, enable PostGIS if available, run the same two SQL files.

## Seed

```bash
npm run seed
```

Truncates seeded tables, re-inserts demo users/orgs/events. Idempotent for local dev.

- Password for all seeded accounts: **`password123`**
- Visitor emails: `visitor1@connectbc.demo`, … (`server/seed.js`)
- Without a valid `MAPBOX_TOKEN`, seed uses baked-in lat/lng per row

## Run

```bash
npm run dev
```

- App: http://localhost:5173 — Vite proxies `/api` → http://localhost:5173 → server `PORT` (default **3001**)

**Scripts**

| Script | Use |
|--------|-----|
| `npm run dev:client` | Frontend only |
| `npm run dev:server` | API with `node --watch` |
| `npm run build` | Client production build |
| `npm run start:server` | API without watch |
| `npm run seed` | Run `server/seed.js` |
| `npm run db:up` / `db:down` | Docker Compose |

## Repo layout (dev-relevant)

```
client/src/           # React app, Mapbox, auth context
server/src/index.js   # Express bootstrap, event routes
server/routes/auth.js # POST login/register, GET me
server/middleware/    # JWT Bearer
server/migrations/    # Schema (manual apply)
server/seed.js        # Demo data
server/db.js          # pg Pool
```

**Useful checks**

```bash
curl http://localhost:3001/api/ping
```

After login, events: `GET /api/events` with `Authorization: Bearer …` (see Network tab in browser).

## Troubleshooting (dev)

| Symptom | Likely cause |
|---------|----------------|
| `ECONNREFUSED` from API/seed | Postgres down or `DATABASE_URL` wrong |
| Empty map / no pins | Not signed in, empty `events`, or need `npm run seed` |
| Gray map | Missing or invalid `VITE_MAPBOX_ACCESS_TOKEN`; restart Vite |
| 401 on `/api/*` | Missing/expired JWT; client stores token under `connectbc_token` |
| CORS errors | `CLIENT_ORIGIN` must match Vite origin (e.g. `http://localhost:5173`) |
