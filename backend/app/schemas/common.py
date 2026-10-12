import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SyncedOut(BaseModel):
    """Fields every synced row returns. `deleted_at` is set on tombstones."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
