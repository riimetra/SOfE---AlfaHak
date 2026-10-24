"""Клиенты внешних источников. В демо-версии все они ходят в сервис mocks.

Сетевые сбои и ответы 5xx повторяются `integration_retries` раз, после чего поднимается
ExternalServiceError — конвейер передаёт заявку специалисту, а не падает.
Ответ 404 означает «по ИНН сведений нет» и возвращается как None.
"""

import logging
import time

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


class ExternalServiceError(Exception):
    def __init__(self, source: str, detail: str):
        super().__init__(f"{source}: {detail}")
        self.source = source


def _get(source: str, path: str) -> dict | None:
    last_error = ""
    for attempt in range(settings.integration_retries + 1):
        try:
            with httpx.Client(
                base_url=settings.mocks_base_url, timeout=settings.integration_timeout_s
            ) as client:
                resp = client.get(path)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as e:
            last_error = str(e) or type(e).__name__
            log.warning("%s attempt %d failed: %s", source, attempt + 1, last_error)
            time.sleep(0.2 * (attempt + 1))
    raise ExternalServiceError(source, last_error)


def fetch_bki(inn: str) -> dict | None:
    """Бюро кредитных историй."""
    return _get("БКИ", f"/bki/reports/{inn}")


def fetch_egrul(inn: str) -> dict | None:
    """ЕГРЮЛ / ЕГРИП — регистрационные данные и статус."""
    return _get("ЕГРЮЛ", f"/egrul/companies/{inn}")


def fetch_fns(inn: str) -> dict | None:
    """ФНС «Прозрачный бизнес» — налоговая задолженность, руководители, ОКВЭД."""
    return _get("ФНС", f"/fns/transparent-business/{inn}")
