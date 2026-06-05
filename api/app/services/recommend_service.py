"""Generate recommendations for a profile + surface (Phase 2).

Sync DB load + pure ranking; callers in async routes use to_thread. Computed on
demand (the corpus is small); caching can layer on later.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.db.base import get_engine
from app.domain.recommend import recommend
from app.repositories import recommend_repo

SURFACES = {"blind_spots", "hidden_gems"}


def generate(profile_id: uuid.UUID, surface: str, limit: int) -> list[dict[str, Any]] | None:
    """Returns scored items, or None if the profile has no taste profile yet."""
    with get_engine().connect() as conn:
        taste = recommend_repo.load_taste(conn, profile_id)
        if taste is None:
            return None
        exclude = recommend_repo.excluded_film_ids(conn, profile_id)
        candidates = recommend_repo.load_candidates(conn, exclude)
    return recommend(candidates, taste, surface, limit=limit)
