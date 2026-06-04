"""Parse a TMDB movie payload into normalized rows (pure, no I/O).

Kept in domain/ so it is unit-testable against fixture JSON without network or DB
(PHASE0 §1 boundary rule). The repository layer consumes EnrichedFilm to upsert.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PersonRef:
    tmdb_id: int
    name: str
    department: str | None = None


@dataclass(frozen=True)
class KeywordRef:
    tmdb_id: int
    name: str


@dataclass(frozen=True)
class StreamingOffer:
    region: str
    provider: str
    offer_type: str  # flatrate | rent | buy | free | ads


@dataclass(frozen=True)
class EnrichedFilm:
    tmdb_id: int
    title: str
    original_title: str | None
    year: int | None
    runtime_min: int | None
    original_language: str | None
    overview: str | None
    poster_path: str | None
    vote_average: float | None
    vote_count: int | None
    popularity: float | None
    adult: bool
    status: str | None
    genres: list[tuple[int, str]] = field(default_factory=list)
    keywords: list[KeywordRef] = field(default_factory=list)
    directors: list[PersonRef] = field(default_factory=list)
    cast_top: list[PersonRef] = field(default_factory=list)
    countries: list[str] = field(default_factory=list)
    streaming: list[StreamingOffer] = field(default_factory=list)


def _year_from(release_date: str | None) -> int | None:
    if release_date and len(release_date) >= 4 and release_date[:4].isdigit():
        return int(release_date[:4])
    return None


def parse_movie(payload: dict[str, Any], *, cast_limit: int = 10) -> EnrichedFilm:
    keywords_block = payload.get("keywords") or {}
    credits = payload.get("credits") or {}
    crew = credits.get("crew") or []
    cast = credits.get("cast") or []

    directors = [
        PersonRef(c["id"], c["name"], c.get("known_for_department"))
        for c in crew
        if c.get("job") == "Director"
    ]
    cast_top = [
        PersonRef(c["id"], c["name"], "Acting")
        for c in sorted(cast, key=lambda c: c.get("order", 9999))[:cast_limit]
    ]

    return EnrichedFilm(
        tmdb_id=payload["id"],
        title=payload.get("title") or payload.get("original_title") or "",
        original_title=payload.get("original_title"),
        year=_year_from(payload.get("release_date")),
        runtime_min=payload.get("runtime") or None,
        original_language=payload.get("original_language"),
        overview=payload.get("overview") or None,
        poster_path=payload.get("poster_path"),
        vote_average=payload.get("vote_average"),
        vote_count=payload.get("vote_count"),
        popularity=payload.get("popularity"),
        adult=bool(payload.get("adult", False)),
        status=payload.get("status"),
        genres=[(g["id"], g["name"]) for g in payload.get("genres", [])],
        keywords=[KeywordRef(k["id"], k["name"]) for k in keywords_block.get("keywords", [])],
        directors=directors,
        cast_top=cast_top,
        countries=[c["iso_3166_1"] for c in payload.get("production_countries", [])],
        streaming=_parse_providers(payload.get("watch/providers") or {}),
    )


def _parse_providers(block: dict[str, Any]) -> list[StreamingOffer]:
    """Flatten watch/providers.results[region][offer_type][] into offers."""
    offers: list[StreamingOffer] = []
    for region, region_block in (block.get("results") or {}).items():
        for offer_type in ("flatrate", "rent", "buy", "free", "ads"):
            for prov in region_block.get(offer_type, []) or []:
                offers.append(StreamingOffer(region, prov["provider_name"], offer_type))
    return offers


def weighted_rating(
    vote_average: float | None, vote_count: int | None, *, corpus_mean: float, m: int = 250
) -> float | None:
    """IMDb-style Bayesian rating (RECOMMENDATION_MATH §3)."""
    if vote_average is None or vote_count is None:
        return None
    v = vote_count
    return (v / (v + m)) * vote_average + (m / (v + m)) * corpus_mean
