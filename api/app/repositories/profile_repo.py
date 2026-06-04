"""Persistence for profiles, imports, ratings, and the title crosswalk. Sync Core."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Connection, update
from sqlalchemy.dialects.postgresql import insert

from app.db import tables as t


def get_or_create_profile(
    conn: Connection, username: str, *, source: str
) -> tuple[uuid.UUID, uuid.UUID]:
    """Upsert the profile by username and open a new queued import. Returns ids."""
    pid = uuid.uuid4()
    stmt = (
        insert(t.letterboxd_profile)
        .values(id=pid, username=username)
        .on_conflict_do_update(index_elements=["username"], set_={"username": username})
        .returning(t.letterboxd_profile.c.id)
    )
    profile_id: uuid.UUID = conn.execute(stmt).scalar_one()

    import_id = uuid.uuid4()
    conn.execute(
        insert(t.profile_import).values(
            id=import_id,
            profile_id=profile_id,
            source=source,
            status="queued",
            stage_counts={},
            started_at=datetime.now(UTC),
        )
    )
    return profile_id, import_id


def update_import(
    conn: Connection,
    import_id: uuid.UUID,
    *,
    status: str | None = None,
    stage_counts: dict[str, int] | None = None,
    error: str | None = None,
    finished: bool = False,
) -> None:
    values: dict[str, Any] = {}
    if status is not None:
        values["status"] = status
    if stage_counts is not None:
        values["stage_counts"] = stage_counts
    if error is not None:
        values["error"] = error
    if finished:
        values["finished_at"] = datetime.now(UTC)
    if values:
        conn.execute(
            update(t.profile_import).where(t.profile_import.c.id == import_id).values(**values)
        )


def get_import(conn: Connection, import_id: uuid.UUID) -> dict[str, Any] | None:
    row = (
        conn.execute(t.profile_import.select().where(t.profile_import.c.id == import_id))
        .mappings()
        .first()
    )
    return dict(row) if row else None


def save_ratings(conn: Connection, profile_id: uuid.UUID, rows: list[dict[str, Any]]) -> None:
    """Upsert user_film_rating rows (one per matched film)."""
    if not rows:
        return
    payload = [{"profile_id": profile_id, **r} for r in rows]
    stmt = insert(t.user_film_rating).values(payload)
    stmt = stmt.on_conflict_do_update(
        index_elements=["profile_id", "film_id"],
        set_={
            c: stmt.excluded[c]
            for c in (
                "rating_0_10",
                "liked",
                "watched_date",
                "review_text",
                "in_watchlist",
                "source",
            )
        },
    )
    conn.execute(stmt)


def save_unmatched(conn: Connection, profile_id: uuid.UUID, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    payload = [{"profile_id": profile_id, **r} for r in rows]
    stmt = insert(t.unmatched_film).values(payload)
    stmt = stmt.on_conflict_do_nothing(index_elements=["profile_id", "lb_uri"])
    conn.execute(stmt)


def save_crosswalk(conn: Connection, rows: list[dict[str, Any]]) -> None:
    """Cache (norm_title, year) -> tmdb_id globally. Only rows with a known year."""
    rows = [r for r in rows if r.get("year") is not None]
    if not rows:
        return
    stmt = insert(t.title_crosswalk).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["norm_title", "year"])
    conn.execute(stmt)


def lookup_crosswalk(
    conn: Connection, keys: list[tuple[str, int]]
) -> dict[tuple[str, int], tuple[int, float]]:
    """Batch-resolve cached matches: {(norm_title, year): (tmdb_id, confidence)}."""
    if not keys:
        return {}
    out: dict[tuple[str, int], tuple[int, float]] = {}
    tc = t.title_crosswalk
    norm_titles = list({k[0] for k in keys})
    rows = conn.execute(tc.select().where(tc.c.norm_title.in_(norm_titles))).mappings().all()
    wanted = set(keys)
    for r in rows:
        key = (r["norm_title"], r["year"])
        if key in wanted and r["tmdb_id"] is not None:
            out[key] = (r["tmdb_id"], r["confidence"])
    return out


def finalize_profile(conn: Connection, profile_id: uuid.UUID, display_name: str | None) -> None:
    conn.execute(
        update(t.letterboxd_profile)
        .where(t.letterboxd_profile.c.id == profile_id)
        .values(last_import_at=datetime.now(UTC), display_name=display_name)
    )
