from __future__ import annotations

import logging
import multiprocessing
import os
import shutil
import signal
import tempfile
import threading
import time
import zipfile
from contextlib import suppress
from multiprocessing.connection import Connection
from pathlib import Path
from typing import Callable, Literal, cast

from yt_dlp.utils import DownloadError

from ..errors import ServiceError
from .downloader import Playlist, extract_media_info, extract_playlist
from .transfers import prepare_media_file

logger = logging.getLogger(__name__)

METADATA_TIMEOUT_SECONDS = 90
TRANSFER_STALL_SECONDS = 10 * 60
TRANSFER_TIMEOUT_SECONDS = 12 * 60 * 60
ARCHIVE_TIMEOUT_SECONDS = 30 * 60
PROCESS_STOP_GRACE_SECONDS = 3

WorkerOperation = Literal["media", "playlist"]


def extract_media_info_isolated(
    url: str,
    *,
    cancel_event: threading.Event,
) -> dict[str, object]:
    return cast(
        dict[str, object],
        _run_isolated(
            _extract_worker,
            ("media", url),
            timeout=METADATA_TIMEOUT_SECONDS,
            cancel_event=cancel_event,
        ),
    )


def extract_playlist_isolated(
    url: str,
    *,
    cancel_event: threading.Event,
) -> Playlist:
    return cast(
        Playlist,
        _run_isolated(
            _extract_worker,
            ("playlist", url),
            timeout=METADATA_TIMEOUT_SECONDS,
            cancel_event=cancel_event,
        ),
    )


def prepare_media_file_isolated(
    *,
    url: str,
    info: dict[str, object],
    directory: Path,
    output_stem: str,
    size_limit: int,
    progress_callback: Callable[[int], None],
    cancel_event: threading.Event,
) -> Path:
    return Path(
        cast(
            str,
            _run_isolated(
                _transfer_worker,
                (url, info, directory, output_stem, size_limit),
                timeout=TRANSFER_TIMEOUT_SECONDS,
                idle_timeout=TRANSFER_STALL_SECONDS,
                progress_callback=progress_callback,
                cancel_event=cancel_event,
            ),
        )
    )


def create_zip_isolated(
    archive_path: Path,
    videos_directory: Path,
    *,
    cancel_event: threading.Event,
) -> Path:
    return Path(
        cast(
            str,
            _run_isolated(
                _archive_worker,
                (archive_path, videos_directory),
                timeout=ARCHIVE_TIMEOUT_SECONDS,
                cancel_event=cancel_event,
            ),
        )
    )


def _extract_worker(connection: Connection, operation: WorkerOperation, url: str) -> None:
    try:
        result = extract_media_info(url) if operation == "media" else extract_playlist(url)
        connection.send(("ok", result))
    except ServiceError as error:
        _safe_send(connection, ("service_error", (error.code, error.status_code)))
    except DownloadError as error:
        _safe_send(connection, ("download_error", str(error)[-1_000:]))
    except BaseException as error:
        _safe_send(connection, ("error", (type(error).__name__, str(error)[-1_000:])))
    finally:
        connection.close()


def _transfer_worker(
    connection: Connection,
    url: str,
    info: dict[str, object],
    directory: Path,
    output_stem: str,
    size_limit: int,
) -> None:
    send_lock = threading.Lock()

    def send(message: tuple[str, object]) -> None:
        with send_lock:
            connection.send(message)

    def report(progress: int) -> None:
        send(("progress", progress))

    def check_disk() -> None:
        size = sum(path.stat().st_size for path in directory.rglob("*") if path.is_file())
        if size > size_limit:
            raise ServiceError("file_too_large", 413)

    try:
        path = prepare_media_file(
            url=url,
            info=info,
            directory=directory,
            output_stem=output_stem,
            size_limit=size_limit,
            progress_callback=report,
            disk_check=check_disk,
        )
        send(("ok", str(path)))
    except ServiceError as error:
        _safe_send(connection, ("service_error", (error.code, error.status_code)), send_lock)
    except DownloadError as error:
        _safe_send(connection, ("download_error", str(error)[-1_000:]), send_lock)
    except BaseException as error:
        _safe_send(
            connection,
            ("error", (type(error).__name__, str(error)[-1_000:])),
            send_lock,
        )
    finally:
        connection.close()


