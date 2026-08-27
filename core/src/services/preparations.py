from __future__ import annotations

import asyncio
import logging
import secrets
import shutil
import threading
import time
from contextlib import suppress
from dataclasses import dataclass, field as dataclass_field
from pathlib import Path
from typing import Callable, Literal, TypedDict, cast

from ..errors import ServiceError
from .downloader import (
    Playlist,
    PlaylistEntry,
    safe_identifier,
    selected_media_size,
)
from .isolation import (
    create_zip_isolated,
    extract_media_info_isolated,
    extract_playlist_isolated,
    prepare_media_file_isolated,
)

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
METADATA_EXTRACTION_CONCURRENCY = 1
PROCESSING_STALL_SECONDS = 10 * 60
MAX_PREPARATION_RUNTIME_SECONDS = 12 * 60 * 60


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
    revision: int = 0
    event: asyncio.Event = dataclass_field(default_factory=asyncio.Event, repr=False)

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
        self._metadata_semaphore: asyncio.Semaphore | None = None
        self._cleanup_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_PREPARATIONS)
        self._metadata_semaphore = asyncio.Semaphore(METADATA_EXTRACTION_CONCURRENCY)
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

    async def wait_for_change(
        self,
        token: str,
        session_id: str,
        after_revision: int,
        *,
        timeout: float = 15,
    ) -> tuple[JobSnapshot, int] | None:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if job is None or job.session_id != session_id:
                raise ServiceError("unavailable", 404)
            job.event.clear()
            if job.revision != after_revision:
                return job.snapshot(), job.revision

        try:
            await asyncio.wait_for(job.event.wait(), timeout=timeout)
        except TimeoutError:
            return None

        async with lock:
            job = self._jobs.get(token)
            if job is None or job.session_id != session_id:
                raise ServiceError("unavailable", 404)
            return job.snapshot(), job.revision

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
                self._signal(job)
            return job.path, job.filename

    async def mark_delivered(self, token: str) -> None:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if job is not None and job.status in {"ready", "downloading"}:
                job.status = "delivered"
                job.updated_at = time.monotonic()
                self._signal(job)

    async def _run(self, job: DownloadJob) -> None:
        semaphore = self._require_semaphore()
        async with semaphore:
            self._update(job.id, status="processing", progress=1)
            logger.info("Media preparation started (job=%s, playlist=%s)", job.id, job.playlist)
            job_directory = TEMP_ROOT / job.id
            try:
                async with asyncio.timeout(MAX_PREPARATION_RUNTIME_SECONDS):
                    if job.playlist:
                        await self._run_playlist(job, job_directory)
                    else:
                        await self._run_single(job, job_directory)
                logger.info("Media preparation completed (job=%s)", job.id)
            except asyncio.CancelledError:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                raise
            except TimeoutError:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                self._update(job.id, status="failed", error="timeout", reserved_bytes=0)
                logger.warning("Media preparation timed out (job=%s)", job.id)
            except ServiceError as error:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                self._update(job.id, status="failed", error=error.code, reserved_bytes=0)
                logger.warning("Media preparation failed (job=%s, code=%s)", job.id, error.code)
            except Exception:
                await asyncio.to_thread(shutil.rmtree, job_directory, True)
                logger.exception("Unexpected media preparation failure (job=%s)", job.id)
                self._update(
                    job.id,
                    status="failed",
                    error="service_unavailable",
                    reserved_bytes=0,
                )

    async def _run_single(self, job: DownloadJob, job_directory: Path) -> None:
        info = await self._extract_media_info(job.url)
        total_bytes = await asyncio.wait_for(
            asyncio.to_thread(selected_media_size, info),
            timeout=30,
        )
        if total_bytes > MAX_FILE_BYTES:
            raise ServiceError("file_too_large", 413)
        await self._reserve(job.id, MAX_FILE_BYTES)
        media_id = safe_identifier(str(info.get("id") or "media"))
        job_directory.mkdir(parents=True, exist_ok=False, mode=0o700)
        path = await self._prepare_file(
            job,
            job_directory,
            media_id,
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

    async def _run_playlist(self, job: DownloadJob, job_directory: Path) -> None:
        playlist = await self._extract_playlist(job.url)
        await self._reserve(
            job.id,
            MAX_PLAYLIST_TEMP_BYTES,
            limit=MAX_PLAYLIST_TEMP_BYTES,
        )
        videos_directory = job_directory / "videos"
        videos_directory.mkdir(parents=True, exist_ok=False)
        semaphore = asyncio.Semaphore(PLAYLIST_DOWNLOAD_CONCURRENCY)
        entry_progress = [0] * len(playlist.entries)

        def report_entry_progress(entry_index: int, progress: int) -> None:
            entry_progress[entry_index] = max(entry_progress[entry_index], progress)
            total_progress = 2 + int(sum(entry_progress) * 88 / (len(entry_progress) * 100))
            self._update_progress(job.id, min(90, total_progress))

        async def prepare_entry(index: int, entry: PlaylistEntry) -> Path:
            async with semaphore:
                info = await self._extract_media_info(entry["url"])
                path = await self._prepare_file(
                    job=job,
                    directory=videos_directory,
                    media_id=safe_identifier(Path(entry["filename"]).stem),
                    url=entry["url"],
                    size_limit=MAX_PLAYLIST_MEDIA_BYTES,
                    progress_callback=lambda progress: report_entry_progress(index - 1, progress),
                    media_info=info,
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
        await self._run_cancellable_worker(
            create_zip_isolated,
            archive_path,
            videos_directory,
        )
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

    async def _prepare_file(
        self,
        job: DownloadJob,
        directory: Path,
        media_id: str,
        url: str | None = None,
        size_limit: int = MAX_FILE_BYTES,
        progress_callback: Callable[[int], None] | None = None,
        media_info: dict[str, object] | None = None,
        total_bytes: int = 0,
    ) -> Path:
        if media_info is None:
            raise ServiceError("service_unavailable")
        info = media_info
        if total_bytes <= 0:
            total_bytes = await asyncio.wait_for(
                asyncio.to_thread(selected_media_size, info),
                timeout=30,
            )
        if total_bytes > size_limit:
            raise ServiceError("file_too_large", 413)

        def report_on_event_loop(progress: int) -> None:
            if progress_callback is None:
                self._update_progress(job.id, progress)
            else:
                progress_callback(progress)

        loop = asyncio.get_running_loop()
        result = await self._run_cancellable_worker(
            prepare_media_file_isolated,
            url=url or job.url,
            info=info,
            directory=directory,
            output_stem=f"baixaboo-{media_id}",
            size_limit=size_limit,
            progress_callback=lambda progress: loop.call_soon_threadsafe(
                report_on_event_loop,
                progress,
            ),
        )
        return cast(Path, result)

    async def _extract_media_info(self, url: str) -> dict[str, object]:
        semaphore = self._require_metadata_semaphore()
        async with semaphore:
            result = await self._run_cancellable_worker(extract_media_info_isolated, url)
        return cast(dict[str, object], result)

    async def _extract_playlist(self, url: str) -> Playlist:
        semaphore = self._require_metadata_semaphore()
        async with semaphore:
            result = await self._run_cancellable_worker(extract_playlist_isolated, url)
        return cast(Playlist, result)

    @staticmethod
    async def _run_cancellable_worker(
        function: Callable[..., object],
        *args: object,
        **kwargs: object,
    ) -> object:
        cancel_event = threading.Event()
        worker = asyncio.create_task(
            asyncio.to_thread(
                function,
                *args,
                cancel_event=cancel_event,
                **kwargs,
            )
        )
        try:
            return await asyncio.shield(worker)
        except asyncio.CancelledError:
            cancel_event.set()
            with suppress(Exception):
                await asyncio.wait_for(asyncio.shield(worker), timeout=5)
            raise

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            now = time.monotonic()
            expired: list[str] = []
            stalled: list[DownloadJob] = []
            stalled_tasks: list[asyncio.Task[None]] = []
            lock = self._require_lock()
            async with lock:
                for token, job in self._jobs.items():
                    age = now - job.updated_at
                    runtime = now - job.created_at
                    if job.status == "processing" and (
                        age >= PROCESSING_STALL_SECONDS
                        or runtime >= MAX_PREPARATION_RUNTIME_SECONDS
                    ):
                        job.status = "failed"
                        job.error = "timeout"
                        job.reserved_bytes = 0
                        job.updated_at = now
                        self._signal(job)
                        stalled.append(job)
                        task = self._tasks.get(token)
                        if task is not None:
                            stalled_tasks.append(task)
                    elif job.status == "ready" and age >= READY_TTL_SECONDS:
                        expired.append(token)
                    elif job.status == "downloading" and age >= DOWNLOADING_TTL_SECONDS:
                        expired.append(token)
                    elif job.status == "delivered" and age >= DELIVERED_TTL_SECONDS:
                        expired.append(token)
                    elif job.status == "failed" and age >= FAILED_TTL_SECONDS:
                        expired.append(token)
                jobs = [self._jobs.pop(token) for token in expired]
            for task in stalled_tasks:
                task.cancel()
            if stalled_tasks:
                await asyncio.gather(*stalled_tasks, return_exceptions=True)
            for job in stalled:
                await asyncio.to_thread(shutil.rmtree, TEMP_ROOT / job.id, True)
            for job in jobs:
                await asyncio.to_thread(shutil.rmtree, TEMP_ROOT / job.id, True)

    def _update_progress(self, token: str, progress: int) -> None:
        job = self._jobs.get(token)
        if job is not None and job.status == "processing":
            next_progress = max(job.progress, progress)
            changed = next_progress != job.progress
            job.progress = next_progress
            job.updated_at = time.monotonic()
            if changed:
                self._signal(job)

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
        self._signal(job)

    def _signal(self, job: DownloadJob) -> None:
        job.revision += 1
        job.event.set()

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

    def _require_metadata_semaphore(self) -> asyncio.Semaphore:
        if self._metadata_semaphore is None:
            raise RuntimeError("Preparation manager is not running")
        return self._metadata_semaphore


preparation_manager = PreparationManager()
