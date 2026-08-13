import asyncio
from contextlib import suppress
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, HttpUrl
from yt_dlp.utils import DownloadError

from ..dependencies import analyze_rate_limit
from ..errors import ServiceError
from ..services.analyzer import build_analysis
from ..services.downloader import extract_media_info
from ..services.url_guard import validate_public_url

router = APIRouter(tags=["analyze"])
ANALYZE_TIMEOUT_SECONDS = 30
MAX_CONCURRENT_ANALYSES = 8


class AnalysisSlots:
    def __init__(self) -> None:
        self.active = 0
        self.lock: asyncio.Lock | None = None

    async def acquire(self) -> None:
        lock = self.lock
        if lock is None:
            lock = self.lock = asyncio.Lock()
        async with lock:
            if self.active >= MAX_CONCURRENT_ANALYSES:
                raise ServiceError("rate_limited", 429)
            self.active += 1

    async def release(self) -> None:
        if self.lock is None:
            return
        async with self.lock:
            self.active = max(0, self.active - 1)


analysis_slots = AnalysisSlots()


class AnalyzePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl


@router.post("/analyze", dependencies=[Depends(analyze_rate_limit)])
async def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    url = str(payload.url)
    await validate_public_url(url)
    await analysis_slots.acquire()
    loop = asyncio.get_running_loop()
    future = loop.run_in_executor(None, extract_media_info, url)
    release_immediately = True
    try:
        info = await asyncio.wait_for(asyncio.shield(future), timeout=ANALYZE_TIMEOUT_SECONDS)
    except TimeoutError as error:
        release_immediately = False
        future.add_done_callback(release_analysis_slot)
        raise ServiceError("timeout", 408) from error
    except DownloadError as error:
        raise ServiceError("unsupported_source") from error
    finally:
        if release_immediately:
            await analysis_slots.release()
    return build_analysis(url, info)


def release_analysis_slot(future: asyncio.Future[Any]) -> None:
    with suppress(asyncio.CancelledError, Exception):
        future.exception()
    asyncio.create_task(analysis_slots.release())
