from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    supabase_url: AnyHttpUrl | None = Field(default=None, alias="SUPABASE_URL")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    deepgram_api_key: str | None = Field(default=None, alias="DEEPGRAM_API_KEY")
    openrouter_api_key: str | None = Field(default=None, alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL")
    openrouter_model: str = Field(default="openai/gpt-oss-120b:free", alias="OPENROUTER_MODEL")
    openrouter_app_url: str | None = Field(default=None, alias="OPENROUTER_APP_URL")
    openrouter_app_name: str = Field(default="Ed-Tech Training Loop", alias="OPENROUTER_APP_NAME")
    backend_cors_origins: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:5174,http://127.0.0.1:5174,"
            "http://localhost:5175,http://127.0.0.1:5175"
        ),
        alias="BACKEND_CORS_ORIGINS",
    )
    port: int = Field(default=3001, alias="PORT")

    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", ".env"),
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
