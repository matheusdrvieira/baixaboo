from __future__ import annotations

import json
import logging
import secrets
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from yt_dlp.utils import DownloadError

from ..config import settings
from ..errors import ServiceError
from .downloader import (
    PLAYER_CLIENT_INFO_KEY,
    YOUTUBE_CLIENT,
    common_options,
    media_format_size,
    selected_media_formats,
    youtube_downloader,
)
from .url_guard import validate_public_url_sync

ARIA_CONNECTIONS = 8
THROTTLE_BYTES_PER_SECOND = 200 * 1024
THROTTLE_GRACE_SECONDS = 20
THROTTLE_WINDOW_SECONDS = 15
THROTTLE_MIN_REMAINING_BYTES = 8 * 1024 * 1024
THROTTLE_REFRESH_ATTEMPTS = 2

_RPC_PORTS: set[int] = set()
_RPC_PORTS_LOCK = threading.Lock()
logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MediaStream:
    index: int
    format_id: str
    kind: str
    expected_bytes: int
    protocol: str


@dataclass(frozen=True, slots=True)
class AriaStatus:
    active_count: int
    waiting_count: int
    stopped_count: int
    completed_bytes: int
    total_bytes: int
    speed: int


class TransferProgress:
    def __init__(
        self,
        streams: list[MediaStream],
        callback: Callable[[int], None],
    ) -> None:
        self._callback = callback
        self._completed = [0] * len(streams)
        self._total = [stream.expected_bytes for stream in streams]
        self._fixed_total = [stream.expected_bytes > 0 for stream in streams]
        self._lock = threading.Lock()

    def update(self, index: int, completed_bytes: int, total_bytes: int) -> None:
        with self._lock:
            self._completed[index] = max(self._completed[index], completed_bytes)
            if self._fixed_total[index]:
                self._total[index] = max(self._total[index], completed_bytes)
            else:
                self._total[index] = max(self._total[index], total_bytes)
            known_total = sum(self._total)
            if known_total <= 0:
                return
            known_completed = sum(
                min(completed, total)
                for completed, total in zip(self._completed, self._total, strict=True)
            )
            progress = min(90, 2 + int(known_completed * 88 / known_total))
        self._callback(progress)

    def finish(self, index: int) -> None:
        with self._lock:
            total = self._total[index]
        if total > 0:
            self.update(index, total, total)


class TransferAbort:
    def __init__(self) -> None:
        self.event = threading.Event()
        self._error: ServiceError | None = None
        self._lock = threading.Lock()

    def fail(self, error: ServiceError) -> None:
        with self._lock:
            if self._error is None:
                self._error = error
        self.event.set()

    @property
    def error(self) -> ServiceError | None:
        with self._lock:
            return self._error


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
    formats = selected_media_formats(info)
    for media_format in formats:
        media_url = media_format.get("url")
        if isinstance(media_url, str):
            validate_public_url_sync(media_url)

    player_client = str(info.get(PLAYER_CLIENT_INFO_KEY) or YOUTUBE_CLIENT)
    use_external_downloader = "youtube" in str(
        info.get("extractor_key") or info.get("extractor") or ""
    ).lower()
    streams = [
        MediaStream(
            index=index,
            format_id=str(media_format.get("format_id") or ""),
            kind=_stream_kind(media_format),
            expected_bytes=media_format_size(media_format),
            protocol=str(media_format.get("protocol") or ""),
        )
        for index, media_format in enumerate(formats)
    ]
    if not streams or any(not stream.format_id for stream in streams):
        raise ServiceError("unavailable")

    estimated_bytes = sum(stream.expected_bytes for stream in streams)
    if estimated_bytes > size_limit:
        raise ServiceError("file_too_large", 413)

    progress = TransferProgress(streams, progress_callback)
    abort = TransferAbort()
    paths: dict[int, Path] = {}
    workers = min(2, len(streams))

    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="media-stream") as pool:
        futures = {
            pool.submit(
                _download_stream,
                url=url,
                directory=directory,
                output_stem=output_stem,
                stream=stream,
                player_client=player_client,
                progress=progress,
                abort=abort,
                disk_check=disk_check,
                use_external_downloader=use_external_downloader,
            ): stream.index
            for stream in streams
        }
        try:
            for future in as_completed(futures):
                paths[futures[future]] = future.result()
        except BaseException:
            abort.event.set()
            for future in futures:
                future.cancel()
            raise

    if abort.error is not None:
        raise abort.error
    ordered_paths = [paths[stream.index] for stream in streams]
    if len(ordered_paths) == 1:
        source = ordered_paths[0]
        destination = directory / f"{output_stem}{source.suffix}"
        source.replace(destination)
        progress_callback(95)
        return destination

    video_path = next(
        (paths[stream.index] for stream in streams if stream.kind == "video"),
        None,
    )
    audio_path = next(
        (paths[stream.index] for stream in streams if stream.kind == "audio"),
        None,
    )
    if video_path is None or audio_path is None:
        raise ServiceError("unavailable")

    progress_callback(95)
    destination = directory / f"{output_stem}.mp4"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-protocol_whitelist",
                "file,pipe",
                "-i",
                str(video_path),
                "-i",
                str(audio_path),
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c",
                "copy",
                str(destination),
            ],
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise ServiceError("service_unavailable") from error
    finally:
        video_path.unlink(missing_ok=True)
        audio_path.unlink(missing_ok=True)

    disk_check()
    return destination


