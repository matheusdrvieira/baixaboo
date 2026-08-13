import asyncio
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import Request

from .config import settings
from .errors import ServiceError
from .services.sessions import client_ip

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def normalized_origin(value: str) -> tuple[str, str, int] | None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError:
        return None
    return parsed.scheme, parsed.hostname.lower(), port


FRONTEND_ORIGIN = normalized_origin(str(settings.frontend_url))


async def require_frontend_origin(request: Request) -> None:
    if request.method not in UNSAFE_METHODS:
        return
    origin = request.headers.get("Origin")
    if origin is None or normalized_origin(origin) != FRONTEND_ORIGIN:
        raise ServiceError("forbidden_origin", 403)


class SlidingWindowRateLimiter:
    def __init__(self, requests: int, window_seconds: int) -> None:
        self.requests = requests
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock: asyncio.Lock | None = None

    async def __call__(self, request: Request) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        key = client_ip(request)
        lock = self._lock
        if lock is None:
            lock = self._lock = asyncio.Lock()

        async with lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.requests:
                raise ServiceError("rate_limited", 429)
            events.append(now)
            if len(self._events) > 10_000:
                self._events = defaultdict(
                    deque,
                    {
                        address: timestamps
                        for address, timestamps in self._events.items()
                        if timestamps and timestamps[-1] > cutoff
                    },
                )


analyze_rate_limit = SlidingWindowRateLimiter(requests=12, window_seconds=60)
download_rate_limit = SlidingWindowRateLimiter(requests=6, window_seconds=5 * 60)
process_rate_limit = SlidingWindowRateLimiter(requests=6, window_seconds=5 * 60)
