"""Seed default entities (tech_co + firm).

Run once after the first migration:
  python -m app.scripts.seed_entities

Idempotent — safe to re-run; existing entities are left unchanged.
Names can be changed by editing the constants below and bumping the version.
"""
from app.core.db import SessionLocal
from app.models.entity import Entity, EntityKind

ENTITIES = [
    {"name": "Acme Technologies Pvt Ltd", "kind": EntityKind.tech_co},
    {"name": "Legal Associates LLP",      "kind": EntityKind.firm},
]


def seed() -> None:
    db = SessionLocal()
    try:
        existing_kinds = {e.kind for e in db.query(Entity).all()}
        for row in ENTITIES:
            if row["kind"] not in existing_kinds:
                db.add(Entity(name=row["name"], kind=row["kind"]))
                print(f"  + Created entity: {row['name']} ({row['kind']})")
            else:
                print(f"  ~ Skipped (already exists): {row['kind']}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Entities seeded.")
