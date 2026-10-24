from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CLIENT, current_user, require_underwriter
from app.core.db import get_db
from app.models import Company, Product, User
from app.schemas import CompanyOut, ProductOut

router = APIRouter()


@router.get("/products", response_model=list[ProductOut], tags=["catalog"])
def list_products(db: Session = Depends(get_db)):
    """Каталог кредитных продуктов (публичный)."""
    return db.scalars(select(Product)).all()


@router.get("/companies", response_model=list[CompanyOut], tags=["companies"])
def list_companies(db: Session = Depends(get_db), _: User = Depends(require_underwriter)):
    """Клиенты банка — только для сотрудника банка."""
    return db.scalars(select(Company)).all()


@router.get("/companies/{company_id}", response_model=CompanyOut, tags=["companies"])
def get_company(
    company_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    company = db.get(Company, company_id)
    if not company or (user.role == CLIENT and user.company_id != company_id):
        raise HTTPException(404, "Компания не найдена")
    return company
