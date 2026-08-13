from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

CORE_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=CORE_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_key: SecretStr = Field(min_length=32)
    session_secret: SecretStr = Field(min_length=32)
    frontend_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3001")
    pot_provider_url: AnyHttpUrl = AnyHttpUrl("http://pot-provider:4416")
    ytdlp_cookies_file: Path | None = None

    @field_validator("ytdlp_cookies_file")
    @classmethod
    def resolve_cookie_file(cls, value: Path | None) -> Path | None:
        if value is None or value.is_absolute():
            return value
        return (CORE_ROOT / value).resolve()


settings = Settings()
