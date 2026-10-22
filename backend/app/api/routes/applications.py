from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Application, ApplicationStatus, Company, Product
from app.schemas import (
    ApplicationCreate,
    ApplicationDetail,
    ApplicationOut,
    ApplicationUpdate,
    UnderwriterDecision,
)
from app.services import pipeline
from app.services.state_machine import InvalidTransition

router = APIRouter(prefix="/applications", tags=["applications"])
S = ApplicationStatus


def _get(db: Session, app_id: str) -> Application:
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Заявка не найдена")
    return app


def _move(db: Session, app: Application, target: S, actor: str, comment: str | None = None):
    try:
        pipeline.transition(db, app, target, actor, comment)
    except InvalidTransition as e:
        raise HTTPException(409, str(e)) from e


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    company_id: str | None = None, status: S | None = None, db: Session = Depends(get_db)
):
    q = select(Application).order_by(Application.created_at.desc())
    if company_id:
        q = q.where(Application.company_id == company_id)
    if status:
        q = q.where(Application.status == status)
    return db.scalars(q).all()


@router.post("", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationCreate, db: Session = Depends(get_db)):
    if not db.get(Company, body.company_id):
        raise HTTPException(404, "Компания не найдена")
    if not db.get(Product, body.product_code):
        raise HTTPException(404, "Продукт не найден")
    app = Application(**body.model_dump())
    db.add(app)
    db.commit()
    return app


@router.get("/{app_id}", response_model=ApplicationDetail)
def get_application(app_id: str, db: Session = Depends(get_db)):
    return _get(db, app_id)


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(app_id: str, body: ApplicationUpdate, db: Session = Depends(get_db)):
    app = _get(db, app_id)
    if app.status not in (S.DRAFT, S.INFO_REQUESTED):
        raise HTTPException(409, "Заявку можно менять только в статусах DRAFT и INFO_REQUESTED")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(app, k, v)
    db.commit()
    return app


@router.post("/{app_id}/submit", response_model=ApplicationDetail)
def submit_application(app_id: str, db: Session = Depends(get_db)):
    """Отправка заявки (из DRAFT) или повторная отправка после уточнений (из INFO_REQUESTED)."""
    app = _get(db, app_id)
    if app.status == S.INFO_REQUESTED:
        _move(db, app, S.VALIDATION, "client", "Данные уточнены")
    else:
        _move(db, app, S.SUBMITTED, "client")
    db.commit()
    return pipeline.run(db, app)


@router.post("/{app_id}/accept", response_model=ApplicationOut)
def accept_offer(app_id: str, db: Session = Depends(get_db)):
    app = _get(db, app_id)
    _move(db, app, S.SIGNING, "client", "Клиент принял предложение")
    db.commit()
    return app


@router.post("/{app_id}/sign", response_model=ApplicationOut)
def sign_documents(app_id: str, db: Session = Depends(get_db)):
    """Симуляция подписания документов и выдачи средств."""
    app = _get(db, app_id)
    _move(db, app, S.ISSUED, "client", "Документы подписаны (симуляция ПЭП)")
    db.commit()
    return app


@router.post("/{app_id}/cancel", response_model=ApplicationOut)
def cancel_application(app_id: str, db: Session = Depends(get_db)):
    app = _get(db, app_id)
    _move(db, app, S.CANCELLED, "client")
    db.commit()
    return app


@router.post("/{app_id}/underwriter-decision", response_model=ApplicationOut, tags=["bank"])
def underwriter_decision(app_id: str, body: UnderwriterDecision, db: Session = Depends(get_db)):
    """Решение андеррайтера по заявке в статусе UNDERWRITING."""
    app = _get(db, app_id)
    if app.status != S.UNDERWRITING:
        raise HTTPException(409, "Заявка не находится на ручном разборе")
    _move(db, app, body.status, "underwriter", body.comment)
    db.commit()
    return app
