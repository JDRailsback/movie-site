"""Regression test: two Letterboxd entries that resolve to the same TMDB film
must merge into one rating row (else ON CONFLICT DO UPDATE gets duplicate keys)."""

from datetime import date

from app.domain.letterboxd_export import FilmRecord
from app.services.import_pipeline import _merge_rating


def test_merge_prefers_watched_and_combines_signals() -> None:
    # existing row started life as a watchlist-only entry with no rating
    row = {
        "film_id": 1,
        "rating_0_10": None,
        "liked": False,
        "watched_date": None,
        "review_text": None,
        "in_watchlist": True,
        "watched": False,
        "source": "export",
    }
    # a second entry for the same film: watched, rated, liked, reviewed
    f = FilmRecord(
        lb_uri="u2",
        title="Blade Runner",
        rating_0_10=9,
        liked=True,
        watched_date=date(2020, 1, 1),
        review_text="great",
        in_watchlist=False,
        watched=True,
    )
    _merge_rating(row, f)
    assert row["rating_0_10"] == 9
    assert row["liked"] is True
    assert row["review_text"] == "great"
    assert row["watched_date"] == date(2020, 1, 1)
    assert row["in_watchlist"] is False  # watched wins over watchlist-only
    assert row["watched"] is True
