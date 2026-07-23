# Deploying without Docker

Local dev uses `docker-compose` for convenience, but nothing about the app
requires Docker in production. This is the free-tier stack from
[`PLAN.md` §18](PLAN.md): Vercel (web) + Render (API + worker) + Neon
(Postgres) + Upstash (Redis). All four have permanent free tiers — no card
required to start.

## 1. Postgres — Neon

1. [neon.tech](https://neon.tech) → new project → note the connection string
   it gives you (`postgresql://user:pass@host/dbname?sslmode=require`).
2. Rewrite the scheme for SQLAlchemy's psycopg driver:
   `postgresql+psycopg://user:pass@host/dbname?sslmode=require`. This is
   your `DATABASE_URL`.
3. Enable the `vector` extension once, from Neon's SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

## 2. Redis — Upstash

1. [upstash.com](https://upstash.com) → new Redis database → copy the
   **`rediss://`** (TLS) connection string. This is your `REDIS_URL`.

## 3. API + worker — Render

1. Push this repo to GitHub (already done) → Render dashboard → **New →
   Blueprint** → point it at the repo. Render reads [`render.yaml`](../render.yaml)
   at the root and creates two free services: `movie-rec-api` (web) and
   `movie-rec-worker` (background worker), both built from `api/` with
   Render's native Python runtime — no Dockerfile involved.
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
wake on the next request; the free worker does not spin down.

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
