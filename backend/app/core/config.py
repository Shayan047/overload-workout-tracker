from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Query options that libpq (and so Neon's and Render's connection strings) use but asyncpg
# doesn't: `sslmode` is asyncpg's `ssl`; `channel_binding` has no asyncpg equivalent.
_RENAMED_OPTIONS = {"sslmode": "ssl"}
_DROPPED_OPTIONS = {"channel_binding"}


def normalize_database_url(url: str) -> str:
    """A connection string as a host shows it (`postgres://…?sslmode=require`), made usable
    by SQLAlchemy's asyncpg driver. Neon's pooled host (`-pooler`) becomes its direct host:
    PgBouncer's transaction pooling breaks asyncpg's prepared statements, and one small
    API doesn't need a pooler."""
    parts = urlsplit(url)
    scheme = "postgresql+asyncpg" if parts.scheme in {"postgres", "postgresql"} else parts.scheme
    netloc = parts.netloc.replace("-pooler.", ".") if ".neon.tech" in parts.netloc else parts.netloc
    query = [
        (_RENAMED_OPTIONS.get(key, key), value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key not in _DROPPED_OPTIONS
    ]
    return urlunsplit((scheme, netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    """App settings, read from environment variables (and `.env` in local dev)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://overload:overload@localhost:5432/overload"
    sql_echo: bool = False

    @field_validator("database_url")
    @classmethod
    def _asyncpg_url(cls, value: str) -> str:
        return normalize_database_url(value)

    # Signs access tokens (HS256). No default: the API refuses to start without it
    # (see `require_jwt_secret`), while tools like Alembic don't need it.
    jwt_secret: SecretStr | None = Field(default=None, min_length=32)
    # Long-lived because the app works offline for days; there are no refresh tokens yet.
    access_token_ttl_days: int = 30

    # Browser origins allowed to call the API (comma-separated). Phones don't need this;
    # it's for the Expo web dev server (`npm run web`). Set it to "" to allow none.
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def require_jwt_secret() -> str:
    secret = get_settings().jwt_secret
    if secret is None:
        raise RuntimeError("JWT_SECRET is not set. See backend/.env.example.")
    return secret.get_secret_value()
