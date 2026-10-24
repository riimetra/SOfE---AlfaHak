import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.db import Base, SessionLocal, engine
from app.seed import seed

logging.basicConfig(level=settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # MVP: схема создаётся при старте. Развитие — миграции Alembic (см. docs/architecture.md)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(
    title="Умный кредитный кабинет — API",
    version="1.0.0",
    description="Цифровой кредитный конвейер для малого и микробизнеса",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}
