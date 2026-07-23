"""Regression test: _enrich must process every tmdb_id across chunk
boundaries, not just the first batch — a Render OOM traced back to
asyncio.gather() building every TMDB payload for a whole import at once."""

from unittest.mock import patch

from app.services import import_pipeline
from app.services.import_pipeline import _CHUNK_SIZE, _chunks, _enrich


def test_chunks_covers_every_item_across_boundaries() -> None:
    items = list(range(1, 63))  # spans multiple chunks at _CHUNK_SIZE=25
    batches = _chunks(items, _CHUNK_SIZE)
    assert [len(b) for b in batches] == [25, 25, 12]
    assert [x for b in batches for x in b] == items


def test_chunks_empty_and_smaller_than_one_chunk() -> None:
    assert _chunks([], _CHUNK_SIZE) == []
    assert _chunks([1, 2, 3], _CHUNK_SIZE) == [[1, 2, 3]]


class _FakeTMDB:
    """Records every id requested; returns a minimal parseable payload."""

    def __init__(self) -> None:
        self.movie_calls: list[int] = []
        self.tv_calls: list[int] = []

    async def get_movie(self, tmdb_id: int) -> dict:
        self.movie_calls.append(tmdb_id)
        return {"id": tmdb_id, "title": f"Movie {tmdb_id}"}

    async def get_tv(self, tmdb_id: int) -> dict:
        self.tv_calls.append(tmdb_id)
        return {"id": tmdb_id, "name": f"Show {tmdb_id}"}


async def test_enrich_persists_every_film_across_multiple_chunks() -> None:
    persisted: list[int] = []

    def fake_persist(films: list, tv_slugs: dict | None) -> None:
        persisted.extend(f.tmdb_id for f in films)

    tmdb = _FakeTMDB()
    # 2 * _CHUNK_SIZE + a partial batch, of both movies (positive ids) and
    # tv shows (negative ids, per the matched.values() convention).
    movie_ids = list(range(1, 2 * _CHUNK_SIZE + 6))
    tv_ids = [-i for i in range(1000, 1000 + _CHUNK_SIZE + 3)]

    with patch.object(import_pipeline, "_persist_films", fake_persist):
        await _enrich(movie_ids + tv_ids, tmdb)  # type: ignore[arg-type]

    # get_tv is called with abs(id); parse_tv_show re-negates on the way back
    assert sorted(tmdb.movie_calls) == movie_ids
    assert sorted(tmdb.tv_calls) == sorted(-i for i in tv_ids)
    assert sorted(persisted) == sorted(movie_ids + tv_ids)
