"""Load taste-engine inputs from the DB and persist/read the computed profile."""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Connection, func, select
from sqlalchemy.dialects.postgresql import insert

from app.db import tables as t
from app.domain.taste import CorpusStats, RatedFilm, TasteResult


def load_rated_films(conn: Connection, profile_id: uuid.UUID) -> list[RatedFilm]:
    ufr, film = t.user_film_rating, t.film
    rows = conn.execute(
        select(
            film.c.tmdb_id,
            ufr.c.rating_0_10,
            ufr.c.liked,
            film.c.year,
            film.c.runtime_min,
            film.c.vote_average,
        )
        .select_from(ufr.join(film, film.c.tmdb_id == ufr.c.film_id))
        .where(ufr.c.profile_id == profile_id, ufr.c.in_watchlist.is_not(True))
    ).all()

    films: dict[int, RatedFilm] = {}
    for r in rows:
        decade = (r.year // 10) * 10 if r.year else None
        films[r.tmdb_id] = RatedFilm(
            tmdb_id=r.tmdb_id,
            rating_0_10=r.rating_0_10,
            liked=bool(r.liked),
            decade=decade,
            runtime_min=r.runtime_min,
            tmdb_vote_average=r.vote_average,
        )
    if not films:
        return []

    ids = list(films)
    _fill(conn, t.film_genre, ids, "genre_id", films, "genres")
    _fill(conn, t.film_keyword, ids, "keyword_id", films, "keywords")
    _fill(conn, t.film_country, ids, "country_code", films, "countries")
    for r in conn.execute(
        select(t.film_crew.c.film_id, t.film_crew.c.person_id).where(
            t.film_crew.c.film_id.in_(ids), t.film_crew.c.job == "Director"
        )
    ):
        films[r.film_id].directors.append(r.person_id)
    return list(films.values())


def _fill(
    conn: Connection, table: Any, ids: list[int], col: str, films: dict[int, RatedFilm], attr: str
) -> None:
    for r in conn.execute(select(table.c.film_id, table.c[col]).where(table.c.film_id.in_(ids))):
        getattr(films[r.film_id], attr).append(r[1])


def load_corpus_stats(conn: Connection, keyword_ids: set[int], person_ids: set[int]) -> CorpusStats:
    total = conn.execute(select(func.count()).select_from(t.film)).scalar_one() or 1

    genre_base = {
        gid: cnt / total
        for gid, cnt in conn.execute(
            select(t.film_genre.c.genre_id, func.count()).group_by(t.film_genre.c.genre_id)
        )
    }
    country_base = {
        cc: cnt / total
        for cc, cnt in conn.execute(
            select(t.film_country.c.country_code, func.count()).group_by(
                t.film_country.c.country_code
            )
        )
    }
    decade_expr = (t.film.c.year / 10 * 10).label("decade")
    decade_base = {
        int(dec): cnt / total
        for dec, cnt in conn.execute(
            select(decade_expr, func.count())
            .where(t.film.c.year.is_not(None))
            .group_by(decade_expr)
        )
        if dec is not None
    }
    vote_mean, vote_std = conn.execute(
        select(func.avg(t.film.c.vote_average), func.stddev_pop(t.film.c.vote_average))
    ).one()

    keyword_idf: dict[int, float] = {}
    if keyword_ids:
        for kid, df in conn.execute(
            select(t.film_keyword.c.keyword_id, func.count())
            .where(t.film_keyword.c.keyword_id.in_(keyword_ids))
            .group_by(t.film_keyword.c.keyword_id)
        ):
            keyword_idf[kid] = math.log((total + 1) / (df + 1)) + 1

    return CorpusStats(
        genre_base=genre_base,
        country_base=country_base,
        decade_base=decade_base,
        vote_mean=float(vote_mean or 6.0),
        vote_std=float(vote_std or 1.0) or 1.0,
        keyword_idf=keyword_idf,
        genre_names=_names(conn, t.genre, t.genre.c.id, t.genre.c.name, None),
        keyword_names=_names(conn, t.keyword, t.keyword.c.tmdb_id, t.keyword.c.name, keyword_ids),
        person_names=_names(conn, t.person, t.person.c.tmdb_id, t.person.c.name, person_ids),
    )


def _names(
    conn: Connection, table: Any, id_col: Any, name_col: Any, ids: set[int] | None
) -> dict[int, str]:
    stmt = select(id_col, name_col)
    if ids is not None:
        if not ids:
            return {}
        stmt = stmt.where(id_col.in_(ids))
    return {row[0]: row[1] for row in conn.execute(stmt)}


def save_taste(
    conn: Connection, profile_id: uuid.UUID, model_version: str, res: TasteResult
) -> None:
    values = {
        "profile_id": profile_id,
        "model_version": model_version,
        "mu": res.mu,
        "sigma": res.sigma,
        "genre_affinity": res.genre_affinity,
        "director_affinity": res.director_affinity,
        "era_affinity": res.era_affinity,
        "country_affinity": res.country_affinity,
        "runtime_pref": res.runtime_pref,
        "top_keywords": res.top_keywords,
        "gaps": res.gaps,
        "computed_at": datetime.now(UTC),
    }
    stmt = insert(t.taste_profile).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["profile_id"],
        set_={k: v for k, v in values.items() if k != "profile_id"},
    )
    conn.execute(stmt)


def get_taste(conn: Connection, profile_id: uuid.UUID) -> dict[str, Any] | None:
    row = (
        conn.execute(t.taste_profile.select().where(t.taste_profile.c.profile_id == profile_id))
        .mappings()
        .first()
    )
    return dict(row) if row else None


def get_profile_summary(conn: Connection, profile_id: uuid.UUID) -> dict[str, Any] | None:
    p = (
        conn.execute(t.letterboxd_profile.select().where(t.letterboxd_profile.c.id == profile_id))
        .mappings()
        .first()
    )
    if p is None:
        return None
    film_count = conn.execute(
        select(func.count())
        .select_from(t.user_film_rating)
        .where(
            t.user_film_rating.c.profile_id == profile_id,
            t.user_film_rating.c.in_watchlist.is_not(True),
        )
    ).scalar_one()
    return {
        "profile_id": str(p["id"]),
        "username": p["username"],
        "display_name": p["display_name"],
        "last_import_at": p["last_import_at"],
        "film_count": film_count,
    }


def recently_watched(conn: Connection, profile_id: uuid.UUID, limit: int) -> list[dict[str, Any]]:
    ufr, film = t.user_film_rating, t.film
    rows = (
        conn.execute(
            select(
                film.c.tmdb_id,
                film.c.title,
                film.c.year,
                film.c.poster_path,
                film.c.runtime_min,
                film.c.weighted_rating,
                ufr.c.rating_0_10,
            )
            .select_from(ufr.join(film, film.c.tmdb_id == ufr.c.film_id))
            .where(ufr.c.profile_id == profile_id, ufr.c.in_watchlist.is_not(True))
            .order_by(ufr.c.watched_date.desc().nulls_last())
            .limit(limit)
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]
