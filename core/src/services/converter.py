from __future__ import annotations

import asyncio
import json
import logging
import secrets
import shutil
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, TypedDict, cast
from urllib.parse import unquote

from fastapi import Request

from ..errors import ServiceError

AudioFormat = Literal["mp3", "m4a", "wav", "flac", "aac", "ogg"]
VideoFormat = Literal["mp4", "webm", "mov", "mkv"]
OutputFormat = AudioFormat | VideoFormat
Operation = Literal["extract-audio", "extract-video", "convert-audio", "convert-video"]
ProcessStatus = Literal["processing", "ready", "downloading", "delivered", "failed"]

AUDIO_FORMATS = {"mp3", "m4a", "wav", "flac", "aac", "ogg"}
VIDEO_FORMATS = {"mp4", "webm", "mov", "mkv"}
OPERATIONS = {"extract-audio", "extract-video", "convert-audio", "convert-video"}
MAX_FILE_BYTES = 1_500_000_000
MAX_CONCURRENT_PROCESSES = 4
MAX_ACTIVE_PROCESSES_PER_IP = 1
UPLOAD_CHUNK_BYTES = 1024 * 1024
READY_TTL_SECONDS = 15 * 60
DELIVERED_TTL_SECONDS = 5 * 60
FAILED_TTL_SECONDS = 5 * 60
CLEANUP_INTERVAL_SECONDS = 30
TEMP_ROOT = Path("/tmp/baixaboo-processes")
logger = logging.getLogger(__name__)


class ProcessSnapshot(TypedDict):
    id: str
    status: ProcessStatus
    progress: int
    filename: str | None
    error: str | None
    operation: Operation
    output_format: str


@dataclass(slots=True)
class ProcessJob:
    id: str
    session_id: str
    client_ip: str
    operation: Operation
    output_format: str
    filename: str
    media_type: str
    directory: Path
    input_path: Path
    output_path: Path
    created_at: float
    updated_at: float
    status: ProcessStatus = "processing"
    progress: int = 1
    error: str | None = None
    process: asyncio.subprocess.Process | None = None

    def snapshot(self) -> ProcessSnapshot:
        return {
            "id": self.id,
            "status": self.status,
            "progress": self.progress,
            "filename": self.filename if self.status in {"ready", "downloading", "delivered"} else None,
            "error": self.error,
            "operation": self.operation,
            "output_format": self.output_format,
        }


