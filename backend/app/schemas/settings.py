import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.split import RestSeconds


class SettingsIn(BaseModel):
    unit: Literal["lb", "kg"]
    active_split_id: uuid.UUID | None
    ghost_mode: bool
    sync_wifi_only: bool
    rest_alert_sound: bool
    # Builds from before this setting leave it out, and that keeps the saved value.
    default_rest_seconds: RestSeconds = 90


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    unit: str
    active_split_id: uuid.UUID | None
    ghost_mode: bool
    sync_wifi_only: bool
    rest_alert_sound: bool
    default_rest_seconds: int
    updated_at: datetime
