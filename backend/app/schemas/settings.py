import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SettingsIn(BaseModel):
    unit: Literal["lb", "kg"]
    active_split_id: uuid.UUID | None
    ghost_mode: bool
    sync_wifi_only: bool
    rest_alert_sound: bool


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    unit: str
    active_split_id: uuid.UUID | None
    ghost_mode: bool
    sync_wifi_only: bool
    rest_alert_sound: bool
    updated_at: datetime
