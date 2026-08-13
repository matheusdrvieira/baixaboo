from __future__ import annotations

from typing import Any
from urllib.parse import urlparse


def build_analysis(url: str, info: dict[str, Any]) -> dict[str, Any]:
    host = (urlparse(url).hostname or "fonte externa").removeprefix("www.")
    selected_formats = info.get("requested_formats") or [info]
    video_format = next((item for item in selected_formats if has_video(item)), None)
    audio_format_info = next((item for item in selected_formats if has_audio(item)), None)
    primary_format = video_format or audio_format_info or info
    extension = str(primary_format.get("ext") or info.get("ext") or "mp4").lower()
    estimated_bytes = sum(
        int(item.get("filesize") or item.get("filesize_approx") or 0)
        for item in selected_formats
    )
    duration = int(info.get("duration") or 0)
    height = int((video_format or {}).get("height") or info.get("height") or 0)
    contains_video = video_format is not None

    video_options: list[dict[str, Any]] = []
    audio_options: list[dict[str, Any]] = []
    if contains_video:
        video_options.append(
            {
                "id": "best",
                "resolution": f"{height}p" if height else "best",
                "label": "Melhor arquivo disponível até 1080p",
                "container": "MP4",
                "codec": str((video_format or {}).get("vcodec") or "Original"),
                "fps": int((video_format or {}).get("fps") or 0) or None,
                "hasAudio": audio_format_info is not None,
                "requiresMux": len(selected_formats) > 1,
                "estimatedBytes": estimated_bytes,
                "estimatedSeconds": 0,
                "compatibility": (
                    "Vídeo e áudio em até 1080p, unidos durante a transmissão."
                ),
            }
        )
    else:
        audio_options.append(
            {
                "id": "best-audio",
                "format": audio_format(extension),
                "label": "Melhor áudio disponível",
                "bitrates": [],
                "lossless": extension in {"flac", "wav"},
                "supportsCover": False,
                "estimatedBytesPerMinute": 0,
                "compatibility": "Transmitido pelo serviço yt-dlp sem persistência.",
            }
        )

    result: dict[str, Any] = {
        "id": str(info.get("id") or "yt-dlp-stream"),
        "title": str(info.get("title") or "Mídia autorizada"),
        "author": str(info.get("uploader") or info.get("channel") or host),
        "durationSeconds": duration,
        "source": {"id": "yt-dlp", "label": host, "kind": "video-platform"},
        "bestResolution": f"{height}p" if height else "Original",
        "estimatedBytes": estimated_bytes,
        "mediaType": "Vídeo" if contains_video else "Áudio",
        "videoOptions": video_options,
        "audioOptions": audio_options,
    }
    if info.get("thumbnail"):
        result["thumbnailUrl"] = str(info["thumbnail"])
    upload_date = str(info.get("upload_date") or "")
    if len(upload_date) == 8:
        result["publishedAt"] = (
            f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00Z"
        )
    return result


def has_video(media_format: dict[str, Any]) -> bool:
    video_codec = media_format.get("vcodec")
    if video_codec not in {None, "none"}:
        return True
    return str(media_format.get("ext") or "").lower() in {
        "mp4",
        "webm",
        "mov",
        "mkv",
        "flv",
        "m4v",
    }


def has_audio(media_format: dict[str, Any]) -> bool:
    audio_codec = media_format.get("acodec")
    if audio_codec not in {None, "none"}:
        return True
    extension = str(media_format.get("ext") or "").lower()
    if audio_codec is None and extension in {"mp4", "webm", "mov", "mkv"}:
        return True
    return extension in {"mp3", "m4a", "aac", "wav", "flac", "ogg", "opus"}


def audio_format(extension: str) -> str:
    return {
        "mp3": "MP3",
        "m4a": "M4A",
        "aac": "AAC",
        "wav": "WAV",
        "flac": "FLAC",
        "ogg": "OGG",
        "opus": "OPUS",
    }.get(extension, "M4A")
