from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings

CORE_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    session_secret: SecretStr = Field(min_length=32)
    frontend_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3001")
    ytdlp_cookies_file: Path | None = None

    @field_validator("ytdlp_cookies_file")
    @classmethod
    def resolve_cookie_file(cls, value: Path | None) -> Path | None:
        if value is None or value.is_absolute():
            return value
        return (CORE_ROOT / value).resolve()


settings = Settings()
