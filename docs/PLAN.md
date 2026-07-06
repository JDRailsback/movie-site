# Film Recommendation Platform — Complete Build Plan

> Status: planning. Repo is greenfield (no code yet). This document is the
> source of truth for architecture and product decisions until superseded.
> Last updated: 2026-06-02.

> **Note (current build, 2026-06-30):** the live frontend deliberately diverged
> from §10/§1 below. It's a single page (`web/app/page.tsx`) with no accounts,
> no magic-link auth, no per-profile routes, no compare/share routes, and no
> Framer Motion — every visit reimports the Letterboxd username fresh and shows
> three rec rows + a watchlist spinner. This was a conscious simplification, not
> drift; treat §1, §10, and the auth/social sections below as the longer-term
> target if/when the product grows back out, not as a description of what's
> running today. See the root [README.md](../README.md) "Current state" section
> for what's actually built.

A web app for serious film lovers who use Letterboxd. The user provides their
Letterboxd data; the app builds a rich, multi-dimensional **taste profile** and
generates explainable, personalized recommendations across multiple discovery
lenses.

**North-star metric:** does the user discover a film they end up watching and
loving that they wouldn't have found otherwise?

---

## 0. Decisions that diverge from the original brief

These changes are intentional and everything below assumes them.

1. **Import-first, not scrape-first.** Primary ingest path is the user's official
   Letterboxd data export (ZIP of CSVs). Scraping is a secondary convenience path
   and the only option for social comparison. Removes the biggest source of
   fragility, legal risk, and the multi-minute wait from the core journey.
2. **Pre-built local film corpus.** Recommendations score against a curated local
   corpus in Postgres (refreshed on a schedule), never against live TMDB. Fast,
   cheap, offline-scorable.
3. **Lightweight accounts (magic-link email).** Required to capture feedback (the
   north star is unmeasurable without it), support incremental re-import, and
   remember dismissed recs. Anonymous "try it" allowed but ephemeral until claimed.
4. **Feedback loop is a Phase-2 requirement,** not an afterthought. Every card:
   Seen it / Loved it / Not interested / Add to watchlist.
5. **Weighted (Bayesian) rating for "acclaim,"** not raw TMDB average, everywhere
   quality appears.
6. **Collaborative filtering via latent-vector fold-in** (ridge regression onto the
   item-factor matrix), not nearest-neighbor users.
7. **Explainable component scoring** over a single opaque similarity — the score
   breakdown *is* the "Why this?" payload.

---

## 1. Product scope & identity

- **Identity:** magic-link (email) accounts, no passwords. A `User` owns one or
  more `LetterboxdProfile` imports (their own + profiles looked up for comparison).
- **Anonymous:** "try it" sessions allowed; results ephemeral until claimed.
- **Region:** captured once (default by IP, user-editable) for streaming accuracy.
- **Not building:** a Letterboxd replacement, social graph/following, our own
  rating system. We are a discovery layer.

---

## 2. Data acquisition

### 2.1 Primary — Letterboxd export upload
Official export ZIP: `watched.csv`, `ratings.csv`, `diary.csv`, `reviews.csv`,
`watchlist.csv`, `likes/films.csv`, `profile.csv`. Instant, complete, consensual.
**Gap:** export has no TMDB IDs — only title, year, Letterboxd URI. Matching to
TMDB required either way (see §3.2).

### 2.2 Secondary — username scraping
Best-effort fallback; required for social comparison. Respect robots.txt, throttle
(~1 req/s jittered), descriptive UA, cache every page. Isolate behind a single
versioned adapter with contract tests against fixture HTML. Fragile + against ToS
— surface an "export instead" path on failure. Scraped film pages expose the
TMDB/IMDb link (ground-truth matching) at the cost of an extra fetch.

### 2.3 Legal / ToS posture
Scraping third-party public profiles and storing it has GDPR/CCPA implications.
Store scraped third-party data transiently (TTL cache) with a documented takedown
path. Get a real legal read before launch. **Biggest non-technical risk.**

