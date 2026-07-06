# Phase 0 — Foundations & Scaffolding

> Companion to PLAN.md and RECOMMENDATION_MATH.md. This defines the repo layout,
> the database schema (DDL), the Next ↔ FastAPI contract, and the Phase-0
> checklist. Nothing here is application logic — it's the skeleton everything else
> hangs off. Goal of Phase 0: a deployable empty app where an export can be
> uploaded, a corpus seed job runs, and the import state machine advances through
> its stages (even if stages are stubs).

> **Note (current build, 2026-06-30):** the `api/` tree below still matches
> reality fairly closely. The `web/` tree does not — the frontend was
> simplified to a single page with no auth, no per-profile routes, and no
> `components/ui|film|charts` split (see [PLAN.md](PLAN.md)'s note and the root
> [README.md](../README.md) "Current state"). Treat the `web/` portion of §1 and
> the auth rows in §4 as the original target, not the current layout.

---

## 1. Repository layout (monorepo)

```
movie-site/
├── docs/
│   ├── PLAN.md
│   ├── RECOMMENDATION_MATH.md
│   └── PHASE0_SCAFFOLDING.md
├── docker-compose.yml            # postgres(+pgvector), redis, api, worker, web
├── .env.example                  # all required env vars, documented
├── Makefile                      # up / down / migrate / seed / test / fmt
│
├── web/                          # Next.js (App Router, TS)
│   ├── app/
│   │   ├── (marketing)/page.tsx          # landing + entry
│   │   ├── import/[importId]/page.tsx     # SSE progress
│   │   ├── p/[profile]/page.tsx           # profile hub
│   │   ├── p/[profile]/recs/[surface]/page.tsx
│   │   ├── p/[profile]/explore/page.tsx
│   │   ├── compare/[a]/[b]/page.tsx
│   │   ├── s/[shareId]/page.tsx
│   │   └── api/                            # thin BFF: auth callbacks, SSE proxy, uploads
│   ├── components/
│   │   ├── ui/                  # design-system primitives (Button, Card, Skeleton…)
│   │   ├── film/                # FilmCard, PosterImage, WhyThisChip, FeedbackBar
│   │   └── charts/              # GenreBar, WorldHeatmap, DecadeChart, TimelineArea
│   ├── lib/
│   │   ├── api-client.ts        # typed client generated from OpenAPI (see §4)
│   │   ├── sse.ts               # EventSource hook
│   │   └── auth.ts              # magic-link session helpers
│   ├── styles/tokens.css        # palette + type tokens (cream/teal/coral/yellow)
│   ├── tailwind.config.ts
│   └── package.json
│
├── api/                          # FastAPI service
│   ├── app/
│   │   ├── main.py              # app factory, router mount, CORS, OpenAPI export
│   │   ├── config.py           # pydantic-settings, reads env
│   │   ├── db/
│   │   │   ├── base.py          # SQLAlchemy engine/session
│   │   │   └── models/          # ORM models (mirror §3 DDL)
│   │   ├── schemas/             # pydantic request/response (the contract types)
│   │   ├── routers/
│   │   │   ├── auth.py          # magic link request/verify
│   │   │   ├── imports.py       # create import, status, SSE stream
│   │   │   ├── profiles.py      # taste profile read
│   │   │   ├── recommendations.py
│   │   │   ├── feedback.py
│   │   │   └── compare.py
│   │   ├── domain/              # pure logic, no web/db deps (unit-testable)
│   │   │   ├── matching/        # title+year → tmdb_id
│   │   │   ├── taste/           # taste-profile engine (RECOMMENDATION_MATH §2-8)
│   │   │   └── recommend/       # candidate gen, ranker, MMR, surfaces
│   │   ├── integrations/
│   │   │   ├── tmdb.py          # client + cache + single-flight
│   │   │   └── letterboxd/      # export parser + scraper adapter (versioned)
│   │   └── services/            # orchestration (import pipeline state machine)
│   ├── workers/
│   │   ├── arq_app.py           # arq worker settings + queues
│   │   └── tasks/               # import, enrich, corpus_refresh, precompute_recs
│   ├── alembic/                 # migrations
│   ├── tests/
│   │   ├── unit/                # domain logic, golden-profile tests
│   │   ├── contract/            # scraper fixtures, OpenAPI snapshot
│   │   └── fixtures/            # sample export ZIP, sample HTML, golden profile
│   ├── pyproject.toml
│   └── Dockerfile
│
└── data/
    ├── movielens/               # 25M dataset (gitignored; download script)
    └── seed/                    # TMDB id-export ingest scripts
```

**Boundaries that matter:** `domain/` has zero web/db imports (pure functions over
plain data) so the math is unit-testable in isolation. `integrations/` is the only
place that talks to the outside world. `services/` orchestrates.

