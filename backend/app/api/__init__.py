from fastapi import APIRouter

from app.api.routes import applications, auth, catalog

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(applications.router)
