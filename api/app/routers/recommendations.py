"""Recommendation surfaces (PLAN §7-8, RECOMMENDATION_MATH)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.db.base import get_engine
from app.repositories import taste_repo
from app.routers._stub import not_implemented
from app.schemas.models import Explanation, FilmCard, RecommendationItem, RecommendationSet
from app.services import recommend_service

router = APIRouter(tags=["recommendations"])
settings = get_settings()


async def _resolve(profile_id: str) -> uuid.UUID:
    def _lookup() -> uuid.UUID | None:
        with get_engine().connect() as conn:
            return taste_repo.resolve_profile_id(conn, profile_id)

    pid = await asyncio.to_thread(_lookup)
    if pid is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}
        )
    return pid


@router.get("/profiles/{profile_id}/recs/{surface}")
async def get_recs(
    profile_id: str,
    surface: str,
    limit: int = 24,
) -> RecommendationSet:
    pid = await _resolve(profile_id)
    if surface not in recommend_service.SURFACES:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "unknown_surface", "message": f"unknown surface {surface}"}},
        )

    def _gen() -> list[dict[str, Any]] | None:
        return recommend_service.generate(pid, surface, limit)

    items = await asyncio.to_thread(_gen)
    if items is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {"code": "taste_not_ready", "message": "taste profile not computed yet"}
            },
        )

    return RecommendationSet(
        set_id=f"{profile_id}:{surface}",
        surface=surface,
        params={},
        model_version=settings.model_version,
        items=[
            RecommendationItem(
                film=FilmCard(
                    tmdb_id=it["candidate"].tmdb_id,
                    title=it["candidate"].title,
                    year=it["candidate"].year,
                    poster_path=it["candidate"].poster_path,
                    runtime_min=it["candidate"].runtime_min,
                    weighted_rating=round(it["candidate"].weighted_rating, 2),
                    genres=it["candidate"].genre_names,
                    lb_rating=round(it["candidate"].lb_rating, 2)
                    if it["candidate"].lb_rating is not None
                    else None,
                    lb_watch_count=it["candidate"].lb_watch_count,
                ),
                rank=i + 1,
                score=it["score"],
                fit=it["fit"],
                components=it["components"],
                explanation=Explanation(**it["explanation"]),
            )
            for i, it in enumerate(items)
        ],
    )


@router.post("/recs/{set_id}/share")
def share_set(set_id: str) -> dict[str, str]:
    not_implemented("share recommendation set", phase="3")
    raise AssertionError


@router.get("/share/{share_id}")
def get_shared(share_id: str) -> RecommendationSet:
    not_implemented("shared recommendation set", phase="3")
    raise AssertionError
