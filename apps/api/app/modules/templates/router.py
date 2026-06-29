import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.template import Template
from app.modules.auth.dependencies import get_current_user
from app.modules.templates.schemas import TemplateDetail, TemplateSummary

router = APIRouter()


@router.get("/", response_model=list[TemplateSummary])
def list_templates(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Template).order_by(Template.name).all()


@router.get("/{template_id}", response_model=TemplateDetail)
def get_template(template_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    template = db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template
