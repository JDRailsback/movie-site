"""Import state machine (PLAN §5).

queued -> fetching -> matching -> enriching -> profiling -> ready (or failed).
Profiling is a no-op placeholder until Phase 1; everything up to and including
persisting the user's ratings is implemented here.

Heavy compute (TMDB) is async; DB writes are sync Core run via to_thread, matching
the enrichment worker pattern. Progress is written to the import row (for polling)
and published to Redis (for SSE).
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, cast

from app.config import get_settings
from app.db.base import get_engine
from app.domain.enrich import parse_movie, parse_tv_show, weighted_rating
from app.domain.letterboxd_export import FilmRecord, ParsedExport, parse_export
from app.domain.matching import MatchResult, choose_match, choose_tv_match, normalize_title
from app.integrations import progress
from app.integrations.tmdb import TMDBClient
from app.repositories import film_repo, profile_repo
from app.services import taste_service

settings = get_settings()

MATCH_THRESHOLD = 0.80
IMPORT_CORPUS_MEAN = 6.3
ZIP_KEY = "import:{import_id}:zip"
SCRAPE_KEY = "import:{import_id}:scrape_username"


async def run_pipeline(import_id: str, redis: Any, tmdb: TMDBClient) -> None:
    iid = uuid.UUID(import_id)

    async def stage(status: str, **counts: int) -> None:
        await asyncio.to_thread(_set_status, iid, status, counts or None)
        await progress.publish(redis, import_id, {"status": status, **counts})

    try:
        # --- fetching: load + parse the export or scrape the profile ---
        await stage("fetching")
        import_row = await asyncio.to_thread(_get_import_row, iid)
        profile_id = cast(uuid.UUID, import_row["profile_id"])
        source = str(import_row["source"])

        if source == "scrape":
            from app.integrations.letterboxd_profile import scrape_profile

            username_raw = await redis.get(SCRAPE_KEY.format(import_id=import_id))
            if username_raw is None:
                raise RuntimeError("scrape params not found (expired before processing)")
            username = (
                username_raw.decode() if isinstance(username_raw, bytes) else str(username_raw)
            )
            parsed = await scrape_profile(username)
        else:
            raw = await redis.get(ZIP_KEY.format(import_id=import_id))
            if raw is None:
                raise RuntimeError("export bytes not found (expired before processing)")
            parsed = parse_export(raw)

        await stage("matching", total=len(parsed.films), matched=0)

        # --- matching: crosswalk cache, then TMDB search for misses ---
        matched, unmatched = await _match_all(parsed.films, tmdb, redis, import_id)
        await stage("enriching", matched=len(matched), unmatched=len(unmatched))

        # --- enriching: ensure film rows exist for matched tmdb_ids ---
        tv_slugs = {
            abs(mr.tmdb_id): f.lb_uri.rstrip("/").rsplit("/", 1)[-1]
            for f in parsed.films
            if (mr := matched.get(f.lb_uri)) and mr.tmdb_id < 0
        }
        await _enrich(list({m.tmdb_id for m in matched.values()}), tmdb, tv_slugs)

        # --- persist ratings, unmatched, crosswalk ---
        await asyncio.to_thread(_persist, profile_id, parsed, matched, unmatched, source)

        # --- profiling: compute the taste profile (Phase 1) ---
        await stage("profiling")
        await asyncio.to_thread(taste_service.compute_and_store, profile_id)

        await asyncio.to_thread(_finish, iid, profile_id, parsed.display_name or parsed.username)
        await stage("ready", matched=len(matched), unmatched=len(unmatched))
    except Exception as exc:  # noqa: BLE001 - surface any failure to the user
        await asyncio.to_thread(_fail, iid, str(exc))
        await progress.publish(redis, import_id, {"status": "failed", "error": str(exc)})
        raise


async def _match_all(
    films: list[FilmRecord], tmdb: TMDBClient, redis: Any, import_id: str
) -> tuple[dict[str, MatchResult], list[FilmRecord]]:
    # Resolve from the global crosswalk cache first.
    keyed = [(f, normalize_title(f.title), f.year) for f in films]
    cache_keys = [(nt, yr) for _, nt, yr in keyed if yr is not None]
    cached = await asyncio.to_thread(_lookup_crosswalk, cache_keys)

    matched: dict[str, MatchResult] = {}
    misses: list[tuple[FilmRecord, str]] = []
    for f, nt, yr in keyed:
        hit = cached.get((nt, yr)) if yr is not None else None
        if hit is not None:
            matched[f.lb_uri] = MatchResult(tmdb_id=hit[0], confidence=hit[1], title=f.title)
        else:
            misses.append((f, nt))

    # Search TMDB for cache misses (bounded concurrency lives in the client).
    async def search_one(f: FilmRecord) -> tuple[FilmRecord, MatchResult | None]:
        res = await tmdb.search_movie(f.title, f.year)
        results = res.get("results", [])
        # Letterboxd often uses festival/production year; TMDB uses release year.
        # When the year-filtered search returns nothing, retry without the year.
        if not results and f.year is not None:
            res = await tmdb.search_movie(f.title, None)
            results = res.get("results", [])
        mr = choose_match(f.title, f.year, results)
        if mr is not None and mr.confidence >= MATCH_THRESHOLD:
            return f, mr

        # TV fallback: for episodes logged as films on Letterboxd (e.g. Black Mirror
        # episodes), strip the "Show: " prefix and search TMDB's TV catalogue.
        tv_query = f.title
        colon_pos = f.title.find(": ")
        if colon_pos > 0:
            tv_query = f.title[:colon_pos]
        tv_res = await tmdb.search_tv(tv_query, f.year)
        tv_results = tv_res.get("results", [])
        if not tv_results and f.year is not None:
            tv_res = await tmdb.search_tv(tv_query, None)
            tv_results = tv_res.get("results", [])
        tv_mr = choose_tv_match(f.title, f.year, tv_results)
        return f, tv_mr if (tv_mr is not None and tv_mr.confidence >= MATCH_THRESHOLD) else mr

    results = await asyncio.gather(*(search_one(f) for f, _ in misses))

    unmatched: list[FilmRecord] = []
    for f, mr in results:
        if mr is not None and mr.confidence >= MATCH_THRESHOLD:
            matched[f.lb_uri] = mr
        else:
            unmatched.append(f)

    # publish a mid-stage progress beat
    await progress.publish(
        redis, import_id, {"status": "matching", "matched": len(matched), "total": len(films)}
    )
    return matched, unmatched


async def _enrich(
    tmdb_ids: list[int], tmdb: TMDBClient, tv_slugs: dict[int, str] | None = None
) -> None:
    if not tmdb_ids:
        return
    movie_ids = [i for i in tmdb_ids if i > 0]
    tv_ids = [abs(i) for i in tmdb_ids if i < 0]
    movie_payloads = await asyncio.gather(*(tmdb.get_movie(i) for i in movie_ids))
    tv_payloads = await asyncio.gather(*(tmdb.get_tv(i) for i in tv_ids)) if tv_ids else []
    all_films = [parse_movie(p, regions={settings.default_region}) for p in movie_payloads]
    all_films += [parse_tv_show(p) for p in tv_payloads]

    def _persist_films() -> None:
        with get_engine().begin() as conn:
            for f in all_films:
                slug = (tv_slugs or {}).get(abs(f.tmdb_id)) if f.tmdb_id < 0 else None
                wr = weighted_rating(f.vote_average, f.vote_count, corpus_mean=IMPORT_CORPUS_MEAN)
                film_repo.upsert_film(conn, f, weighted=wr, lb_slug=slug)

    await asyncio.to_thread(_persist_films)


# --- sync DB helpers (run via to_thread) ---
def _set_status(import_id: uuid.UUID, status: str, counts: dict[str, int] | None) -> None:
    with get_engine().begin() as conn:
        profile_repo.update_import(conn, import_id, status=status, stage_counts=counts)


def _get_import_row(import_id: uuid.UUID) -> dict[str, Any]:
    with get_engine().connect() as conn:
        row = profile_repo.get_import(conn, import_id)
    if row is None:
        raise RuntimeError("import row missing")
    return dict(row)


def _lookup_crosswalk(keys: list[tuple[str, int]]) -> dict[tuple[str, int], tuple[int, float]]:
    with get_engine().connect() as conn:
        return profile_repo.lookup_crosswalk(conn, keys)


def _merge_rating(row: dict[str, Any], f: FilmRecord) -> None:
    """Merge a second Letterboxd entry that maps to the same TMDB film."""
    if row["rating_0_10"] is None:
        row["rating_0_10"] = f.rating_0_10
    row["liked"] = row["liked"] or f.liked
    row["review_text"] = row["review_text"] or f.review_text
    if f.watched_date and (row["watched_date"] is None or f.watched_date > row["watched_date"]):
        row["watched_date"] = f.watched_date
    row["watched"] = row["watched"] or f.watched
    row["in_watchlist"] = row["in_watchlist"] or f.in_watchlist
    if row["watched"]:
        # A watched entry supersedes a stale watchlist-only signal — Letterboxd
        # removes films from the watchlist once watched, so a merged row that's
        # watched should never still appear on the watchlist page.
        row["in_watchlist"] = False


def _persist(
    profile_id: uuid.UUID,
    parsed: ParsedExport,
    matched: dict[str, MatchResult],
    unmatched: list[FilmRecord],
    source: str,
) -> None:
    # Multiple Letterboxd entries (distinct URIs) can resolve to the same TMDB id
    # (alternate cuts, duplicate LB pages). Collapse by film_id so a single upsert
    # never carries duplicate (profile_id, film_id) keys.
    by_film: dict[int, dict[str, Any]] = {}
    crosswalk_rows: list[dict[str, Any]] = []
    for f in parsed.films:
        mr = matched.get(f.lb_uri)
        if mr is None:
            continue
        existing = by_film.get(mr.tmdb_id)
        if existing is None:
            by_film[mr.tmdb_id] = {
                "film_id": mr.tmdb_id,
                "rating_0_10": f.rating_0_10,
                "liked": f.liked,
                "watched_date": f.watched_date,
                "review_text": f.review_text,
                "in_watchlist": f.in_watchlist,
                "watched": f.watched,
                "source": source,
            }
        else:
            _merge_rating(existing, f)
        if f.year is not None:
            crosswalk_rows.append(
                {
                    "norm_title": normalize_title(f.title),
                    "year": f.year,
                    "tmdb_id": mr.tmdb_id,
                    "confidence": mr.confidence,
                    "source": "tmdb_search",
                }
            )
    rating_rows = list(by_film.values())
    unmatched_rows = [
        {
            "lb_uri": f.lb_uri,
            "raw_title": f.title,
            "raw_year": f.year,
            "rating_0_10": f.rating_0_10,
            "best_guess_tmdb": None,
            "confidence": None,
        }
        for f in unmatched
    ]
    with get_engine().begin() as conn:
        film_ids_present = _existing_film_ids(conn, [r["film_id"] for r in rating_rows])
        present_rows = [r for r in rating_rows if r["film_id"] in film_ids_present]
        profile_repo.save_ratings(conn, profile_id, present_rows)
        profile_repo.save_crosswalk(
            conn, [c for c in crosswalk_rows if c["tmdb_id"] in film_ids_present]
        )
        profile_repo.save_unmatched(conn, profile_id, unmatched_rows)


def _existing_film_ids(conn: Any, ids: list[int]) -> set[int]:
    from app.db import tables as t

    if not ids:
        return set()
    rows = conn.execute(
        t.film.select().with_only_columns(t.film.c.tmdb_id).where(t.film.c.tmdb_id.in_(ids))
    )
    return {r[0] for r in rows}


def _finish(import_id: uuid.UUID, profile_id: uuid.UUID, display_name: str | None) -> None:
    with get_engine().begin() as conn:
        profile_repo.finalize_profile(conn, profile_id, display_name)


def _fail(import_id: uuid.UUID, error: str) -> None:
    with get_engine().begin() as conn:
        profile_repo.update_import(conn, import_id, status="failed", error=error, finished=True)
