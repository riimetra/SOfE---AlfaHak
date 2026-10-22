"""Кредитный конвейер: проводит заявку по этапам и пишет журнал событий."""

from sqlalchemy.orm import Session

from app.integrations import external
from app.models import Application, ApplicationEvent, ApplicationStatus, Product
from app.services.decision import make_decision
from app.services.scoring import calculate_score
from app.services.state_machine import ensure_transition

S = ApplicationStatus


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
    app.status = target


def validate(app: Application, product: Product) -> list[str]:
    errors = []
    if not product.min_amount <= app.amount <= product.max_amount:
        errors.append(f"Сумма вне диапазона {product.min_amount}–{product.max_amount}")
    if not product.min_term_months <= app.term_months <= product.max_term_months:
        errors.append(f"Срок вне диапазона {product.min_term_months}–{product.max_term_months} мес.")
    if not app.purpose:
        errors.append("Не указана цель финансирования")
    return errors


def run(db: Session, app: Application) -> Application:
    """Синхронно прогоняет отправленную заявку до решения.

    TODO: вынести этапы в асинхронные воркеры (очередь), когда появится нагрузка.
    """
    product = db.get(Product, app.product_code)
    # После уточнений клиент сам возвращает заявку в VALIDATION
    if app.status != S.VALIDATION:
        transition(db, app, S.VALIDATION, "system")

    errors = validate(app, product)
    if errors:
        transition(db, app, S.INFO_REQUESTED, "system", "; ".join(errors))
        db.commit()
        return app

    transition(db, app, S.ENRICHMENT, "system")
    inn = app.company.inn
    app.enrichment = {
        "bki": external.fetch_bki(inn),
        "egrul": external.fetch_egrul(inn),
        "fns": external.fetch_fns(inn),
    }

    transition(db, app, S.SCORING, "system")
    revenue = float(app.company.annual_revenue) if app.company.annual_revenue else None
    result = calculate_score(app.enrichment, float(app.amount), revenue)
    app.score = result.score

    hard_stop = None
    if app.enrichment["egrul"].get("status") != "ACTIVE":
        hard_stop = "Компания не действует по данным ЕГРЮЛ"

    decision = make_decision(
        result.score, float(app.amount), app.term_months, float(product.base_rate), hard_stop
    )
    app.decision = {
        "amount": decision.amount,
        "term_months": decision.term_months,
        "rate": decision.rate,
        "reason": decision.reason,
        "factors": result.factors,
    }
    transition(db, app, decision.status, "system", decision.reason or None)
    db.commit()
    return app
