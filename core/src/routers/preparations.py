import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, HttpUrl

from ..services.preparations import JobSnapshot, preparation_manager
from ..services.sessions import (
    client_ip,
    require_session,
    session_for_request,
    set_session_cookie,
)
from ..services.url_guard import validate_public_url

router = APIRouter(prefix="/downloads", tags=["downloads"])


class PrepareDownloadPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl
    playlist: bool = False


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def prepare_download(
    payload: PrepareDownloadPayload,
    request: Request,
    response: Response,
) -> JobSnapshot:
    url = str(payload.url)
    await validate_public_url(url)
    session_id, new_cookie = session_for_request(request)
    job = await preparation_manager.create(
        url,
        session_id=session_id,
        client_ip=client_ip(request),
        playlist=payload.playlist,
    )
    if new_cookie is not None:
        set_session_cookie(response, new_cookie)
    return job


@router.get("/active")
async def active_download(request: Request) -> JobSnapshot:
    return await preparation_manager.active(require_session(request))


@router.get("/{token}")
async def download_status(token: str, request: Request) -> JobSnapshot:
    return await preparation_manager.get(token, require_session(request))


@router.get("/{token}/file", response_class=StreamingResponse)
async def prepared_file(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
) -> StreamingResponse:
    path, filename = await preparation_manager.file(token, require_session(request))
    background_tasks.add_task(preparation_manager.mark_delivered, token)
    media_type = "application/zip" if filename.endswith(".zip") else "video/mp4"
    return StreamingResponse(
        stream_file(path),
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(path.stat().st_size),
            "X-Content-Type-Options": "nosniff",
        },
        background=background_tasks,
    )


async def stream_file(path: Path) -> AsyncIterator[bytes]:
    file = await asyncio.to_thread(path.open, "rb")
    try:
        while chunk := await asyncio.to_thread(file.read, 64 * 1024):
            yield chunk
    finally:
        await asyncio.to_thread(file.close)
