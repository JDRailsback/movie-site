"""Seed a corpus slice into `film` (PHASE0 §6, step 0.3).

Discovers films at/above the vote-count floor via TMDB /discover, enriches them
concurrently (cache + single-flight), computes the weighted Bayesian rating, and
upserts. Run: `python -m app.scripts.seed_corpus --pages 5`  (or `make seed`).

Requires a live Postgres (DATABASE_URL) and TMDB_READ_TOKEN. Redis is optional
(used as cache if reachable).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Any

from app.config import get_settings
from app.db.base import get_engine
from app.domain.enrich import EnrichedFilm, parse_movie, weighted_rating
from app.integrations.tmdb import TMDBClient
from app.repositories.film_repo import upsert_film


async def _gather_films(
    tmdb: TMDBClient, floor: int, pages: int, regions: set[str]
) -> list[EnrichedFilm]:
    ids: list[int] = []
    for page in range(1, pages + 1):
        disc = await tmdb.discover_movies(vote_count_gte=floor, page=page)
        ids.extend(m["id"] for m in disc.get("results", []))
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
        print(f"[seed] discovering films with vote_count >= {floor} across {pages} page(s)...")
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
    parser.add_argument("--pages", type=int, default=5, help="TMDB discover pages (20 films each)")
    args = parser.parse_args()
    return asyncio.run(run(args.pages))


if __name__ == "__main__":
    raise SystemExit(main())