def _download_stream(
    *,
    url: str,
    directory: Path,
    output_stem: str,
    stream: MediaStream,
    player_client: str,
    progress: TransferProgress,
    abort: TransferAbort,
    disk_check: Callable[[], None],
    use_external_downloader: bool,
) -> Path:
    prefix = f"{output_stem}.{stream.kind}-{stream.index}"
    if _is_fragmented_protocol(stream.protocol) or not use_external_downloader:
        return _download_with_ytdlp(
            url=url,
            directory=directory,
            prefix=prefix,
            stream=stream,
            player_client=player_client,
            progress=progress,
            abort=abort,
            disk_check=disk_check,
            exclude_hls=use_external_downloader
            and not stream.protocol.startswith("m3u8"),
        )

    for attempt in range(THROTTLE_REFRESH_ATTEMPTS + 1):
        if abort.event.is_set():
            raise abort.error or ServiceError("service_unavailable")

        rpc_port = _claim_rpc_port()
        rpc_secret = secrets.token_urlsafe(24)
        stop = threading.Event()
        throttled = threading.Event()
        monitor = threading.Thread(
            target=_monitor_aria,
            kwargs={
                "stream": stream,
                "progress": progress,
                "directory": directory,
                "prefix": prefix,
                "port": rpc_port,
                "secret": rpc_secret,
                "stop": stop,
                "throttled": throttled,
                "abort": abort,
                "disk_check": disk_check,
                "detect_throttling": attempt < THROTTLE_REFRESH_ATTEMPTS,
            },
            daemon=True,
        )
        monitor.start()
        try:
            _run_ytdlp_stream(
                url=url,
                directory=directory,
                prefix=prefix,
                format_id=stream.format_id,
                rpc_port=rpc_port,
                rpc_secret=rpc_secret,
                player_client=player_client,
            )
        except DownloadError:
            if abort.error is not None:
                raise abort.error
            if not throttled.is_set() or attempt >= THROTTLE_REFRESH_ATTEMPTS:
                raise
        finally:
            stop.set()
            monitor.join(timeout=1)
            _release_rpc_port(rpc_port)

        candidate = _finished_stream_path(directory, prefix)
        if candidate is not None:
            progress.finish(stream.index)
            return candidate
        if not throttled.is_set():
            raise ServiceError("unavailable")

        _remove_aria_control_files(directory, prefix)
        logger.warning(
            "YouTube transfer throttled; refreshing the PO token (format=%s, attempt=%s)",
            stream.format_id,
            attempt + 1,
        )
        _invalidate_pot_cache()
        time.sleep(0.25)

    raise ServiceError("service_unavailable")