---

## 3. Data model & corpus

### 3.1 Core entities (Postgres)
- `film` — corpus: tmdb_id (PK), title, year, runtime, original_language,
  countries[], genres[], director_ids[], cast_ids[], vote_average, vote_count,
  popularity, weighted_rating (precomputed), poster_path, overview, keyword_ids[],
  status, adult.
- `keyword` — tmdb_id, name, idf (precomputed corpus IDF), is_stoplisted.
- `person` — directors/actors.
- `streaming_availability` — (film_id, region, provider, type).
- `user`, `letterboxd_profile`, `profile_import` (status, source=export|scrape).
- `user_film_rating` — (profile_id, film_id, rating_0_10, liked, watched_date,
  review_text, source). The atomic signal.
- `taste_profile` — computed object per profile, versioned with model_version.
- `recommendation` — materialized lists per (profile, surface, params), score +
  explanation JSON, cached.
- `user_feedback` — (profile_id, film_id, action, ts). North-star data.

### 3.2 TMDB matching (hard, under-specified)
Letterboxd → TMDB by title+year is ambiguous (remakes, translations, year drift,
shorts). Strategy:
1. Normalize (lowercase, strip punctuation/articles, transliterate).
2. TMDB search, filter year ±1, prefer exact normalized title, tiebreak by vote_count.
3. If scraping, use the TMDB link on the film page as ground truth.
4. Store match confidence; quarantine low-confidence so bad matches don't poison
   the profile.
5. Cache (title,year)→tmdb_id crosswalk globally (reusable across users).

### 3.3 Building the corpus
Seed from TMDB daily ID export dumps, filter to vote_count ≥ N (~50). Lazily add
full filmographies of any "loved" director/actor. Add every MovieLens-linked film
(via links.csv). Bulk-enrich via worker pool, Redis-cached, single-flight per
tmdb_id. Recompute keyword.idf and film.weighted_rating as batch jobs after refresh.

---

## 4. System architecture & stack

Split along the language boundary: Next for UX, Python for ML/domain.

```
Next.js (App Router, RSC) — frontend + thin BFF, SSE consumer, magic-link auth
        | HTTP (typed contract)
FastAPI (Python) — taste profile, rec engine, matching, profiles
        |
Postgres + pgvector | Redis (cache + SSE pub/sub) | arq workers | Object store
```

- **Frontend:** Next.js App Router + RSC, TypeScript, Tailwind + small bespoke
  component layer, Framer Motion, Recharts/visx, react-simple-maps/D3 for heatmap.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0.
- **Jobs:** arq (async, Redis-backed). Import, enrichment, corpus refresh, rec
  precompute.
- **DB:** Postgres + pgvector (film feature vectors + CF latent vectors in-DB, ANN
  retrieval via `<=>`).
- **Cache/pubsub:** Redis (TMDB cache, crosswalk, SSE, rate-limit token buckets).
- **Real-time:** SSE for import progress.
- **Hosting:** $0 / free-tier posture — see §18 for the concrete free-tier mapping
  and the storage discipline it forces (halfvec, higher corpus floor, offline ML).

---

## 5. Ingestion pipeline

State machine per import:
`queued → fetching → matching → enriching → profiling → precomputing_recs → ready`
(or `failed` with reason). Progress published Redis → SSE → UI with per-stage counts.

1. Acquire (export parse OR scrape — single adapter, same downstream shape).
2. Match each film to tmdb_id (crosswalk cache first); quarantine low-confidence.
3. Enrich (ensure film row exists + full metadata; lazy director filmographies).
4. Persist user_film_rating upserts.
5. Profile (§6).
6. Precompute default rec surfaces (§7–8) so the hub loads instantly.
7. Incremental re-import: only fetch diary newer than last import; recompute
   affected aggregates.

Idempotent + resumable.

---

## 6. Taste-profile engine (math)

All comparisons use the user's own normalized scale. Compute personal mean `μ_u`
and std `σ_u`; a film's normalized score `z = (r − μ_u)/σ_u`.

