import os
from pathlib import Path

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_dotenv_if_present() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv_if_present()


class Settings(BaseSettings):
    # Required — app fails to start if missing
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    anthropic_api_key: str
    revenuecat_webhook_secret: str

    # Optional with safe defaults
    openai_api_key: str = ""
    groq_api_key: str = ""
    anthropic_base_url: str = ""
    huggingface_api_key: str = ""
    redis_url: str = "redis://localhost:6379"

    # Observability
    sentry_dsn: str = ""
    environment: str = "development"

    # AI budget + limits
    daily_user_token_budget: int = Field(default=200_000, ge=0)
    max_audio_seconds: int = Field(default=180, ge=10, le=1800)

    # Premium / RevenueCat-derived limits
    daily_free_token_budget: int = Field(default=50_000, ge=0)
    daily_premium_token_budget: int = Field(default=500_000, ge=0)
    free_daily_dump_limit: int = Field(default=10, ge=1)
    free_max_active_goals: int = Field(default=3, ge=1)
    free_history_days: int = Field(default=30, ge=1)

    allowed_origins: str = (
        "http://localhost:8081,"
        "http://localhost:19006,"
        "http://localhost:3000"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


try:
    settings = Settings()
except ValidationError as exc:  # surface missing keys loudly
    missing = ", ".join(str(err["loc"][0]) for err in exc.errors())
    raise RuntimeError(f"Missing required env vars: {missing}") from exc
