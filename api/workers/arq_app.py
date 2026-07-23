"""arq worker entrypoint. `arq workers.arq_app.WorkerSettings` (see docker-compose).

Shared resources (TMDB client + Redis) are created once on startup and stored in
ctx. enrich_films is implemented (step 0.3); run_import / precompute_recs are stubs
filled in by step 0.6 and Phase 2.
"""

from __future__ import annotations

import asyncio
from typing import Any

from arq.connections import RedisSettings
from arq.typing import WorkerCoroutine

from app.config import get_settings
from app.db.base import get_engine
from app.domain.enrich import parse_movie, weighted_rating
from app.integrations.tmdb import TMDBClient
from app.repositories.film_repo import upsert_film

settings = get_settings()

# Prior for incremental enrichment; corpus_refresh recomputes weighted_rating
# against the true corpus mean as a batch (RECOMMENDATION_MATH §3).
_INCREMENTAL_CORPUS_MEAN = 6.3


async def startup(ctx: dict[str, Any]) -> None:
    import redis.asyncio as aioredis

    redis = aioredis.from_url(settings.redis_url)
    ctx["tmdb"] = TMDBClient(settings.tmdb_read_token, redis=redis)
    ctx["redis"] = redis


async def shutdown(ctx: dict[str, Any]) -> None:
    await ctx["tmdb"].aclose()
    await ctx["redis"].aclose()


async def enrich_films(ctx: dict[str, Any], tmdb_ids: list[int]) -> int:
    """Fetch + parse + upsert films. Idempotent; safe to retry."""
    tmdb: TMDBClient = ctx["tmdb"]
    payloads = await asyncio.gather(*(tmdb.get_movie(i) for i in tmdb_ids))
    films = [parse_movie(p, regions={settings.default_region}) for p in payloads]

    def _persist() -> None:
        with get_engine().begin() as conn:
            for f in films:
                wr = weighted_rating(
                    f.vote_average, f.vote_count, corpus_mean=_INCREMENTAL_CORPUS_MEAN
                )
                upsert_film(conn, f, weighted=wr)

    await asyncio.to_thread(_persist)
    return len(films)


async def run_import(ctx: dict[str, Any], import_id: str) -> None:
    """Drive the import state machine (PLAN §5)."""
    from app.services.import_pipeline import run_pipeline

    await run_pipeline(import_id, ctx["redis"], ctx["tmdb"])


async def corpus_refresh(ctx: dict[str, Any]) -> None:
    """Weekly corpus refresh + idf/weighted_rating recompute. Stub — step 0.3/1."""
    raise NotImplementedError("corpus_refresh: step 1")


async def precompute_recs(ctx: dict[str, Any], profile_id: str) -> None:
    """Materialize default rec surfaces after import. Stub — Phase 2."""
    raise NotImplementedError("precompute_recs: Phase 2")


class WorkerSettings:
    functions: list[WorkerCoroutine] = [run_import, enrich_films, corpus_refresh, precompute_recs]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