def _run_ytdlp_stream(
    *,
    url: str,
    directory: Path,
    prefix: str,
    format_id: str,
    rpc_port: int,
    rpc_secret: str,
    player_client: str,
) -> None:
    aria_arguments = [
        f"--max-connection-per-server={ARIA_CONNECTIONS}",
        f"--split={ARIA_CONNECTIONS}",
        "--min-split-size=1M",
        "--piece-length=1M",
        "--file-allocation=none",
        "--continue=true",
        "--always-resume=true",
        "--max-resume-failure-tries=2",
        "--connect-timeout=10",
        "--timeout=20",
        "--max-tries=3",
        "--retry-wait=1",
        "--summary-interval=0",
        "--console-log-level=warn",
        "--quiet=true",
        "--enable-rpc=true",
        f"--rpc-listen-port={rpc_port}",
        f"--rpc-secret={rpc_secret}",
        "--rpc-listen-all=false",
        "--rpc-allow-origin-all=false",
    ]
    options = {
        **common_options(player_client),
        # A recently ended YouTube live can expose the same format id both as
        # finite DASH media and as a still-open HLS/DVR manifest. Selecting by
        # id alone lets yt-dlp pick the manifest and FFmpeg then waits forever
        # for new segments. The format selected during analysis is non-HLS, so
        # preserve that constraint when yt-dlp refreshes the media URL.
        "format": f"{format_id}[protocol!*=m3u8]",
        "noplaylist": True,
        "outtmpl": str(directory / f"{prefix}.%(ext)s"),
        "concurrent_fragment_downloads": ARIA_CONNECTIONS,
        "external_downloader": {"default": "aria2c"},
        "external_downloader_args": {"aria2c": aria_arguments},
        "noprogress": True,
        "overwrites": True,
    }
    with youtube_downloader(options) as downloader:
        downloader.download([url])


def _download_with_ytdlp(
    *,
    url: str,
    directory: Path,
    prefix: str,
    stream: MediaStream,
    player_client: str,
    progress: TransferProgress,
    abort: TransferAbort,
    disk_check: Callable[[], None],
    exclude_hls: bool,
) -> Path:
    last_disk_check = 0.0

    def report(download: dict[str, object]) -> None:
        nonlocal last_disk_check
        if abort.event.is_set():
            raise abort.error or ServiceError("service_unavailable")

        status = str(download.get("status") or "")
        completed_bytes = int(download.get("downloaded_bytes") or 0)
        total_bytes = int(
            download.get("total_bytes")
            or download.get("total_bytes_estimate")
            or stream.expected_bytes
            or 0
        )
        if completed_bytes > 0 or total_bytes > 0:
            progress.update(stream.index, completed_bytes, total_bytes)

        now = time.monotonic()
        if now - last_disk_check >= 1:
            last_disk_check = now
            try:
                disk_check()
            except ServiceError as error:
                abort.fail(error)
                raise

        if status == "finished":
            progress.finish(stream.index)

    options = {
        **common_options(player_client),
        "format": (
            f"{stream.format_id}[protocol!*=m3u8]"
            if exclude_hls
            else stream.format_id
        ),
        "noplaylist": True,
        "outtmpl": str(directory / f"{prefix}.%(ext)s"),
        "concurrent_fragment_downloads": ARIA_CONNECTIONS,
        "fragment_retries": 5,
        "retries": 3,
        "skip_unavailable_fragments": False,
        "noprogress": True,
        "overwrites": True,
        "progress_hooks": [report],
    }
    with youtube_downloader(options) as downloader:
        downloader.download([url])

    candidate = _finished_stream_path(directory, prefix)
    if candidate is None:
        raise ServiceError("unavailable")
    progress.finish(stream.index)
    return candidate


def _is_fragmented_protocol(protocol: str) -> bool:
    return protocol.startswith("m3u8") or protocol.endswith("_segments")


def _monitor_aria(
    *,
    stream: MediaStream,
    progress: TransferProgress,
    directory: Path,
    prefix: str,
    port: int,
    secret: str,
    stop: threading.Event,
    throttled: threading.Event,
    abort: TransferAbort,
    disk_check: Callable[[], None],
    detect_throttling: bool,
) -> None:
    active_since: float | None = None
    low_speed_since: float | None = None
    last_disk_check = 0.0
    while not stop.wait(0.2):
        status = _aria_status(port, secret)
        if status is None:
            continue
        if status.active_count == 0:
            if status.waiting_count == 0 and status.stopped_count > 0:
                progress.update(
                    stream.index,
                    status.completed_bytes,
                    status.total_bytes,
                )
                _shutdown_aria(port, secret)
                return
            continue

        now = time.monotonic()
        active_since = active_since or now
        progress.update(
            stream.index,
            status.completed_bytes,
            status.total_bytes,
        )

        if abort.event.is_set():
            _shutdown_aria(port, secret, force=True)
            return

        if now - last_disk_check >= 1:
            last_disk_check = now
            try:
                disk_check()
            except ServiceError as error:
                abort.fail(error)
                _shutdown_aria(port, secret, force=True)
                return

        remaining_bytes = max(status.total_bytes - status.completed_bytes, 0)
        below_limit = (
            detect_throttling
            and now - active_since >= THROTTLE_GRACE_SECONDS
            and remaining_bytes >= THROTTLE_MIN_REMAINING_BYTES
            and status.speed < THROTTLE_BYTES_PER_SECOND
        )
        if not below_limit:
            low_speed_since = None
            continue
        low_speed_since = low_speed_since or now
        if now - low_speed_since >= THROTTLE_WINDOW_SECONDS:
            throttled.set()
            _shutdown_aria(port, secret, force=True)
            return


