#!/usr/bin/env python
"""Seed the film catalog from TMDB's discover endpoint.

Run inside the api container:
    docker exec -it movie-site-api-1 python /app/scripts/seed_catalog.py
    docker exec -it movie-site-api-1 python /app/scripts/seed_catalog.py --pages 300

Each run is idempotent — existing films are upserted, so re-running refreshes data.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.db.base import get_engine
from app.domain.enrich import parse_movie, weighted_rating
from app.integrations.tmdb import TMDBClient
from app.repositories import film_repo
from app.services.import_pipeline import IMPORT_CORPUS_MEAN

# General pass: top films sorted by vote count (20 films per page)
DEFAULT_PAGES = 200       # 4,000 films
DEFAULT_VOTE_FLOOR = 200  # low enough to catch quality niche films

# Supplemental genre passes for genres under-represented in the popularity sort.
# (genre_id, label, pages, vote_floor)
GENRE_PASSES: list[tuple[int, str, int, int]] = [
    (37,    "western",   40,  30),
    (16,    "animation", 60, 100),
    (36,    "history",   40,  30),
    (9648,  "mystery",   40,  50),
    (10749, "romance",   50,  50),
    (10752, "war",       30,  30),
    (14,    "fantasy",   50,  50),
    (878,   "sci-fi",    50,  50),
]


async def _fetch_and_store(
    tmdb: TMDBClient,
    *,
    page: int,
    vote_floor: int,
    with_genres: str | None,
    region: str,
) -> int:
    resp = await tmdb.discover_movies(
        vote_count_gte=vote_floor,
        page=page,
        sort_by="vote_count.desc",
        with_genres=with_genres,
    )
    results = resp.get("results", [])
    if not results:
        return 0

    ids = [r["id"] for r in results if r.get("id")]
    payloads = await asyncio.gather(*(tmdb.get_movie(i) for i in ids), return_exceptions=True)

    films = []
    for p in payloads:
        if isinstance(p, Exception):
            continue
        try:
            films.append(parse_movie(p, regions={region}))
        except Exception:
            continue

    with get_engine().begin() as conn:
        for f in films:
            wr = weighted_rating(f.vote_average, f.vote_count, corpus_mean=IMPORT_CORPUS_MEAN)
            film_repo.upsert_film(conn, f, weighted=wr)

    return len(films)


async def seed(pages: int = DEFAULT_PAGES, vote_floor: int = DEFAULT_VOTE_FLOOR) -> None:
    settings = get_settings()
    region = settings.default_region
    total = 0

    async with TMDBClient(settings.tmdb_read_token) as tmdb:
        # General pass: top films by vote count
        print(f"General: {pages} pages, vote_count >= {vote_floor} ...", flush=True)
        for page in range(1, pages + 1):
            n = await _fetch_and_store(
                tmdb, page=page, vote_floor=vote_floor, with_genres=None, region=region
            )
            total += n
            if n == 0:
                print(f"  page {page}: empty, stopping early", flush=True)
                break
            if page % 25 == 0 or page == pages:
                print(f"  page {page}/{pages} — {total} films total", flush=True)

        # Supplemental genre passes
        for genre_id, label, genre_pages, genre_floor in GENRE_PASSES:
            print(
                f"Genre '{label}': {genre_pages} pages, vote_count >= {genre_floor} ...",
                flush=True,
            )
            genre_total = 0
            for page in range(1, genre_pages + 1):
                n = await _fetch_and_store(
                    tmdb,
                    page=page,
                    vote_floor=genre_floor,
                    with_genres=str(genre_id),
                    region=region,
                )
                genre_total += n
                if n == 0:
                    break
            total += genre_total
            print(f"  {genre_total} films — running total {total}", flush=True)

    print(f"\nDone. {total} films seeded into the catalog.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed film catalog from TMDB")
    parser.add_argument(
        "--pages",
        type=int,
        default=DEFAULT_PAGES,
        help="General pass page count (default 200 = 4000 films)",
    )
    parser.add_argument(
        "--vote-floor",
        type=int,
        default=DEFAULT_VOTE_FLOOR,
        help="Minimum vote count for general pass",
    )
    args = parser.parse_args()
    asyncio.run(seed(pages=args.pages, vote_floor=args.vote_floor))
