from fastapi import Request
from fastapi.responses import JSONResponse


class ServiceError(Exception):
    def __init__(self, code: str, status_code: int = 422) -> None:
        self.code = code
        self.status_code = status_code
        super().__init__(code)


async def service_error_handler(_request: Request, error: ServiceError) -> JSONResponse:
    return JSONResponse({"code": error.code}, status_code=error.status_code)
