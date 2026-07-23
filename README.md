# Recs

A single-page film recommendation dashboard built on top of Letterboxd.
Type a Letterboxd username, it imports and matches your watch history against
a local film corpus, and shows three ranked recommendation rows plus a
watchlist "spin the wheel" picker — no accounts, no sign-in, every visit
reimports fresh.

## How it works

1. **Import** — enter a Letterboxd username. The API either scrapes the
   public profile or (if you've uploaded one) parses an official Letterboxd
   export ZIP, matches each film to a TMDB id, and computes a taste profile
   (genre/director/era/country affinities, weighted against your own rating
   scale).
2. **Recommend** — three surfaces are precomputed against the local corpus:
   - **Top Picks** — ranked by overall fit to your taste.
   - **Blind Spots** — acclaimed films that fit your taste but you haven't seen.
   - **Hidden Gems** — lower-profile films your taste says you'll love.
3. **Watchlist** — your Letterboxd watchlist renders as a vertical spinning
   reel; hit Spin to land on something to watch tonight.

## Stack

- **`web/`** — Next.js 15 (App Router), TypeScript, Tailwind CSS. One route
  (`/`), no client-side routing, no accounts.
- **`api/`** — FastAPI + SQLAlchemy 2.0 + Alembic, Postgres (+pgvector) for the
  film corpus and taste vectors, Redis + [arq](https://arq-docs.helpmanual.io/)
  for the async import pipeline (scrape/parse → TMDB match → enrich → profile
  → precompute recs), served behind an SSE progress stream.

## Local development

Requires Docker.

```bash
cp .env.example .env        # add TMDB_API_KEY to actually seed/enrich films
make up                     # postgres, redis, api, worker, web
make upgrade                # apply DB migrations
make seed                   # (optional) pull a starter corpus slice from TMDB
```

- Web: http://localhost:3000
- API: http://localhost:8000 ([docs](http://localhost:8000/docs), `/health`)

Other commands: `make help`.

## Deploying

Docker is only for local dev — [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
walks through a free, no-Docker public deploy: Vercel (web) + Render (API +
worker, via [`render.yaml`](render.yaml)) + Neon (Postgres) + Upstash (Redis).

To run checks the way CI does:

```bash
# api/
ruff check . && ruff format --check . && mypy app && pytest -q

# web/
pnpm exec biome check --fix --unsafe && pnpm lint && pnpm build
```

## Repository layout

```
api/
  app/
    routers/        FastAPI route handlers (imports, profiles, feedback, health)
    domain/          pure logic — taste profile, recommend, discover, match (no I/O)
    integrations/    TMDB client, Letterboxd export parser + profile scraper
    services/        import pipeline orchestration (the state machine)
    repositories/    SQL access
  workers/           arq worker entrypoint + task queue
  alembic/           DB migrations
  tests/
web/
  app/page.tsx                     the entire frontend
  components/recs/PosterRow.tsx    scrollable recommendation row
  components/watchlist/            the spinning watchlist reel
  lib/api.ts                       typed fetch client for the API
docs/                planning docs — see below
```

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — original product/architecture plan (accounts,
  multi-page hub, social features). The live app deliberately stayed simpler
  than this — see the note at the top of that file for what actually shipped
  vs. what's still just planned.
- [`docs/RECOMMENDATION_MATH.md`](docs/RECOMMENDATION_MATH.md) — the
  recommendation engine's formulas, weights, and tuning notes. Still accurate.
- [`docs/PHASE0_SCAFFOLDING.md`](docs/PHASE0_SCAFFOLDING.md) — DB schema DDL
  and the Next↔FastAPI service contract.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to
`main` and every PR: `ruff`/`mypy`/`pytest` for the API, `biome`/`build` for
the web app.
