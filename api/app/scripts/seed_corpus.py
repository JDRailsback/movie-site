"""Seed a corpus slice into `film` (PHASE0 §6, step 0.3).

Discovers films via several TMDB /discover "strands" so the corpus is broad
rather than just the most-voted canon: the popular canon (material for Blind
Spots), acclaimed but mid-popularity films (material for Hidden Gems), a general
popularity sweep, and per-decade acclaimed sweeps for era coverage. Ids are
deduped, enriched concurrently (cache + single-flight), Bayesian-rated, and
upserted. Run: `python -m app.scripts.seed_corpus --pages 10`  (or `make seed`).

Requires a live Postgres (DATABASE_URL) and TMDB_READ_TOKEN. Redis is optional
(used as cache if reachable).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from typing import Any

from app.config import get_settings
from app.db.base import get_engine
from app.domain.enrich import EnrichedFilm, parse_movie, weighted_rating
from app.integrations.tmdb import TMDBClient
from app.repositories.film_repo import upsert_film


@dataclass(frozen=True)
class Strand:
    """One /discover query swept across `pages`. `params` are discover_movies kwargs."""

    label: str
    pages: int
    params: dict[str, Any]


# decades to sweep for acclaimed older films (era coverage for the taste profile)
_DECADES = [(1950, 1969), (1970, 1979), (1980, 1989), (1990, 1999), (2000, 2009), (2010, 2019)]

# TMDB genre ids -> swept individually for catalogue depth the global strands miss
_GENRES: dict[str, int] = {
    "action": 28,
    "adventure": 12,
    "animation": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "scifi": 878,
    "thriller": 53,
    "war": 10752,
    "western": 37,
}


def _build_strands(base_pages: int, floor: int) -> list[Strand]:
    half = max(2, base_pages // 2)
    strands = [
        # the popular canon — well-known, heavily-voted films (Blind Spots)
        Strand(
            "canon",
            base_pages,
            {"sort_by": "vote_count.desc", "vote_count_gte": max(floor, 1500)},
        ),
        # acclaimed but under-the-radar — high rating, capped popularity (Hidden Gems)
        Strand(
            "gems",
            base_pages * 2,
            {
                "sort_by": "vote_average.desc",
                "vote_count_gte": max(floor, 250),
                "vote_count_lte": 12000,
                "vote_average_gte": 6.8,
            },
        ),
        # general popularity sweep for broad coverage
        Strand("popular", base_pages, {"sort_by": "popularity.desc", "vote_count_gte": floor}),
    ]
    for lo, hi in _DECADES:
        strands.append(
            Strand(
                f"decade-{lo}s",
                half,
                {
                    "sort_by": "vote_average.desc",
                    "vote_count_gte": max(floor, 150),
                    "vote_average_gte": 6.5,
                    "release_date_gte": f"{lo}-01-01",
                    "release_date_lte": f"{hi}-12-31",
                },
            )
        )
    for name, gid in _GENRES.items():
        strands.append(
            Strand(
                f"genre-{name}",
                half,
                {
                    "sort_by": "vote_average.desc",
                    "vote_count_gte": max(floor, 150),
                    "vote_average_gte": 6.2,
                    "with_genres": str(gid),
                },
            )
        )
    return strands


async def _gather_ids(tmdb: TMDBClient, strands: list[Strand]) -> list[int]:
    ids: dict[int, None] = {}  # insertion-ordered dedup across strands
    for s in strands:
        before = len(ids)
        for page in range(1, s.pages + 1):
            disc = await tmdb.discover_movies(page=page, **s.params)
            for m in disc.get("results", []):
                ids.setdefault(m["id"], None)
        print(f"[seed]   strand {s.label}: +{len(ids) - before} new ({len(ids)} total)")
    return list(ids)


async def _gather_films(
    tmdb: TMDBClient, floor: int, pages: int, regions: set[str]
) -> list[EnrichedFilm]:
    strands = _build_strands(pages, floor)
    ids = await _gather_ids(tmdb, strands)
    print(f"[seed] {len(ids)} unique films discovered; enriching...")
    payloads = await asyncio.gather(*(tmdb.get_movie(i) for i in ids))
    return [parse_movie(p, regions=regions) for p in payloads]


async def _maybe_redis(url: str) -> Any:  # optional dependency, best-effort
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(url)
        await client.ping()
        return client
    except Exception as exc:  # cache is optional
        print(f"[seed] Redis cache unavailable ({exc}); proceeding without cache.")
        return None


async def run(pages: int) -> int:
    settings = get_settings()
    if not settings.tmdb_read_token:
        print("TMDB_READ_TOKEN is not set. Add it to .env.", file=sys.stderr)
        return 1

    redis = await _maybe_redis(settings.redis_url)
    async with TMDBClient(settings.tmdb_read_token, redis=redis) as tmdb:
        floor = settings.corpus_vote_count_floor
        print(f"[seed] discovering films (floor {floor}, ~{pages} pages/strand) across strands...")
        films = await _gather_films(tmdb, floor, pages, {settings.default_region})

    if redis is not None:
        await redis.aclose()

    rated = [f.vote_average for f in films if f.vote_average is not None]
    corpus_mean = sum(rated) / len(rated) if rated else 6.3
    print(f"[seed] enriched {len(films)} films; corpus_mean={corpus_mean:.3f}. Upserting...")

    engine = get_engine()
    ok, failed = 0, 0
    for f in films:
        wr = weighted_rating(f.vote_average, f.vote_count, corpus_mean=corpus_mean)
        try:  # per-film tx so one bad payload doesn't roll back the whole seed
            with engine.begin() as conn:
                upsert_film(conn, f, weighted=wr)
            ok += 1
        except Exception as exc:  # noqa: BLE001 - seed is best-effort
            failed += 1
            print(f"[seed] skipped {f.tmdb_id} ({f.title}): {exc}")

    print(f"[seed] done. {ok} upserted, {failed} skipped.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pages", type=int, default=10, help="base TMDB discover pages per strand (20 films each)"
    )
    args = parser.parse_args()
    return asyncio.run(run(args.pages))


if __name__ == "__main__":
    raise SystemExit(main())
