from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .dependencies import require_frontend_origin
from .errors import ServiceError, service_error_handler
from .routers import health, preparations, process
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
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    application.add_exception_handler(ServiceError, service_error_handler)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(settings.frontend_url).rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-File-Name"],
        expose_headers=["Content-Disposition", "Content-Type"],
    )

    @application.middleware("http")
    async def security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        return response

    application.include_router(health.router)
    browser_only = [Depends(require_frontend_origin)]
    application.include_router(preparations.router, dependencies=browser_only)
    application.include_router(process.router, dependencies=browser_only)
    return application


app = create_app()
