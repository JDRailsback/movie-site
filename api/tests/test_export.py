"""Unit tests for the Letterboxd export parser (pure, builds an in-memory ZIP)."""

import io
import zipfile

from app.domain.letterboxd_export import parse_export


def _make_zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def _sample() -> bytes:
    return _make_zip(
        {
            "profile.csv": "Username,Given Name\nashbug,Ash\n",
            "watched.csv": (
                "Date,Name,Year,Letterboxd URI\n"
                "2021-01-02,Stalker,1979,https://boxd.it/aaa\n"
                "2021-03-04,Paddington,2014,https://boxd.it/bbb\n"
            ),
            "ratings.csv": (
                "Date,Name,Year,Letterboxd URI,Rating\n"
                "2021-01-02,Stalker,1979,https://boxd.it/aaa,4.5\n"
                "2021-03-04,Paddington,2014,https://boxd.it/bbb,3.0\n"
            ),
            "likes/films.csv": (
                "Date,Name,Year,Letterboxd URI\n"
                "2021-01-02,Stalker,1979,https://boxd.it/aaa\n"
            ),
            "reviews.csv": (
                "Date,Name,Year,Letterboxd URI,Rating,Review\n"
                "2021-01-02,Stalker,1979,https://boxd.it/aaa,4.5,Hypnotic and bleak.\n"
            ),
            "watchlist.csv": (
                "Date,Name,Year,Letterboxd URI\n"
                "2022-05-05,Solaris,1972,https://boxd.it/ccc\n"
            ),
        }
    )


def test_username_and_counts() -> None:
    parsed = parse_export(_sample())
    assert parsed.username == "ashbug"
    assert len(parsed.films) == 3  # stalker, paddington, solaris
    assert len(parsed.watched_films) == 2  # solaris is watchlist-only


def test_rating_conversion_and_signals() -> None:
    parsed = parse_export(_sample())
    by_uri = {f.lb_uri: f for f in parsed.films}
    stalker = by_uri["https://boxd.it/aaa"]
    assert stalker.rating_0_10 == 9  # 4.5 stars -> 9
    assert stalker.liked is True
    assert stalker.review_text == "Hypnotic and bleak."
    assert stalker.watched is True
    assert by_uri["https://boxd.it/bbb"].rating_0_10 == 6  # 3.0 -> 6


def test_watchlist_is_unwatched() -> None:
    parsed = parse_export(_sample())
    solaris = next(f for f in parsed.films if f.lb_uri == "https://boxd.it/ccc")
    assert solaris.in_watchlist is True
    assert solaris.watched is False
    assert solaris.rating_0_10 is None
