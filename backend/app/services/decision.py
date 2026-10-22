"""Кредитная логика: превращает скоринговую оценку в решение по заявке."""

from dataclasses import dataclass

from app.models.status import ApplicationStatus

APPROVE_THRESHOLD = 600
COUNTER_OFFER_THRESHOLD = 450
MANUAL_REVIEW_AMOUNT = 10_000_000


@dataclass
class Decision:
    status: ApplicationStatus
    amount: float | None = None
    term_months: int | None = None
    rate: float | None = None
    reason: str = ""


def make_decision(
    score: int, amount: float, term_months: int, base_rate: float, hard_stop: str | None = None
) -> Decision:
    if hard_stop:
        return Decision(ApplicationStatus.REJECTED, reason=hard_stop)
    if amount >= MANUAL_REVIEW_AMOUNT:
        return Decision(ApplicationStatus.UNDERWRITING, reason="Крупная сумма — ручной разбор")
    if score >= APPROVE_THRESHOLD:
        return Decision(ApplicationStatus.APPROVED, amount, term_months, base_rate)
    if score >= COUNTER_OFFER_THRESHOLD:
        return Decision(
            ApplicationStatus.COUNTER_OFFER,
            amount=round(amount * 0.6, -3),
            term_months=term_months,
            rate=base_rate + 3,
            reason="Одобрено на изменённых условиях",
        )
    return Decision(ApplicationStatus.REJECTED, reason="Недостаточная скоринговая оценка")
