from __future__ import annotations

import logging
import shutil
import tempfile
import urllib.error
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, TypedDict
from urllib.parse import urljoin

import yt_dlp
from yt_dlp.networking._urllib import RedirectHandler, UrllibRH
from yt_dlp.networking.exceptions import RequestError

from ..config import settings
from ..errors import ServiceError
from .url_guard import open_public_url, validate_public_url_sync

logger = logging.getLogger(__name__)

DOWNLOAD_FORMAT = (
    "bestvideo[height<=?1080][ext=mp4]+bestaudio[ext=m4a]/"
    "best[height<=?1080][ext=mp4]/"
    "bestvideo[height<=?1080]+bestaudio/"
    "best[height<=?1080]"
)
MAX_PLAYLIST_ITEMS = 100


class PlaylistEntry(TypedDict):
    url: str
    filename: str


@dataclass(slots=True)
class Playlist:
    entries: list[PlaylistEntry]
    playlist_id: str


TRANSFER_FORMAT_FIELDS = {
    "filesize",
    "filesize_approx",
    "format_id",
    "http_headers",
    "url",
}
USE_COOKIES_INFO_KEY = "_baixaboo_use_cookies"


class SafeRedirectHandler(RedirectHandler):
    handler_order = 499

    def redirect_request(self, request, file, code, message, headers, new_url):
        try:
            validate_public_url_sync(urljoin(request.full_url, new_url))
        except ServiceError as error:
            raise urllib.error.URLError("unsafe redirect blocked") from error
        return super().redirect_request(request, file, code, message, headers, new_url)


class SafeUrllibRH(UrllibRH):
    def _create_instance(self, proxies, cookiejar, legacy_ssl_support=None):
        opener = super()._create_instance(proxies, cookiejar, legacy_ssl_support)
        opener.add_handler(SafeRedirectHandler())
        return opener

    def _send(self, request):
        try:
            validate_public_url_sync(request.url)
        except ServiceError as error:
            raise RequestError("unsafe request blocked", cause=error) from error
        return super()._send(request)


class SafeYoutubeDL(yt_dlp.YoutubeDL):
    def build_request_director(self, handlers, preferences=None):
        safe_handlers = [SafeUrllibRH if handler is UrllibRH else handler for handler in handlers]
        return super().build_request_director(safe_handlers, preferences)


def common_options() -> dict[str, Any]:
    return {
        "js_runtimes": {"node": {}},
        "quiet": True,
        "noprogress": True,
        "no_warnings": True,
        "socket_timeout": 30,
        "retries": 10,
        "fragment_retries": 10,
        "cachedir": False,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        },
    }


@contextmanager
def youtube_downloader(
    options: dict[str, Any],
    *,
    use_cookies: bool = True,
) -> Iterator[yt_dlp.YoutubeDL]:
    source = settings.ytdlp_cookies_file
    if source is None or not use_cookies:
        with SafeYoutubeDL(options) as downloader:
            yield downloader
        return
    if not source.is_file():
        raise ServiceError("service_misconfigured", 503)

    with tempfile.TemporaryDirectory(prefix="baixaboo-cookies-") as directory:
        cookie_path = Path(directory) / "cookies.txt"
        shutil.copyfile(source, cookie_path)
        cookie_path.chmod(0o600)
        with SafeYoutubeDL({**options, "cookiefile": str(cookie_path)}) as downloader:
            yield downloader


def extract_media_info(url: str) -> dict[str, Any]:
    options = {
        **common_options(),
        "format": DOWNLOAD_FORMAT,
        "noplaylist": True,
        "skip_download": True,
    }
    info, used_cookies = _extract_with_cookie_retry(url, options)

    if not isinstance(info, dict) or info.get("_type") in {"playlist", "multi_video"}:
        raise ServiceError("unsupported_source")
    selected_formats = info.get("requested_formats") or [info]
    compact_formats = [
        {
            key: value
            for key, value in media_format.items()
            if key in TRANSFER_FORMAT_FIELDS
        }
        for media_format in selected_formats
        if isinstance(media_format, dict)
    ]
    if not compact_formats:
        raise ServiceError("unavailable")
    return {
        "id": info.get("id"),
        USE_COOKIES_INFO_KEY: used_cookies,
        "requested_formats": compact_formats,
    }