---

## 2. Environments & tooling

- **Python:** 3.12, `uv` for deps, `ruff` (lint+format), `mypy`, `pytest`.
- **Node:** Next 15 / React 19, `pnpm`, `biome` or `eslint+prettier`, `vitest` +
  Playwright (later).
- **Docker compose** brings up: `postgres` (pgvector image), `redis`, `api`,
  `worker`, `web`. One `make up` to run the whole thing locally.
- **Migrations:** Alembic. `make migrate` (autogenerate + review) / `make upgrade`.
- **Typed contract:** FastAPI emits OpenAPI; `web` generates `api-client.ts` from
  it (openapi-typescript). The contract is therefore single-sourced in pydantic.
- **CI:** lint + typecheck + unit + contract tests on PR; build images on main.

Required env (`.env.example`):
```
DATABASE_URL=postgresql+psycopg://app:app@postgres:5432/movies
REDIS_URL=redis://redis:6379/0
TMDB_API_KEY=...                 # server-side only, never shipped to web
TMDB_READ_TOKEN=...
APP_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000
MAGIC_LINK_SIGNING_KEY=...
EMAIL_PROVIDER_KEY=...            # magic-link delivery (Resend/Postmark)
DEFAULT_REGION=US
CORPUS_VOTE_COUNT_FLOOR=200       # free-tier posture (PLAN §18); lower when budget allows
MODEL_VERSION=2026.06.0
```

---

## 3. Database schema (DDL)

Postgres + `pgvector`. Abbreviated to the Phase-0/1/2 surface; Phase-3 tables
(`movielens_item_factor`, `review_embedding`) added later.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- fuzzy title matching

