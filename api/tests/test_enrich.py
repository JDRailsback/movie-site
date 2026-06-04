"""Unit tests for the TMDB payload parser (pure, no network).

Runs against a captured fixture so CI exercises the parsing logic offline.
"""

import json
from pathlib import Path

from app.domain.enrich import parse_movie, weighted_rating

FIXTURE = Path(__file__).parent / "fixtures" / "movie_550.json"


def _film():
    return parse_movie(json.loads(FIXTURE.read_text(encoding="utf-8")))


def test_core_fields() -> None:
    f = _film()
    assert f.tmdb_id == 550
    assert f.title == "Fight Club"
    assert f.year == 1999
    assert f.runtime_min == 139
    assert f.original_language == "en"
    assert "US" in f.countries


def test_associations() -> None:
    f = _film()
    assert {g[1] for g in f.genres} >= {"Drama", "Thriller"}
    assert any(d.name == "David Fincher" for d in f.directors)
    assert len(f.cast_top) <= 10
    assert any(k.name == "nihilism" for k in f.keywords)


def test_streaming_offers_have_shape() -> None:
    f = _film()
    for offer in f.streaming:
        assert offer.region and offer.provider
        assert offer.offer_type in {"flatrate", "rent", "buy", "free", "ads"}


def test_region_filter_limits_streaming() -> None:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    all_regions = parse_movie(payload)
    us_only = parse_movie(payload, regions={"US"})
    # Filtering must not increase offers, and US-only must be region-pure.
    assert len(us_only.streaming) <= len(all_regions.streaming)
    assert {o.region for o in us_only.streaming} <= {"US"}


def test_weighted_rating_shrinks_toward_mean() -> None:
    # low vote count -> pulled hard toward corpus mean
    low = weighted_rating(9.0, 5, corpus_mean=6.0, m=250)
    high = weighted_rating(9.0, 100_000, corpus_mean=6.0, m=250)
    assert low is not None and high is not None
    assert abs(low - 6.0) < abs(high - 6.0)
    assert high > 8.5
    assert weighted_rating(None, 100, corpus_mean=6.0) is None
