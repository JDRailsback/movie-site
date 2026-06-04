"""Taste-profile engine (RECOMMENDATION_MATH §6). Pure, unit-testable.

Operates on plain dataclasses (rated films + corpus statistics) and returns a
TasteResult. No DB or network — the repository layer loads the inputs and persists
the output. Every comparison is on the user's own normalized rating scale.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

SIGMA_MIN = 1.0  # on the 0-10 scale (§2)
K_GENRE = 15
K_DIRECTOR = 4
K_COUNTRY = 12
K_DECADE = 12
# genre blend weights (§5.5)
B_REL, B_AUD, B_ENG, B_LIKE = 0.40, 0.25, 0.25, 0.10
ENG_SCALE = 1.5  # s3 (§5.3)
LIKE_SCALE = 0.15  # s4 (§5.4)
EPS = 1e-6

# Curated keyword stoplist (§8.1): ubiquitous, low-signal tags that carry no
# thematic meaning. Matched case-insensitively by keyword name.
KEYWORD_STOPLIST = frozenset(
    {
        "based on novel or book",
        "based on true story",
        "based on play or musical",
        "based on comic",
        "based on short story",
        "based on young adult novel",
        "based on memoir or autobiography",
        "based on television series",
        "aftercreditsstinger",
        "duringcreditsstinger",
        "post-credits scene",
        "woman director",
        "independent film",
        "sequel",
        "live action remake",
        "remake",
        "3d",
    }
)


@dataclass
class RatedFilm:
    tmdb_id: int
    rating_0_10: int | None
    liked: bool
    genres: list[int] = field(default_factory=list)
    keywords: list[int] = field(default_factory=list)
    directors: list[int] = field(default_factory=list)
    decade: int | None = None
    countries: list[str] = field(default_factory=list)
    runtime_min: int | None = None
    tmdb_vote_average: float | None = None


@dataclass
class CorpusStats:
    genre_base: dict[int, float]  # share of corpus films in each genre
    country_base: dict[str, float]
    decade_base: dict[int, float]
    vote_mean: float
    vote_std: float
    keyword_idf: dict[int, float]
    genre_names: dict[int, str]
    keyword_names: dict[int, str]
    person_names: dict[int, str]


@dataclass
class TasteResult:
    mu: float
    sigma: float
    genre_affinity: dict[str, Any]
    director_affinity: dict[str, Any]
    era_affinity: dict[str, Any]
    country_affinity: dict[str, Any]
    runtime_pref: dict[str, Any]
    top_keywords: list[dict[str, Any]]
    gaps: dict[str, Any]


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _shrink(mean_z: float, n: int, k: int) -> float:
    return (n / (n + k)) * mean_z if n else 0.0


def _clip(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def compute_taste(films: list[RatedFilm], corpus: CorpusStats) -> TasteResult:
    rated = [f for f in films if f.rating_0_10 is not None]
    ratings = [f.rating_0_10 for f in rated if f.rating_0_10 is not None]
    mu = _mean([float(r) for r in ratings])
    sigma = _std([float(r) for r in ratings], mu)
    sigma_eff = max(sigma, SIGMA_MIN)

    # per-film normalized scores
    z: dict[int, float] = {
        f.tmdb_id: (f.rating_0_10 - mu) / sigma_eff for f in rated if f.rating_0_10 is not None
    }
    ztmdb: dict[int, float] = {
        f.tmdb_id: ((f.tmdb_vote_average - corpus.vote_mean) / corpus.vote_std)
        if f.tmdb_vote_average is not None and corpus.vote_std > 0
        else 0.0
        for f in rated
    }
    total = len(rated)
    like_rate_overall = _mean([1.0 if f.liked else 0.0 for f in rated])

    return TasteResult(
        mu=mu,
        sigma=sigma,
        genre_affinity=_genres(rated, z, ztmdb, total, like_rate_overall, corpus),
        director_affinity=_directors(rated, z, corpus),
        era_affinity=_decades(rated, z, corpus),
        country_affinity=_countries(rated, z, corpus),
        runtime_pref=_runtime(rated, z),
        top_keywords=_keywords(rated, z, corpus),
        gaps=_gaps(rated, total, corpus),
    )


def _std(xs: list[float], mu: float) -> float:
    if len(xs) < 2:
        return 0.0
    return math.sqrt(sum((x - mu) ** 2 for x in xs) / len(xs))


def _group(rated: list[RatedFilm], key: str) -> dict[Any, list[RatedFilm]]:
    out: dict[Any, list[RatedFilm]] = {}
    for f in rated:
        for v in getattr(f, key):
            out.setdefault(v, []).append(f)
    return out


def _genres(
    rated: list[RatedFilm],
    z: dict[int, float],
    ztmdb: dict[int, float],
    total: int,
    like_rate_overall: float,
    corpus: CorpusStats,
) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for gid, fs in _group(rated, "genres").items():
        n = len(fs)
        a1 = _shrink(_mean([z[f.tmdb_id] for f in fs]), n, K_GENRE)
        a2 = _shrink(_mean([z[f.tmdb_id] - ztmdb[f.tmdb_id] for f in fs]), n, K_GENRE)
        share = n / total if total else 0.0
        base = corpus.genre_base.get(gid, EPS)
        a3 = math.tanh(math.log((share + EPS) / (base + EPS)) / ENG_SCALE)
        like_rate = _mean([1.0 if f.liked else 0.0 for f in fs])
        a4 = math.tanh((like_rate - like_rate_overall) / LIKE_SCALE)
        blend = _clip(B_REL * a1 + B_AUD * a2 + B_ENG * a3 + B_LIKE * a4)
        out[str(gid)] = {
            "name": corpus.genre_names.get(gid, str(gid)),
            "affinity": round(blend, 3),
            "components": {
                "rating": round(a1, 3),
                "vs_audience": round(a2, 3),
                "engagement": round(a3, 3),
                "likes": round(a4, 3),
            },
            "count": n,
            "avg_rating": round(_mean([float(f.rating_0_10) for f in fs if f.rating_0_10]), 2),
        }
    return out


def _directors(rated: list[RatedFilm], z: dict[int, float], corpus: CorpusStats) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for pid, fs in _group(rated, "directors").items():
        n = len(fs)
        if n < 2:
            continue  # one film is not a signal
        aff = _shrink(_mean([z[f.tmdb_id] for f in fs]), n, K_DIRECTOR)
        out[str(pid)] = {
            "name": corpus.person_names.get(pid, str(pid)),
            "affinity": round(aff, 3),
            "count": n,
            "avg_rating": round(_mean([float(f.rating_0_10) for f in fs if f.rating_0_10]), 2),
        }
    return out


def _decades(rated: list[RatedFilm], z: dict[int, float], corpus: CorpusStats) -> dict[str, Any]:
    out: dict[str, Any] = {}
    buckets: dict[int, list[RatedFilm]] = {}
    for f in rated:
        if f.decade is not None:
            buckets.setdefault(f.decade, []).append(f)
    for dec, fs in buckets.items():
        n = len(fs)
        out[str(dec)] = {
            "affinity": round(_shrink(_mean([z[f.tmdb_id] for f in fs]), n, K_DECADE), 3),
            "count": n,
            "avg_rating": round(_mean([float(f.rating_0_10) for f in fs if f.rating_0_10]), 2),
        }
    return out


def _countries(rated: list[RatedFilm], z: dict[int, float], corpus: CorpusStats) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for cc, fs in _group(rated, "countries").items():
        n = len(fs)
        out[str(cc)] = {
            "affinity": round(_shrink(_mean([z[f.tmdb_id] for f in fs]), n, K_COUNTRY), 3),
            "count": n,
        }
    return out


def _runtime(rated: list[RatedFilm], z: dict[int, float]) -> dict[str, Any]:
    pairs = [(f.runtime_min, max(z[f.tmdb_id], 0.0) + 0.1) for f in rated if f.runtime_min]
    if not pairs:
        return {}
    wsum = sum(w for _, w in pairs)
    pref = sum(rt * w for rt, w in pairs) / wsum
    var = sum(w * (rt - pref) ** 2 for rt, w in pairs) / wsum
    return {"pref_min": round(pref, 1), "sd_min": round(max(math.sqrt(var), 20.0), 1)}


def _keywords(
    rated: list[RatedFilm], z: dict[int, float], corpus: CorpusStats
) -> list[dict[str, Any]]:
    weights: dict[int, float] = {}
    for f in rated:
        zf = max(z[f.tmdb_id], 0.0)
        if zf <= 0:
            continue
        for kw in f.keywords:
            idf = corpus.keyword_idf.get(kw)
            if idf is None:
                continue
            if corpus.keyword_names.get(kw, "").lower() in KEYWORD_STOPLIST:
                continue
            weights[kw] = weights.get(kw, 0.0) + zf * idf
    norm = math.sqrt(sum(w * w for w in weights.values())) or 1.0
    top = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:24]
    return [
        {"id": kw, "name": corpus.keyword_names.get(kw, str(kw)), "weight": round(w / norm, 4)}
        for kw, w in top
    ]


def _gaps(rated: list[RatedFilm], total: int, corpus: CorpusStats) -> dict[str, Any]:
    dec_share: dict[int, float] = {}
    for f in rated:
        if f.decade is not None:
            dec_share[f.decade] = dec_share.get(f.decade, 0.0) + 1.0 / total
    ctry_share: dict[str, float] = {}
    for f in rated:
        for cc in f.countries:
            ctry_share[cc] = ctry_share.get(cc, 0.0) + 1.0 / total

    dec_gaps = sorted(
        ((d, round(b - dec_share.get(d, 0.0), 3)) for d, b in corpus.decade_base.items()),
        key=lambda kv: kv[1],
        reverse=True,
    )[:5]
    ctry_gaps = sorted(
        ((c, round(b - ctry_share.get(c, 0.0), 3)) for c, b in corpus.country_base.items()),
        key=lambda kv: kv[1],
        reverse=True,
    )[:5]
    return {
        "decades": [{"decade": d, "gap": g} for d, g in dec_gaps if g > 0],
        "countries": [{"country": c, "gap": g} for c, g in ctry_gaps if g > 0],
    }