### 6.1 Genre affinity (multi-factor, shrunk)
Per genre g, blend:
- **Relative rating (shrunk):** `(n_g/(n_g+k))·mean_z_g`, k≈15 — kills prestige bias.
- **vs-audience delta:** user normalized rating − film normalized TMDB weighted
  rating, averaged — separates "love the genre" from "only watch its canon."
- **Over/under-watching:** log-ratio of genre share in library vs corpus base rate
  — captures the comedy paradox (high volume, meh ratings).
- **Like rate:** share hearted in g vs overall like rate.

Output a signed interpretable number (−1…+1) with components retained for display.

### 6.2 Director affinity
Mean z per director, Bayesian-shrunk. Drives rabbit holes + a ranking component.

### 6.3 Era, country, runtime
Distributions + avg normalized rating per bucket + a **gap signal**
(corpus base rate − user share) to flag under-explored decades/countries.
Runtime → preferred bucket(s) with tolerance.

### 6.4 Themes / keywords
Aggregate keywords over highly-rated films weighted by tf·idf (corpus IDF) +
curated stoplist (stingers, sequel labels, bare city names). Yields a thematic
fingerprint vector + top-N display.

### 6.5 Content feature vector
Sparse per-film vector: multi-hot genres, IDF-weighted keywords, director one-hots,
decade, country, language, runtime bucket. User taste vector = z-weighted,
like-boosted centroid, stored in pgvector for ANN retrieval. Distinct from the
explainable component scores used for final ranking. All versioned via model_version.

---

## 7. Recommendation engine

Two-stage: cheap candidate generation → transparent ranking → diversity pass.

### 7.1 Candidate generation
Union from the local corpus:
- ANN nearest films to user taste vector (pgvector).
- Unwatched films by high-affinity directors.
- High-weighted-rating films in high-affinity genres/keywords.
- Collaborative candidates (§9).
- Surface-specific pools.

Hard filters: exclude watched, (optionally) watchlist, `not interested`,
adult/non-film, low match confidence.

### 7.2 Ranking (transparent weighted sum)
Per candidate, each component normalized 0–1:
```
score = w_q·quality + w_g·genreAffinity + w_d·directorAffinity
      + w_k·keywordOverlap + w_e·eraFit + w_c·countryFit
      + w_r·runtimeFit + w_cf·collaborative − penalties
```
- quality = weighted Bayesian rating.
- Component values ARE the "Why this?" payload — stored on the rec.
- Penalties: over-popular (gems), franchise fatigue.

Surfaces = different weight presets + candidate pools over this single engine.

### 7.3 Diversity (MMR)
Re-rank with Maximal Marginal Relevance (tunable λ) so lists aren't 8 films by one
director / all same decade+country. Key to "feels like discovery."

### 7.4 Explainability
Each rec stores top contributing components, source (content/collaborative/
blind-spot), matched entities (genres, director, keywords). Card renders directly.

---

## 8. Recommendation surfaces (presets over the engine)

| Surface | Candidate pool | Emphasis |
|---|---|---|
| Blind Spots | high weighted-rating + high vote_count | ↑quality, ↑affinity, popularity ok |
| Hidden Gems | high weighted-rating + low popularity pct, vote_count ≥ floor | ↑affinity, ↑obscurity, quality |
| Director Rabbit Holes | unwatched films of top directors + manual search | ↑directorAffinity, quality |
| Mood | overlay genre+keyword predicate on any pool | inherits |
| Era & Country Explorer | "fill the gap" → chosen under-explored bucket | ↑affinity within constraint |
| Collaborative | MovieLens fold-in candidates (§9) | hybrid content+CF |

All default surfaces precomputed on import + cached; mood/era/country params
recompute on demand from cached pool.

---

## 9. Collaborative filtering (Phase 3)

1. Train SVD/ALS item-factor matrix offline on MovieLens 25M (periodic). Store item
   factors keyed by tmdb_id via links.csv.
