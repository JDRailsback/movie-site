"""Parse a Letterboxd account export ZIP into per-film records (pure).

The export is the primary ingest path (PLAN decision #1). It is a ZIP of CSVs;
the canonical per-film key is the Letterboxd URI. Each CSV uses columns
"Name", "Year", "Letterboxd URI", and some add "Rating", "Review", "Watched Date".

Takes raw bytes so it is unit-testable without filesystem or network.
"""

from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass
from datetime import date


@dataclass
class FilmRecord:
    lb_uri: str
    title: str
    year: int | None = None
    rating_0_10: int | None = None
    liked: bool = False
    watched_date: date | None = None
    review_text: str | None = None
    in_watchlist: bool = False
    watched: bool = False


@dataclass
class ParsedExport:
    username: str | None
    films: list[FilmRecord]

    @property
    def watched_films(self) -> list[FilmRecord]:
        return [f for f in self.films if f.watched]


def _to_int_year(raw: str | None) -> int | None:
    if raw and raw.strip().isdigit():
        return int(raw.strip())
    return None


def _stars_to_0_10(raw: str | None) -> int | None:
    """Letterboxd ratings are 0.5-5.0 stars; store on a 1-10 integer scale."""
    if not raw:
        return None
    try:
        return round(float(raw) * 2)
    except ValueError:
        return None


def _to_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw.strip()[:10])
    except ValueError:
        return None


def _open_csv(zf: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    """Read a CSV member if present; tolerant of absence and casing."""
    members = {m.lower(): m for m in zf.namelist()}
    actual = members.get(name.lower())
    if actual is None:
        return []
    with zf.open(actual) as fh:
        text = io.TextIOWrapper(fh, encoding="utf-8-sig")
        return list(csv.DictReader(text))


def parse_export(data: bytes) -> ParsedExport:
    zf = zipfile.ZipFile(io.BytesIO(data))
    records: dict[str, FilmRecord] = {}

    def get(uri: str, name: str, year: str | None) -> FilmRecord:
        rec = records.get(uri)
        if rec is None:
            rec = FilmRecord(lb_uri=uri, title=name, year=_to_int_year(year))
            records[uri] = rec
        return rec

    # watched.csv — establishes the watched set
    for row in _open_csv(zf, "watched.csv"):
        rec = get(row["Letterboxd URI"], row["Name"], row.get("Year"))
        rec.watched = True
        rec.watched_date = rec.watched_date or _to_date(row.get("Date"))

    # ratings.csv — authoritative current rating
    for row in _open_csv(zf, "ratings.csv"):
        rec = get(row["Letterboxd URI"], row["Name"], row.get("Year"))
        rec.watched = True
        rec.rating_0_10 = _stars_to_0_10(row.get("Rating"))

    # diary.csv — temporal context (watched dates)
    for row in _open_csv(zf, "diary.csv"):
        rec = get(row["Letterboxd URI"], row["Name"], row.get("Year"))
        rec.watched = True
        wd = _to_date(row.get("Watched Date")) or _to_date(row.get("Date"))
        if wd and (rec.watched_date is None or wd > rec.watched_date):
            rec.watched_date = wd
        if rec.rating_0_10 is None:
            rec.rating_0_10 = _stars_to_0_10(row.get("Rating"))

    # reviews.csv — qualitative signal
    for row in _open_csv(zf, "reviews.csv"):
        rec = get(row["Letterboxd URI"], row["Name"], row.get("Year"))
        rec.watched = True
        if row.get("Review"):
            rec.review_text = row["Review"]
        if rec.rating_0_10 is None:
            rec.rating_0_10 = _stars_to_0_10(row.get("Rating"))

    # likes/films.csv — strong positive signal distinct from rating
    for row in _open_csv(zf, "likes/films.csv"):
        rec = get(row["Letterboxd URI"], row["Name"], row.get("Year"))
        rec.liked = True

    # watchlist.csv — unwatched intent; used for rec exclusion
    for row in _open_csv(zf, "watchlist.csv"):
        rec = get(row["Letterboxd URI"], row["Name"], row.get("Year"))
        rec.in_watchlist = True

    return ParsedExport(username=_read_username(zf), films=list(records.values()))


def _read_username(zf: zipfile.ZipFile) -> str | None:
    rows = _open_csv(zf, "profile.csv")
    if rows:
        row = rows[0]
        return row.get("Username") or row.get("Given Name") or None
    return None
