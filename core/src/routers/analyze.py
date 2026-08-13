import asyncio
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, HttpUrl
from yt_dlp.utils import DownloadError

from ..errors import ServiceError
from ..services.analyzer import build_analysis
from ..services.downloader import extract_media_info
from ..services.url_guard import validate_public_url

router = APIRouter(tags=["analyze"])
ANALYZE_TIMEOUT_SECONDS = 30


class AnalyzePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl


@router.post("/analyze")
async def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    url = str(payload.url)
    await validate_public_url(url)
    try:
        info = await asyncio.wait_for(
            asyncio.to_thread(extract_media_info, url),
            timeout=ANALYZE_TIMEOUT_SECONDS,
        )
    except TimeoutError as error:
        raise ServiceError("timeout", 408) from error
    except DownloadError as error:
        raise ServiceError("unsupported_source") from error
    return build_analysis(url, info)
