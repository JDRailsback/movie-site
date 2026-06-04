"""SQLAlchemy Core table definitions for the corpus tables enrichment writes.

Core (not ORM) on purpose: the schema is owned by the Alembic raw-SQL migration
(0001); these Table objects are a typed handle for upserts only. They must stay in
sync with the migration. Full ORM models arrive in Phase 1 for query-heavy work.
"""

from sqlalchemy import (
    REAL,
    TIMESTAMP,
    Boolean,
    Column,
    Integer,
    MetaData,
    SmallInteger,
    Table,
    Text,
)

metadata = MetaData()

film = Table(
    "film",
    metadata,
    Column("tmdb_id", Integer, primary_key=True),
    Column("imdb_id", Text),
    Column("title", Text, nullable=False),
    Column("original_title", Text),
    Column("year", SmallInteger),
    Column("runtime_min", SmallInteger),
    Column("original_language", Text),
    Column("overview", Text),
    Column("poster_path", Text),
    Column("vote_average", REAL),
    Column("vote_count", Integer),
    Column("popularity", REAL),
    Column("weighted_rating", REAL),
    Column("adult", Boolean),
    Column("status", Text),
    Column("enriched_at", TIMESTAMP(timezone=True)),
)

genre = Table(
    "genre",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", Text, nullable=False),
)

keyword = Table(
    "keyword",
    metadata,
    Column("tmdb_id", Integer, primary_key=True),
    Column("name", Text, nullable=False),
)

person = Table(
    "person",
    metadata,
    Column("tmdb_id", Integer, primary_key=True),
    Column("name", Text, nullable=False),
    Column("department", Text),
)

film_genre = Table(
    "film_genre",
    metadata,
    Column("film_id", Integer, primary_key=True),
    Column("genre_id", Integer, primary_key=True),
)

film_keyword = Table(
    "film_keyword",
    metadata,
    Column("film_id", Integer, primary_key=True),
    Column("keyword_id", Integer, primary_key=True),
)

film_crew = Table(
    "film_crew",
    metadata,
    Column("film_id", Integer, primary_key=True),
    Column("person_id", Integer, primary_key=True),
    Column("job", Text, primary_key=True),
)

film_country = Table(
    "film_country",
    metadata,
    Column("film_id", Integer, primary_key=True),
    Column("country_code", Text, primary_key=True),
)

streaming_availability = Table(
    "streaming_availability",
    metadata,
    Column("film_id", Integer, primary_key=True),
    Column("region", Text, primary_key=True),
    Column("provider", Text, primary_key=True),
    Column("offer_type", Text, primary_key=True),
    Column("refreshed_at", TIMESTAMP(timezone=True)),
)