def _archive_worker(
    connection: Connection,
    archive_path: Path,
    videos_directory: Path,
) -> None:
    try:
        with zipfile.ZipFile(archive_path, mode="w", allowZip64=True) as archive:
            for video in sorted(videos_directory.iterdir()):
                if video.is_file():
                    archive.write(video, arcname=video.name, compress_type=zipfile.ZIP_STORED)
        connection.send(("ok", str(archive_path)))
    except BaseException as error:
        _safe_send(connection, ("error", (type(error).__name__, str(error)[-1_000:])))
    finally:
        connection.close()


def _run_isolated(
    target: Callable[..., None],
    arguments: tuple[object, ...],
    *,
    timeout: float,
    cancel_event: threading.Event,
    idle_timeout: float | None = None,
    progress_callback: Callable[[int], None] | None = None,
) -> object:
    context = multiprocessing.get_context("spawn")
    reader, writer = context.Pipe(duplex=False)
    worker_root = Path(tempfile.mkdtemp(prefix="baixaboo-worker-"))
    process = context.Process(
        target=_worker_entry,
        args=(target, writer, worker_root, *arguments),
    )
    try:
        process.start()
    except BaseException:
        reader.close()
        writer.close()
        shutil.rmtree(worker_root, ignore_errors=True)
        raise
    writer.close()
    started_at = time.monotonic()
    last_activity = started_at

    try:
        while True:
            if cancel_event.is_set():
                raise ServiceError("timeout", 504)

            if reader.poll(0.25):
                try:
                    kind, payload = reader.recv()
                except EOFError:
                    kind, payload = "error", ("WorkerExit", "worker closed without a result")
                last_activity = time.monotonic()
                if kind == "progress":
                    if progress_callback is not None:
                        progress_callback(int(payload))
                    continue
                if kind == "ok":
                    return payload
                if kind == "service_error":
                    code, status_code = cast(tuple[str, int], payload)
                    raise ServiceError(code, status_code)
                if kind == "download_error":
                    logger.warning("Isolated yt-dlp operation failed: %s", payload)
                    raise ServiceError("unsupported_source")
                error_name, message = cast(tuple[str, str], payload)
                logger.warning("Isolated worker failed (%s): %s", error_name, message)
                raise ServiceError("service_unavailable")

            now = time.monotonic()
            if now - started_at >= timeout:
                raise ServiceError("timeout", 504)
            if idle_timeout is not None and now - last_activity >= idle_timeout:
                raise ServiceError("timeout", 504)
            if not process.is_alive():
                if reader.poll(0.1):
                    continue
                logger.warning("Isolated worker exited unexpectedly (code=%s)", process.exitcode)
                raise ServiceError("service_unavailable")
    finally:
        reader.close()
        _stop_process_tree(process)
        shutil.rmtree(worker_root, ignore_errors=True)


def _worker_entry(
    target: Callable[..., None],
    connection: Connection,
    worker_root: Path,
    *arguments: object,
) -> None:
    os.environ["TMPDIR"] = str(worker_root)
    tempfile.tempdir = str(worker_root)
    with suppress(OSError):
        os.setsid()
    target(connection, *arguments)


def _stop_process_tree(process: multiprocessing.Process) -> None:
    process.join(timeout=0.5)
    if process.is_alive():
        with suppress(OSError):
            os.killpg(process.pid, signal.SIGTERM)
        with suppress(Exception):
            process.terminate()
        process.join(timeout=PROCESS_STOP_GRACE_SECONDS)
    if process.is_alive():
        with suppress(OSError):
            os.killpg(process.pid, signal.SIGKILL)
        with suppress(Exception):
            process.kill()
        process.join(timeout=PROCESS_STOP_GRACE_SECONDS)
    if process.is_alive():
        logger.error("Could not terminate isolated worker (pid=%s)", process.pid)
    else:
        process.close()


def _safe_send(
    connection: Connection,
    message: tuple[str, object],
    lock: threading.Lock | None = None,
) -> None:
    with suppress(OSError, EOFError, BrokenPipeError):
        if lock is None:
            connection.send(message)
        else:
            with lock:
                connection.send(message)
