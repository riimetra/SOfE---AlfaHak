from fastapi import APIRouter

from app.api.routes import applications, catalog

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(catalog.router)
api_router.include_router(applications.router)
