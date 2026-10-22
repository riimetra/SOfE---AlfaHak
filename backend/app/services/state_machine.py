from app.models.status import ApplicationStatus as S

# Разрешённые переходы статусов заявки. Любой переход вне таблицы — ошибка.
TRANSITIONS: dict[S, set[S]] = {
    S.DRAFT: {S.SUBMITTED, S.CANCELLED},
    S.SUBMITTED: {S.VALIDATION},
    S.VALIDATION: {S.ENRICHMENT, S.INFO_REQUESTED, S.REJECTED},
    S.INFO_REQUESTED: {S.VALIDATION, S.CANCELLED},
    S.ENRICHMENT: {S.SCORING},
    S.SCORING: {S.APPROVED, S.COUNTER_OFFER, S.REJECTED, S.UNDERWRITING},
    S.UNDERWRITING: {S.APPROVED, S.COUNTER_OFFER, S.REJECTED, S.INFO_REQUESTED},
    S.APPROVED: {S.SIGNING, S.CANCELLED},
    S.COUNTER_OFFER: {S.SIGNING, S.CANCELLED},
    S.SIGNING: {S.ISSUED, S.CANCELLED},
    S.REJECTED: set(),
    S.ISSUED: set(),
    S.CANCELLED: set(),
}

TERMINAL = {s for s, nxt in TRANSITIONS.items() if not nxt}


class InvalidTransition(Exception):
    def __init__(self, current: S, target: S):
        super().__init__(f"Переход {current} -> {target} запрещён")
        self.current = current
        self.target = target


def ensure_transition(current: S, target: S) -> None:
    if target not in TRANSITIONS[current]:
        raise InvalidTransition(current, target)
