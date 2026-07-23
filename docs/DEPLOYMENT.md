# Deploying without Docker

Local dev uses `docker-compose` for convenience, but nothing about the app
requires Docker in production. This is the free-tier stack from
[`PLAN.md` §18](PLAN.md): Vercel (web) + Render (API + worker) + Neon
(Postgres) + Upstash (Redis). All four have permanent free tiers — no card
required to start.

## 1. Postgres — Neon

1. Sign up at [console.neon.tech/signup](https://console.neon.tech/signup)
   (email, GitHub, or Google — no credit card for the free tier) and create a
   project. Neon gives it a default `production` branch with a database and
   compute already provisioned.
2. On the Project Dashboard, click **Connect** → pick the branch/database/role
   → copy the connection string. Neon gives you two variants:
   - **Pooled** (hostname ends in `-pooler`) — use this one for the app's
     `DATABASE_URL` (Render's API service makes many short-lived connections;
     pooling handles that better on the free tier).
   - **Direct** (no `-pooler`) — use this one *once*, locally, for running
     `alembic upgrade head` (schema migrations can misbehave through
     PgBouncer's transaction-pooling mode).
3. Rewrite the scheme for SQLAlchemy's psycopg driver — Neon gives you
   `postgresql://...`, change it to `postgresql+psycopg://...`. That's your
   `DATABASE_URL`. If psycopg complains about `channel_binding=require` in
   the query string, just drop that parameter.
4. Enable the `vector` extension once, from Neon's SQL editor (Dashboard →
   SQL Editor):
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

## 2. Redis — Upstash

1. [upstash.com](https://upstash.com) → new Redis database → copy the
   **`rediss://`** (TLS) connection string. This is your `REDIS_URL`.

## 3. API + worker — Render

Render's free plan only supports the **web** service type — background
workers need a paid plan. So instead of a separate worker service, the API
runs the arq worker as a background task inside the same process
(`RUN_WORKER_IN_PROCESS=true`, already set in `render.yaml`). Local dev via
`docker-compose` is unaffected — it still runs `api` and `worker` as separate
containers.

1. Push this repo to GitHub (already done) → Render dashboard → **New →
   Blueprint** → point it at the repo. Render reads [`render.yaml`](../render.yaml)
   at the root and creates one free web service, `movie-rec-api`, built from
   `api/` with Render's native Python runtime — no Dockerfile involved.
2. When prompted, fill in the env vars marked `sync: false`:
   `DATABASE_URL`, `REDIS_URL` (from steps 1–2), `TMDB_API_KEY`,
   `TMDB_READ_TOKEN` ([themoviedb.org](https://www.themoviedb.org/settings/api)),
   and `APP_BASE_URL` (your Vercel URL — you can update this after step 4
   once you know it; the API only needs it correct for CORS).
3. Run migrations once, from the `movie-rec-api` service's Shell tab in
   Render's dashboard:
   ```bash
   alembic upgrade head
   ```
4. (Optional) Seed a starter corpus the same way:
   ```bash
   python -m app.scripts.seed_corpus
   ```
5. Note the API's public URL (`https://movie-rec-api.onrender.com` or
   similar) — you'll need it for step 4 below.

Render's free web services spin down after inactivity and take ~30–60s to
wake on the next request — the embedded worker spins down with it, so a
queued import just resumes once the next request wakes the service back up.

## 4. Web — Vercel

1. [vercel.com](https://vercel.com) → New Project → import this repo.
2. Set **Root Directory** to `web` (Project Settings → General — this repo
   is a monorepo, Vercel needs to know where the Next.js app lives).
3. Add an env var: `NEXT_PUBLIC_API_BASE_URL` = the Render API URL from
   step 3.5, e.g. `https://movie-rec-api.onrender.com`.
4. Deploy. Vercel builds and hosts the Next.js app natively — no Docker.
5. Go back to Render and update `APP_BASE_URL` on `movie-rec-api` to the
   Vercel URL it just gave you (`https://your-app.vercel.app`), so CORS
   allows the deployed frontend to call the API.

## Updating after a deploy

- **Web**: every push to `main` auto-redeploys on Vercel.
- **API/worker**: every push to `main` auto-redeploys on Render (per the
  blueprint). New migrations still need `alembic upgrade head` run manually
  from the Shell tab — there's no auto-migrate step.
