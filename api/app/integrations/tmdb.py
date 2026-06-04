"""Async TMDB client with Redis caching, single-flight, rate-limiting, and retry
(PLAN §13, PHASE0 §5).

- Auth: TMDB v4 read token (Bearer).
- Cache: optional Redis; identical requests are served from cache. Single-flight
  (per-key async lock) collapses concurrent identical requests into one upstream
  call — the race-condition guard the brief calls for.
- Rate limit: bounded concurrency via a semaphore; honors 429 Retry-After.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any

import httpx

BASE_URL = "https://api.themoviedb.org/3"

# Cache TTLs (seconds). Movie details are stable; watch providers churn.
TTL_MOVIE = 60 * 60 * 24 * 30
TTL_DISCOVER = 60 * 60 * 24
TTL_PROVIDERS = 60 * 60 * 24


class TMDBClient:
    def __init__(
        self,
        token: str,
        redis: Any | None = None,
        *,
        max_concurrency: int = 20,
        timeout: float = 15.0,
    ) -> None:
        if not token:
            raise ValueError("TMDB read token is required")
        self._redis = redis
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=timeout,
        )
        self._sem = asyncio.Semaphore(max_concurrency)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> TMDBClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    # --- core ---
    @staticmethod
    def _cache_key(path: str, params: dict[str, Any]) -> str:
        items = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        return f"tmdb:{path}?{items}"

    async def _get(self, path: str, params: dict[str, Any], ttl: int) -> dict[str, Any]:
        key = self._cache_key(path, params)

        cached = await self._cache_get(key)
        if cached is not None:
            return cached

        # Single-flight: one concurrent fetch per key; others await then hit cache.
        async with self._locks[key]:
            cached = await self._cache_get(key)
            if cached is not None:
                return cached
            data = await self._request(path, params)
            await self._cache_set(key, data, ttl)
            return data

    async def _request(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        attempts = 0
        while True:
            attempts += 1
            async with self._sem:
                resp = await self._client.get(path, params=params)
            if resp.status_code == 429 and attempts <= 5:
                retry_after = float(resp.headers.get("Retry-After", "1"))
                await asyncio.sleep(retry_after)
                continue
            if resp.status_code >= 500 and attempts <= 5:
                await asyncio.sleep(min(2**attempts, 10))
                continue
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return data

    async def _cache_get(self, key: str) -> dict[str, Any] | None:
        if self._redis is None:
            return None
        raw = await self._redis.get(key)
        return json.loads(raw) if raw else None

    async def _cache_set(self, key: str, data: dict[str, Any], ttl: int) -> None:
        if self._redis is None:
            return
        await self._redis.set(key, json.dumps(data), ex=ttl)

    # --- endpoints ---
    async def get_movie(self, tmdb_id: int, region: str = "US") -> dict[str, Any]:
        """Full movie payload in one call via append_to_response."""
        return await self._get(
            f"/movie/{tmdb_id}",
            {
                "language": "en-US",
                "append_to_response": "keywords,credits,watch/providers,release_dates",
            },
            TTL_MOVIE,
        )

    async def discover_movies(
        self, *, vote_count_gte: int, page: int = 1, sort_by: str = "vote_count.desc"
    ) -> dict[str, Any]:
        return await self._get(
            "/discover/movie",
            {
                "language": "en-US",
                "include_adult": "false",
                "sort_by": sort_by,
                "vote_count.gte": vote_count_gte,
                "page": page,
            },
            TTL_DISCOVER,
        )

    async def search_movie(self, query: str, year: int | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"query": query, "language": "en-US", "include_adult": "false"}
        if year is not None:
            params["primary_release_year"] = year
        return await self._get("/search/movie", params, TTL_DISCOVER)
