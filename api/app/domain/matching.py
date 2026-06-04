"""Title+year -> TMDB id matching (PLAN §3.2).

The selection logic is pure and unit-testable: it takes TMDB search candidates and
returns the best match with a confidence score. The orchestrator applies a
confidence threshold and quarantines low-confidence matches so a wrong match never
poisons the taste profile.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

_ARTICLES = ("the ", "a ", "an ")


def normalize_title(title: str) -> str:
    """Lowercase, strip diacritics/punctuation, collapse whitespace, drop articles."""
    t = unicodedata.normalize("NFKD", title)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower().strip()
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    for art in _ARTICLES:
        if t.startswith(art):
            t = t[len(art) :]
            break
    return t


def _cand_year(candidate: dict[str, Any]) -> int | None:
    rd = candidate.get("release_date") or ""
    return int(rd[:4]) if rd[:4].isdigit() else None


@dataclass
class MatchResult:
    tmdb_id: int
    confidence: float
    title: str


def choose_match(
    query_title: str, query_year: int | None, candidates: list[dict[str, Any]]
) -> MatchResult | None:
    """Pick the best TMDB candidate for a Letterboxd (title, year).

    Confidence:
      1.00  exact normalized title + exact year
      0.90  exact title + year within 1
      0.80  exact title, query year unknown
      0.55  exact title, year off by >1 (likely remake — accept cautiously)
      0.40  no exact title; best popular candidate (quarantine territory)
    Ties broken by vote_count then popularity.
    """
    if not candidates:
        return None

    nq = normalize_title(query_title)
    scored: list[tuple[float, int, float, dict[str, Any]]] = []
    for c in candidates:
        names = {
            normalize_title(c.get("title") or ""),
            normalize_title(c.get("original_title") or ""),
        }
        exact = nq in names and nq != ""
        cy = _cand_year(c)
        if exact and query_year is not None and cy is not None:
            if cy == query_year:
                conf = 1.0
            elif abs(cy - query_year) <= 1:
                conf = 0.90
            else:
                conf = 0.55
        elif exact and query_year is None:
            conf = 0.80
        elif exact:
            conf = 0.80
        else:
            conf = 0.40
        scored.append((conf, c.get("vote_count", 0), c.get("popularity", 0.0), c))

    scored.sort(key=lambda s: (s[0], s[1], s[2]), reverse=True)
    conf, _, _, best = scored[0]
    return MatchResult(tmdb_id=best["id"], confidence=conf, title=best.get("title", ""))
