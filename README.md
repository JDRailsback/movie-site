# Recs

A single-page film recommendation dashboard built on top of Letterboxd.
Enter a Letterboxd username (or upload an export ZIP), it matches your watch
history against a local film corpus and shows three ranked recommendation
rows plus a watchlist "spin the wheel" picker. No accounts — every visit
reimports fresh.

## How it works

1. **Import** — enter a Letterboxd username (scraped) or upload an official
   export ZIP (parsed) → each film matched to a TMDB id → a taste profile is
   computed (genre/director/era/country affinities, weighted against your own
   rating scale).
2. **Recommend** — three surfaces precomputed against the local corpus:
   - **Top Picks** — ranked by overall fit to your taste.
   - **Blind Spots** — acclaimed films that fit your taste but you haven't seen.
   - **Hidden Gems** — lower-profile films your taste says you'll love.
3. **Watchlist** — your Letterboxd watchlist as a spinning reel; hit Spin to
   land on something to watch tonight.

## Stack

- **`web/`** — Next.js 15 (App Router), TypeScript, Tailwind CSS. One route
  (`/`), no accounts.
- **`api/`** — FastAPI + SQLAlchemy 2.0 + Alembic, Postgres (+pgvector) for the
  corpus and taste vectors, Redis + [arq](https://arq-docs.helpmanual.io/) for
  the async import pipeline (match → enrich → profile → precompute recs),
  served behind an SSE progress stream.

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

Other commands: `make help`. To run checks the way CI does:

```bash
# api/
ruff check . && ruff format --check . && mypy app && pytest -q

# web/
pnpm exec biome check --fix --unsafe && pnpm lint && pnpm build
```

## Deploying

[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) walks through a free, no-Docker
public deploy: Vercel (web) + Render (API, running the import worker
in-process — see [`render.yaml`](render.yaml)) + Neon (Postgres) + Upstash
(Redis).

**Known limitation:** Letterboxd's bot protection blocks/stalls scrape
requests from cloud-hosting IPs (confirmed on Render — identical requests
succeed instantly from a home network). Username import may not work on the
public deployment; the export-ZIP upload always works since it never talks
to Letterboxd's servers.

## Repository layout

```
api/
  app/
    routers/        FastAPI route handlers (imports, profiles, feedback, health)
    domain/          pure logic — taste profile, recommend, discover, match (no I/O)
    integrations/    TMDB client, Letterboxd export parser + profile scraper
    services/        import pipeline orchestration (the state machine)
    repositories/    SQL access
  workers/           arq worker (runs standalone locally, in-process on Render)
  alembic/           DB migrations
  tests/
web/
  app/page.tsx                     the entire frontend
  components/recs/PosterRow.tsx    scrollable recommendation row
  components/watchlist/            the spinning watchlist reel
  lib/api.ts                       typed fetch client for the API
docs/                planning + deployment docs — see below
```

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — original product/architecture plan
  (accounts, multi-page hub, social features). The live app deliberately
  stayed simpler — see the note at the top of that file for what shipped
  vs. what's still just planned.
- [`docs/RECOMMENDATION_MATH.md`](docs/RECOMMENDATION_MATH.md) — the
  recommendation engine's formulas, weights, and tuning notes. Still accurate.
- [`docs/PHASE0_SCAFFOLDING.md`](docs/PHASE0_SCAFFOLDING.md) — DB schema DDL
  and the Next↔FastAPI service contract.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — step-by-step public deploy.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to
`main` and every PR: `ruff`/`mypy`/`pytest` for the API, `biome`/`build` for
the web app.
