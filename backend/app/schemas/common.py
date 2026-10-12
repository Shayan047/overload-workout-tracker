import uuid
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer


class SyncedOut(BaseModel):
    """Fields every synced row returns. `deleted_at` is set on tombstones."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


def _to_grams(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


_as_number = PlainSerializer(float, return_type=float, when_used="json")

# Weights travel as JSON numbers in kg. Input is rounded to the gram, which is what
# NUMERIC(7,3) stores, so the phone can send 10 lb as 4.5359237.
Kg = Annotated[Decimal, Field(ge=0, le=Decimal("9999.999")), AfterValidator(_to_grams), _as_number]
PositiveKg = Annotated[
    Decimal, Field(gt=0, le=Decimal("9999.999")), AfterValidator(_to_grams), _as_number
]
KgOut = Annotated[Decimal, _as_number]
