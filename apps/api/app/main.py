from celery.result import AsyncResult
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.storage import ensure_bucket
from app.worker.celery_app import celery_app
from app.worker.tasks import ping_task
from app.modules.ai_orchestration.router import router as ai_orchestration_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.documents.router import router as documents_router
from app.modules.entities.router import router as entities_router
from app.modules.extraction.router import router as extraction_router
from app.modules.reminders.router import router as reminders_router
from app.modules.review.router import router as review_router
from app.modules.templates.router import router as templates_router
from app.modules.uploads.router import router as uploads_router


def create_app() -> FastAPI:
    app = FastAPI(title="Legal Tech API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup():
        ensure_bucket()

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/internal/ping-task")
    def trigger_ping_task(message: str = "pong"):
        result = ping_task.delay(message)
        return {"task_id": result.id}

    @app.get("/internal/ping-task/{task_id}")
    def get_ping_task_result(task_id: str):
        result = AsyncResult(task_id, app=celery_app)
        return {
            "task_id": task_id,
            "status": result.status,
            "result": result.result if result.ready() else None,
        }

    app.include_router(auth_router,            prefix="/auth",       tags=["auth"])
    app.include_router(documents_router,       prefix="/documents",  tags=["documents"])
    app.include_router(templates_router,       prefix="/templates",  tags=["templates"])
    app.include_router(uploads_router,         prefix="/uploads",    tags=["uploads"])
    app.include_router(extraction_router,      prefix="/extraction", tags=["extraction"])
    app.include_router(ai_orchestration_router,prefix="/ai",         tags=["ai"])
    app.include_router(review_router,          prefix="/reviews",    tags=["reviews"])
    app.include_router(reminders_router,       prefix="/reminders",  tags=["reminders"])
    app.include_router(billing_router,         prefix="/billing",    tags=["billing"])
    app.include_router(entities_router,        prefix="/entities",   tags=["entities"])
    app.include_router(audit_router,           prefix="/audit",      tags=["audit"])

    return app


app = create_app()
