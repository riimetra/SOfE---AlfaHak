import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    CLIENT,
    current_user,
    get_application,
    require_client,
    require_underwriter,
)
from app.core.db import get_db
from app.models import Application, ApplicationStatus, Product, User
from app.schemas import (
    ApplicationCreate,
    ApplicationDetail,
    ApplicationOut,
    ApplicationUpdate,
    UnderwriterDecision,
)
from app.services import pipeline
from app.services.decision import annuity_payment
from app.services.state_machine import InvalidTransition

router = APIRouter(prefix="/applications", tags=["applications"])
S = ApplicationStatus
log = logging.getLogger(__name__)

EDITABLE = (S.DRAFT, S.INFO_REQUESTED)


def _move(db: Session, app: Application, target: S, actor: str, comment: str | None = None):
    try:
        pipeline.transition(db, app, target, actor, comment)
    except InvalidTransition as e:
        raise HTTPException(409, str(e)) from e


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    status: S | None = None,
    company_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Клиент видит заявки своей компании, сотрудник банка — все (с фильтрами)."""
    q = select(Application).order_by(Application.created_at.desc())
    if user.role == CLIENT:
        q = q.where(Application.company_id == user.company_id)
    elif company_id:
        q = q.where(Application.company_id == company_id)
    if status:
        q = q.where(Application.status == status)
    return db.scalars(q).all()


@router.post("", response_model=ApplicationDetail, status_code=201)
def create_application(
    body: ApplicationCreate, db: Session = Depends(get_db), user: User = Depends(require_client)
):
    if not db.get(Product, body.product_code):
        raise HTTPException(404, "Продукт не найден")
    data = body.model_dump(exclude={"company_id"})
    app = Application(**data, company_id=user.company_id, enrichment={})
    db.add(app)
    db.flush()
    db.refresh(app)
    db.commit()
    return app


@router.get("/{app_id}", response_model=ApplicationDetail)
def read_application(app_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return get_application(db, app_id, user)


@router.patch("/{app_id}", response_model=ApplicationDetail)
def update_application(
    app_id: str,
    body: ApplicationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_client),
):
    app = get_application(db, app_id, user)
    if app.status not in EDITABLE:
        raise HTTPException(409, "Заявку можно менять только в статусах «Черновик» и «Нужны уточнения»")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(app, k, v)
    db.commit()
    return app


@router.post("/{app_id}/submit", response_model=ApplicationDetail)
def submit_application(
    app_id: str, db: Session = Depends(get_db), user: User = Depends(require_client)
):
    """Отправка (из DRAFT) или повторная отправка после уточнений (из INFO_REQUESTED).

    Весь конвейер выполняется в одной транзакции: при непредвиденной ошибке заявка
    остаётся в исходном статусе и её можно отправить снова.
    """
    app = get_application(db, app_id, user)
    try:
        if app.status == S.INFO_REQUESTED:
            _move(db, app, S.VALIDATION, "client", "Клиент уточнил данные")
        elif app.status != S.SUBMITTED:  # SUBMITTED — заявка, застрявшая в старой версии
            _move(db, app, S.SUBMITTED, "client")
        pipeline.run(db, app)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        log.exception("pipeline failed for %s", app_id)
        raise HTTPException(503, "Не удалось обработать заявку, попробуйте ещё раз") from e
    db.refresh(app)
    return app


@router.post("/{app_id}/accept", response_model=ApplicationDetail)
def accept_offer(app_id: str, db: Session = Depends(get_db), user: User = Depends(require_client)):
    app = get_application(db, app_id, user)
    _move(db, app, S.SIGNING, "client", "Клиент принял предложение банка")
    db.commit()
    return app


@router.post("/{app_id}/sign", response_model=ApplicationDetail)
def sign_documents(app_id: str, db: Session = Depends(get_db), user: User = Depends(require_client)):
    """Симуляция подписания документов простой электронной подписью и выдачи средств."""
    app = get_application(db, app_id, user)
    _move(db, app, S.ISSUED, "client", "Документы подписаны ПЭП, средства зачислены на счёт (симуляция)")
    db.commit()
    return app


@router.post("/{app_id}/cancel", response_model=ApplicationDetail)
def cancel_application(
    app_id: str, db: Session = Depends(get_db), user: User = Depends(require_client)
):
    app = get_application(db, app_id, user)
    _move(db, app, S.CANCELLED, "client", "Заявка отозвана клиентом")
    db.commit()
    return app


@router.post("/{app_id}/underwriter-decision", response_model=ApplicationDetail, tags=["bank"])
def underwriter_decision(
    app_id: str,
    body: UnderwriterDecision,
    db: Session = Depends(get_db),
    user: User = Depends(require_underwriter),
):
    """Решение андеррайтера по заявке в статусе UNDERWRITING."""
    app = get_application(db, app_id, user)
    if app.status != S.UNDERWRITING:
        raise HTTPException(409, "Заявка не находится на ручном разборе")

    decision = dict(app.decision or {})
    decision.update(decided_by="underwriter", underwriter=user.full_name, reason=body.comment or "")
    if body.status in (S.APPROVED, S.COUNTER_OFFER):
        amount = float(body.amount or app.amount)
        term = body.term_months or app.term_months
        rate = float(body.rate or app.product.base_rate)
        decision.update(
            amount=amount,
            term_months=term,
            rate=rate,
            monthly_payment=annuity_payment(amount, rate, term),
        )
    else:
        decision.update(amount=None, term_months=None, rate=None, monthly_payment=None)
    app.decision = decision
    _move(db, app, body.status, "underwriter", body.comment)
    db.commit()
    return app
