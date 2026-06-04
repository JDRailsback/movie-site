"""Unit tests for the taste engine (pure)."""

from app.domain.taste import CorpusStats, RatedFilm, compute_taste


def _corpus(**over) -> CorpusStats:
    base = dict(
        genre_base={1: 0.5, 2: 0.1},  # genre 1 common, genre 2 rare in corpus
        country_base={"US": 0.6, "JP": 0.05},
        decade_base={1970: 0.05, 2010: 0.4},
        vote_mean=6.0,
        vote_std=1.0,
        keyword_idf={10: 2.0, 11: 1.0},
        genre_names={1: "Drama", 2: "War"},
        keyword_names={10: "memory", 11: "city"},
        person_names={100: "Tarkovsky"},
    )
    base.update(over)
    return CorpusStats(**base)


def test_normalization_and_prestige_shrinkage() -> None:
    # 30 drama films rated around the user's mean; 3 war films rated very high.
    films = [
        RatedFilm(tmdb_id=i, rating_0_10=6, liked=False, genres=[1], tmdb_vote_average=6.0)
        for i in range(30)
    ] + [
        RatedFilm(tmdb_id=900 + i, rating_0_10=10, liked=False, genres=[2], tmdb_vote_average=8.0)
        for i in range(3)
    ]
    res = compute_taste(films, _corpus())
    war = res.genre_affinity["2"]
    # only 3 war films -> shrunk hard toward neutral despite the high ratings
    assert war["count"] == 3
    assert war["affinity"] < 0.5  # prestige bias defeated


def test_comedy_paradox_engagement() -> None:
    # User watches a ton of a rare-in-corpus genre but rates it only meh.
    films = [
        RatedFilm(tmdb_id=i, rating_0_10=5, liked=False, genres=[2], tmdb_vote_average=6.0)
        for i in range(40)
    ] + [
        RatedFilm(tmdb_id=500 + i, rating_0_10=7, liked=False, genres=[1], tmdb_vote_average=6.0)
        for i in range(10)
    ]
    res = compute_taste(films, _corpus())
    # genre 2 is heavily over-watched vs its 0.1 base -> positive engagement signal
    assert res.genre_affinity["2"]["components"]["engagement"] > 0.5


def test_director_needs_two_films() -> None:
    films = [
        RatedFilm(tmdb_id=1, rating_0_10=9, liked=True, directors=[100], tmdb_vote_average=8.0),
        RatedFilm(tmdb_id=2, rating_0_10=9, liked=True, directors=[100], tmdb_vote_average=8.0),
        RatedFilm(tmdb_id=3, rating_0_10=4, liked=False, directors=[200], tmdb_vote_average=6.0),
    ]
    res = compute_taste(films, _corpus())
    assert "100" in res.director_affinity  # 2 films -> present
    assert "200" not in res.director_affinity  # 1 film -> excluded


def test_keyword_idf_weighting_and_gaps() -> None:
    films = [
        RatedFilm(tmdb_id=1, rating_0_10=10, liked=True, keywords=[10, 11], decade=2010,
                  countries=["US"], tmdb_vote_average=7.0),
        RatedFilm(tmdb_id=2, rating_0_10=9, liked=True, keywords=[10], decade=2010,
                  countries=["US"], tmdb_vote_average=7.0),
    ]
    res = compute_taste(films, _corpus())
    kw = {k["name"]: k["weight"] for k in res.top_keywords}
    assert kw["memory"] > kw.get("city", 0)  # higher idf wins
    # user never watched JP / 1970s -> they appear as gaps
    gap_countries = {g["country"] for g in res.gaps["countries"]}
    gap_decades = {g["decade"] for g in res.gaps["decades"]}
    assert "JP" in gap_countries
    assert 1970 in gap_decades
