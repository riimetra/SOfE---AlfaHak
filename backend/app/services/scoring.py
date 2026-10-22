"""Балльная скоринговая модель (упрощённая, явно описанная — см. docs/scoring.md).

Скоринг даёт только оценку риска. Итоговое решение принимает decision.py,
учитывая продукт, сумму, срок и результаты внешних проверок.
"""

from dataclasses import dataclass, field

BASE_SCORE = 500


@dataclass
class ScoreResult:
    score: int
    factors: list[tuple[str, int]] = field(default_factory=list)


def calculate_score(enrichment: dict, amount: float, annual_revenue: float | None) -> ScoreResult:
    factors: list[tuple[str, int]] = []

    bki = enrichment.get("bki", {})
    egrul = enrichment.get("egrul", {})
    fns = enrichment.get("fns", {})

    if bki.get("overdue_days_max", 0) > 30:
        factors.append(("Просрочки свыше 30 дней в КИ", -150))
    elif bki.get("closed_loans_count", 0) > 0:
        factors.append(("Положительная кредитная история", +80))

    if egrul.get("age_months", 0) >= 24:
        factors.append(("Бизнес старше 2 лет", +60))
    elif egrul.get("age_months", 0) < 6:
        factors.append(("Бизнес младше 6 месяцев", -80))

    if fns.get("tax_debt", 0) > 0:
        factors.append(("Задолженность по налогам", -100))

    if annual_revenue:
        load = (amount + bki.get("current_debt", 0)) / annual_revenue
        if load > 0.5:
            factors.append(("Высокая долговая нагрузка", -120))
        elif load < 0.2:
            factors.append(("Низкая долговая нагрузка", +70))

    score = BASE_SCORE + sum(delta for _, delta in factors)
    return ScoreResult(score=max(0, min(1000, score)), factors=factors)
