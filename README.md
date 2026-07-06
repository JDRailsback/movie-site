# Recs — taste-driven film discovery

A discovery layer on top of Letterboxd: it ingests your watch history and
generates explainable, personalized film recommendations across multiple lenses.
Not a Letterboxd replacement — the intelligent recommendation layer it lacks.

> **North-star metric:** does the user discover a film they end up watching and
> loving that they wouldn't have found otherwise?

## Documentation

Planning is the source of truth for architecture and product direction — read
these before changing it. Note: both docs predate the current frontend, which
intentionally diverged from the planned multi-page/accounts design in favor of
a single-page, no-accounts dashboard (see "Current state" below and the note at
the top of each doc).

- [`docs/PLAN.md`](docs/PLAN.md) — product scope, architecture, data strategy, roadmap, decisions.
- [`docs/RECOMMENDATION_MATH.md`](docs/RECOMMENDATION_MATH.md) — engine formulas, weights, tuning.
- [`docs/PHASE0_SCAFFOLDING.md`](docs/PHASE0_SCAFFOLDING.md) — repo layout, schema DDL, service contract.

## Stack

- **web/** — Next.js (App Router) + TypeScript + Tailwind CSS. Single-page
  dashboard, no client-side routing beyond `/`.
- **api/** — FastAPI + SQLAlchemy + Alembic; arq workers; Postgres (+pgvector) + Redis.
- $0 / free-tier deployment posture (PLAN §18).

## Quick start (local)

Requires Docker. Then:

```bash
cp .env.example .env        # add TMDB_API_KEY when ready to seed
make up                     # postgres, redis, api, worker, web
make upgrade                # apply DB migrations
# api:  http://localhost:8000/health   docs: http://localhost:8000/docs
# web:  http://localhost:3000
```

Other commands: `make help`.

## Current state

The frontend is a single page (`web/app/page.tsx`): enter a Letterboxd
username, it imports and polls until ready, then shows three recommendation
rows (Top Picks, Blind Spots, Hidden Gems) plus a watchlist "spin the wheel"
picker. There is no login/accounts — every visit reimports the username fresh,
nothing persists client-side. The earlier multi-route design (per-profile hub,
Match, Discover, Taste, Settings pages) was built and then removed in favor of
this streamlined dashboard.

Backend-side, the API still exposes most of the originally planned surface
(imports, profiles/taste, recommendations, feedback, match, discover) — see
`api/app/routers/` for what's actually mounted. Magic-link auth (`api/app/routers/auth.py`)
exists as a stub; the frontend does not use it.

## Status

**Phase 0/1 foundations are largely in place; later phases are partial.**

- ✅ Repo skeleton, docker-compose, schema migrations, FastAPI app + arq worker.
- ✅ TMDB integration (cache + single-flight), enrichment parser, corpus seeding
  (`api/app/scripts/seed_corpus.py`, `api/scripts/seed_catalog.py`).
- ✅ Import state machine + SSE progress + Letterboxd export-ZIP parser + username
  scraper + title→TMDB matching, end-to-end through `ready`.
- ✅ Taste profile engine, recommendation surfaces (overall/blind_spots/hidden_gems),
  feedback endpoint.
- ⬜ Magic-link auth wired up client-side (stubbed, unused by the current UI).
- ⬜ Multi-page profile hub, compare/share routes, era/country explorer,
  collaborative filtering — planned in PLAN.md but not built; current frontend
  deliberately stayed single-page instead.

See PLAN.md §16 for the original phased roadmap (read in light of the note above).
