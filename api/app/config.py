"""Application settings, loaded from environment (.env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # datastores
    database_url: str = "postgresql+psycopg://app:app@localhost:5432/movies"
    redis_url: str = "redis://localhost:6379/0"

    # tmdb (server-side only)
    tmdb_api_key: str = ""
    tmdb_read_token: str = ""

    # wiring
    app_base_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"
    magic_link_signing_key: str = "dev-only-change-me"
    email_provider_key: str = ""

    # behavior / tuning
    default_region: str = "US"
    corpus_vote_count_floor: int = 200
    model_version: str = "2026.06.0"

    # deployment: run the arq worker as a background task inside this process
    # instead of a separate service. Set true on hosts (like Render's free
    # plan) that don't offer a free standalone background-worker service type.
    run_worker_in_process: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
