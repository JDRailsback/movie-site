"""Unit tests for the recommendation ranker (pure)."""

from app.domain.recommend import Candidate, Taste, fit_percent, recommend


def _taste() -> Taste:
    return Taste(
        genre={1: 0.5, 2: -0.8},  # loves genre 1, hates genre 2
        director={100: 0.7},
        era={1990: 0.3},
        country={"US": 0.2},
        keyword={10: 0.6, 11: 0.3},
        runtime_pref=120.0,
        runtime_sd=20.0,
        genre_names={1: "Drama", 2: "Horror"},
        director_names={100: "Fincher"},
        keyword_names={10: "memory", 11: "grief"},
    )


def _cand(tmdb_id: int, **kw) -> Candidate:
    base = dict(
        title=f"Film {tmdb_id}",
        year=1995,
        poster_path=None,
        runtime_min=120,
        weighted_rating=8.2,
        vote_count=10000,
        popularity=10.0,
        decade=1990,
        genres=[1],
        directors=[100],
        keywords=[10],
        countries=["US"],
    )
    base.update(kw)
    return Candidate(tmdb_id=tmdb_id, **base)


def test_blind_spots_rank_taste_fit_high() -> None:
    good = _cand(1, genres=[1], directors=[100], keywords=[10, 11])  # all loved
    meh = _cand(2, genres=[2], directors=[], keywords=[], vote_count=1500)  # hated genre
    items = recommend([good, meh], _taste(), "blind_spots")
    assert items[0]["candidate"].tmdb_id == 1  # the taste-fit film ranks first


def test_disliked_genre_is_damped() -> None:
    horror = _cand(2, genres=[2], directors=[], keywords=[], weighted_rating=9.0)
    # Strongly disliked genre scores well below the 80% taste floor → excluded.
    assert recommend([horror], _taste(), "blind_spots") == []


def test_explanation_names_a_director_and_genre() -> None:
    [item] = recommend([_cand(1)], _taste(), "blind_spots")
    reasons = " ".join(item["explanation"]["reasons"]).lower()
    assert "fincher" in reasons
    assert "drama" in reasons


def test_blind_spots_gate_excludes_obscure() -> None:
    obscure = _cand(3, vote_count=300)  # below blind-spots vote floor (5000)
    assert recommend([obscure], _taste(), "blind_spots") == []


def test_fit_percent_is_bounded_and_monotonic() -> None:
    assert 0 <= fit_percent(-1.0) <= 100
    assert fit_percent(2.0) == 100
    assert fit_percent(0.7) > fit_percent(0.5)  # higher score -> higher % match


def test_recommend_emits_fit_in_match_range() -> None:
    [item] = recommend([_cand(1)], _taste(), "blind_spots")
    assert isinstance(item["fit"], int)
    assert 0 <= item["fit"] <= 100


def test_director_cap_limits_per_director() -> None:
    # More than 3 films from the same director: only 3 should appear.
    cands = [_cand(i, genres=[i], directors=[100]) for i in range(1, 8)]
    items = recommend(cands, _taste(), "overall")
    director_count = sum(1 for it in items if 100 in it["candidate"].directors)
    assert director_count <= 3
