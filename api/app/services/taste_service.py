"""Compute and persist a profile's taste profile (Phase 1).

Sync (DB load + pure compute + DB save); callers in the async pipeline use
to_thread. Safe to re-run — recompute overwrites the prior profile.
"""

from __future__ import annotations

import uuid

from app.config import get_settings
from app.db.base import get_engine
from app.domain.taste import compute_taste
from app.repositories import taste_repo

settings = get_settings()


def compute_and_store(profile_id: uuid.UUID) -> int:
    """Returns the number of rated films the profile was built from (0 = skipped)."""
    with get_engine().begin() as conn:
        films = taste_repo.load_rated_films(conn, profile_id)
        if not films:
            return 0
        keyword_ids = {k for f in films for k in f.keywords}
        person_ids = {p for f in films for p in f.directors}
        corpus = taste_repo.load_corpus_stats(conn, keyword_ids, person_ids)
        result = compute_taste(films, corpus)
        taste_repo.save_taste(conn, profile_id, settings.model_version, result)
    return len(films)
