"""Клиенты внешних источников. В демо-версии все они ходят в сервис mocks."""

import httpx

from app.core.config import settings

TIMEOUT = httpx.Timeout(5.0)


def _get(path: str) -> dict:
    with httpx.Client(base_url=settings.mocks_base_url, timeout=TIMEOUT) as client:
        resp = client.get(path)
        resp.raise_for_status()
        return resp.json()


def fetch_bki(inn: str) -> dict:
    """Бюро кредитных историй."""
    return _get(f"/bki/reports/{inn}")


def fetch_egrul(inn: str) -> dict:
    """ЕГРЮЛ / ЕГРИП — регистрационные данные и статус."""
    return _get(f"/egrul/companies/{inn}")


def fetch_fns(inn: str) -> dict:
    """ФНС «Прозрачный бизнес» — налоговая задолженность, руководители, ОКВЭД."""
    return _get(f"/fns/transparent-business/{inn}")