-- ---------- corpus ----------
CREATE TABLE film (
    tmdb_id            INTEGER PRIMARY KEY,
    imdb_id            TEXT,
    title              TEXT NOT NULL,
    original_title     TEXT,
    year               SMALLINT,
    runtime_min        SMALLINT,
    original_language  TEXT,
    overview           TEXT,
    poster_path        TEXT,
    vote_average       REAL,
    vote_count         INTEGER,
    popularity         REAL,
    weighted_rating    REAL,                   -- precomputed (MATH §3)
    adult              BOOLEAN DEFAULT FALSE,
    status             TEXT,                    -- Released, etc.
    feature_vector     halfvec(1024),          -- content vector (MATH §8.4); halfvec = 2B/dim (PLAN §18)
    enriched_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX film_year_idx        ON film (year);
CREATE INDEX film_wr_idx          ON film (weighted_rating DESC);
CREATE INDEX film_pop_idx         ON film (popularity);
CREATE INDEX film_title_trgm_idx  ON film USING gin (title gin_trgm_ops);
CREATE INDEX film_vec_idx         ON film USING hnsw (feature_vector halfvec_cosine_ops);

CREATE TABLE person (
    tmdb_id   INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    department TEXT
);

CREATE TABLE keyword (
    tmdb_id       INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    df            INTEGER DEFAULT 0,           -- document frequency
    idf           REAL,                        -- precomputed (MATH §8.1)
    is_stoplisted BOOLEAN DEFAULT FALSE
);

CREATE TABLE genre ( id INTEGER PRIMARY KEY, name TEXT NOT NULL );

-- join tables
CREATE TABLE film_genre   ( film_id INT REFERENCES film, genre_id INT REFERENCES genre,
                            PRIMARY KEY (film_id, genre_id) );
CREATE TABLE film_keyword ( film_id INT REFERENCES film, keyword_id INT REFERENCES keyword,
                            PRIMARY KEY (film_id, keyword_id) );
CREATE TABLE film_crew    ( film_id INT REFERENCES film, person_id INT REFERENCES person,
                            job TEXT,           -- 'Director' etc.
                            PRIMARY KEY (film_id, person_id, job) );
CREATE TABLE film_country ( film_id INT REFERENCES film, country_code TEXT,
                            PRIMARY KEY (film_id, country_code) );

CREATE TABLE streaming_availability (
    film_id      INT REFERENCES film,
    region       TEXT,
    provider     TEXT,
    offer_type   TEXT,                          -- flatrate/rent/buy/free
    refreshed_at TIMESTAMPTZ,
    PRIMARY KEY (film_id, region, provider, offer_type)
);

-- crosswalk cache: (normalized title, year) -> tmdb_id, reusable across users
CREATE TABLE title_crosswalk (
    norm_title TEXT,
    year       SMALLINT,
    tmdb_id    INTEGER REFERENCES film,
    confidence REAL,
    source     TEXT,                            -- 'tmdb_search' | 'lb_link'
    PRIMARY KEY (norm_title, year)
);

-- ---------- users & profiles ----------
CREATE TABLE app_user (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE,
    region      TEXT DEFAULT 'US',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE letterboxd_profile (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL,
    display_name  TEXT,
    owner_user_id UUID REFERENCES app_user,     -- null for looked-up (compare) profiles
    last_import_at TIMESTAMPTZ,
    UNIQUE (username)
);

CREATE TABLE profile_import (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID REFERENCES letterboxd_profile,
    source       TEXT NOT NULL,                 -- 'export' | 'scrape'
    status       TEXT NOT NULL DEFAULT 'queued',-- state machine (PLAN §5)
    stage_counts JSONB DEFAULT '{}',            -- {matched: 412, total: 980, ...}
    error        TEXT,
    started_at   TIMESTAMPTZ DEFAULT now(),
    finished_at  TIMESTAMPTZ
);
CREATE INDEX profile_import_profile_idx ON profile_import (profile_id, started_at DESC);

CREATE TABLE user_film_rating (
    profile_id   UUID REFERENCES letterboxd_profile,
    film_id      INTEGER REFERENCES film,
    rating_0_10  SMALLINT,                       -- null = watched but unrated
    liked        BOOLEAN DEFAULT FALSE,
    watched_date DATE,                           -- from diary; null if unknown
    review_text  TEXT,
    in_watchlist BOOLEAN DEFAULT FALSE,
    source       TEXT,
    PRIMARY KEY (profile_id, film_id)
);
CREATE INDEX ufr_profile_idx ON user_film_rating (profile_id);

-- low-confidence / unmatched films quarantined here, not in user_film_rating
CREATE TABLE unmatched_film (
    profile_id  UUID REFERENCES letterboxd_profile,
    raw_title   TEXT, raw_year SMALLINT, lb_uri TEXT,
    rating_0_10 SMALLINT, best_guess_tmdb INTEGER, confidence REAL,
    PRIMARY KEY (profile_id, lb_uri)
);

-- ---------- computed artifacts ----------
CREATE TABLE taste_profile (
    profile_id     UUID PRIMARY KEY REFERENCES letterboxd_profile,
    model_version  TEXT NOT NULL,
    mu             REAL, sigma REAL,             -- personal mean/std
    taste_vector   halfvec(1024),               -- MATH §8.4 (halfvec, PLAN §18)
    genre_affinity   JSONB,                      -- {genreId: {blend, A1..A4}}
    director_affinity JSONB,
    era_affinity     JSONB,
    country_affinity JSONB,
    runtime_pref     JSONB,                      -- {pref, sd}
    top_keywords     JSONB,
    gaps             JSONB,                       -- decade/country gap signals
    computed_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recommendation_set (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID REFERENCES letterboxd_profile,
    surface      TEXT NOT NULL,                  -- 'blind_spots' | 'hidden_gems' | ...
    params       JSONB DEFAULT '{}',             -- mood/era/country/director args
    model_version TEXT NOT NULL,
    share_id     TEXT UNIQUE,                    -- public /s/[shareId]
    computed_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (profile_id, surface, params, model_version)
);

CREATE TABLE recommendation_item (
    set_id       UUID REFERENCES recommendation_set,
    film_id      INTEGER REFERENCES film,
    rank         SMALLINT,
    score        REAL,
    components    JSONB,                          -- per-component contributions
    explanation   JSONB,                          -- rendered "why this" strings + source
    PRIMARY KEY (set_id, film_id)
);

CREATE TABLE user_feedback (
    profile_id  UUID REFERENCES letterboxd_profile,
    film_id     INTEGER REFERENCES film,
    action      TEXT NOT NULL,                    -- seen|loved|not_interested|watchlist|watched_because
    surface     TEXT,                             -- which surface drove it (funnel)
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (profile_id, film_id, action)
);
CREATE INDEX feedback_funnel_idx ON user_feedback (surface, action, created_at);
```

---

## 4. Service contract (Next ↔ FastAPI)

REST + SSE. All types single-sourced from FastAPI pydantic → OpenAPI →
`web/lib/api-client.ts`. Auth via signed session cookie set by the BFF after
magic-link verify; FastAPI trusts a forwarded user id header from the Next BFF
(internal network) or validates the session token directly.

### Auth
```
POST /auth/magic-link        { email }                  -> 202
POST /auth/verify            { token }                  -> { user, sessionToken }
GET  /auth/me                                           -> { user } | 401
```

### Imports
```
POST /imports                (multipart: export.zip)    -> { importId, profileId }
POST /imports/by-username    { username }               -> { importId, profileId }
GET  /imports/{importId}                                -> ImportStatus
GET  /imports/{importId}/events   (SSE)                  -> stream of ImportProgress
```
```ts
type ImportStatus = {
  importId: string; profileId: string;
  source: 'export' | 'scrape';
  status: 'queued'|'fetching'|'matching'|'enriching'|'profiling'|'precomputing_recs'|'ready'|'failed';
  stageCounts: Record<string, number>;     // e.g. { matched: 412, total: 980 }
  error?: string;
};
// SSE event: { stage, done, total, message }
```

### Profiles / taste
```
GET /profiles/{profileId}                               -> ProfileSummary
GET /profiles/{profileId}/taste                         -> TasteProfile
GET /profiles/{profileId}/recently-watched?limit=        -> FilmCard[]
GET /profiles/{profileId}/unmatched                     -> UnmatchedFilm[]   (review UI)
```

### Recommendations
```
GET /profiles/{profileId}/recs/{surface}
      ?mood=&decade=&country=&director=&limit=&offset=    -> RecommendationSet
POST /recs/{setId}/share                                 -> { shareId, url }
GET  /share/{shareId}                                    -> RecommendationSet (public)
GET  /profiles/{profileId}/recs/{surface}/export.csv     -> text/csv
```
```ts
type RecommendationSet = {
  setId: string; surface: string; params: Record<string,unknown>;
  modelVersion: string;
  items: Array<{
    film: FilmCard;
    rank: number; score: number;
    components: Record<string, number>;        // contribution per component
    explanation: { source: string; reasons: string[] };
  }>;
};
type FilmCard = {
  tmdbId: number; title: string; year?: number;
  posterPath?: string; runtimeMin?: number;
  weightedRating?: number;
  yourRating?: number | null;                  // if in history
  streaming?: { provider: string; type: string }[];
};
```

### Feedback
```
POST /profiles/{profileId}/feedback   { filmId, action, surface }  -> 204
```

### Compare (Phase 3, contract reserved now)
```
GET /compare?a={username}&b={username}        -> CompatibilityReport
```

**Error shape (all endpoints):** `{ error: { code, message, details? } }` with
conventional HTTP statuses. Long operations return 202 + a resource to poll/stream.

---

## 5. Background jobs (arq queues)

| Task | Trigger | Does |
|---|---|---|
| `run_import(importId)` | POST /imports | Drives the state machine (PLAN §5); enqueues enrich/profile/precompute; publishes SSE progress to Redis. |
| `enrich_films(tmdb_ids)` | import + corpus | TMDB metadata with cache + single-flight; upsert film + joins. |
| `corpus_refresh` | cron (weekly) | Pull TMDB id-export, enrich new films above floor, recompute `idf`, `weighted_rating`, `WR` percentiles, `C`. |
| `precompute_recs(profileId)` | end of import / re-import | Materialize default surfaces into recommendation_set/item. |
| `refresh_streaming(film_id, region)` | lazy / daily TTL | Update streaming_availability. |

Redis pub/sub channel `import:{importId}` carries progress; the SSE endpoint
subscribes and forwards.

---

## 6. Phase-0 acceptance checklist

Phase 0 is "done" when, locally via `make up`:

- [ ] `docker-compose` brings up postgres(+pgvector)+redis+api+worker+web; all healthy.
- [ ] Alembic migrations create the §3 schema; `make seed` ingests a small corpus
      slice (e.g. top-N by vote_count) and computes `weighted_rating`/`idf`.
- [ ] OpenAPI is emitted by FastAPI and `web` generates a typed client from it.
- [ ] Magic-link auth round-trips (request → email/log → verify → session cookie).
- [ ] Upload a sample Letterboxd export ZIP → an `import` row is created and the
      state machine advances through stages (stages may be stubs) to `ready`.
- [ ] `/import/[importId]` page renders SSE progress with skeleton loaders.
- [ ] Design tokens (cream/teal/coral/yellow + serif/sans) are wired into Tailwind;
      `FilmCard`, `PosterImage`, `Skeleton` primitives render with sample data.
- [ ] CI runs ruff/mypy/pytest + biome/tsc/vitest green; scraper contract test runs
      against a fixture HTML file.

No real taste-profile or recommendation logic is required in Phase 0 — only that the
pipeline plumbing, schema, contract, and design skeleton exist and connect. Phase 1
fills in matching + taste profile; Phase 2 fills in the ranker.

---

## 7. Sequencing within Phase 0

1. Repo + compose + CI skeleton + Makefile.
2. DB schema + Alembic + `make seed` (corpus slice).
3. TMDB integration (client + Redis cache + single-flight) — unblocks seed + enrich.
4. FastAPI app factory + OpenAPI + auth + imports routers (stubs where needed).
5. arq worker + `run_import` state machine (stub stages) + Redis SSE plumbing.
6. Export ZIP parser (the primary ingest path) feeding `run_import`.
7. Next: design tokens, UI primitives, landing/upload + SSE progress page,
   generated API client.

Items 3 and 7 can proceed in parallel once 1–2 land.
