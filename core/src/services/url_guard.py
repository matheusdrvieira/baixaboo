import asyncio
import ipaddress
import socket
import urllib.request
from urllib.parse import urljoin, urlparse

from ..errors import ServiceError

ALLOWED_PORTS = {80, 443}


async def validate_public_url(value: str) -> None:
    await asyncio.to_thread(validate_public_url_sync, value)


def validate_public_url_sync(value: str) -> None:
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ServiceError("invalid_url", 400)

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as error:
        raise ServiceError("invalid_url", 400) from error

    if port not in ALLOWED_PORTS:
        raise ServiceError("invalid_url", 400)

    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except (OSError, socket.gaierror) as error:
        raise ServiceError("unavailable") from error

    if not addresses or any(
        not ipaddress.ip_address(address[4][0]).is_global for address in addresses
    ):
        raise ServiceError("invalid_url", 400)


class PublicRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        try:
            validate_public_url_sync(urljoin(request.full_url, new_url))
        except ServiceError as error:
            raise urllib.error.URLError("unsafe redirect blocked") from error
        return super().redirect_request(request, file, code, message, headers, new_url)


def open_public_url(
    request: urllib.request.Request,
    *,
    timeout: float,
):
    validate_public_url_sync(request.full_url)
    opener = urllib.request.build_opener(PublicRedirectHandler())
    return opener.open(request, timeout=timeout)
