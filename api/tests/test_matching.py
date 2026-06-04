"""Unit tests for title normalization and TMDB candidate selection (pure)."""

from app.domain.matching import choose_match, normalize_title


def test_normalize_title() -> None:
    assert normalize_title("The Matrix") == "matrix"
    assert normalize_title("Amélie") == "amelie"
    assert normalize_title("WALL·E") == "wall e"
    assert normalize_title("A Brighter Summer Day") == "brighter summer day"


def _cand(id_: int, title: str, year: str, votes: int = 100) -> dict:
    return {"id": id_, "title": title, "original_title": title,
            "release_date": f"{year}-01-01", "vote_count": votes, "popularity": 1.0}


def test_exact_title_and_year_is_full_confidence() -> None:
    m = choose_match("Stalker", 1979, [_cand(1, "Stalker", "1979")])
    assert m is not None and m.tmdb_id == 1 and m.confidence == 1.0


def test_remake_year_off_is_low_confidence() -> None:
    # same title, very different year -> likely a remake, accept only cautiously
    m = choose_match("Solaris", 1972, [_cand(2, "Solaris", "2002")])
    assert m is not None and m.confidence == 0.55


def test_prefers_higher_vote_count_among_exact() -> None:
    cands = [_cand(1, "Stalker", "1979", votes=50), _cand(9, "Stalker", "1979", votes=5000)]
    m = choose_match("Stalker", 1979, cands)
    assert m is not None and m.tmdb_id == 9


def test_no_exact_match_is_quarantine_territory() -> None:
    m = choose_match("Stalker", 1979, [_cand(3, "Completely Different", "1979")])
    assert m is not None and m.confidence == 0.40


def test_no_candidates_returns_none() -> None:
    assert choose_match("Nonexistent Film", 2050, []) is None
