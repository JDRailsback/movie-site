"""Load recommendation inputs: the stored taste vectors and the candidate corpus
(everything the user hasn't watched)."""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any

from sqlalchemy import Connection, or_, select

from app.db import tables as t
from app.domain.recommend import Candidate, Taste

# The full eligible-candidate corpus is identical for every caller (only the
# per-profile `exclude` set differs) but was previously re-queried — base
# columns plus four separate join queries for genres/directors/keywords/
# countries — on every single recs/discover/match request. With a
# multi-thousand-film corpus and several concurrent requests (the frontend
# fires overall/blind_spots/hidden_gems in parallel right after import),
# that repeated full-corpus load was enough to exceed a 512MB instance.
# Cache the unfiltered corpus in-process; `exclude` is then a cheap
# in-memory filter instead of a DB round-trip. TTL (not permanent) so films
# enriched by a later import still show up without requiring a restart.
_CACHE_TTL_SECONDS = 900
_candidates_cache: list[Candidate] | None = None
_candidates_cache_at: float = 0.0
_candidates_cache_lock = threading.Lock()


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
    """Films the user has already watched, plus 'not interested'.

    Watchlist-only entries are NOT excluded. For export imports, watched films
    always carry watched_date or rating_0_10. For scrape imports, neither is
    set for unrated films, so we additionally exclude scrape rows where the
    film is not purely a watchlist entry (in_watchlist IS NOT TRUE means the
    user logged it as watched on Letterboxd).
    """
    ufr = t.user_film_rating
    watched = conn.execute(
        select(ufr.c.film_id).where(
            ufr.c.profile_id == profile_id,
            ufr.c.watched.is_(True),
        )
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
    """All eligible candidates minus `exclude`. The unfiltered corpus is
    process-cached (see module docstring above) — this just applies the
    per-profile exclusion set in memory."""
    global _candidates_cache, _candidates_cache_at
    now = time.monotonic()
    if _candidates_cache is None or (now - _candidates_cache_at) > _CACHE_TTL_SECONDS:
        with _candidates_cache_lock:
            if _candidates_cache is None or (now - _candidates_cache_at) > _CACHE_TTL_SECONDS:
                _candidates_cache = _load_all_candidates(conn)
                _candidates_cache_at = now
    if not exclude:
        return _candidates_cache
    return [c for c in _candidates_cache if c.tmdb_id not in exclude]


def _load_all_candidates(conn: Connection) -> list[Candidate]:
    film = t.film
    # TMDB genre IDs excluded from all recommendation surfaces:
    #   99    = Documentary
    #   10402 = Music (concert films, music videos, music documentaries)
    #   10751 = Family (kids films)
    _EXCLUDED_GENRE_IDS = [99, 10402, 10751]

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
            film.c.lb_rating,
            film.c.lb_watch_count,
            film.c.original_language,
        ).where(
            film.c.weighted_rating.is_not(None),
            film.c.vote_count.is_not(None),
            film.c.adult.is_not(True),
            # Exclude short films; allow NULL runtime (data gap, not necessarily short)
            or_(film.c.runtime_min.is_(None), film.c.runtime_min >= 40),
            # Exclude concert films / music-only content by genre
            film.c.tmdb_id.not_in(
                select(t.film_genre.c.film_id).where(
                    t.film_genre.c.genre_id.in_(_EXCLUDED_GENRE_IDS)
                )
            ),
        )
    ).all()

    cands: dict[int, Candidate] = {}
    for r in rows:
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
            lb_rating=float(r.lb_rating) if r.lb_rating is not None else None,
            lb_watch_count=int(r.lb_watch_count) if r.lb_watch_count is not None else None,
            original_language=r.original_language,
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

    # resolve genre ids -> names for display (scoring still uses the ids)
    gmap = {r.id: r.name for r in conn.execute(select(t.genre.c.id, t.genre.c.name))}
    for c in cands.values():
        c.genre_names = [gmap[g] for g in c.genres if g in gmap]
    return list(cands.values())


def _fill(
    conn: Connection, stmt: Any, ids: list[int], cands: dict[int, Candidate], attr: str
) -> None:
    # the first selected column is always film_id
    fid_col = stmt.selected_columns[0]
    for r in conn.execute(stmt.where(fid_col.in_(ids))):
        if r[0] in cands:
            getattr(cands[r[0]], attr).append(r[1])
