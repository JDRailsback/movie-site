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

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession

from app.domain.letterboxd_export import FilmRecord, ParsedExport

BASE_URL = "https://letterboxd.com"
_PAGE_DELAY = 0.8  # seconds between pages — polite pacing


class LbProfileScraper:
    def __init__(self, *, timeout: float = 20.0) -> None:
        # impersonate="chrome120" sends Chrome's TLS fingerprint, passing Cloudflare checks
        self._session = AsyncSession(impersonate="chrome120", timeout=timeout)

    async def aclose(self) -> None:
        await self._session.close()

    async def __aenter__(self) -> LbProfileScraper:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def _get(self, path: str) -> str | None:
        try:
            r = await self._session.get(BASE_URL + path)
            return r.text if r.status_code == 200 else None
        except Exception:
            return None

    async def check_user(self, username: str) -> str | None:
        """Return a display name if the user exists and is public, else None."""
        html = await self._get(f"/{username}/")
        if html is None:
            return None
        soup = BeautifulSoup(html, "html.parser")
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
            html = await self._get(path)
            if html is None:
                break
            soup = BeautifulSoup(html, "html.parser")
            items = _parse_film_grid(soup, watched=True)
            if not items:
                break
            for rec in items:
                records.setdefault(rec.lb_uri, rec)
            if not _has_next(soup, next_page=page + 1):
                break
            page += 1
            await asyncio.sleep(_PAGE_DELAY)
        return list(records.values())

    async def scrape_watchlist(self, username: str) -> list[FilmRecord]:
        """Page through /{username}/watchlist/ collecting unwatched intent."""
        records: dict[str, FilmRecord] = {}
        page = 1
        while True:
            path = f"/{username}/watchlist/" if page == 1 else f"/{username}/watchlist/page/{page}/"
            html = await self._get(path)
            if html is None:
                break
            soup = BeautifulSoup(html, "html.parser")
            items = _parse_film_grid(soup, watched=False)
            if not items:
                break
            for rec in items:
                records.setdefault(rec.lb_uri, rec)
            if not _has_next(soup, next_page=page + 1):
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

        films = await scraper.scrape_films(username)
        watchlist = await scraper.scrape_watchlist(username)

    # Merge watched and watchlist. Films in both lists stay as watched (watched=True)
    # but also get in_watchlist=True so they appear in the spin wheel.
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

    Letterboxd now renders posters as <div data-component-class="LazyPoster">
    with data-item-slug, data-item-name (e.g. "Sicario (2015)"), and
    data-item-link. Ratings appear as <span class="rated-N"> in the parent <li>.
    """
    records = []
    for div in soup.find_all("div", attrs={"data-component-class": "LazyPoster"}):
        slug = str(div.get("data-item-slug") or "").strip()
        item_name = str(div.get("data-item-name") or "").strip()
        if not slug or not item_name:
            continue

        # "Sicario (2015)" → title="Sicario", year=2015
        year: int | None = None
        name = item_name
        m_year = re.search(r"\((\d{4})\)\s*$", item_name)
        if m_year:
            year = int(m_year.group(1))
            name = item_name[: m_year.start()].strip()
        if not name:
            continue

        item_link = str(div.get("data-item-link") or f"/film/{slug}/").strip()
        lb_uri = f"{BASE_URL}{item_link}"

        # Rating span lives in the parent <li class="griditem">
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


def _has_next(soup: BeautifulSoup, *, next_page: int) -> bool:
    """True if the page links to the next paginated page.

    Checks for a link containing /page/{next_page}/ in the href — robust
    against Letterboxd changing their pagination CSS class names.
    """
    return bool(soup.find("a", href=re.compile(rf"/page/{next_page}/"))) or bool(
        soup.find("a", class_="next")
    )
