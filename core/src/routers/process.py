from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from fastapi.responses import FileResponse

from ..dependencies import process_rate_limit
from ..services.converter import (
    Operation,
    OutputFormat,
    ProcessSnapshot,
    process_manager,
)
from ..services.sessions import client_ip, require_session, session_for_request, set_session_cookie

router = APIRouter(prefix="/process", tags=["process"])


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(process_rate_limit)],
)
async def process_media(
    request: Request,
    response: Response,
    operation: Annotated[Operation, Query()],
    format: Annotated[OutputFormat, Query()],
) -> ProcessSnapshot:
    session_id, new_cookie = session_for_request(request)
    job = await process_manager.create(
        request,
        operation,
        format,
        session_id,
        client_ip(request),
    )
    if new_cookie is not None:
        set_session_cookie(response, new_cookie)
    return job


@router.get("/{token}")
async def process_status(token: str, request: Request) -> ProcessSnapshot:
    return await process_manager.get(token, require_session(request))


@router.get("/active/current")
async def active_process(request: Request) -> ProcessSnapshot:
    return await process_manager.active(require_session(request))


@router.get("/{token}/file", response_class=FileResponse)
async def processed_file(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
) -> FileResponse:
    path, filename, media_type = await process_manager.file(
        token,
        require_session(request),
    )
    background_tasks.add_task(process_manager.mark_delivered, token)
    return FileResponse(
        path,
        media_type=media_type,
        filename=filename,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
        background=background_tasks,
    )
