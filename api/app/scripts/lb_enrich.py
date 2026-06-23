"""Enrich the film corpus with Letterboxd stats.

For each film in the DB that hasn't been LB-enriched yet, this script:
  1. Follows letterboxd.com/tmdb/{id}/ to resolve the LB slug.
  2. Scrapes the film page for rating, watch count, list count, and fan count.
  3. Updates the film row in-place (lb_* columns only; TMDB data is untouched).

Usage:
  python -m app.scripts.lb_enrich               # unenriched films only
  python -m app.scripts.lb_enrich --force       # re-enrich all films
  python -m app.scripts.lb_enrich --limit 500   # stop after N films
  python -m app.scripts.lb_enrich --concurrency 3  # lower if hitting rate limits

Requires DATABASE_URL (+ optionally REDIS_URL for slug/stats caching).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime

from sqlalchemy import Connection, select, update

from app.config import get_settings
from app.db import tables as t
from app.db.base import get_engine
from app.integrations.letterboxd import LbStats, LetterboxdClient


async def _maybe_redis(url: str):  # type: ignore[return]
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(url)
        await client.ping()
        return client
    except Exception as exc:  # noqa: BLE001
        print(f"[lb] Redis unavailable ({exc}); running without cache.")
        return None


def _fetch_tmdb_ids(conn: Connection, *, force: bool, limit: int | None) -> list[int]:
    if force:
        stmt = select(t.film.c.tmdb_id).where(t.film.c.adult.is_not(True))
    else:
        stmt = select(t.film.c.tmdb_id).where(
            t.film.c.adult.is_not(True),
            t.film.c.lb_enriched_at.is_(None),
        )
    if limit:
        stmt = stmt.limit(limit)
    return [r[0] for r in conn.execute(stmt)]


def _write_result(
    conn: Connection,
    tmdb_id: int,
    slug: str | None,
    stats: LbStats | None,
) -> None:
    values: dict = {"lb_enriched_at": datetime.now(UTC)}
    if slug is not None:
        values["lb_slug"] = slug
    # Only overwrite stats columns when we actually received data — never
    # wipe existing counts because a single failed fetch hit a transient 403.
    if stats is not None:
        values.update(
            lb_rating=stats.rating,
            lb_rating_count=stats.rating_count,
            lb_watch_count=stats.watch_count,
            lb_list_count=stats.list_count,
            lb_fan_count=stats.fan_count,
        )
    conn.execute(update(t.film).where(t.film.c.tmdb_id == tmdb_id).values(**values))


async def _enrich_one(lb: LetterboxdClient, tmdb_id: int) -> tuple[int, str | None, LbStats | None]:
    slug = await lb.resolve_slug(tmdb_id)
    stats = await lb.fetch_stats(slug) if slug else None
    return tmdb_id, slug, stats


async def run(*, force: bool, limit: int | None, concurrency: int) -> int:
    settings = get_settings()
    redis = await _maybe_redis(settings.redis_url)

    engine = get_engine()
    with engine.connect() as conn:
        ids = _fetch_tmdb_ids(conn, force=force, limit=limit)

    total = len(ids)
    if total == 0:
        print("[lb] Nothing to enrich. Use --force to re-enrich all films.")
        if redis:
            await redis.aclose()
        return 0

    print(f"[lb] Enriching {total} films (concurrency={concurrency})...")

    ok = found = 0

    async with LetterboxdClient(redis=redis, max_concurrency=concurrency) as lb:
        # Process in chunks so DB writes happen regularly and progress is visible.
        chunk_size = max(concurrency, 20)
        for start in range(0, total, chunk_size):
            chunk = ids[start : start + chunk_size]
            results = await asyncio.gather(*(_enrich_one(lb, tid) for tid in chunk))

            with engine.begin() as conn:
                for tmdb_id, slug, stats in results:
                    _write_result(conn, tmdb_id, slug, stats)
                    ok += 1
                    if slug:
                        found += 1

            pct = ok / total * 100
            print(
                f"[lb]   {ok}/{total} ({pct:.0f}%) done — "
                f"{found} matched on LB, {ok - found} not found"
            )

    print(f"[lb] done. {found}/{total} films matched on Letterboxd.")
    if redis:
        await redis.aclose()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Enrich corpus with Letterboxd stats")
    parser.add_argument("--force", action="store_true", help="Re-enrich already-enriched films")
    parser.add_argument("--limit", type=int, default=None, help="Max number of films to process")
    parser.add_argument(
        "--concurrency", type=int, default=5, help="Concurrent LB requests (default 5)"
    )
    args = parser.parse_args()

    if not get_settings().database_url:
        print("DATABASE_URL is not set.", file=sys.stderr)
        return 1

    return asyncio.run(run(force=args.force, limit=args.limit, concurrency=args.concurrency))


if __name__ == "__main__":
    raise SystemExit(main())
