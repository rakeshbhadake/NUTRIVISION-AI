"""Server-only configuration. This service has no browser-facing credentials."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(Path(__file__).resolve().parents[3] / ".env"), str(Path(__file__).resolve().parents[1] / ".env")),
        extra="ignore",
    )
    internal_service_token: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    usda_api_key: str = ""
    max_image_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=20 * 1024 * 1024)
    provider_timeout_seconds: float = Field(default=75, ge=5, le=180)


@lru_cache
def settings() -> Settings:
    return Settings()
