"""Import endpoints: export upload (primary), username scrape (fallback), status,
and the SSE progress stream (PLAN §5)."""

from __future__ import annotations

import asyncio
import re
import uuid
import zipfile
from typing import Any

from fastapi import APIRouter, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from app.db.base import get_engine
from app.domain.letterboxd_export import parse_export
from app.integrations import progress
from app.repositories import profile_repo
from app.schemas.models import (
    ByUsernameRequest,
    ImportCreated,
    ImportSource,
    ImportState,
    ImportStatus,
)
from app.services.import_pipeline import SCRAPE_KEY, ZIP_KEY

router = APIRouter(prefix="/imports", tags=["imports"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # generous ceiling for a Letterboxd export
ZIP_TTL_SECONDS = 60 * 60
_USERNAME_RE = re.compile(r"^[a-z0-9_-]{1,50}$")


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_import_from_export(request: Request, file: UploadFile) -> ImportCreated:
    """Primary path: upload a Letterboxd export ZIP (decision #1)."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"error": {"code": "too_large", "message": "export exceeds size limit"}},
        )
    try:
        parsed = parse_export(data)
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "bad_zip",
                    "message": "uploaded file is not a valid Letterboxd export ZIP",
                }
            },
        ) from None

    username = parsed.username or f"import-{uuid.uuid4().hex[:8]}"

    def _create() -> tuple[uuid.UUID, uuid.UUID]:
        with get_engine().begin() as conn:
            return profile_repo.get_or_create_profile(conn, username, source="export")

    profile_id, import_id = await asyncio.to_thread(_create)

    await request.app.state.redis.set(ZIP_KEY.format(import_id=import_id), data, ex=ZIP_TTL_SECONDS)
    await request.app.state.arq.enqueue_job("run_import", str(import_id))
    return ImportCreated(import_id=str(import_id), profile_id=str(profile_id))


@router.post("/by-username", status_code=status.HTTP_202_ACCEPTED)
async def create_import_from_username(request: Request, body: ByUsernameRequest) -> ImportCreated:
    """Scrape a public Letterboxd profile by username."""
    username = body.username.strip().lower()
    if not username or not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "invalid_username",
                    "message": "invalid Letterboxd username",
                }
            },
        )

    def _create() -> tuple[uuid.UUID, uuid.UUID]:
        with get_engine().begin() as conn:
            return profile_repo.get_or_create_profile(conn, username, source="scrape")

    profile_id, import_id = await asyncio.to_thread(_create)
    await request.app.state.redis.set(
        SCRAPE_KEY.format(import_id=import_id), username, ex=ZIP_TTL_SECONDS
    )
    await request.app.state.arq.enqueue_job("run_import", str(import_id))
    return ImportCreated(import_id=str(import_id), profile_id=str(profile_id))


@router.get("/{import_id}")
async def get_import_status(import_id: str) -> ImportStatus:
    def _read() -> dict[str, Any] | None:
        with get_engine().connect() as conn:
            return profile_repo.get_import(conn, uuid.UUID(import_id))

    row = await asyncio.to_thread(_read)
    if row is None:
        raise HTTPException(
            status_code=404, detail={"error": {"code": "not_found", "message": "import not found"}}
        )
    return ImportStatus(
        import_id=str(row["id"]),
        profile_id=str(row["profile_id"]),
        source=ImportSource(row["source"]),
        status=ImportState(row["status"]),
        stage_counts=row.get("stage_counts") or {},
        error=row.get("error"),
    )


@router.get("/{import_id}/events")
async def import_events(request: Request, import_id: str) -> StreamingResponse:
    """SSE stream of import progress (text/event-stream)."""
    stream = progress.subscribe(request.app.state.redis, import_id)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
