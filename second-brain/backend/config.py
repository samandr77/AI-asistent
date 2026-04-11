from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    openai_api_key: str
    groq_api_key: str
    anthropic_api_key: str
    huggingface_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    environment: str = "development"
    allowed_origins: str = "http://localhost:8081"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
