"""Scrape a public Letterboxd profile to produce a ParsedExport.

Pages through /{username}/films/ (all watched/rated entries) and
/{username}/watchlist/ and returns the same ParsedExport the CSV pipeline
expects, so the rest of the import pipeline (matching → enriching → persist)
runs unchanged.

No Redis caching here — each import run should reflect the user's current data.
Rate-limiting: sequential page fetches within each list with a short delay.
"""

from __future__ import annotations

import asyncio
import re

import httpx
from bs4 import BeautifulSoup

from app.domain.letterboxd_export import FilmRecord, ParsedExport

BASE_URL = "https://letterboxd.com"
_UA = "movie-rec-bot/0.1 (personal recommendation tool; self-import only)"
_PAGE_DELAY = 0.35  # seconds between pages — polite pacing


class LbProfileScraper:
    def __init__(self, *, timeout: float = 20.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"User-Agent": _UA, "Accept-Language": "en"},
            timeout=timeout,
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> LbProfileScraper:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def _get(self, path: str) -> httpx.Response | None:
        try:
            r = await self._client.get(path)
            return r if r.status_code == 200 else None
        except httpx.HTTPError:
            return None

    async def check_user(self, username: str) -> str | None:
        """Return a display name if the user exists and is public, else None."""
        resp = await self._get(f"/{username}/")
        if resp is None:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        # <h1 class="... person-title"><a ...>Display Name</a></h1>
        h1 = soup.find("h1", class_=re.compile(r"person-title"))
        if h1:
            link = h1.find("a")
            if link:
                name = link.get_text(strip=True)
                if name:
                    return name
        # Fallback: og:title "Display Name • Letterboxd"
        og = soup.find("meta", property="og:title")
        if og:
            content = str(og.get("content") or "")
            name = content.split("•")[0].strip()
            if name:
                return name
        return username

    async def scrape_films(self, username: str) -> list[FilmRecord]:
        """Page through /{username}/films/ collecting all watched/rated entries."""
        records: dict[str, FilmRecord] = {}
        page = 1
        while True:
            path = f"/{username}/films/" if page == 1 else f"/{username}/films/page/{page}/"
            resp = await self._get(path)
            if resp is None:
                break
            soup = BeautifulSoup(resp.text, "html.parser")
            items = _parse_film_grid(soup, watched=True)
            if not items:
                break
            for rec in items:
                records.setdefault(rec.lb_uri, rec)
            if not _has_next(soup):
                break
            page += 1
            await asyncio.sleep(_PAGE_DELAY)
        return list(records.values())

    async def scrape_watchlist(self, username: str) -> list[FilmRecord]:
        """Page through /{username}/watchlist/ collecting unwatched intent."""
        records: dict[str, FilmRecord] = {}
        page = 1
        while True:
            path = (
                f"/{username}/watchlist/"
                if page == 1
                else f"/{username}/watchlist/page/{page}/"
            )
            resp = await self._get(path)
            if resp is None:
                break
            soup = BeautifulSoup(resp.text, "html.parser")
            items = _parse_film_grid(soup, watched=False)
            if not items:
                break
            for rec in items:
                records.setdefault(rec.lb_uri, rec)
            if not _has_next(soup):
                break
            page += 1
            await asyncio.sleep(_PAGE_DELAY)
        return list(records.values())


async def scrape_profile(username: str) -> ParsedExport:
    """Scrape a public Letterboxd profile and return a ParsedExport.

    Raises ValueError if the user doesn't exist or has a private profile.
    Films and watchlist are fetched concurrently; pages within each list
    are fetched sequentially with a polite delay.
    """
    async with LbProfileScraper() as scraper:
        display_name = await scraper.check_user(username)
        if display_name is None:
            raise ValueError(f"Letterboxd user '{username}' not found or profile is private")

        films, watchlist = await asyncio.gather(
            scraper.scrape_films(username),
            scraper.scrape_watchlist(username),
        )

    # Merge watchlist into the watched set, or add as unwatched-intent entries.
    by_uri: dict[str, FilmRecord] = {f.lb_uri: f for f in films}
    for wl in watchlist:
        if wl.lb_uri in by_uri:
            by_uri[wl.lb_uri].in_watchlist = True
        else:
            wl.in_watchlist = True
            by_uri[wl.lb_uri] = wl

    return ParsedExport(
        username=username,
        display_name=display_name,
        films=list(by_uri.values()),
    )


# --- HTML parsers ---


def _parse_film_grid(soup: BeautifulSoup, *, watched: bool) -> list[FilmRecord]:
    """Extract FilmRecord objects from a Letterboxd poster-grid page.

    Each poster <div> carries data-film-slug, data-film-name, and data-film-year.
    Ratings appear as a sibling/ancestor <span class="rated-N"> (N=1–10 on the
    same integer scale stored in rating_0_10).
    """
    records = []
    for div in soup.find_all("div", attrs={"data-film-slug": True}):
        slug = str(div.get("data-film-slug") or "").strip()
        name = str(div.get("data-film-name") or "").strip()
        if not slug or not name:
            continue

        year_raw = str(div.get("data-film-year") or "").strip()
        year = int(year_raw) if year_raw.isdigit() else None
        lb_uri = f"{BASE_URL}/film/{slug}/"

        # Walk up to the <li class="poster-container"> to find the rating span.
        rating_0_10: int | None = None
        container = div.parent
        if container:
            rating_span = container.find("span", class_=re.compile(r"\brated-\d+\b"))
            if rating_span:
                for cls in rating_span.get("class") or []:
                    m = re.fullmatch(r"rated-(\d+)", str(cls))
                    if m:
                        rating_0_10 = int(m.group(1))
                        break

        records.append(
            FilmRecord(
                lb_uri=lb_uri,
                title=name,
                year=year,
                rating_0_10=rating_0_10,
                watched=watched,
                in_watchlist=not watched,
            )
        )
    return records


def _has_next(soup: BeautifulSoup) -> bool:
    """True if the page has a next-page pagination link."""
    return bool(soup.find("a", class_="next"))
