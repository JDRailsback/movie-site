"""Profile + taste-profile reads (PLAN §6)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.db.base import get_engine
from app.domain import discover as discover_domain
from app.domain import match as match_domain
from app.repositories import profile_repo, recommend_repo, taste_repo
from app.schemas.models import (
    CompatibilityResult,
    FilmCard,
    FilmDatum,
    ImportCreated,
    MatchResponse,
    ProfileSummary,
    RecommendationItem,
    TasteProfile,
)
from app.services.import_pipeline import SCRAPE_KEY

router = APIRouter(prefix="/profiles", tags=["profiles"])


async def _resolve(profile_id: str) -> uuid.UUID:
    """Resolve a UUID string or Letterboxd username to a profile UUID."""

    def _lookup() -> uuid.UUID | None:
        with get_engine().connect() as conn:
            return taste_repo.resolve_profile_id(conn, profile_id)

    pid = await asyncio.to_thread(_lookup)
    if pid is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}
        )
    return pid


@router.post("/{profile_id}/refresh", status_code=202)
async def refresh_profile(request: Request, profile_id: str) -> ImportCreated:
    """Trigger a fresh Letterboxd scrape for this profile."""
    pid = await _resolve(profile_id)

    def _get_username() -> str | None:
        with get_engine().connect() as conn:
            row = taste_repo.get_profile_summary(conn, pid)
        return row["username"] if row else None

    username = await asyncio.to_thread(_get_username)
    if not username:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}
        )

    def _create_import() -> tuple[uuid.UUID, uuid.UUID]:
        with get_engine().begin() as conn:
            return profile_repo.get_or_create_profile(conn, username, source="scrape")

    _, import_id = await asyncio.to_thread(_create_import)
    await request.app.state.redis.set(
        SCRAPE_KEY.format(import_id=import_id), username, ex=3600
    )
    await request.app.state.arq.enqueue_job("run_import", str(import_id))
    return ImportCreated(import_id=str(import_id), profile_id=str(pid))


@router.get("/{profile_id}")
async def get_profile(profile_id: str) -> ProfileSummary:
    pid = await _resolve(profile_id)

    def _read() -> dict[str, Any] | None:
        with get_engine().connect() as conn:
            return taste_repo.get_profile_summary(conn, pid)

    row = await asyncio.to_thread(_read)
    if row is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}
        )
    return ProfileSummary(**row)


@router.get("/{profile_id}/taste")
async def get_taste(profile_id: str) -> TasteProfile:
    pid = await _resolve(profile_id)

    def _read() -> dict[str, Any] | None:
        with get_engine().connect() as conn:
            return taste_repo.get_taste(conn, pid)

    row = await asyncio.to_thread(_read)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {"code": "taste_not_ready", "message": "taste profile not computed yet"}
            },
        )
    return TasteProfile(
        profile_id=str(row["profile_id"]),
        model_version=row["model_version"],
        mu=row["mu"],
        sigma=row["sigma"],
        genre_affinity=row["genre_affinity"] or {},
        director_affinity=row["director_affinity"] or {},
        era_affinity=row["era_affinity"] or {},
        country_affinity=row["country_affinity"] or {},
        runtime_pref=row["runtime_pref"] or {},
        top_keywords=row["top_keywords"] or [],
        gaps=row["gaps"] or {},
    )


@router.get("/{profile_id}/films")
async def get_films(profile_id: str) -> list[FilmDatum]:
    pid = await _resolve(profile_id)

    def _read() -> list[dict[str, Any]]:
        with get_engine().connect() as conn:
            return taste_repo.load_film_dataset(conn, pid)

    rows = await asyncio.to_thread(_read)
    return [FilmDatum(**r) for r in rows]


@router.get("/{profile_id}/watchlist")
async def get_watchlist(profile_id: str) -> list[FilmCard]:
    pid = await _resolve(profile_id)

    def _read() -> list[dict[str, Any]]:
        with get_engine().connect() as conn:
            return taste_repo.get_watchlist(conn, pid)

    rows = await asyncio.to_thread(_read)
    return [
        FilmCard(
            tmdb_id=r["tmdb_id"],
            title=r["title"],
            year=r["year"],
            poster_path=r["poster_path"],
            runtime_min=r["runtime_min"],
            weighted_rating=r["weighted_rating"],
            lb_rating=r["lb_rating"],
            lb_watch_count=r["lb_watch_count"],
            lb_slug=r.get("lb_slug"),
        )
        for r in rows
    ]


@router.get("/{profile_id}/match")
async def get_match(profile_id: str, with_: str = Query(alias="with")) -> MatchResponse:
    pid_a = await _resolve(profile_id)

    def _load() -> dict[str, Any] | None:
        with get_engine().connect() as conn:
            pid_b = taste_repo.resolve_profile_id(conn, with_)
            if pid_b is None:
                return None
            taste_a = recommend_repo.load_taste(conn, pid_a)
            taste_b = recommend_repo.load_taste(conn, pid_b)
            if taste_a is None or taste_b is None:
                return {"missing_taste": True}
            summary_a = taste_repo.get_profile_summary(conn, pid_a)
            summary_b = taste_repo.get_profile_summary(conn, pid_b)
            exclude = (
                recommend_repo.excluded_film_ids(conn, pid_a)
                | recommend_repo.excluded_film_ids(conn, pid_b)
            )
            candidates = recommend_repo.load_candidates(conn, exclude)
            return {
                "taste_a": taste_a,
                "taste_b": taste_b,
                "username_a": (summary_a or {}).get("username", str(pid_a)),
                "username_b": (summary_b or {}).get("username", with_),
                "candidates": candidates,
            }

    data = await asyncio.to_thread(_load)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "profile_not_found",
                    "message": f"profile '{with_}' not found — import them first",
                }
            },
        )
    if data.get("missing_taste"):
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "taste_not_ready",
                    "message": "one or both profiles need more films imported before matching",
                }
            },
        )

    compat = match_domain.compatibility(data["taste_a"], data["taste_b"])
    raw_items = match_domain.co_watch_recommend(
        data["candidates"], data["taste_a"], data["taste_b"]
    )

    items = [
        RecommendationItem(
            film=FilmCard(
                tmdb_id=it["candidate"].tmdb_id,
                title=it["candidate"].title,
                year=it["candidate"].year,
                poster_path=it["candidate"].poster_path,
                runtime_min=it["candidate"].runtime_min,
                weighted_rating=it["candidate"].weighted_rating,
                genres=it["candidate"].genre_names,
                lb_rating=it["candidate"].lb_rating,
                lb_watch_count=it["candidate"].lb_watch_count,
            ),
            rank=i + 1,
            score=it["score"],
            fit=it["fit"],
            components=it["components"],
            explanation=it["explanation"],
        )
        for i, it in enumerate(raw_items)
    ]

    return MatchResponse(
        profile_a=data["username_a"],
        profile_b=data["username_b"],
        compatibility=CompatibilityResult(**compat),
        items=items,
    )


@router.get("/{profile_id}/discover")
async def get_discover(
    profile_id: str,
    genre: str = Query(default="any"),
    era: str = Query(default="any"),
    length: str = Query(default="any"),
    popularity: str = Query(default="any"),
    language: str = Query(default="any"),
) -> list[RecommendationItem]:
    pid = await _resolve(profile_id)

    def _load() -> list[dict[str, Any]] | None:
        with get_engine().connect() as conn:
            taste = recommend_repo.load_taste(conn, pid)
            if taste is None:
                return None
            exclude = recommend_repo.excluded_film_ids(conn, pid)
            candidates = recommend_repo.load_candidates(conn, exclude)
            return discover_domain.discover(
                candidates, taste,
                genre=genre, era=era, length=length, popularity=popularity, language=language,
            )

    raw = await asyncio.to_thread(_load)
    if raw is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {"code": "taste_not_ready", "message": "taste profile not computed yet"}
            },
        )

    return [
        RecommendationItem(
            film=FilmCard(
                tmdb_id=it["candidate"].tmdb_id,
                title=it["candidate"].title,
                year=it["candidate"].year,
                poster_path=it["candidate"].poster_path,
                runtime_min=it["candidate"].runtime_min,
                weighted_rating=it["candidate"].weighted_rating,
                genres=it["candidate"].genre_names,
                lb_rating=it["candidate"].lb_rating,
                lb_watch_count=it["candidate"].lb_watch_count,
            ),
            rank=i + 1,
            score=it["score"],
            fit=it["fit"],
            components=it["components"],
            explanation=it["explanation"],
        )
        for i, it in enumerate(raw)
    ]


@router.get("/{profile_id}/recently-watched")
async def recently_watched(profile_id: str, limit: int = 24) -> list[FilmCard]:
    pid = await _resolve(profile_id)

    def _read() -> list[dict[str, Any]]:
        with get_engine().connect() as conn:
            return taste_repo.recently_watched(conn, pid, limit)

    rows = await asyncio.to_thread(_read)
    return [
        FilmCard(
            tmdb_id=r["tmdb_id"],
            title=r["title"],
            year=r["year"],
            poster_path=r["poster_path"],
            runtime_min=r["runtime_min"],
            weighted_rating=r["weighted_rating"],
            your_rating=r["rating_0_10"],
        )
        for r in rows
    ]
