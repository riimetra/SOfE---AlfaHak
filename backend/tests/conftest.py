import json
import os
import tempfile
from pathlib import Path

import pytest

# БД для тестов — временный SQLite; задаётся до импорта приложения
_db_file = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["INTEGRATION_RETRIES"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from app.integrations import external  # noqa: E402
from app.main import app  # noqa: E402

REGISTRY = json.loads(
    (Path(__file__).resolve().parents[2] / "mocks/app/data/registry.json").read_text("utf-8")
)
SOURCES = {"/bki/": "bki", "/egrul/": "egrul", "/fns/": "fns"}


def fake_get(source: str, path: str):
    """Подмена HTTP-вызова к mocks: те же синтетические данные, что и в сервисе mocks."""
    key = next(v for k, v in SOURCES.items() if path.startswith(k))
    record = REGISTRY.get(path.rsplit("/", 1)[-1])
    return {**record[key]} if record else None


@pytest.fixture(autouse=True)
def _mock_integrations(monkeypatch):
    monkeypatch.setattr(external, "_get", fake_get)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, name: str) -> dict:
    resp = client.post("/api/v1/auth/login", json={"login": name, "password": "demo"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
