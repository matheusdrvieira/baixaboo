from __future__ import annotations

import asyncio
import logging
import secrets
import shutil
import time
import zipfile
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal, TypedDict

from yt_dlp.utils import DownloadError

from ..errors import ServiceError
from .downloader import (
    PlaylistEntry,
    extract_media_info,
    extract_playlist,
    safe_identifier,
    selected_media_size,
)
from .transfers import prepare_media_file

logger = logging.getLogger(__name__)

JobStatus = Literal["processing", "ready", "downloading", "delivered", "failed"]

TEMP_ROOT = Path("/tmp/baixaboo-downloads")
MAX_CONCURRENT_PREPARATIONS = 10
MAX_ACTIVE_DOWNLOADS_PER_IP = 1
MAX_FILE_BYTES = 15_000_000_000
MAX_PLAYLIST_MEDIA_BYTES = 15_000_000_000
MAX_PLAYLIST_TEMP_BYTES = 31_000_000_000
MAX_TEMP_BYTES = 80_000_000_000
MIN_FREE_BYTES = 5_000_000_000
READY_TTL_SECONDS = 15 * 60
DOWNLOADING_TTL_SECONDS = 6 * 60 * 60
DELIVERED_TTL_SECONDS = 5 * 60
FAILED_TTL_SECONDS = 5 * 60
CLEANUP_INTERVAL_SECONDS = 30
PLAYLIST_DOWNLOAD_CONCURRENCY = 2


class JobSnapshot(TypedDict):
    id: str
    status: JobStatus
    progress: int
    filename: str | None
    error: str | None


@dataclass(slots=True)
class DownloadJob:
    id: str
    url: str
    session_id: str
    client_ip: str
    created_at: float
    updated_at: float
    playlist: bool = False
    status: JobStatus = "processing"
    progress: int = 1
    filename: str | None = None
    path: Path | None = None
    error: str | None = None
    reserved_bytes: int = 0

    def snapshot(self) -> JobSnapshot:
        return {
            "id": self.id,
            "status": self.status,
            "progress": self.progress,
            "filename": self.filename,
            "error": self.error,
        }


