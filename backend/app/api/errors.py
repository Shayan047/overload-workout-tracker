from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status

from app.services.sync import NotFoundError


@contextmanager
def not_found_as_404(what: str) -> Iterator[None]:
    """Turns the services' NotFoundError (missing, someone else's, or a bad reference) into 404."""
    try:
        yield
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{what} not found") from None
