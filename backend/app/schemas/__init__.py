from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.status import ApplicationStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProductOut(ORM):
    code: str
    name: str
    description: str
    min_amount: Decimal
    max_amount: Decimal
    min_term_months: int
    max_term_months: int
    base_rate: Decimal
    purposes: list[str]


class CompanyOut(ORM):
    id: str
    inn: str
    name: str
    legal_form: str
    okved: str | None
    annual_revenue: Decimal | None


class ApplicationCreate(BaseModel):
    company_id: str
    product_code: str
    amount: Decimal = Field(gt=0)
    term_months: int = Field(gt=0)
    purpose: str


class ApplicationUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, gt=0)
    purpose: str | None = None


class EventOut(ORM):
    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    actor: str
    comment: str | None
    created_at: datetime


class ApplicationOut(ORM):
    id: str
    company_id: str
    product_code: str
    status: ApplicationStatus
    amount: Decimal
    term_months: int
    purpose: str
    score: int | None
    decision: dict | None
    created_at: datetime
    updated_at: datetime


class ApplicationDetail(ApplicationOut):
    enrichment: dict
    events: list[EventOut]


class UnderwriterDecision(BaseModel):
    status: ApplicationStatus
    comment: str | None = None
