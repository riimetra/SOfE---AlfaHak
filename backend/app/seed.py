"""Загрузка синтетических данных из data/seed при первом старте."""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Company, Product

SEED_DIR = Path(__file__).resolve().parent / "seed_data"


def seed(db: Session) -> None:
    if db.query(Product).first():
        return
    for p in json.loads((SEED_DIR / "products.json").read_text(encoding="utf-8")):
        db.add(Product(**p))
    for c in json.loads((SEED_DIR / "companies.json").read_text(encoding="utf-8")):
        db.add(Company(**c))
    db.commit()
