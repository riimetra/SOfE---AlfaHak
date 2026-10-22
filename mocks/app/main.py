"""Моки внешних систем: БКИ, ЕГРЮЛ/ЕГРИП, ФНС «Прозрачный бизнес».

Контракты упрощены, но сохраняют смысл интеграции. Данные — синтетические.
"""

import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException

REGISTRY = json.loads((Path(__file__).parent / "data" / "registry.json").read_text("utf-8"))
LATENCY_MS = int(os.getenv("MOCKS_LATENCY_MS", "0"))

app = FastAPI(title="External services mocks", version="0.1.0")


def _lookup(inn: str, source: str) -> dict:
    if LATENCY_MS:
        time.sleep(LATENCY_MS / 1000)
    record = REGISTRY.get(inn)
    if not record:
        raise HTTPException(404, f"ИНН {inn} не найден в {source}")
    return {"inn": inn, "source": source, **record[source]}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/bki/reports/{inn}", tags=["bki"])
def bki_report(inn: str):
    return _lookup(inn, "bki")


@app.get("/egrul/companies/{inn}", tags=["egrul"])
def egrul_company(inn: str):
    return _lookup(inn, "egrul")


@app.get("/fns/transparent-business/{inn}", tags=["fns"])
def fns_info(inn: str):
    return _lookup(inn, "fns")
