from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Company, Product
from app.schemas import CompanyOut, ProductOut

router = APIRouter()


@router.get("/products", response_model=list[ProductOut], tags=["catalog"])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product)).all()


@router.get("/companies", response_model=list[CompanyOut], tags=["companies"])
def list_companies(db: Session = Depends(get_db)):
    """Демо-список компаний (вместо авторизации — выбор тестового клиента)."""
    return db.scalars(select(Company)).all()


@router.get("/companies/{company_id}", response_model=CompanyOut, tags=["companies"])
def get_company(company_id: str, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Компания не найдена")
    return company