def _aria_status(port: int, secret: str) -> AriaStatus | None:
    token = f"token:{secret}"
    payload = json.dumps(
        [
            {
                "jsonrpc": "2.0",
                "id": "active",
                "method": "aria2.tellActive",
                "params": [
                    token,
                    ["completedLength", "totalLength", "downloadSpeed"],
                ],
            },
            {
                "jsonrpc": "2.0",
                "id": "global",
                "method": "aria2.getGlobalStat",
                "params": [token],
            },
            {
                "jsonrpc": "2.0",
                "id": "stopped",
                "method": "aria2.tellStopped",
                "params": [
                    token,
                    0,
                    1,
                    ["completedLength", "totalLength", "downloadSpeed"],
                ],
            },
        ]
    ).encode()
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/jsonrpc",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=0.15) as response:
            batch = json.loads(response.read())
    except (OSError, TimeoutError, ValueError, urllib.error.URLError):
        return None
    if not isinstance(batch, list):
        return None
    results = {
        item.get("id"): item.get("result")
        for item in batch
        if isinstance(item, dict) and "result" in item
    }
    active = results.get("active") or []
    stopped = results.get("stopped") or []
    global_status = results.get("global") or {}
    transfers = [*active, *stopped]
    return AriaStatus(
        active_count=int(global_status.get("numActive") or 0),
        waiting_count=int(global_status.get("numWaiting") or 0),
        stopped_count=int(global_status.get("numStopped") or 0),
        completed_bytes=sum(
            int(item.get("completedLength") or 0) for item in transfers
        ),
        total_bytes=sum(int(item.get("totalLength") or 0) for item in transfers),
        speed=int(global_status.get("downloadSpeed") or 0),
    )


def _shutdown_aria(port: int, secret: str, *, force: bool = False) -> None:
    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": "baixaboo-shutdown",
            "method": "aria2.forceShutdown" if force else "aria2.shutdown",
            "params": [f"token:{secret}"],
        }
    ).encode()
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/jsonrpc",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=0.5):
            return
    except (OSError, urllib.error.URLError):
        return


def _invalidate_pot_cache() -> None:
    base_url = str(settings.pot_provider_url).rstrip("/")
    request = urllib.request.Request(
        f"{base_url}/invalidate_caches",
        data=b"",
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=2):
            return
    except (OSError, urllib.error.URLError):
        return


def _finished_stream_path(directory: Path, prefix: str) -> Path | None:
    candidates = [
        path
        for path in directory.iterdir()
        if path.is_file()
        and path.name.startswith(f"{prefix}.")
        and not path.name.endswith((".part", ".aria2", ".ytdl"))
    ]
    return candidates[0] if len(candidates) == 1 else None


def _remove_aria_control_files(directory: Path, prefix: str) -> None:
    for path in directory.glob(f"{prefix}*.aria2"):
        path.unlink(missing_ok=True)


def _stream_kind(media_format: dict[str, object]) -> str:
    has_video = str(media_format.get("vcodec") or "none") != "none"
    has_audio = str(media_format.get("acodec") or "none") != "none"
    if has_video and not has_audio:
        return "video"
    if has_audio and not has_video:
        return "audio"
    return "combined"


def _claim_rpc_port() -> int:
    for _attempt in range(20):
        with socket.socket() as candidate:
            candidate.bind(("127.0.0.1", 0))
            port = candidate.getsockname()[1]
        with _RPC_PORTS_LOCK:
            if port not in _RPC_PORTS:
                _RPC_PORTS.add(port)
                return port
    raise ServiceError("service_unavailable", 503)


def _release_rpc_port(port: int) -> None:
    with _RPC_PORTS_LOCK:
        _RPC_PORTS.discard(port)
