import asyncio
import ipaddress
import re
import socket
import urllib.request
from urllib.parse import parse_qs, urljoin, urlparse

from ..errors import ServiceError

ALLOWED_PORTS = {80, 443}
YOUTUBE_HOSTNAMES = {
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
}
YOUTUBE_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_PLAYLIST_ID = re.compile(r"^[A-Za-z0-9_-]{10,100}$")


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


def normalize_download_url(value: str, *, playlist: bool) -> str:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower()
    if (
        hostname not in YOUTUBE_HOSTNAMES
        or parsed.scheme not in {"http", "https"}
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ServiceError("invalid_url", 400)

    try:
        if parsed.port is not None:
            raise ServiceError("invalid_url", 400)
    except ValueError as error:
        raise ServiceError("invalid_url", 400) from error

    query = parse_qs(parsed.query)
    normalized_url: str | None = None
    is_playlist = False

    if hostname == "youtu.be":
        segments = [segment for segment in parsed.path.split("/") if segment]
        video_id = segments[0] if len(segments) == 1 else ""
        if YOUTUBE_VIDEO_ID.fullmatch(video_id) and "list" not in query:
            normalized_url = f"https://www.youtube.com/watch?v={video_id}"
    elif parsed.path.rstrip("/") == "/watch" and "list" not in query:
        video_id = next(iter(query.get("v", [])), "").strip()
        if YOUTUBE_VIDEO_ID.fullmatch(video_id):
            normalized_url = f"https://www.youtube.com/watch?v={video_id}"
    elif parsed.path.rstrip("/") == "/playlist":
        playlist_id = next(iter(query.get("list", [])), "").strip()
        if YOUTUBE_PLAYLIST_ID.fullmatch(playlist_id):
            normalized_url = f"https://www.youtube.com/playlist?list={playlist_id}"
            is_playlist = True

    if normalized_url is None or playlist != is_playlist:
        raise ServiceError("invalid_url", 400)
    return normalized_url


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