2. **Fold-in:** ridge regression for the user's latent vector against known item
   factors (principled version of "nearest-neighbor users").
3. Score corpus items by dot product → `collaborative` component.
4. Hybrid: blend into the ranker, not a separate list.

Caveats (internal): MovieLens skews older/English and is not Letterboxd users —
weight CF modestly, never sole signal. Grow own-data CF over time.

---

## 10. Frontend architecture & design system

Routes (App Router):
```
/                              landing + username/upload entry
/import/[id]                   live progress (SSE), skeletons
/p/[profile]                   profile hub
/p/[profile]/recs/[surface]    recommendation surfaces
/p/[profile]/explore           era & country explorer (map + charts)
/p/[profile]/timeline          taste evolution (Phase 3)
/compare/[a]/[b]               two-user comparison
/s/[shareId]                   public shareable list / taste card
```

Design system (warm film-journal aesthetic):
- Palette tokens: cream base, teal/coral/yellow accents; light mode default; tokens
  in Tailwind config.
- Type: humanist sans for UI, display serif for titles/headings; defined scale.
- Poster component: fixed aspect ratio, blur-up loading from TMDB CDN, dominant-color
  card backgrounds.
- Skeletons everywhere (no spinners), tailored per surface.
- Framer Motion transitions; respect prefers-reduced-motion.
- Film card = atomic unit: poster, serif title, year, your-rating-if-seen,
  expandable "Why this?" chip, feedback actions.

Data: RSC for cached/profile first paint; client components for interactivity; SSE
hook for import; optimistic feedback. A11y + Core Web Vitals budget.

---

## 11. Social features

- **Two-user comparison:** compatibility from cosine of normalized taste vectors +
  co-rated agreement; side-by-side dimension bars; "both loved," "A loved / B
  hasn't seen," and a **movie-night** list (recs neither has seen, scored against
  the *intersection* via min/harmonic-mean of component fits).
- **Shareable outputs:** stable `/s/[shareId]` for lists + taste card; taste card
  as downloadable PNG (Satori / @vercel/og); CSV export; OG images.

---

## 12. Feedback loop & north-star measurement

Card actions: Seen it (+optional rating), Loved it, Not interested, Add to
watchlist, Watched because of this.
- `Not interested` filters future candidates; `Seen it` moves to history; `Loved
  it` / `Watched because of this` are success events.
- Instrument the funnel recommend → watchlist-add → watched → loved per surface.
- Feedback re-enters the ranker (down/upweight patterns).

---

## 13. Performance, caching, cost

- Global crosswalk + metadata cache; single-flight per tmdb_id; token-bucket rate
  limiting; bulk corpus from TMDB daily exports.
- Recommendations score against local corpus only — no live TMDB in the hot path.
- Precompute on import, cache surfaces, invalidate on re-import / model_version bump.
- pgvector ANN keeps ranking input small.
- Streaming availability: cache per (film, region), daily TTL.

---

## 14. Privacy, security, compliance

- Magic-link auth (no password storage); signed short-lived tokens.
- Third-party scraped data stored transiently + takedown path; legal read pre-launch.
- Per-user data export & delete.
- Secrets in secret manager; TMDB key server-side only; rate-limit public endpoints;
  validate uploaded ZIPs (zip-bomb / path-traversal guards).

---

## 15. Observability & testing

- Matching accuracy is the quality keystone — log confidence distribution, sample
  low-confidence, alert on regressions.
- Scraper contract tests vs fixture HTML.
- Recommendation golden tests: known profile → stable top-N within tolerance.
- Structured logging, Sentry, arq dashboards, DB query metrics, north-star funnel
  analytics.

---

## 16. Roadmap

- **Phase 0 — Foundations:** scaffolding (Next + FastAPI + Postgres/pgvector + Redis
  + arq), design tokens, auth, corpus seed job, TMDB enrichment w/ caching +
  single-flight, export-upload parser.
- **Phase 1 — Ingest & taste profile:** matching/crosswalk, persistence, taste-profile
  engine (§6), import SSE, profile hub UI.