class PreparationManager:
    def __init__(self) -> None:
        self._jobs: dict[str, DownloadJob] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._lock: asyncio.Lock | None = None
        self._semaphore: asyncio.Semaphore | None = None
        self._cleanup_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_PREPARATIONS)
        await asyncio.to_thread(self._reset_temp_root)
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._cleanup_task
        for task in self._tasks.values():
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)
        await asyncio.to_thread(self._reset_temp_root)

    async def create(
        self,
        url: str,
        *,
        session_id: str,
        client_ip: str,
        playlist: bool = False,
    ) -> JobSnapshot:
        lock = self._require_lock()
        async with lock:
            active_statuses = {"processing", "ready", "downloading"}
            if any(
                job.session_id == session_id and job.status in active_statuses
                for job in self._jobs.values()
            ):
                raise ServiceError("rate_limited", 429)

            active_for_ip = sum(
                job.client_ip == client_ip and job.status in active_statuses
                for job in self._jobs.values()
            )
            if active_for_ip >= MAX_ACTIVE_DOWNLOADS_PER_IP:
                raise ServiceError("rate_limited", 429)

            active = sum(job.status == "processing" for job in self._jobs.values())
            if active >= MAX_CONCURRENT_PREPARATIONS:
                raise ServiceError("rate_limited", 429)

            token = secrets.token_urlsafe(24)
            now = time.monotonic()
            job = DownloadJob(
                id=token,
                url=url,
                session_id=session_id,
                client_ip=client_ip,
                created_at=now,
                updated_at=now,
                playlist=playlist,
            )
            self._jobs[token] = job
            task = asyncio.create_task(self._run(job))
            self._tasks[token] = task
            task.add_done_callback(lambda _task, job_id=token: self._tasks.pop(job_id, None))
            return job.snapshot()

    async def get(self, token: str, session_id: str) -> JobSnapshot:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if job is None or job.session_id != session_id:
                raise ServiceError("unavailable", 404)
            return job.snapshot()

    async def active(self, session_id: str) -> JobSnapshot:
        lock = self._require_lock()
        async with lock:
            for job in self._jobs.values():
                if job.session_id == session_id and job.status in {
                    "processing",
                    "ready",
                    "downloading",
                }:
                    return job.snapshot()
        raise ServiceError("unavailable", 404)

    async def file(self, token: str, session_id: str) -> tuple[Path, str]:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if (
                job is None
                or job.session_id != session_id
                or job.status not in {"ready", "downloading", "delivered"}
            ):
                raise ServiceError("unavailable", 404)
            if job.path is None or job.filename is None or not job.path.is_file():
                raise ServiceError("unavailable", 404)
            if job.status == "ready":
                job.status = "downloading"
                job.updated_at = time.monotonic()
            return job.path, job.filename

    async def mark_delivered(self, token: str) -> None:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if job is not None and job.status in {"ready", "downloading"}:
                job.status = "delivered"
                job.updated_at = time.monotonic()

    async def _run(self, job: DownloadJob) -> None:
        semaphore = self._require_semaphore()
        async with semaphore:
            self._update(job.id, status="processing", progress=1)
            job_directory = TEMP_ROOT / job.id
            try:
                if job.playlist:
                    await self._run_playlist(job, job_directory)
                    return
                info = await asyncio.to_thread(extract_media_info, job.url)
                total_bytes = await asyncio.to_thread(selected_media_size, info)
                if total_bytes > MAX_FILE_BYTES:
                    raise ServiceError("file_too_large", 413)
                await self._reserve(job.id, MAX_FILE_BYTES)
                media_id = safe_identifier(str(info.get("id") or "media"))
                job_directory.mkdir(parents=True, exist_ok=False, mode=0o700)
                loop = asyncio.get_running_loop()
                path = await asyncio.to_thread(
                    self._prepare_file,
                    job,
                    job_directory,
                    media_id,
                    loop,
                    media_info=info,
                    total_bytes=total_bytes,
                )
                actual_size = path.stat().st_size
                if actual_size > MAX_FILE_BYTES:
                    raise ServiceError("file_too_large", 413)
                self._update(
                    job.id,
                    status="ready",
                    progress=100,
                    filename=path.name,
                    path=path,
                    reserved_bytes=actual_size,
                )
            except asyncio.CancelledError:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                raise
            except ServiceError as error:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                self._update(job.id, status="failed", error=error.code, reserved_bytes=0)
            except DownloadError as error:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                logger.warning("Media download rejected (job=%s): %s", job.id, error)
                self._update(
                    job.id,
                    status="failed",
                    error="unsupported_source",
                    reserved_bytes=0,
                )
            except Exception:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                logger.exception("Unexpected media preparation failure (job=%s)", job.id)
                self._update(
                    job.id,
                    status="failed",
                    error="service_unavailable",
                    reserved_bytes=0,
                )

    async def _run_playlist(self, job: DownloadJob, job_directory: Path) -> None:
        playlist = await asyncio.to_thread(extract_playlist, job.url)
        await self._reserve(
            job.id,
            MAX_PLAYLIST_TEMP_BYTES,
            limit=MAX_PLAYLIST_TEMP_BYTES,
        )
        videos_directory = job_directory / "videos"
        videos_directory.mkdir(parents=True, exist_ok=False)
        loop = asyncio.get_running_loop()
        semaphore = asyncio.Semaphore(PLAYLIST_DOWNLOAD_CONCURRENCY)
        entry_progress = [0] * len(playlist.entries)

        def report_entry_progress(entry_index: int, progress: int) -> None:
            entry_progress[entry_index] = max(entry_progress[entry_index], progress)
            total_progress = 2 + int(sum(entry_progress) * 88 / (len(entry_progress) * 100))
            self._update_progress(job.id, min(90, total_progress))

        async def prepare_entry(index: int, entry: PlaylistEntry) -> Path:
            async with semaphore:
                path = await asyncio.to_thread(
                    self._prepare_file,
                    job,
                    videos_directory,
                    safe_identifier(Path(entry["filename"]).stem),
                    loop,
                    url=entry["url"],
                    size_limit=MAX_PLAYLIST_MEDIA_BYTES,
                    progress_callback=lambda progress: loop.call_soon_threadsafe(
                        report_entry_progress,
                        index - 1,
                        progress,
                    ),
                )
                report_entry_progress(index - 1, 100)
                return path

        results = await asyncio.gather(
            *(
                prepare_entry(index, entry)
                for index, entry in enumerate(playlist.entries, start=1)
            ),
            return_exceptions=True,
        )
        error = next((result for result in results if isinstance(result, BaseException)), None)
        if error is not None:
            raise error
        self._update_progress(job.id, 95)
        archive_path = job_directory / f"baixaboo-{playlist.playlist_id}.zip"
        await asyncio.to_thread(self._create_zip, archive_path, videos_directory)
        await asyncio.to_thread(shutil.rmtree, videos_directory, True)
        actual_size = archive_path.stat().st_size
        if actual_size > MAX_PLAYLIST_MEDIA_BYTES:
            raise ServiceError("file_too_large", 413)
        self._update(
            job.id,
            status="ready",
            progress=100,
            filename=archive_path.name,
            path=archive_path,
            reserved_bytes=actual_size,
        )

    async def _reserve(
        self,
        token: str,
        estimated_bytes: int,
        *,
        limit: int = MAX_FILE_BYTES,
    ) -> None:
        reservation = max(estimated_bytes, 1_000_000_000)
        if reservation > limit:
            raise ServiceError("file_too_large", 413)

        lock = self._require_lock()
        async with lock:
            reserved = sum(job.reserved_bytes for job in self._jobs.values())
            free = shutil.disk_usage(TEMP_ROOT).free
            if reserved + reservation > MAX_TEMP_BYTES or free < reservation + MIN_FREE_BYTES:
                raise ServiceError("service_unavailable", 503)
            job = self._jobs.get(token)
            if job is None:
                raise ServiceError("unavailable", 404)
            job.reserved_bytes = reservation
            job.updated_at = time.monotonic()

    def _prepare_file(
        self,
        job: DownloadJob,
        directory: Path,
        media_id: str,
        loop: asyncio.AbstractEventLoop,
        url: str | None = None,
        size_limit: int = MAX_FILE_BYTES,
        progress_callback: Callable[[int], None] | None = None,
        media_info: dict[str, object] | None = None,
        total_bytes: int = 0,
    ) -> Path:
        info = media_info or extract_media_info(url or job.url)
        if total_bytes <= 0:
            total_bytes = selected_media_size(info)
        if total_bytes > size_limit:
            raise ServiceError("file_too_large", 413)

        def report(progress: int) -> None:
            if progress_callback is None:
                loop.call_soon_threadsafe(self._update_progress, job.id, progress)
            else:
                progress_callback(progress)

        def check_disk() -> None:
            if self._directory_size(directory) > size_limit:
                raise ServiceError("file_too_large", 413)

        return prepare_media_file(
            url=url or job.url,
            info=info,
            directory=directory,
            output_stem=f"baixaboo-{media_id}",
            size_limit=size_limit,
            progress_callback=report,
            disk_check=check_disk,
        )

    @staticmethod
    def _create_zip(archive_path: Path, videos_directory: Path) -> None:
        with zipfile.ZipFile(archive_path, mode="w", allowZip64=True) as archive:
            for video in sorted(videos_directory.iterdir()):
                if video.is_file():
                    archive.write(video, arcname=video.name, compress_type=zipfile.ZIP_STORED)

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            now = time.monotonic()
            expired: list[str] = []
            lock = self._require_lock()
            async with lock:
                for token, job in self._jobs.items():
                    age = now - job.updated_at
                    if job.status == "ready" and age >= READY_TTL_SECONDS:
                        expired.append(token)
                    elif job.status == "downloading" and age >= DOWNLOADING_TTL_SECONDS:
                        expired.append(token)
                    elif job.status == "delivered" and age >= DELIVERED_TTL_SECONDS:
                        expired.append(token)
                    elif job.status == "failed" and age >= FAILED_TTL_SECONDS:
                        expired.append(token)
                jobs = [self._jobs.pop(token) for token in expired]
            for job in jobs:
                await asyncio.to_thread(shutil.rmtree, TEMP_ROOT / job.id, True)

    def _update_progress(self, token: str, progress: int) -> None:
        job = self._jobs.get(token)
        if job is not None and job.status == "processing":
            job.progress = max(job.progress, progress)
            job.updated_at = time.monotonic()

    def _update(
        self,
        token: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        filename: str | None = None,
        path: Path | None = None,
        error: str | None = None,
        reserved_bytes: int | None = None,
    ) -> None:
        job = self._jobs.get(token)
        if job is None:
            return
        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = progress
        if filename is not None:
            job.filename = filename
        if path is not None:
            job.path = path
        if error is not None:
            job.error = error
        if reserved_bytes is not None:
            job.reserved_bytes = reserved_bytes
        job.updated_at = time.monotonic()

    @staticmethod
    def _directory_size(directory: Path) -> int:
        total = 0
        for media_path in directory.rglob("*"):
            try:
                if media_path.is_file():
                    total += media_path.stat().st_size
            except FileNotFoundError:
                # Fragment downloads create and remove part files concurrently.
                continue
        return total

    @staticmethod
    def _reset_temp_root() -> None:
        shutil.rmtree(TEMP_ROOT, ignore_errors=True)
        TEMP_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)

    def _require_lock(self) -> asyncio.Lock:
        if self._lock is None:
            raise RuntimeError("Preparation manager is not running")
        return self._lock

    def _require_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            raise RuntimeError("Preparation manager is not running")
        return self._semaphore


preparation_manager = PreparationManager()
