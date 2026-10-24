"""Загрузка синтетических данных при старте. Идемпотентна: каждая таблица наполняется,
только если она пустая (так новые таблицы появляются и на уже существующей БД)."""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Company, Product, User

SEED_DIR = Path(__file__).resolve().parent / "seed_data"


def _load(name: str) -> list[dict]:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def seed(db: Session) -> None:
    if not db.query(Product).first():
        db.add_all(Product(**p) for p in _load("products.json"))
    if not db.query(Company).first():
        db.add_all(Company(**c) for c in _load("companies.json"))
    db.flush()
    if not db.query(User).first():
        for u in _load("users.json"):
            password = u.pop("password")
            db.add(User(**u, password_hash=hash_password(password)))
    db.commit()
