"""Сквозные сценарии через HTTP API — соответствуют docs/test-scenarios.md."""

from app.integrations import external
from app.integrations.external import ExternalServiceError

from .conftest import login

API = "/api/v1"


def create(client, h, product="EXPRESS", amount=2_000_000, term=24,
           purpose="Пополнение оборотных средств"):
    resp = client.post(f"{API}/applications", headers=h, json={
        "product_code": product, "amount": amount, "term_months": term, "purpose": purpose,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def post(client, h, app_id, action, **kw):
    return client.post(f"{API}/applications/{app_id}/{action}", headers=h, **kw)


def test_auth_required(client):
    assert client.get(f"{API}/applications").status_code == 401
    assert client.post(f"{API}/auth/login", json={"login": "romashka", "password": "x"}).status_code == 401


def test_me(client):
    me = client.get(f"{API}/auth/me", headers=login(client, "romashka")).json()
    assert me["role"] == "client" and me["company"]["inn"] == "7701000001"


def test_happy_path_approve_sign_issue(client):
    h = login(client, "romashka")
    app_id = create(client, h)
    app = post(client, h, app_id, "submit").json()
    assert app["status"] == "APPROVED"
    assert app["score"] == 710
    assert app["decision"]["rate"] == 22.5
    assert app["decision"]["monthly_payment"] > 0
    assert post(client, h, app_id, "accept").json()["status"] == "SIGNING"
    app = post(client, h, app_id, "sign").json()
    assert app["status"] == "ISSUED"
    statuses = [e["to_status"] for e in app["events"]]
    assert statuses == ["SUBMITTED", "VALIDATION", "ENRICHMENT", "SCORING", "APPROVED",
                        "SIGNING", "ISSUED"]


def test_bad_credit_history_rejected(client):
    h = login(client, "vasilek")
    app = post(client, h, create(client, h, amount=1_000_000, term=12), "submit").json()
    assert app["status"] == "REJECTED"


def test_liquidated_company_rejected(client):
    h = login(client, "lyutik")
    app = post(client, h, create(client, h), "submit").json()
    assert app["status"] == "REJECTED"
    assert "ЕГРЮЛ" in app["decision"]["reason"]


def test_info_requested_then_fixed(client):
    h = login(client, "petrov")
    app_id = create(client, h, amount=50_000)
    app = post(client, h, app_id, "submit").json()
    assert app["status"] == "INFO_REQUESTED"
    assert "Сумма" in app["events"][-1]["comment"]
    resp = client.patch(f"{API}/applications/{app_id}", headers=h, json={"amount": 300_000})
    assert resp.status_code == 200
    app = post(client, h, app_id, "submit").json()
    assert app["status"] in ("APPROVED", "COUNTER_OFFER", "REJECTED")


def test_large_amount_goes_to_underwriter(client):
    h = login(client, "romashka")
    app_id = create(client, h, product="INVEST", amount=15_000_000, term=60,
                    purpose="Покупка оборудования")
    assert post(client, h, app_id, "submit").json()["status"] == "UNDERWRITING"

    # клиент не может принимать решение андеррайтера
    assert post(client, h, app_id, "underwriter-decision", json={"status": "APPROVED"}).status_code == 403

    uw = login(client, "underwriter")
    queue = client.get(f"{API}/applications?status=UNDERWRITING", headers=uw).json()
    assert any(a["id"] == app_id for a in queue)
    resp = post(client, uw, app_id, "underwriter-decision", json={
        "status": "COUNTER_OFFER", "amount": 12_000_000, "rate": 20.5, "comment": "Залог — оборудование",
    })
    assert resp.status_code == 200, resp.text
    app = resp.json()
    assert app["status"] == "COUNTER_OFFER"
    assert app["decision"]["amount"] == 12_000_000
    assert app["decision"]["decided_by"] == "underwriter"
    assert post(client, h, app_id, "accept").json()["status"] == "SIGNING"


def test_underwriter_reject_requires_comment(client):
    h = login(client, "romashka")
    app_id = create(client, h, product="INVEST", amount=20_000_000, term=60,
                    purpose="Развитие бизнеса")
    post(client, h, app_id, "submit")
    uw = login(client, "underwriter")
    assert post(client, uw, app_id, "underwriter-decision", json={"status": "REJECTED"}).status_code == 422


def test_client_cannot_see_foreign_application(client):
    h = login(client, "romashka")
    app_id = create(client, h)
    other = login(client, "vasilek")
    assert client.get(f"{API}/applications/{app_id}", headers=other).status_code == 404
    assert all(a["company"]["inn"] == "7701000002"
               for a in client.get(f"{API}/applications", headers=other).json())


def test_invalid_transition_conflict(client):
    h = login(client, "vasilek")
    app_id = create(client, h, amount=1_000_000, term=12)
    post(client, h, app_id, "submit")
    assert post(client, h, app_id, "submit").status_code == 409
    assert post(client, h, app_id, "sign").status_code == 409


def test_external_outage_goes_to_underwriter(client, monkeypatch):
    def broken(source, path):
        raise ExternalServiceError("БКИ", "timeout")

    monkeypatch.setattr(external, "_get", broken)
    h = login(client, "romashka")
    app = post(client, h, create(client, h), "submit").json()
    assert app["status"] == "UNDERWRITING"
    assert "недоступен" in app["events"][-1]["comment"]


def test_unexpected_error_keeps_application_resubmittable(client, monkeypatch):
    def crash(source, path):
        raise RuntimeError("boom")

    h = login(client, "romashka")
    app_id = create(client, h)
    monkeypatch.setattr(external, "_get", crash)
    assert post(client, h, app_id, "submit").status_code == 503
    assert client.get(f"{API}/applications/{app_id}", headers=h).json()["status"] == "DRAFT"
    monkeypatch.undo()
    from .conftest import fake_get
    monkeypatch.setattr(external, "_get", fake_get)
    assert post(client, h, app_id, "submit").json()["status"] == "APPROVED"
