"""Load recommendation inputs: the stored taste vectors and the candidate corpus
(everything the user hasn't watched)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Connection, select

from app.db import tables as t
from app.domain.recommend import Candidate, Taste


def load_taste(conn: Connection, profile_id: uuid.UUID) -> Taste | None:
    row = (
        conn.execute(t.taste_profile.select().where(t.taste_profile.c.profile_id == profile_id))
        .mappings()
        .first()
    )
    if row is None:
        return None

    genre = row["genre_affinity"] or {}
    director = row["director_affinity"] or {}
    era = row["era_affinity"] or {}
    country = row["country_affinity"] or {}
    keywords = row["top_keywords"] or []
    rt = row["runtime_pref"] or {}

    return Taste(
        genre={int(k): v["affinity"] for k, v in genre.items()},
        director={int(k): v["affinity"] for k, v in director.items()},
        era={int(k): v["affinity"] for k, v in era.items()},
        country={k: v["affinity"] for k, v in country.items()},
        keyword={int(k["id"]): float(k["weight"]) for k in keywords},
        runtime_pref=rt.get("pref_min"),
        runtime_sd=float(rt.get("sd_min") or 30.0),
        genre_names={int(k): v["name"] for k, v in genre.items()},
        director_names={int(k): v["name"] for k, v in director.items()},
        keyword_names={int(k["id"]): k["name"] for k in keywords},
    )


def excluded_film_ids(conn: Connection, profile_id: uuid.UUID) -> set[int]:
    """Films the user has already watched or watchlisted, plus 'not interested'."""
    watched = conn.execute(
        select(t.user_film_rating.c.film_id).where(t.user_film_rating.c.profile_id == profile_id)
    )
    out = {r[0] for r in watched}
    not_int = conn.execute(
        select(t.user_feedback.c.film_id).where(
            t.user_feedback.c.profile_id == profile_id,
            t.user_feedback.c.action == "not_interested",
        )
    )
    out |= {r[0] for r in not_int}
    return out


def load_candidates(conn: Connection, exclude: set[int]) -> list[Candidate]:
    film = t.film
    rows = conn.execute(
        select(
            film.c.tmdb_id,
            film.c.title,
            film.c.year,
            film.c.poster_path,
            film.c.runtime_min,
            film.c.weighted_rating,
            film.c.vote_count,
            film.c.popularity,
        ).where(
            film.c.weighted_rating.is_not(None),
            film.c.vote_count.is_not(None),
            film.c.adult.is_not(True),
        )
    ).all()

    cands: dict[int, Candidate] = {}
    for r in rows:
        if r.tmdb_id in exclude:
            continue
        cands[r.tmdb_id] = Candidate(
            tmdb_id=r.tmdb_id,
            title=r.title,
            year=r.year,
            poster_path=r.poster_path,
            runtime_min=r.runtime_min,
            weighted_rating=float(r.weighted_rating),
            vote_count=int(r.vote_count),
            popularity=float(r.popularity or 0.0),
            decade=(r.year - r.year % 10) if r.year else None,
        )
    if not cands:
        return []
    ids = list(cands)

    _fill(conn, select(t.film_genre.c.film_id, t.film_genre.c.genre_id), ids, cands, "genres")
    _fill(
        conn,
        select(t.film_crew.c.film_id, t.film_crew.c.person_id).where(
            t.film_crew.c.job == "Director"
        ),
        ids,
        cands,
        "directors",
    )
    _fill(
        conn, select(t.film_keyword.c.film_id, t.film_keyword.c.keyword_id), ids, cands, "keywords"
    )
    _fill(
        conn,
        select(t.film_country.c.film_id, t.film_country.c.country_code),
        ids,
        cands,
        "countries",
    )
    return list(cands.values())


def _fill(
    conn: Connection, stmt: Any, ids: list[int], cands: dict[int, Candidate], attr: str
) -> None:
    # the first selected column is always film_id
    fid_col = stmt.selected_columns[0]
    for r in conn.execute(stmt.where(fid_col.in_(ids))):
        if r[0] in cands:
            getattr(cands[r[0]], attr).append(r[1])
