"""Compatibility scoring and co-watch recommendations between two taste profiles."""

from __future__ import annotations

import math
from typing import Any

from app.domain.recommend import (
    _BASE_WEIGHTS,
    Candidate,
    Taste,
    fit_percent,
    score,
)


def _cosine(a: dict, b: dict) -> float:
    """Cosine similarity of two sparse real-valued vectors. Returns -1..1."""
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[k] * b[k] for k in common)
    mag_a = math.sqrt(sum(v ** 2 for v in a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return max(-1.0, min(1.0, dot / (mag_a * mag_b)))


def compatibility(taste_a: Taste, taste_b: Taste) -> dict[str, Any]:
    """Return an overall 0-100 compatibility score with a human-readable breakdown."""
    genre_sim = (_cosine(taste_a.genre, taste_b.genre) + 1.0) / 2.0
    era_sim = (_cosine(taste_a.era, taste_b.era) + 1.0) / 2.0
    country_sim = (_cosine(taste_a.country, taste_b.country) + 1.0) / 2.0

    overall = 0.70 * genre_sim + 0.20 * era_sim + 0.10 * country_sim
    score_int = round(overall * 100)

    # Genres both rate positively — sorted by combined strength
    shared_ids = sorted(
        [g for g in set(taste_a.genre) & set(taste_b.genre)
         if taste_a.genre[g] > 0.1 and taste_b.genre[g] > 0.1],
        key=lambda g: taste_a.genre[g] + taste_b.genre[g],
        reverse=True,
    )
    shared_genres = [
        taste_a.genre_names.get(g) or taste_b.genre_names.get(g, "")
        for g in shared_ids
        if taste_a.genre_names.get(g) or taste_b.genre_names.get(g)
    ][:5]

    # Genres where preferences meaningfully diverge
    divergent_ids = [
        g for g in set(taste_a.genre) & set(taste_b.genre)
        if abs(taste_a.genre[g] - taste_b.genre[g]) > 0.4
    ]
    divergent_genres = [
        taste_a.genre_names.get(g) or taste_b.genre_names.get(g, "")
        for g in divergent_ids
        if taste_a.genre_names.get(g) or taste_b.genre_names.get(g)
    ][:3]

    if score_int >= 80:
        blurb = "Nearly identical taste — you'll rarely disagree on a pick."
    elif score_int >= 65:
        blurb = "Strong overlap with some interesting differences."
    elif score_int >= 50:
        blurb = "Decent compatibility — expect a few compromises."
    else:
        blurb = "Very different tastes. The recs below are your common ground."

    return {
        "score": score_int,
        "shared_genres": shared_genres,
        "divergent_genres": divergent_genres,
        "blurb": blurb,
    }


def co_watch_recommend(
    candidates: list[Candidate],
    taste_a: Taste,
    taste_b: Taste,
    *,
    limit: int = 24,
) -> list[dict[str, Any]]:
    """Films neither has seen that both would enjoy, ranked by joint taste + quality."""
    w = _BASE_WEIGHTS

    results: list[tuple[float, float, float, Candidate]] = []
    for c in candidates:
        # Same gate as the "overall" surface — wide corpus so taste does the work.
        if c.vote_count < 300 or c.weighted_rating < 6.0:
            continue

        sa, _ = score(c, taste_a, w)
        sb, _ = score(c, taste_b, w)

        # Both users must clear 65% fit (slightly relaxed vs solo recs for two-person constraint)
        if fit_percent(sa) < 65 or fit_percent(sb) < 65:
            continue

        # Harmonic mean: only scores high when both users would enjoy the film
        joint = 2 * sa * sb / (sa + sb) if (sa + sb) > 0 else 0.0

        # Taste-first, exactly like the "overall" surface (quality is just a tiebreaker)
        quality_norm = (
            c.lb_rating / 5.0 if c.lb_rating is not None else c.weighted_rating / 10.0
        )
        sort_key = joint + 0.15 * quality_norm
        results.append((sort_key, sa, sb, c))

    results.sort(key=lambda x: x[0], reverse=True)

    out: list[dict[str, Any]] = []
    dir_count: dict[int, int] = {}
    for _, sa, sb, c in results:
        d = c.directors[0] if c.directors else -1
        if dir_count.get(d, 0) >= 2:
            continue
        dir_count[d] = dir_count.get(d, 0) + 1

        joint = 2 * sa * sb / (sa + sb) if (sa + sb) > 0 else 0.0
        _, contrib = score(c, taste_a, w)
        out.append({
            "candidate": c,
            "score": round(joint, 4),
            "fit": fit_percent(joint),
            "components": {k: round(v, 4) for k, v in contrib.items()},
            "explanation": _explain(c, taste_a, taste_b),
        })
        if len(out) >= limit:
            break
    return out


def _explain(c: Candidate, taste_a: Taste, taste_b: Taste) -> dict[str, Any]:
    reasons: list[str] = []

    shared_liked = [
        gn for g, gn in zip(c.genres, c.genre_names, strict=False)
        if taste_a.genre.get(g, 0) > 0.1 and taste_b.genre.get(g, 0) > 0.1
    ]
    if shared_liked:
        reasons.append(f"A genre you both love: {', '.join(shared_liked[:2])}")

    best_dir = max(
        c.directors,
        key=lambda d: min(taste_a.director.get(d, 0.0), taste_b.director.get(d, 0.0)),
        default=None,
    )
    if best_dir is not None:
        joint_dir = min(taste_a.director.get(best_dir, 0.0), taste_b.director.get(best_dir, 0.0))
        if joint_dir > 0.2:
            name = taste_a.director_names.get(best_dir) or taste_b.director_names.get(best_dir, "")
            if name:
                reasons.append(f"A director you're both fans of: {name}")

    if not reasons:
        reasons.append("A great pick for both your tastes")
    return {"source": "co_watch", "reasons": reasons[:2]}
