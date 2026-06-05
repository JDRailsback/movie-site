"""North-star feedback capture (PLAN §12)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.dialects.postgresql import insert

from app.db import tables as t
from app.db.base import get_engine
from app.schemas.models import FeedbackRequest

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
