"""Pydantic contract types shared across routers (PHASE0 §4).

These define the Next <-> FastAPI contract and are exported via OpenAPI to
generate web/lib/api-client.ts. Keep field names camel-friendly via alias so the
TS client reads naturally.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def _camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(w.capitalize() for w in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True)


# --- auth ---
class MagicLinkRequest(ApiModel):
    email: EmailStr


class VerifyRequest(ApiModel):
    token: str


class User(ApiModel):
    id: str
    email: EmailStr | None = None
    region: str = "US"


class Session(ApiModel):
    user: User
    session_token: str


# --- imports ---
class ImportSource(StrEnum):
    export = "export"
    scrape = "scrape"


class ImportState(StrEnum):
    queued = "queued"
    fetching = "fetching"
    matching = "matching"
    enriching = "enriching"
    profiling = "profiling"
    precomputing_recs = "precomputing_recs"
    ready = "ready"
    failed = "failed"


class ImportCreated(ApiModel):
    import_id: str
    profile_id: str


class ImportStatus(ApiModel):
    import_id: str
    profile_id: str
    source: ImportSource
    status: ImportState
    stage_counts: dict[str, int] = Field(default_factory=dict)
    error: str | None = None


class ByUsernameRequest(ApiModel):
    username: str


# --- films / recs ---
class StreamingOffer(ApiModel):
    provider: str
    type: str


class FilmCard(ApiModel):
    tmdb_id: int
    title: str
    year: int | None = None
    poster_path: str | None = None
    runtime_min: int | None = None
    weighted_rating: float | None = None
    your_rating: int | None = None
    streaming: list[StreamingOffer] = Field(default_factory=list)


class Explanation(ApiModel):
    source: str
    reasons: list[str] = Field(default_factory=list)


class RecommendationItem(ApiModel):
    film: FilmCard
    rank: int
    score: float
    components: dict[str, float] = Field(default_factory=dict)
    explanation: Explanation


class RecommendationSet(ApiModel):
    set_id: str
    surface: str
    params: dict[str, Any] = Field(default_factory=dict)
    model_version: str
    items: list[RecommendationItem] = Field(default_factory=list)


# --- profile / taste ---
class ProfileSummary(ApiModel):
    profile_id: str
    username: str
    display_name: str | None = None
    last_import_at: datetime | None = None
    film_count: int = 0


class TasteProfile(ApiModel):
    profile_id: str
    model_version: str
    mu: float | None = None
    sigma: float | None = None
    genre_affinity: dict[str, Any] = Field(default_factory=dict)
    director_affinity: dict[str, Any] = Field(default_factory=dict)
    era_affinity: dict[str, Any] = Field(default_factory=dict)
    country_affinity: dict[str, Any] = Field(default_factory=dict)
    runtime_pref: dict[str, Any] = Field(default_factory=dict)
    top_keywords: list[dict[str, Any]] = Field(default_factory=list)
    gaps: dict[str, Any] = Field(default_factory=dict)


# --- feedback ---
class FeedbackAction(StrEnum):
    seen = "seen"
    loved = "loved"
    not_interested = "not_interested"
    watchlist = "watchlist"
    watched_because = "watched_because"


class FeedbackRequest(ApiModel):
    film_id: int
    action: FeedbackAction
    surface: str | None = None


# --- errors ---
class ErrorBody(ApiModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(ApiModel):
    error: ErrorBody
