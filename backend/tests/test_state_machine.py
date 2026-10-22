import pytest

from app.models.status import ApplicationStatus as S
from app.services.decision import make_decision
from app.services.scoring import calculate_score
from app.services.state_machine import TERMINAL, InvalidTransition, ensure_transition


def test_happy_path_transitions():
    path = [S.DRAFT, S.SUBMITTED, S.VALIDATION, S.ENRICHMENT, S.SCORING, S.APPROVED, S.SIGNING,
            S.ISSUED]
    for a, b in zip(path, path[1:]):
        ensure_transition(a, b)


def test_forbidden_transition():
    with pytest.raises(InvalidTransition):
        ensure_transition(S.DRAFT, S.ISSUED)


def test_terminal_states():
    assert TERMINAL == {S.REJECTED, S.ISSUED, S.CANCELLED}


def test_good_borrower_is_approved():
    enrichment = {
        "bki": {"closed_loans_count": 4, "current_debt": 1_500_000, "overdue_days_max": 0},
        "egrul": {"status": "ACTIVE", "age_months": 103},
        "fns": {"tax_debt": 0},
    }
    result = calculate_score(enrichment, amount=2_000_000, annual_revenue=24_000_000)
    assert make_decision(result.score, 2_000_000, 24, 22.5).status == S.APPROVED


def test_bad_borrower_is_rejected():
    enrichment = {
        "bki": {"closed_loans_count": 2, "current_debt": 3_200_000, "overdue_days_max": 65},
        "egrul": {"status": "ACTIVE", "age_months": 76},
        "fns": {"tax_debt": 120_000},
    }
    result = calculate_score(enrichment, amount=1_000_000, annual_revenue=6_000_000)
    assert make_decision(result.score, 1_000_000, 12, 22.5).status == S.REJECTED


def test_hard_stop_rejects():
    assert make_decision(900, 100_000, 12, 22.5, hard_stop="ликвидирована").status == S.REJECTED