- **Phase 2 — Rec engine + feedback:** feature vectors, candidate gen + transparent
  ranker + MMR, Blind Spots & Hidden Gems, rec-hub UI, feedback loop + north-star
  instrumentation, explainability, director rabbit holes, mood overlays.
- **Phase 3 — Depth:** era/country explorer + viz, collaborative filtering (fold-in),
  taste-evolution timeline, two-user comparison, shareable images/CSV.
- **Phase 4 — Sentiment & polish:** review-sentiment embeddings ("your taste in your
  own words"), dissonance detection, perf hardening, a11y audit.

---

## 17. Decisions & remaining open questions

### Resolved (2026-06-02)
1. **Letterboxd ToS / scraping → DECIDED: export-first.** Official Letterboxd
   export upload is the primary path everywhere. Username-scraping is a
   clearly-labeled fallback (and the only option for stranger comparison), behind a
   versioned adapter, cached + rate-limited, with a documented takedown path and
   transient storage of third-party data. Legal read still required before any
   public launch.
2. **Accounts → DECIDED: magic-link email accounts.** Anonymous "try it" sessions
   are allowed but ephemeral until claimed with an email. Required for the
   north-star feedback funnel, incremental re-import, and remembering dismissals.
3. **Budget / corpus size → DECIDED: no budget; free-tier-only posture.** See §18.
   Corpus floor set to keep storage within free Postgres limits (see PHASE0 env:
   `CORPUS_VOTE_COUNT_FLOOR`).

### Still open (deferrable — tuning, not architecture)
4. **Matching accuracy bar** — how aggressively to quarantine low-confidence
   title→TMDB matches. Resolve with real data during Phase 1.
5. **CF weight** — trust in MovieLens given age/skew. Start `w_cf` low (~0.08),
   gate off below 20 matched films, tune via the funnel. Resolve in Phase 3.

---

## 18. Deployment & cost posture (no budget)

Constraint: **$0 hosting budget.** Architecture from §4 is unchanged in shape, but
every component must fit a free tier or run locally. This mainly bounds the corpus
and pushes heavy ML offline.

**Target free-tier mapping (revisit when budget exists):**
- **Frontend:** Vercel Hobby (free) for the Next app.
- **Postgres + pgvector:** Neon free tier (~0.5 GB storage). This is the binding
  constraint — it caps corpus size.
- **Redis:** Upstash / Vercel KV free tier (cache + SSE pub/sub). If the free Redis
  is too limited for pub/sub, fall back to Postgres LISTEN/NOTIFY for SSE.
- **API + worker:** a single small free/always-on instance (Fly.io free allowance
  or Render free web service) running FastAPI + an in-process arq worker. Acceptable
  at low traffic; split out workers only when there's budget.
- **Object store (share images, exports):** Cloudflare R2 free tier or Vercel Blob.

**Storage discipline (to fit ~0.5 GB Postgres):**
- Use pgvector **`halfvec`** (2 bytes/dim) instead of `vector` (4 bytes/dim) for
  `feature_vector` — halves vector storage. Consider 512 dims instead of 1024 if
  pressure remains.
- Raise the corpus vote-count floor (see PHASE0) so the corpus is ~15–25k
  well-regarded films rather than 50k+. This narrows Hidden Gems' obscurity pool —
  an accepted trade-off until budget allows a lower floor.
- Don't store cast for every film (directors + a capped top-cast only); skip
  overviews if storage is tight (re-fetch from TMDB on demand for detail views).

**Heavy ML stays offline (Phase 3):**
- Train MovieLens SVD/ALS and compute review embeddings as one-off **local batch
  jobs on the dev machine**; commit/store only the *results* (item-factor matrix
  ≈ tens of MB; per-user vectors computed cheaply at fold-in). Never run 25M-row
  training on a free instance.

**Implication:** at $0 the app is comfortably a personal / small-beta tool. The
free Postgres storage cap is the first thing to hit; that's the trigger to revisit
the floor, vector dims, and a paid DB tier.
