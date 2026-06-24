"""Profile + taste-profile reads (PLAN §6)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.db.base import get_engine
from app.repositories import profile_repo, taste_repo
from app.schemas.models import FilmCard, FilmDatum, ImportCreated, ProfileSummary, TasteProfile
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
        )
        for r in rows
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
