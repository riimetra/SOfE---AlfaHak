"""Кредитная логика: превращает скоринговую оценку в решение по заявке.

Скоринг (scoring.py) даёт только оценку риска. Решение учитывает ещё и продукт
(базовая ставка, минимальная сумма), сумму заявки и стоп-факторы внешних проверок.
"""

from dataclasses import dataclass

from app.models.status import ApplicationStatus

APPROVE_THRESHOLD = 600
COUNTER_OFFER_THRESHOLD = 450
MANUAL_REVIEW_AMOUNT = 10_000_000
COUNTER_OFFER_SHARE = 0.6
COUNTER_OFFER_RATE_PREMIUM = 3.0


@dataclass
class Decision:
    status: ApplicationStatus
    amount: float | None = None
    term_months: int | None = None
    rate: float | None = None
    reason: str = ""

    @property
    def monthly_payment(self) -> float | None:
        if self.amount and self.term_months and self.rate:
            return annuity_payment(self.amount, self.rate, self.term_months)
        return None


def annuity_payment(amount: float, rate_percent: float, term_months: int) -> float:
    """Ежемесячный аннуитетный платёж."""
    r = rate_percent / 100 / 12
    if r == 0:
        return round(amount / term_months, 2)
    return round(amount * r / (1 - (1 + r) ** -term_months), 2)


def make_decision(
    score: int,
    amount: float,
    term_months: int,
    base_rate: float,
    hard_stop: str | None = None,
    min_amount: float = 0,
) -> Decision:
    if hard_stop:
        return Decision(ApplicationStatus.REJECTED, reason=hard_stop)
    if amount >= MANUAL_REVIEW_AMOUNT:
        return Decision(
            ApplicationStatus.UNDERWRITING,
            reason="Сумма от 10 млн ₽ — заявку рассмотрит кредитный специалист",
        )
    if score >= APPROVE_THRESHOLD:
        return Decision(ApplicationStatus.APPROVED, amount, term_months, base_rate)
    if score >= COUNTER_OFFER_THRESHOLD:
        counter_amount = round(amount * COUNTER_OFFER_SHARE, -3)
        if counter_amount >= min_amount:
            return Decision(
                ApplicationStatus.COUNTER_OFFER,
                amount=counter_amount,
                term_months=term_months,
                rate=base_rate + COUNTER_OFFER_RATE_PREMIUM,
                reason="Банк готов выдать кредит на изменённых условиях: меньшая сумма, "
                "ставка выше на 3 п.п.",
            )
    return Decision(ApplicationStatus.REJECTED, reason="Недостаточная скоринговая оценка")
