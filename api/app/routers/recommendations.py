"""Recommendation surfaces (PLAN §7-8, RECOMMENDATION_MATH)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.routers._stub import not_implemented
from app.schemas.models import Explanation, FilmCard, RecommendationItem, RecommendationSet
from app.services import recommend_service

router = APIRouter(tags=["recommendations"])
settings = get_settings()


@router.get("/profiles/{profile_id}/recs/{surface}")
async def get_recs(
    profile_id: str,
    surface: str,
    limit: int = 24,
) -> RecommendationSet:
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}
        ) from None
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
