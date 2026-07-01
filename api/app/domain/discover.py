"""Discover: quiz-driven film recommendation. Pure, unit-testable."""

from __future__ import annotations

from typing import Any

from app.domain.recommend import (
    WEIGHTS,
    Candidate,
    Taste,
    _explain,
    fit_percent,
)
from app.domain.recommend import (
    score as taste_score,
)

# TMDB genre ID(s) per selectable genre name
_GENRE_IDS: dict[str, set[int]] = {
    "action": {28},
    "adventure": {12},
    "animation": {16},
    "comedy": {35},
    "crime": {80},
    "drama": {18},
    "fantasy": {14},
    "horror": {27},
    "mystery": {9648},
    "romance": {10749},
    "sci-fi": {878},
    "thriller": {53},
    "western": {37},
    "history": {36},
}


def discover(
    candidates: list[Candidate],
    taste: Taste,
    *,
    genre: str = "any",
    era: str = "any",
    length: str = "any",
    popularity: str = "any",
    language: str = "any",
    limit: int = 3,
) -> list[dict[str, Any]]:
    w = WEIGHTS["overall"]
    scored: list[tuple[float, Candidate, dict]] = []

    for c in candidates:
        # Length
        if length == "short" and (c.runtime_min is None or c.runtime_min > 95):
            continue
        if (
            length == "standard"
            and c.runtime_min is not None
            and (c.runtime_min < 80 or c.runtime_min > 135)
        ):
            continue
        if length == "epic" and (c.runtime_min is None or c.runtime_min < 130):
            continue

        # Genre
        if genre != "any":
            target = _GENRE_IDS.get(genre, set())
            if not any(g in target for g in c.genres):
                continue

        # Era
        yr = c.year
        if era == "classic" and (yr is None or yr >= 1970):
            continue
        if era == "retro" and (yr is None or yr < 1970 or yr >= 2000):
            continue
        if era == "modern" and (yr is None or yr < 2000 or yr >= 2015):
            continue
        if era == "new" and (yr is None or yr < 2015):
            continue

        # Popularity
        lbwc = c.lb_watch_count
        if popularity == "mainstream":
            if lbwc is not None and lbwc < 100_000:
                continue
            if lbwc is None and c.vote_count < 3_000:
                continue
        if popularity == "hidden":
            if lbwc is not None and lbwc > 100_000:
                continue
            if lbwc is None and c.vote_count > 5_000:
                continue

        # Language
        lang = c.original_language
        if language == "english" and lang not in (None, "en"):
            continue
        if language == "foreign" and lang in (None, "en"):
            continue

        s, contrib = taste_score(c, taste, w)
        scored.append((s, c, contrib))

    scored.sort(key=lambda x: x[0], reverse=True)

    out: list[dict[str, Any]] = []
    dir_count: dict[int, int] = {}
    for s, c, contrib in scored:
        # At most one film per director to keep results diverse
        d = c.directors[0] if c.directors else -1
        if dir_count.get(d, 0) >= 1:
            continue
        dir_count[d] = dir_count.get(d, 0) + 1
        out.append(
            {
                "candidate": c,
                "score": round(s, 4),
                "fit": fit_percent(s),
                "components": {k: round(v, 4) for k, v in contrib.items()},
                "explanation": _explain(c, taste, "overall"),
            }
        )
        if len(out) >= limit:
            break
    return out