class ProcessManager:
    def __init__(self) -> None:
        self._jobs: dict[str, ProcessJob] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._lock: asyncio.Lock | None = None
        self._semaphore: asyncio.Semaphore | None = None
        self._cleanup_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_PROCESSES)
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
        request: Request,
        operation: str,
        output_format: str,
        session_id: str,
        client_ip: str,
    ) -> ProcessSnapshot:
        operation = operation.lower()
        output_format = output_format.lower()
        if operation not in OPERATIONS or not allowed_format(operation, output_format):
            raise ServiceError("unsupported_format", 400)

        expected_bytes = content_length(request)
        lock = self._require_lock()
        async with lock:
            if any(
                job.session_id == session_id
                and job.status in {"processing", "ready", "downloading"}
                for job in self._jobs.values()
            ):
                raise ServiceError("rate_limited", 429)
            active_for_ip = sum(
                job.client_ip == client_ip
                and job.status in {"processing", "ready", "downloading"}
                for job in self._jobs.values()
            )
            if active_for_ip >= MAX_ACTIVE_PROCESSES_PER_IP:
                raise ServiceError("rate_limited", 429)
            active = sum(job.status == "processing" for job in self._jobs.values())
            if active >= MAX_CONCURRENT_PROCESSES:
                raise ServiceError("rate_limited", 429)

            token = secrets.token_urlsafe(24)
            directory = TEMP_ROOT / token
            directory.mkdir(parents=True, exist_ok=False, mode=0o700)
            source_name = request.headers.get("x-file-name", "media")
            now = time.monotonic()
            job = ProcessJob(
                id=token,
                session_id=session_id,
                client_ip=client_ip,
                operation=cast(Operation, operation),
                output_format=output_format,
                filename=output_filename(source_name, output_format),
                media_type=content_type(output_format),
                directory=directory,
                input_path=directory / "input.media",
                output_path=directory / f"output.{output_format}",
                created_at=now,
                updated_at=now,
            )
            self._jobs[token] = job

        try:
            received_bytes = await save_upload(request, job.input_path)
            if received_bytes == 0 or (
                expected_bytes is not None and received_bytes != expected_bytes
            ):
                raise ServiceError("invalid_file", 400)
        except BaseException:
            async with lock:
                self._jobs.pop(token, None)
            await asyncio.to_thread(shutil.rmtree, directory, True)
            raise

        job.progress = 20
        job.updated_at = time.monotonic()
        task = asyncio.create_task(self._run(job))
        self._tasks[token] = task
        task.add_done_callback(lambda _task, job_id=token: self._tasks.pop(job_id, None))
        return job.snapshot()

    async def get(self, token: str, session_id: str) -> ProcessSnapshot:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if job is None or job.session_id != session_id:
                raise ServiceError("unavailable", 404)
            return job.snapshot()

    async def active(self, session_id: str) -> ProcessSnapshot:
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

    async def file(self, token: str, session_id: str) -> tuple[Path, str, str]:
        lock = self._require_lock()
        async with lock:
            job = self._jobs.get(token)
            if (
                job is None
                or job.session_id != session_id
                or job.status not in {"ready", "downloading"}
                or not job.output_path.is_file()
            ):
                raise ServiceError("unavailable", 404)
            job.status = "downloading"
            job.updated_at = time.monotonic()
            return job.output_path, job.filename, job.media_type

    async def mark_delivered(self, token: str) -> None:
        lock = self._require_lock()
        directory: Path | None = None
        async with lock:
            job = self._jobs.get(token)
            if job is not None and job.status in {"ready", "downloading"}:
                job.status = "delivered"
                job.progress = 100
                job.updated_at = time.monotonic()
                directory = job.directory
        if directory is not None:
            await asyncio.to_thread(shutil.rmtree, directory, True)

    async def _run(self, job: ProcessJob) -> None:
        semaphore = self._require_semaphore()
        async with semaphore:
            try:
                duration, video_codec = await probe_media(job.input_path)
                arguments = build_ffmpeg_args(
                    job.operation,
                    job.output_format,
                    job.input_path,
                    job.output_path,
                    video_codec,
                )
                process = await asyncio.create_subprocess_exec(
                    "ffmpeg",
                    *arguments,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    start_new_session=True,
                )
                job.process = process
                stderr_task = asyncio.create_task(read_stderr(process))
                await self._track_progress(job, process, duration)
                stderr = await stderr_task
                if (
                    process.returncode != 0
                    or not job.output_path.is_file()
                    or job.output_path.stat().st_size == 0
                ):
                    logger.warning("FFmpeg conversion failed (job=%s): %s", job.id, stderr[-2_000:])
                    raise ServiceError("conversion_failed")

                job.input_path.unlink(missing_ok=True)
                self._update(job, status="ready", progress=100)
            except asyncio.CancelledError:
                if job.process is not None:
                    await stop_process(job.process)
                await asyncio.to_thread(shutil.rmtree, job.directory, True)
                raise
            except ServiceError as error:
                await asyncio.to_thread(shutil.rmtree, job.directory, True)
                self._update(job, status="failed", error=error.code)
            except Exception:
                await asyncio.to_thread(shutil.rmtree, job.directory, True)
                logger.exception("Unexpected conversion failure (job=%s)", job.id)
                self._update(job, status="failed", error="conversion_failed")
            finally:
                job.process = None

    async def _track_progress(
        self,
        job: ProcessJob,
        process: asyncio.subprocess.Process,
        duration: float,
    ) -> None:
        if process.stdout is None:
            raise ServiceError("conversion_failed")
        while line := await process.stdout.readline():
            key, separator, value = line.decode(errors="replace").strip().partition("=")
            if not separator:
                continue
            if key == "out_time_us" and duration > 0:
                with suppress(ValueError):
                    elapsed = int(value) / 1_000_000
                    progress = min(95, 20 + int(elapsed * 75 / duration))
                    self._update(job, progress=progress)
            elif key == "progress" and value == "end":
                self._update(job, progress=95)
        await process.wait()

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            now = time.monotonic()
            expired: list[ProcessJob] = []
            lock = self._require_lock()
            async with lock:
                for token, job in list(self._jobs.items()):
                    age = now - job.updated_at
                    if (
                        (job.status == "ready" and age >= READY_TTL_SECONDS)
                        or (job.status == "delivered" and age >= DELIVERED_TTL_SECONDS)
                        or (job.status == "failed" and age >= FAILED_TTL_SECONDS)
                    ):
                        expired.append(self._jobs.pop(token))
            for job in expired:
                await asyncio.to_thread(shutil.rmtree, job.directory, True)

    @staticmethod
    def _update(
        job: ProcessJob,
        *,
        status: ProcessStatus | None = None,
        progress: int | None = None,
        error: str | None = None,
    ) -> None:
        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = max(job.progress, progress)
        if error is not None:
            job.error = error
        job.updated_at = time.monotonic()

    @staticmethod
    def _reset_temp_root() -> None:
        shutil.rmtree(TEMP_ROOT, ignore_errors=True)
        TEMP_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)

    def _require_lock(self) -> asyncio.Lock:
        if self._lock is None:
            raise RuntimeError("Process manager is not running")
        return self._lock

    def _require_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            raise RuntimeError("Process manager is not running")
        return self._semaphore


def content_length(request: Request) -> int | None:
    value = request.headers.get("content-length")
    if value is None:
        return None
    try:
        length = int(value)
    except ValueError as error:
        raise ServiceError("invalid_file", 400) from error
    if length <= 0:
        raise ServiceError("invalid_file", 400)
    if length > MAX_FILE_BYTES:
        raise ServiceError("file_too_large", 413)
    return length


