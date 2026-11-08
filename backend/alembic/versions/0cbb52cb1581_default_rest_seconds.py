"""default rest seconds

Revision ID: 0cbb52cb1581
Revises: ea44cfbcb7e2
Create Date: 2026-11-06 22:38:39.465389

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0cbb52cb1581"
down_revision: str | Sequence[str] | None = "ea44cfbcb7e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "user_settings",
        sa.Column(
            "default_rest_seconds", sa.Integer(), server_default=sa.text("90"), nullable=False
        ),
    )
    op.create_check_constraint(
        op.f("ck_user_settings_default_rest_seconds"),
        "user_settings",
        "default_rest_seconds BETWEEN 0 AND 3600",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f("ck_user_settings_default_rest_seconds"), "user_settings", type_="check"
    )
    op.drop_column("user_settings", "default_rest_seconds")
