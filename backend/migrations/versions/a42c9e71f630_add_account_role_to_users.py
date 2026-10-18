
"""Add account-level role to users.

Revision ID: a42c9e71f630
Revises: d87914774319
"""

from alembic import op
import sqlalchemy as sa


revision = "a42c9e71f630"
down_revision = "d87914774319"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "account_role",
            sa.String(length=20),
            nullable=False,
            server_default="member",
        ),
    )

    op.alter_column(
        "users",
        "account_role",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("users", "account_role")
