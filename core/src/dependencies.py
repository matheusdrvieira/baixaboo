import secrets
from typing import Annotated

from fastapi import Security
from fastapi.security import APIKeyHeader, APIKeyQuery

from .config import settings
from .errors import ServiceError

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)


async def require_api_key(
    header_key: Annotated[str | None, Security(api_key_header)],
    query_key: Annotated[str | None, Security(api_key_query)],
) -> None:
    provided_key = header_key or query_key
    expected_key = settings.api_key.get_secret_value()
    if not provided_key or not secrets.compare_digest(provided_key, expected_key):
        raise ServiceError("invalid_api_key", 401)
