"""Демо-аутентификация: подписанные HMAC-SHA256 токены (формат, совместимый по смыслу с JWT).

Реализовано на стандартной библиотеке, чтобы не тянуть лишних зависимостей.
В продуктиве заменяется на корпоративный IdP (OIDC) — контракт `Authorization: Bearer` не меняется.
"""

import base64
import hashlib
import hmac
import json
import os
import time

from app.core.config import settings

TOKEN_TTL_SECONDS = 12 * 3600
PBKDF2_ITERATIONS = 100_000


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64d(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _sign(raw: str) -> str:
    return _b64e(hmac.new(settings.jwt_secret.encode(), raw.encode(), hashlib.sha256).digest())


def create_token(subject: str, role: str) -> str:
    payload = {"sub": subject, "role": role, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    raw = _b64e(json.dumps(payload).encode())
    return f"{raw}.{_sign(raw)}"


def decode_token(token: str) -> dict | None:
    try:
        raw, sig = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sign(raw)):
        return None
    try:
        payload = json.loads(_b64d(raw))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("exp", 0) < time.time():
        return None
    return payload


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"{_b64e(salt)}${_b64e(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, _b64d(salt)), stored)
