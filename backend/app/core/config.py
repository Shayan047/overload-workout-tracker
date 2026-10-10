from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (and `.env` in local dev)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://overload:overload@localhost:5432/overload"
    sql_echo: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
