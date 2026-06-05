"""Unit tests for the recommendation ranker (pure)."""

from app.domain.recommend import Candidate, Taste, recommend


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
        weighted_rating=7.5,
        vote_count=2000,
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
    [item] = recommend([horror], _taste(), "blind_spots")
    # damping pulls a celebrated but hated-genre film well below its raw quality
    assert item["score"] < 0.5


def test_explanation_names_a_director_and_genre() -> None:
    [item] = recommend([_cand(1)], _taste(), "blind_spots")
    reasons = " ".join(item["explanation"]["reasons"]).lower()
    assert "fincher" in reasons
    assert "drama" in reasons


def test_blind_spots_gate_excludes_obscure() -> None:
    obscure = _cand(3, vote_count=300)  # below blind-spots vote floor (1000)
    assert recommend([obscure], _taste(), "blind_spots") == []
