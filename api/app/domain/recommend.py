"""Recommendation engine (RECOMMENDATION_MATH §7-8). Pure, unit-testable.

Two-stage: candidate gating per surface, then a transparent weighted-sum ranker
whose component contributions double as the "Why this?" explanation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Candidate:
    tmdb_id: int
    title: str
    year: int | None
    poster_path: str | None
    runtime_min: int | None
    weighted_rating: float
    vote_count: int
    popularity: float
    decade: int | None
    genres: list[int] = field(default_factory=list)
    genre_names: list[str] = field(default_factory=list)
    directors: list[int] = field(default_factory=list)
    keywords: list[int] = field(default_factory=list)
    countries: list[str] = field(default_factory=list)


@dataclass
class Taste:
    genre: dict[int, float]
    director: dict[int, float]
    era: dict[int, float]
    country: dict[str, float]
    keyword: dict[int, float]  # id -> normalized weight
    runtime_pref: float | None
    runtime_sd: float
    genre_names: dict[int, str]
    director_names: dict[int, str]
    keyword_names: dict[int, str]


# component weights per surface (sum ~1; collaborative deferred to Phase 3)
WEIGHTS: dict[str, dict[str, float]] = {
    "overall": {"q": 0.34, "g": 0.22, "d": 0.16, "k": 0.14, "e": 0.06, "c": 0.05, "r": 0.03},
    "blind_spots": {"q": 0.40, "g": 0.20, "d": 0.14, "k": 0.12, "e": 0.06, "c": 0.05, "r": 0.03},
    "hidden_gems": {"q": 0.20, "g": 0.24, "d": 0.16, "k": 0.20, "e": 0.08, "c": 0.07, "r": 0.05},
}


def _map01(x: float) -> float:
    return (x + 1.0) / 2.0


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _runtime_fit(runtime: int | None, pref: float | None, sd: float) -> float:
    if runtime is None or pref is None or sd <= 0:
        return 0.5
    return math.exp(-0.5 * ((runtime - pref) / sd) ** 2)


def score(c: Candidate, t: Taste, w: dict[str, float]) -> tuple[float, dict[str, float]]:
    genre_affs = [t.genre[g] for g in c.genres if g in t.genre]
    genre = _mean(genre_affs)
    director = max((t.director.get(d, 0.0) for d in c.directors), default=0.0)
    keyword = min(sum(t.keyword.get(k, 0.0) for k in c.keywords), 1.0)
    era = t.era.get(c.decade, 0.0) if c.decade is not None else 0.0
    country = max((t.country.get(cc, 0.0) for cc in c.countries), default=0.0)
    quality = max(0.0, min(c.weighted_rating / 10.0, 1.0))
    runtime = _runtime_fit(c.runtime_min, t.runtime_pref, t.runtime_sd)

    contrib = {
        "quality": w["q"] * quality,
        "genre": w["g"] * _map01(genre),
        "director": w["d"] * _map01(director),
        "keyword": w["k"] * keyword,
        "era": w["e"] * _map01(era),
        "country": w["c"] * _map01(country),
        "runtime": w["r"] * runtime,
    }
    total = sum(contrib.values())

    # a celebrated film still sinks for a strongly-disliked genre (§10)
    min_genre = min(genre_affs, default=0.0)
    if min_genre < -0.5:
        total *= 1.0 - 0.5 * abs(min_genre)

    return total, contrib


def fit_percent(score: float) -> int:
    """Map a raw fit score to an intuitive 0-100 "% match".

    No film maxes every dimension (top genre + top director + every theme +
    perfect runtime + top rating at once), so theoretical-perfect ~1.0 is never
    reached and real top picks land near ~0.67. We therefore anchor the upper
    end of the scale to that realistically-achievable band so the strongest
    recommendations read in the high 90s, not the theoretical ceiling. A linear
    lerp between the two anchors keeps the ranking's differences visible.
    """
    lo_s, lo_p = 0.30, 50.0  # a marginal fit reads as ~50%
    hi_s, hi_p = 0.67, 98.0  # the strongest realistic fit approaches 100%
    pct = lo_p + (score - lo_s) * (hi_p - lo_p) / (hi_s - lo_s)
    return max(0, min(100, round(pct)))


def _explain(c: Candidate, t: Taste, surface: str) -> dict[str, Any]:
    reasons: list[str] = []
    # director
    best_dir = max(c.directors, key=lambda d: t.director.get(d, -9), default=None)
    if best_dir is not None and t.director.get(best_dir, 0) > 0.2:
        reasons.append(f"By {t.director_names.get(best_dir, 'a director')} — you rate them highly")
    # genre
    liked_genres = [
        t.genre_names[g] for g in c.genres if t.genre.get(g, 0) > 0.1 and g in t.genre_names
    ]
    if liked_genres:
        reasons.append(f"Matches your love of {', '.join(liked_genres[:2])}")
    # keywords
    kw_hits = sorted(
        (k for k in c.keywords if k in t.keyword),
        key=lambda k: t.keyword.get(k, 0.0),
        reverse=True,
    )
    kw_names = [t.keyword_names[k] for k in kw_hits[:3] if k in t.keyword_names]
    if kw_names:
        reasons.append(f"Themes you gravitate toward: {', '.join(kw_names)}")
    # quality — the rating badge on the poster already conveys this, so no reason line
    if not reasons:
        reasons.append("A fit for your overall taste")
    return {"source": surface, "reasons": reasons[:3]}


def _gate(c: Candidate, surface: str, pop_threshold: float) -> bool:
    if surface == "overall":
        # best taste-fit across the whole pool, any popularity tier; a light
        # vote-count + quality floor keeps out obscure low-confidence noise.
        return c.vote_count >= 300 and c.weighted_rating >= 6.0
    if surface == "blind_spots":
        return c.vote_count >= 1000 and c.weighted_rating >= 6.8
    if surface == "hidden_gems":
        # under-the-radar but reliable: good rating, lower popularity, a vote-count
        # floor for trust and a ceiling to exclude the mega-popular canon.
        return (
            c.weighted_rating >= 6.6
            and c.popularity <= pop_threshold
            and 150 <= c.vote_count <= 9000
        )
    return True


def recommend(
    candidates: list[Candidate], taste: Taste, surface: str, *, limit: int = 24
) -> list[dict[str, Any]]:
    w = WEIGHTS.get(surface, WEIGHTS["blind_spots"])
    pops = sorted(c.popularity for c in candidates)
    pct = 0.65 if surface == "hidden_gems" else 0.5
    pop_threshold = pops[min(int(len(pops) * pct), len(pops) - 1)] if pops else 0.0

    gated = [c for c in candidates if _gate(c, surface, pop_threshold)]
    scored: list[tuple[float, Candidate, dict[str, float]]] = []
    for c in gated:
        s, contrib = score(c, taste, w)
        if surface == "hidden_gems" and pop_threshold > 0:
            s += 0.08 * (1.0 - min(c.popularity / pop_threshold, 1.0))  # obscurity bonus
        scored.append((s, c, contrib))

    scored.sort(key=lambda x: x[0], reverse=True)

    # diversity: at most 3 films per director in the final list
    out: list[dict[str, Any]] = []
    dir_count: dict[int, int] = {}
    for s, c, contrib in scored:
        d = c.directors[0] if c.directors else -1
        if dir_count.get(d, 0) >= 3:
            continue
        dir_count[d] = dir_count.get(d, 0) + 1
        out.append(
            {
                "candidate": c,
                "score": round(s, 4),
                "fit": fit_percent(s),
                "components": {k: round(v, 4) for k, v in contrib.items()},
                "explanation": _explain(c, taste, surface),
            }
        )
        if len(out) >= limit:
            break
    return out
