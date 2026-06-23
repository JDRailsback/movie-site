"""Add Letterboxd film stats columns to the film table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-23
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DDL_UP = """
ALTER TABLE film
    ADD COLUMN lb_slug          TEXT,
    ADD COLUMN lb_rating        REAL,
    ADD COLUMN lb_rating_count  INTEGER,
    ADD COLUMN lb_watch_count   INTEGER,
    ADD COLUMN lb_list_count    INTEGER,
    ADD COLUMN lb_fan_count     INTEGER,
    ADD COLUMN lb_enriched_at   TIMESTAMPTZ;

CREATE INDEX film_lb_watch_idx ON film (lb_watch_count DESC NULLS LAST)
    WHERE lb_watch_count IS NOT NULL;
"""

DDL_DOWN = """
DROP INDEX IF EXISTS film_lb_watch_idx;
ALTER TABLE film
    DROP COLUMN IF EXISTS lb_slug,
    DROP COLUMN IF EXISTS lb_rating,
    DROP COLUMN IF EXISTS lb_rating_count,
    DROP COLUMN IF EXISTS lb_watch_count,
    DROP COLUMN IF EXISTS lb_list_count,
    DROP COLUMN IF EXISTS lb_fan_count,
    DROP COLUMN IF EXISTS lb_enriched_at;
"""


def upgrade() -> None:
    op.execute(DDL_UP)


def downgrade() -> None:
    op.execute(DDL_DOWN)
