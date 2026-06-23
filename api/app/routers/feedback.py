"""North-star feedback capture (PLAN §12)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.dialects.postgresql import insert

from app.db import tables as t
from app.db.base import get_engine
from app.schemas.models import FeedbackRequest, FilmCard

router = APIRouter(prefix="/profiles", tags=["feedback"])


@router.post("/{profile_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def submit_feedback(profile_id: str, body: FeedbackRequest) -> None:
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}
        ) from None

    def _save() -> None:
        stmt = insert(t.user_feedback).values(
            profile_id=pid,
            film_id=body.film_id,
            action=body.action.value,
            surface=body.surface,
            created_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["profile_id", "film_id", "action"],
            set_={"surface": stmt.excluded.surface, "created_at": stmt.excluded.created_at},
        )
        with get_engine().begin() as conn:
            conn.execute(stmt)

    await asyncio.to_thread(_save)


@router.get("/{profile_id}/dismissed")
async def get_dismissed(profile_id: str) -> list[FilmCard]:
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}) from None

    def _read() -> list[dict[str, Any]]:
        film = t.film
        stmt = (
            select(
                film.c.tmdb_id,
                film.c.title,
                film.c.year,
                film.c.poster_path,
                film.c.runtime_min,
                film.c.weighted_rating,
            )
            .select_from(
                t.user_feedback.join(film, film.c.tmdb_id == t.user_feedback.c.film_id)
            )
            .where(
                t.user_feedback.c.profile_id == pid,
                t.user_feedback.c.action == "not_interested",
            )
            .order_by(t.user_feedback.c.created_at.desc())
        )
        with get_engine().connect() as conn:
            return [dict(r._mapping) for r in conn.execute(stmt)]

    rows = await asyncio.to_thread(_read)
    return [
        FilmCard(
            tmdb_id=r["tmdb_id"],
            title=r["title"],
            year=r["year"],
            poster_path=r["poster_path"],
            runtime_min=r["runtime_min"],
            weighted_rating=r["weighted_rating"],
        )
        for r in rows
    ]


@router.delete("/{profile_id}/dismissed/{film_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_dismissed(profile_id: str, film_id: int) -> None:
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "profile not found"}}) from None

    def _delete() -> None:
        with get_engine().begin() as conn:
            conn.execute(
                sa_delete(t.user_feedback).where(
                    t.user_feedback.c.profile_id == pid,
                    t.user_feedback.c.film_id == film_id,
                    t.user_feedback.c.action == "not_interested",
                )
            )

    await asyncio.to_thread(_delete)
