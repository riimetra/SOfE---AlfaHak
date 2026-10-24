"""Зависимости API: текущий пользователь и проверки ролей / доступа к данным."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_token
from app.models import Application, User

bearer = HTTPBearer(auto_error=False, description="Токен из POST /api/v1/auth/login")

CLIENT = "client"
UNDERWRITER = "underwriter"


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    payload = decode_token(creds.credentials) if creds else None
    user = db.get(User, payload["sub"]) if payload else None
    if not user:
        raise HTTPException(401, "Требуется вход в систему", {"WWW-Authenticate": "Bearer"})
    return user


def require_client(user: User = Depends(current_user)) -> User:
    if user.role != CLIENT:
        raise HTTPException(403, "Действие доступно только клиенту")
    return user


def require_underwriter(user: User = Depends(current_user)) -> User:
    if user.role != UNDERWRITER:
        raise HTTPException(403, "Действие доступно только сотруднику банка")
    return user


def get_application(db: Session, app_id: str, user: User) -> Application:
    """Заявка с проверкой доступа: клиент видит только заявки своей компании."""
    app = db.get(Application, app_id)
    if not app or (user.role == CLIENT and app.company_id != user.company_id):
        raise HTTPException(404, "Заявка не найдена")
    return app
