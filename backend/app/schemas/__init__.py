from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.status import ApplicationStatus

S = ApplicationStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- каталог и клиенты ----------


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


# ---------- аутентификация ----------


class LoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORM):
    id: str
    login: str
    full_name: str
    position: str | None
    role: Literal["client", "underwriter"]
    company: CompanyOut | None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DemoAccount(BaseModel):
    login: str
    password: str
    role: str
    full_name: str
    position: str | None = None


# ---------- заявки ----------


class ApplicationCreate(BaseModel):
    product_code: str
    amount: Decimal = Field(gt=0, le=1_000_000_000)
    term_months: int = Field(gt=0, le=360)
    purpose: str = Field(min_length=1, max_length=255)
    # Для клиента компания берётся из учётной записи; поле оставлено для совместимости
    company_id: str | None = None


class ApplicationUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, le=1_000_000_000)
    term_months: int | None = Field(default=None, gt=0, le=360)
    purpose: str | None = Field(default=None, min_length=1, max_length=255)


class EventOut(ORM):
    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    actor: str
    comment: str | None
    created_at: datetime


class CompanyShort(ORM):
    id: str
    inn: str
    name: str


class ProductShort(ORM):
    code: str
    name: str


class ApplicationOut(ORM):
    id: str
    company_id: str
    company: CompanyShort
    product_code: str
    product: ProductShort
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
    """Решение андеррайтера по заявке на ручном разборе."""

    status: Literal[S.APPROVED, S.COUNTER_OFFER, S.REJECTED, S.INFO_REQUESTED]
    comment: str | None = Field(default=None, max_length=1000)
    amount: Decimal | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, gt=0)
    rate: Decimal | None = Field(default=None, gt=0, lt=100)

    @model_validator(mode="after")
    def _check(self):
        if self.status in (S.REJECTED, S.INFO_REQUESTED) and not (self.comment or "").strip():
            raise ValueError("Для отказа или запроса уточнений укажите комментарий для клиента")
        if self.status == S.COUNTER_OFFER and not (self.amount or self.term_months or self.rate):
            raise ValueError("Для контрпредложения укажите изменённые сумму, срок или ставку")
        return self
