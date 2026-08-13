import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

from ..errors import ServiceError


async def validate_public_url(value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
        raise ServiceError("invalid_url", 400)

    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo,
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as error:
        raise ServiceError("unavailable") from error

    if any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
        raise ServiceError("invalid_url", 400)
