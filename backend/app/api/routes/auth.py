import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.security import create_token, verify_password
from app.models import User
from app.schemas import DemoAccount, LoginRequest, TokenOut, UserOut
from app.seed import SEED_DIR

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login == body.login.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")
    return TokenOut(access_token=create_token(user.id, user.role), user=user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/demo-accounts", response_model=list[DemoAccount])
def demo_accounts():
    """Тестовые учётные записи для экрана входа. Доступно только при DEMO_MODE=true."""
    if not settings.demo_mode:
        return []
    users = json.loads((SEED_DIR / "users.json").read_text(encoding="utf-8"))
    return [DemoAccount(**u) for u in users]
