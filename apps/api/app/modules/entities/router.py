"""Entities — the tech_co and firm ring-fence identifiers.
Every contract, review, and fee is scoped to one of these entities
so the two revenue streams never commingle.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.entity import Entity, EntityKind
from app.models.user import UserRole
from app.modules.auth.dependencies import get_current_user, require_role

router = APIRouter()


class EntityOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: EntityKind
    created_at: datetime

    class Config:
        from_attributes = True


class EntityCreateRequest(BaseModel):
    name: str
    kind: EntityKind


@router.get("/", response_model=list[EntityOut])
def list_entities(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return db.query(Entity).order_by(Entity.created_at).all()


@router.post("/", response_model=EntityOut)
def create_entity(
    payload: EntityCreateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    entity = Entity(name=payload.name, kind=payload.kind)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{entity_id}", status_code=204)
def delete_entity(
    entity_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.admin)),
):
    entity = db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    db.delete(entity)
    db.commit()
