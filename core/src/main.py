from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .dependencies import require_api_key
from .errors import ServiceError, service_error_handler
from .routers import analyze, health, preparations, process
from .services.preparations import preparation_manager
from .services.converter import process_manager


@asynccontextmanager
async def lifespan(_application: FastAPI):
    await preparation_manager.start()
    await process_manager.start()
    yield
    await process_manager.stop()
    await preparation_manager.stop()


def create_app() -> FastAPI:
    application = FastAPI(
        title="Baixaboo API",
        description="API de download e processamento de mídia sem persistência.",
        version="2.2.0",
        lifespan=lifespan,
    )
    application.add_exception_handler(ServiceError, service_error_handler)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(settings.frontend_url).rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key", "X-File-Name"],
        expose_headers=["Content-Disposition", "Content-Type"],
    )

    application.include_router(health.router)
    protected = [Depends(require_api_key)]
    application.include_router(analyze.router, dependencies=protected)
    application.include_router(preparations.router, dependencies=protected)
    application.include_router(process.router, dependencies=protected)
    return application


app = create_app()