def _extract_with_cookie_retry(
    url: str,
    options: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    has_cookies = settings.ytdlp_cookies_file is not None
    attempts = (True, False) if has_cookies else (False,)

    for use_cookies in attempts:
        try:
            with youtube_downloader(options, use_cookies=use_cookies) as downloader:
                info = downloader.extract_info(url, download=False)
            if not isinstance(info, dict):
                raise ServiceError("unavailable")
            return info, use_cookies
        except yt_dlp.utils.DownloadError:
            if use_cookies:
                logger.warning("Authenticated YouTube extraction failed; retrying without cookies")
                continue
            raise

    raise ServiceError("unavailable")


def selected_media_size(info: dict[str, Any]) -> int:
    sizes = [media_format_size(media_format) for media_format in selected_media_formats(info)]
    return sum(sizes) if all(size > 0 for size in sizes) else 0


def selected_media_formats(info: dict[str, Any]) -> list[dict[str, Any]]:
    formats = info.get("requested_formats") or [info]
    return [media_format for media_format in formats if isinstance(media_format, dict)]


def media_format_size(media_format: dict[str, Any]) -> int:
    exact_size = int(media_format.get("filesize") or 0)
    if exact_size > 0:
        return exact_size
    approximate_size = int(media_format.get("filesize_approx") or 0)
    return approximate_size if approximate_size > 0 else remote_file_size(media_format)


def remote_file_size(media_format: dict[str, Any]) -> int:
    url = media_format.get("url")
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return 0
    headers = {
        str(key): str(value)
        for key, value in (media_format.get("http_headers") or {}).items()
        if value is not None
    }
    try:
        request = urllib.request.Request(url, headers=headers, method="HEAD")
        with open_public_url(request, timeout=10) as response:
            return int(response.headers.get("Content-Length") or 0)
    except (OSError, ValueError, urllib.error.URLError):
        return 0


def extract_playlist(url: str) -> Playlist:
    options = {
        **common_options(),
        "extract_flat": "in_playlist",
        "skip_download": True,
        "yesplaylist": True,
        "playlistend": MAX_PLAYLIST_ITEMS,
    }
    info, _ = _extract_with_cookie_retry(url, options)

    if not isinstance(info, dict) or info.get("_type") != "playlist":
        raise ServiceError("unsupported_source")

    entries: list[PlaylistEntry] = []
    for index, item in enumerate(info.get("entries") or [], start=1):
        if not isinstance(item, dict):
            continue
        entry_url = playlist_entry_url(item)
        if entry_url is not None:
            entries.append(
                {
                    "url": entry_url,
                    "filename": f"{index:02d}-{safe_filename(str(item.get('title') or 'video'))}.mp4",
                }
            )

    if not entries:
        raise ServiceError("unavailable")
    return Playlist(
        entries=entries,
        playlist_id=safe_identifier(str(info.get("id") or "playlist")),
    )


def playlist_entry_url(item: dict[str, Any]) -> str | None:
    for key in ("webpage_url", "original_url", "url"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            return value

    video_id = item.get("id")
    extractor = str(item.get("ie_key") or item.get("extractor_key") or "").lower()
    if isinstance(video_id, str) and "youtube" in extractor:
        return f"https://www.youtube.com/watch?v={video_id}"
    return None


def safe_filename(value: str) -> str:
    safe = "".join(
        character if character.isalnum() or character in " ._-" else "-"
        for character in value
    )
    return (" ".join(safe.split()).strip(" .-") or "video")[:120]


def safe_identifier(value: str) -> str:
    safe = "".join(
        character if character.isascii() and character.isalnum() else "-"
        for character in value
    )
    return safe.strip("-")[:120] or "media"
