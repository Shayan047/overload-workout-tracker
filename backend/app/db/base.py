import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, MetaData, Numeric, Uuid
from sqlalchemy.orm import DeclarativeBase

# Stable constraint names, so Alembic migrations can refer to them.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base for all models. Alembic reads `Base.metadata`."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    type_annotation_map = {
        uuid.UUID: Uuid(),
        datetime: DateTime(timezone=True),
        # Weights in kg (rule 1). Any other decimal column must set its own type.
        Decimal: Numeric(7, 3),
    }
