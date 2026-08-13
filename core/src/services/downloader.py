from __future__ import annotations

import shutil
import tempfile
import urllib.error
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, TypedDict

import yt_dlp

from ..config import settings
from ..errors import ServiceError

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


YOUTUBE_CLIENT = "mweb"
PLAYER_CLIENT_INFO_KEY = "_baixaboo_player_client"


def common_options(player_client: str = YOUTUBE_CLIENT) -> dict[str, Any]:
    return {
        "js_runtimes": {"node": {}},
        "extractor_args": {
            "youtube": {"player_client": [player_client]},
            "youtubepot-bgutilhttp": {
                "base_url": [str(settings.pot_provider_url).rstrip("/")],
            },
        },
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 20,
    }


@contextmanager
def youtube_downloader(options: dict[str, Any]) -> Iterator[yt_dlp.YoutubeDL]:
    source = settings.ytdlp_cookies_file
    if source is None:
        with yt_dlp.YoutubeDL(options) as downloader:
            yield downloader
        return
    if not source.is_file():
        raise ServiceError("service_misconfigured", 503)

    with tempfile.TemporaryDirectory(prefix="baixaboo-cookies-") as directory:
        cookie_path = Path(directory) / "cookies.txt"
        shutil.copyfile(source, cookie_path)
        cookie_path.chmod(0o600)
        with yt_dlp.YoutubeDL({**options, "cookiefile": str(cookie_path)}) as downloader:
            yield downloader


def extract_media_info(url: str) -> dict[str, Any]:
    options = {
        **common_options(),
        "format": DOWNLOAD_FORMAT,
        "noplaylist": True,
        "skip_download": True,
    }
    with youtube_downloader(options) as downloader:
        info = downloader.extract_info(url, download=False)

    if not isinstance(info, dict) or info.get("_type") in {"playlist", "multi_video"}:
        raise ServiceError("unsupported_source")
    info[PLAYER_CLIENT_INFO_KEY] = YOUTUBE_CLIENT
    return info


def selected_media_size(info: dict[str, Any]) -> int:
    sizes = [media_format_size(media_format) for media_format in selected_media_formats(info)]
    return sum(sizes) if all(size > 0 for size in sizes) else 0


def selected_media_formats(info: dict[str, Any]) -> list[dict[str, Any]]:
    formats = info.get("requested_formats") or [info]
    return [media_format for media_format in formats if isinstance(media_format, dict)]


def media_format_size(media_format: dict[str, Any]) -> int:
    exact_size = int(media_format.get("filesize") or 0)
    return exact_size if exact_size > 0 else remote_file_size(media_format)


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
        with urllib.request.urlopen(request, timeout=10) as response:
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
    with youtube_downloader(options) as downloader:
        info = downloader.extract_info(url, download=False)

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
