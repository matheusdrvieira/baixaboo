from __future__ import annotations

import time
from pathlib import Path
from typing import Callable

from yt_dlp.utils import DownloadError

from ..errors import ServiceError
from .downloader import (
    DOWNLOAD_FORMAT,
    USE_COOKIES_INFO_KEY,
    common_options,
    media_format_size,
    selected_media_formats,
    youtube_downloader,
)

DOWNLOAD_PROGRESS_START = 2
DOWNLOAD_PROGRESS_END = 90
MERGE_PROGRESS = 95
FRAGMENT_CONCURRENCY = 4


class TransferProgress:
    def __init__(
        self,
        info: dict[str, object],
        callback: Callable[[int], None],
    ) -> None:
        formats = selected_media_formats(info)
        self._callback = callback
        self._format_ids = [str(item.get("format_id") or "") for item in formats]
        self._expected = [media_format_size(item) for item in formats]
        self._completed = [0] * len(formats)
        self._finished = [False] * len(formats)

    def report(self, download: dict[str, object]) -> None:
        info = download.get("info_dict")
        if not isinstance(info, dict):
            return

        format_id = str(info.get("format_id") or "")
        try:
            index = self._format_ids.index(format_id)
        except ValueError:
            return

        status = str(download.get("status") or "")
        completed = int(download.get("downloaded_bytes") or 0)
        total = int(
            download.get("total_bytes")
            or download.get("total_bytes_estimate")
            or self._expected[index]
            or 0
        )
        if total > 0:
            self._expected[index] = max(self._expected[index], total)
            self._completed[index] = max(self._completed[index], min(completed, total))
        if status == "finished":
            self._finished[index] = True
            if self._expected[index] > 0:
                self._completed[index] = self._expected[index]

        self._callback(self._percentage())

    def _percentage(self) -> int:
        if not self._format_ids:
            return DOWNLOAD_PROGRESS_START

        if all(size > 0 for size in self._expected):
            total = sum(self._expected)
            completed = sum(
                min(done, expected)
                for done, expected in zip(self._completed, self._expected, strict=True)
            )
            fraction = completed / total if total else 0
        else:
            fractions = [
                1.0
                if finished
                else (done / expected if expected > 0 else 0.0)
                for done, expected, finished in zip(
                    self._completed,
                    self._expected,
                    self._finished,
                    strict=True,
                )
            ]
            fraction = sum(fractions) / len(fractions)

        span = DOWNLOAD_PROGRESS_END - DOWNLOAD_PROGRESS_START
        return min(DOWNLOAD_PROGRESS_END, DOWNLOAD_PROGRESS_START + int(fraction * span))


def prepare_media_file(
    *,
    url: str,
    info: dict[str, object],
    directory: Path,
    output_stem: str,
    size_limit: int,
    progress_callback: Callable[[int], None],
    disk_check: Callable[[], None],
) -> Path:
    progress = TransferProgress(info, progress_callback)
    last_disk_check = 0.0
    hook_error: ServiceError | None = None

    def report(download: dict[str, object]) -> None:
        nonlocal hook_error, last_disk_check
        progress.report(download)

        now = time.monotonic()
        if now - last_disk_check < 1:
            return
        last_disk_check = now
        try:
            disk_check()
        except ServiceError as error:
            hook_error = error
            raise

    def report_postprocessor(event: dict[str, object]) -> None:
        if event.get("status") in {"started", "processing"}:
            progress_callback(MERGE_PROGRESS)

    progress_callback(DOWNLOAD_PROGRESS_START)
    options = {
        **common_options(),
        "format": DOWNLOAD_FORMAT,
        "outtmpl": str(directory / f"{output_stem}.%(ext)s"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "overwrites": True,
        "continuedl": True,
        "concurrent_fragment_downloads": FRAGMENT_CONCURRENCY,
        "progress_hooks": [report],
        "postprocessor_hooks": [report_postprocessor],
    }

    try:
        with youtube_downloader(
            options,
            use_cookies=bool(info.get(USE_COOKIES_INFO_KEY, True)),
        ) as downloader:
            downloader.extract_info(url, download=True)
    except DownloadError:
        if hook_error is not None:
            raise hook_error
        raise

    if hook_error is not None:
        raise hook_error
    disk_check()
    progress_callback(MERGE_PROGRESS)

    path = _finished_media_path(directory, output_stem)
    if path is None:
        raise ServiceError("unavailable")
    if path.stat().st_size > size_limit:
        raise ServiceError("file_too_large", 413)
    return path


def _finished_media_path(directory: Path, output_stem: str) -> Path | None:
    expected = directory / f"{output_stem}.mp4"
    if expected.is_file():
        return expected

    candidates = [
        path
        for path in directory.glob(f"{output_stem}.*")
        if path.is_file()
        and not path.name.endswith((".part", ".ytdl", ".temp"))
        and not any(part.startswith(".f") for part in path.suffixes[:-1])
    ]
    return candidates[0] if len(candidates) == 1 else None
