"""Async Letterboxd scraper — resolves film slugs from TMDB IDs and fetches stats.

Two operations:
  resolve_slug(tmdb_id)  — follows letterboxd.com/tmdb/{id}/ to extract the slug.
  fetch_stats(slug)      — scrapes the film page (JSON-LD) and the CSI stats
                           fragment for rating + member counts.

Rate-limiting: semaphore-bounded concurrency (default 3); Redis caching means
re-enrichment runs don't re-hit the site. Descriptive UA; film metadata only,
no user data stored.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://letterboxd.com"
TTL_SLUG = 60 * 60 * 24 * 30  # 30 days — slugs are stable
TTL_STATS = 60 * 60 * 24 * 7  # 7 days — counts shift slowly

_UA = "movie-rec-bot/0.1 (personal recommendation tool; not scraping user data)"


@dataclass
class LbStats:
    rating: float          # 0.5–5.0 Letterboxd average
    rating_count: int      # number of ratings
    watch_count: int       # members who've watched
    list_count: int | None = None
    fan_count: int | None = None


class LetterboxdClient:
    def __init__(
        self,
        redis: Any | None = None,
        *,
        max_concurrency: int = 3,
        timeout: float = 15.0,
    ) -> None:
        self._redis = redis
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"User-Agent": _UA, "Accept-Language": "en"},
            timeout=timeout,
        )
        self._sem = asyncio.Semaphore(max_concurrency)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> LetterboxdClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    async def _get(self, path: str, *, follow_redirects: bool = True) -> httpx.Response | None:
        async with self._sem:
            try:
                return await self._client.get(path, follow_redirects=follow_redirects)
            except httpx.HTTPError:
                return None

    async def resolve_slug(self, tmdb_id: int) -> str | None:
        """Follow /tmdb/{id}/ to extract the LB slug."""
        cache_key = f"lb:slug:{tmdb_id}"
        if self._redis is not None:
            raw = await self._redis.get(cache_key)
            if raw is not None:
                return raw.decode() if isinstance(raw, bytes) else raw

        resp = await self._get(f"/tmdb/{tmdb_id}/", follow_redirects=False)
        if resp is None or resp.status_code not in (301, 302):
            return None

        location = resp.headers.get("location", "")
        m = re.search(r"/film/([a-z0-9-]+)/", location)
        if not m:
            return None

        slug = m.group(1)
        if self._redis is not None:
            await self._redis.set(cache_key, slug, ex=TTL_SLUG)
        return slug

    async def fetch_stats(self, slug: str) -> LbStats | None:
        """Scrape rating + member counts for a film by LB slug."""
        cache_key = f"lb:stats:{slug}"
        if self._redis is not None:
            raw = await self._redis.get(cache_key)
            if raw is not None:
                try:
                    return LbStats(**json.loads(raw))
                except Exception:  # noqa: BLE001
                    pass

        film_resp = await self._get(f"/film/{slug}/")
        stats_resp = await self._get(f"/csi/film/{slug}/stats/")

        if film_resp is None or film_resp.status_code != 200:
            return None

        rating, rating_count = _parse_rating(film_resp.text)
        watch_count, list_count, fan_count = _parse_counts(
            stats_resp.text if (stats_resp and stats_resp.status_code == 200) else ""
        )

        if rating is None or watch_count is None:
            return None

        stats = LbStats(
            rating=rating,
            rating_count=rating_count or 0,
            watch_count=watch_count,
            list_count=list_count,
            fan_count=fan_count,
        )
        if self._redis is not None:
            await self._redis.set(
                cache_key,
                json.dumps({
                    "rating": stats.rating,
                    "rating_count": stats.rating_count,
                    "watch_count": stats.watch_count,
                    "list_count": stats.list_count,
                    "fan_count": stats.fan_count,
                }),
                ex=TTL_STATS,
            )
        return stats


def _parse_rating(html: str) -> tuple[float | None, int | None]:
    """Extract aggregateRating from the JSON-LD block on the film page."""
    for block in re.findall(
        r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    ):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        agg = data.get("aggregateRating")
        if not agg:
            continue
        try:
            return float(agg["ratingValue"]), int(agg.get("ratingCount", 0))
        except (KeyError, ValueError):
            continue
    return None, None


def _parse_counts(html: str) -> tuple[int | None, int | None, int | None]:
    """Parse watch / list / fan counts from the /csi/film/{slug}/stats/ fragment.

    Uses href patterns rather than CSS class names, which change between LB
    deployments. The three links in the fragment consistently point to:
      /film/{slug}/members/  — watches
      /film/{slug}/lists/    — list appearances
      /film/{slug}/likes/    — fans/likes (people who favorited the film)
    """
    if not html.strip():
        return None, None, None

    soup = BeautifulSoup(html, "html.parser")

    watches = lists_count = fans = None
    for a in soup.find_all("a", href=True):
        classes = " ".join(a.get("class", []))
        if "filmstat" not in classes:
            continue
        m = re.search(r"([\d,]+)", a.get("title", ""))
        if not m:
            continue
        val = int(m.group(1).replace(",", ""))
        href = a["href"]
        if "/members/" in href:
            watches = val
        elif "/lists/" in href:
            lists_count = val
        elif "/likes/" in href or "/fans/" in href:
            fans = val

    return watches, lists_count, fans
