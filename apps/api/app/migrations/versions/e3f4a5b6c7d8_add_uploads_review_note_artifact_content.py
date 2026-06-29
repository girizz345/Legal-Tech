"""add uploads table, review.note, review_artifacts.content

Revision ID: e3f4a5b6c7d8
Revises: c8e5729f792b
Create Date: 2026-06-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "c8e5729f792b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the enum if orphaned by a previous failed run (no table uses it yet)
    op.execute("DROP TYPE IF EXISTS upload_status")

    # Create uploads table — SQLAlchemy creates the enum type automatically
    op.create_table(
        "uploads",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("file_key", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("ocr_text", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "processing", "done", "failed", name="upload_status"),
            nullable=False,
        ),
        sa.Column("contract_id", sa.UUID(), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["contract_id"], ["contracts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Add note to reviews
    op.add_column("reviews", sa.Column("note", sa.Text(), nullable=True))

    # Add content to review_artifacts
    op.add_column("review_artifacts", sa.Column("content", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("review_artifacts", "content")
    op.drop_column("reviews", "note")
    op.drop_table("uploads")
    op.execute("DROP TYPE IF EXISTS upload_status")
