import json
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping

from fastapi import Request
from fastapi.responses import StreamingResponse

Snapshot = Mapping[str, object]
WaitForChange = Callable[[int], Awaitable[tuple[Snapshot, int] | None]]


def job_events_response(
    request: Request,
    wait_for_change: WaitForChange,
) -> StreamingResponse:
    async def stream() -> AsyncIterator[str]:
        revision = -1
        while not await request.is_disconnected():
            update = await wait_for_change(revision)
            if update is None:
                yield ": keep-alive\n\n"
                continue

            snapshot, revision = update
            payload = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
            yield f"data: {payload}\n\n"
            if snapshot.get("status") in {"delivered", "failed"}:
                return

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
