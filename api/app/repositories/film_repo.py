"""Upsert an EnrichedFilm (+ its associations) into the corpus. Sync Core.

Idempotent: re-enriching a film updates the row and refreshes its associations
(join rows are replaced, so removed genres/keywords don't linger).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Connection, Table, delete
from sqlalchemy.dialects.postgresql import insert

from app.db import tables as t
from app.domain.enrich import EnrichedFilm


def upsert_film(conn: Connection, ef: EnrichedFilm, *, weighted: float | None) -> None:
    now = datetime.now(UTC)

    film_values = {
        "tmdb_id": ef.tmdb_id,
        "title": ef.title,
        "original_title": ef.original_title,
        "year": ef.year,
        "runtime_min": ef.runtime_min,
        "original_language": ef.original_language,
        "overview": ef.overview,
        "poster_path": ef.poster_path,
        "vote_average": ef.vote_average,
        "vote_count": ef.vote_count,
        "popularity": ef.popularity,
        "weighted_rating": weighted,
        "adult": ef.adult,
        "status": ef.status,
        "enriched_at": now,
    }
    stmt = insert(t.film).values(**film_values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[t.film.c.tmdb_id],
        set_={k: v for k, v in film_values.items() if k != "tmdb_id"},
    )
    conn.execute(stmt)

    # dimension tables: insert-or-ignore / update name
    if ef.genres:
        _upsert_named(conn, t.genre, "id", [(gid, name) for gid, name in ef.genres])
    if ef.keywords:
        _upsert_named(conn, t.keyword, "tmdb_id", [(k.tmdb_id, k.name) for k in ef.keywords])
    people = {(p.tmdb_id, p.name, p.department) for p in (*ef.directors, *ef.cast_top)}
    if people:
        _upsert_people(conn, people)

    # association tables: replace for this film
    _replace_assoc(
        conn,
        t.film_genre,
        ef.tmdb_id,
        [{"film_id": ef.tmdb_id, "genre_id": gid} for gid, _ in ef.genres],
    )
    _replace_assoc(
        conn,
        t.film_keyword,
        ef.tmdb_id,
        [{"film_id": ef.tmdb_id, "keyword_id": k.tmdb_id} for k in ef.keywords],
    )
    _replace_assoc(
        conn,
        t.film_crew,
        ef.tmdb_id,
        [{"film_id": ef.tmdb_id, "person_id": d.tmdb_id, "job": "Director"} for d in ef.directors],
    )
    _replace_assoc(
        conn,
        t.film_country,
        ef.tmdb_id,
        [{"film_id": ef.tmdb_id, "country_code": c} for c in ef.countries],
    )

    if ef.streaming:
        _replace_assoc(
            conn,
            t.streaming_availability,
            ef.tmdb_id,
            [
                {
                    "film_id": ef.tmdb_id,
                    "region": o.region,
                    "provider": o.provider,
                    "offer_type": o.offer_type,
                    "refreshed_at": now,
                }
                for o in ef.streaming
            ],
        )


def _upsert_named(conn: Connection, table: Table, pk: str, rows: list[tuple[int, str]]) -> None:
    values = [{pk: i, "name": name} for i, name in rows]
    stmt = insert(table).values(values)
    stmt = stmt.on_conflict_do_update(index_elements=[pk], set_={"name": stmt.excluded.name})
    conn.execute(stmt)


def _upsert_people(conn: Connection, people: set[tuple[int, str, str | None]]) -> None:
    # Dedupe by tmdb_id: one person can be credited twice on a film (e.g. director
    # who also acts), which would put duplicate keys in a single ON CONFLICT DO
    # UPDATE — Postgres rejects that ("cannot affect row a second time").
    by_id: dict[int, dict[str, Any]] = {}
    for i, n, d in people:
        by_id.setdefault(i, {"tmdb_id": i, "name": n, "department": d})
    stmt = insert(t.person).values(list(by_id.values()))
    stmt = stmt.on_conflict_do_update(index_elements=["tmdb_id"], set_={"name": stmt.excluded.name})
    conn.execute(stmt)


def _replace_assoc(
    conn: Connection, table: Table, film_id: int, rows: list[dict[str, Any]]
) -> None:
    conn.execute(delete(table).where(table.c.film_id == film_id))
    if rows:
        conn.execute(insert(table).values(rows).on_conflict_do_nothing())
