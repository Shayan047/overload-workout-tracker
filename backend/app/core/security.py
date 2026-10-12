import uuid
from datetime import UTC, datetime, timedelta
from functools import cache

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings, require_jwt_secret

ALGORITHM = "HS256"

_password_hash = PasswordHash.recommended()  # Argon2id


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Returns (valid, new_hash). `new_hash` is set when the stored hash should be upgraded."""
    return _password_hash.verify_and_update(password, password_hash)


@cache
def _dummy_hash() -> str:
    return hash_password("not-a-real-password")


def burn_password_check(password: str) -> None:
    """Spends the same time as a real check, so unknown emails can't be told apart by timing."""
    _password_hash.verify(password, _dummy_hash())


def create_access_token(user_id: uuid.UUID, now: datetime | None = None) -> str:
    settings = get_settings()
    issued = now or datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "iat": issued,
        "exp": issued + timedelta(days=settings.access_token_ttl_days),
    }
    return jwt.encode(claims, require_jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID | None:
    """The token's user id, or None if the token is invalid or expired."""
    try:
        claims = jwt.decode(
            token,
            require_jwt_secret(),
            algorithms=[ALGORITHM],
            options={"require": ["sub", "iat", "exp"]},
        )
        return uuid.UUID(claims["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None