async def save_upload(request: Request, destination: Path) -> int:
    received = 0
    with destination.open("wb", buffering=UPLOAD_CHUNK_BYTES) as output:
        async for chunk in request.stream():
            if not chunk:
                continue
            received += len(chunk)
            if received > MAX_FILE_BYTES:
                raise ServiceError("file_too_large", 413)
            output.write(chunk)
    return received


async def probe_media(path: Path) -> tuple[float, str | None]:
    process = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name",
        "-of",
        "json",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _stderr = await process.communicate()
    if process.returncode != 0:
        raise ServiceError("invalid_file", 400)
    try:
        info = json.loads(stdout)
        duration = float(info.get("format", {}).get("duration") or 0)
        video_codec = next(
            (
                stream.get("codec_name")
                for stream in info.get("streams", [])
                if stream.get("codec_type") == "video"
            ),
            None,
        )
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        raise ServiceError("invalid_file", 400) from error
    return duration, video_codec


async def read_stderr(process: asyncio.subprocess.Process) -> str:
    if process.stderr is None:
        return ""
    return (await process.stderr.read()).decode(errors="replace").strip()


async def stop_process(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        return
    with suppress(ProcessLookupError):
        process.terminate()
    try:
        await asyncio.wait_for(process.wait(), timeout=5)
    except TimeoutError:
        with suppress(ProcessLookupError):
            process.kill()
        await process.wait()


def allowed_format(operation: str, output_format: str) -> bool:
    return output_format in (AUDIO_FORMATS if operation.endswith("audio") else VIDEO_FORMATS)


def build_ffmpeg_args(
    operation: Operation,
    output_format: str,
    input_path: Path,
    output_path: Path,
    video_codec: str | None,
) -> list[str]:
    args = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-nostats",
        "-y",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        str(input_path),
    ]
    if operation.endswith("audio"):
        args.extend(["-map", "0:a:0", "-vn", *audio_output_args(output_format)])
    else:
        args.extend(["-map", "0:v:0"])
        if operation == "extract-video":
            args.extend(["-an", *extract_video_args(output_format, video_codec)])
        else:
            args.extend(["-map", "0:a:0?", *video_output_args(output_format)])
    return [*args, str(output_path)]


def extract_video_args(output_format: str, video_codec: str | None) -> list[str]:
    copy_codecs: dict[str, set[str] | None] = {
        "mp4": {"h264", "hevc", "av1", "vp9", "mpeg4"},
        "mov": {"h264", "hevc", "mpeg4"},
        "mkv": None,
        "webm": {"vp8", "vp9", "av1"},
    }
    compatible = copy_codecs[output_format]
    if video_codec is not None and (compatible is None or video_codec in compatible):
        return ["-c:v", "copy", *faststart_args(output_format)]
    return video_only_output_args(output_format)


def audio_output_args(output_format: str) -> list[str]:
    return {
        "mp3": ["-c:a", "libmp3lame", "-b:a", "192k"],
        "m4a": ["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
        "wav": ["-c:a", "pcm_s16le"],
        "flac": ["-c:a", "flac"],
        "aac": ["-c:a", "aac", "-b:a", "192k"],
        "ogg": ["-c:a", "libvorbis", "-q:a", "6"],
    }[output_format]


def video_only_output_args(output_format: str) -> list[str]:
    return {
        "mp4": [*h264_args(), "-movflags", "+faststart"],
        "mov": [*h264_args(), "-movflags", "+faststart"],
        "mkv": h264_args(),
        "webm": webm_video_args(),
    }[output_format]


def video_output_args(output_format: str) -> list[str]:
    return {
        "mp4": [*h264_args(), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
        "mov": [*h264_args(), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
        "mkv": [*h264_args(), "-c:a", "aac", "-b:a", "192k"],
        "webm": [*webm_video_args(), "-c:a", "libopus", "-b:a", "160k"],
    }[output_format]


def h264_args() -> list[str]:
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]


def webm_video_args() -> list[str]:
    return [
        "-c:v", "libvpx-vp9",
        "-deadline", "realtime",
        "-cpu-used", "8",
        "-row-mt", "1",
        "-tile-columns", "2",
        "-frame-parallel", "1",
        "-threads", "8",
        "-crf", "33",
        "-b:v", "6M",
        "-maxrate", "9M",
        "-bufsize", "12M",
    ]


def faststart_args(output_format: str) -> list[str]:
    return ["-movflags", "+faststart"] if output_format in {"mp4", "mov"} else []


def output_filename(source_name: str, output_format: str) -> str:
    without_extension = unquote(source_name).rsplit(".", 1)[0]
    base = "".join(
        character if character.isascii() and (character.isalnum() or character in "._-") else "-"
        for character in without_extension
    ).strip("-") or "media"
    return f"{base[:120]}.{output_format}"


def content_type(output_format: str) -> str:
    return {
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "wav": "audio/wav",
        "flac": "audio/flac",
        "aac": "audio/aac",
        "ogg": "audio/ogg",
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "mkv": "video/x-matroska",
    }[output_format]


process_manager = ProcessManager()
