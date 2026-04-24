from pathlib import Path
import os

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        supabase_url: str
        supabase_service_key: str
        supabase_jwt_secret: str
        openai_api_key: str = ""
        groq_api_key: str = ""
        anthropic_base_url: str = ""
        anthropic_api_key: str
        huggingface_api_key: str = ""
        redis_url: str = "redis://localhost:6379"
        environment: str = "development"
        allowed_origins: str = (
            "http://localhost:8081,"
            "http://localhost:19006,"
            "http://localhost:3000"
        )
        # Premium / RevenueCat
        revenuecat_webhook_secret: str = ""
        daily_free_token_budget: int = 50_000
        daily_premium_token_budget: int = 500_000
        free_daily_dump_limit: int = 10
        free_max_active_goals: int = 3
        free_history_days: int = 30

        model_config = SettingsConfigDict(env_file=".env", extra="ignore")

except ModuleNotFoundError:  # pragma: no cover - local/dev fallback
    class Settings:
        def __init__(self):
            self._load_dotenv()
            self.supabase_url = os.getenv(
                "SUPABASE_URL", "https://placeholder.supabase.co"
            )
            self.supabase_service_key = os.getenv(
                "SUPABASE_SERVICE_KEY", "placeholder_service_key"
            )
            self.supabase_jwt_secret = os.getenv(
                "SUPABASE_JWT_SECRET", "placeholder_jwt_secret"
            )
            self.openai_api_key = os.getenv("OPENAI_API_KEY", "placeholder_openai")
            self.groq_api_key = os.getenv("GROQ_API_KEY", "")
            self.anthropic_base_url = os.getenv("ANTHROPIC_BASE_URL", "")
            self.anthropic_api_key = os.getenv(
                "ANTHROPIC_API_KEY", "placeholder_anthropic"
            )
            self.huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY", "")
            self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self.environment = os.getenv("ENVIRONMENT", "development")
            self.allowed_origins = os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:8081,http://localhost:19006,http://localhost:3000",
            )
            # Premium / RevenueCat
            self.revenuecat_webhook_secret = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")
            self.daily_free_token_budget = int(os.getenv("DAILY_FREE_TOKEN_BUDGET", "50000"))
            self.daily_premium_token_budget = int(os.getenv("DAILY_PREMIUM_TOKEN_BUDGET", "500000"))
            self.free_daily_dump_limit = int(os.getenv("FREE_DAILY_DUMP_LIMIT", "10"))
            self.free_max_active_goals = int(os.getenv("FREE_MAX_ACTIVE_GOALS", "3"))
            self.free_history_days = int(os.getenv("FREE_HISTORY_DAYS", "30"))

        @staticmethod
        def _load_dotenv():
            env_path = Path(".env")
            if not env_path.exists():
                return

            for line in env_path.read_text().splitlines():
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                key, value = stripped.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


settings = Settings()
