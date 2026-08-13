from fastapi import APIRouter

from ..config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str | bool]:
    cookie_file = settings.ytdlp_cookies_file
    return {
        "status": "ok",
        "cookiesConfigured": cookie_file is not None and cookie_file.is_file(),
    }
