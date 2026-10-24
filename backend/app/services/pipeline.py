"""Кредитный конвейер: проводит заявку по этапам и пишет журнал событий.

Этапы: валидация → обогащение (БКИ, ЕГРЮЛ, ФНС) → скоринг → кредитное решение.
"""

import logging

from sqlalchemy.orm import Session

from app.integrations import external
from app.integrations.external import ExternalServiceError
from app.models import Application, ApplicationEvent, ApplicationStatus, Product
from app.services.decision import make_decision
from app.services.scoring import calculate_score
from app.services.state_machine import ensure_transition

S = ApplicationStatus
log = logging.getLogger(__name__)


def transition(
    db: Session, app: Application, target: S, actor: str, comment: str | None = None
) -> None:
    ensure_transition(app.status, target)
    db.add(
        ApplicationEvent(
            application_id=app.id,
            from_status=app.status,
            to_status=target,
            actor=actor,
            comment=comment,
        )
    )
    log.info("application %s: %s -> %s (%s)", app.id, app.status, target, actor)
    app.status = target
    db.flush()


def validate(app: Application, product: Product) -> list[str]:
    """Проверка полноты и корректности. Сообщения адресованы клиенту."""
    errors = []
    amount = float(app.amount)
    if not float(product.min_amount) <= amount <= float(product.max_amount):
        errors.append(
            f"Сумма для продукта «{product.name}» должна быть от "
            f"{float(product.min_amount):,.0f} до {float(product.max_amount):,.0f} ₽".replace(",", " ")
        )
    if not product.min_term_months <= app.term_months <= product.max_term_months:
        errors.append(
            f"Срок должен быть от {product.min_term_months} до {product.max_term_months} мес."
        )
    if not app.purpose:
        errors.append("Укажите цель финансирования")
    elif product.purposes and app.purpose not in product.purposes:
        errors.append(f"Цель «{app.purpose}» не подходит для продукта «{product.name}»")
    return errors


def enrich(app: Application) -> dict:
    inn = app.company.inn
    bki = external.fetch_bki(inn)
    egrul = external.fetch_egrul(inn)
    fns = external.fetch_fns(inn)
    return {
        "bki": bki or {"found": False, "closed_loans_count": 0, "current_debt": 0},
        "egrul": egrul or {"found": False},
        "fns": fns or {"found": False},
    }


def hard_stop_reason(enrichment: dict) -> str | None:
    egrul = enrichment["egrul"]
    if egrul.get("found") is False:
        return "Компания не найдена в ЕГРЮЛ / ЕГРИП"
    if egrul.get("status") != "ACTIVE":
        return "Компания не действует по данным ЕГРЮЛ"
    return None


def run(db: Session, app: Application) -> Application:
    """Синхронно прогоняет отправленную заявку до решения.

    Вызывающий код отвечает за commit / rollback: если что-то пошло не так,
    транзакция откатывается целиком и заявка остаётся в исходном статусе.
    Следующий шаг развития — асинхронные воркеры на этап (см. docs/architecture.md).
    """
    product = db.get(Product, app.product_code)
    if app.status != S.VALIDATION:
        transition(db, app, S.VALIDATION, "system")

    errors = validate(app, product)
    if errors:
        transition(db, app, S.INFO_REQUESTED, "system", "; ".join(errors))
        return app

    transition(db, app, S.ENRICHMENT, "system")
    try:
        app.enrichment = enrich(app)
    except ExternalServiceError as e:
        app.enrichment = {"error": f"Источник «{e.source}» недоступен"}
        app.decision = {"reason": "Не удалось автоматически получить сведения — нужна ручная проверка"}
        transition(
            db, app, S.UNDERWRITING, "system",
            f"Источник «{e.source}» недоступен — заявка передана кредитному специалисту",
        )
        return app

    transition(db, app, S.SCORING, "system")
    revenue = float(app.company.annual_revenue) if app.company.annual_revenue else None
    result = calculate_score(app.enrichment, float(app.amount), revenue)
    app.score = result.score

    decision = make_decision(
        result.score,
        float(app.amount),
        app.term_months,
        float(product.base_rate),
        hard_stop_reason(app.enrichment),
        float(product.min_amount),
    )
    app.decision = {
        "amount": decision.amount,
        "term_months": decision.term_months,
        "rate": decision.rate,
        "monthly_payment": decision.monthly_payment,
        "reason": decision.reason,
        "factors": result.factors,
        "decided_by": "system",
    }
    transition(db, app, decision.status, "system", decision.reason or None)
    return app
