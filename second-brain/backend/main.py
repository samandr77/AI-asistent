from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api import dump, tasks, auth, memory, goals, reflections, premium, revenuecat_webhook

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
except ModuleNotFoundError:  # pragma: no cover - local/dev fallback
    class Limiter:  # type: ignore[override]
        def __init__(self, key_func=None):
            self.key_func = key_func

    def get_remote_address(*_args, **_kwargs):
        return "127.0.0.1"

    class RateLimitExceeded(Exception):
        pass

    async def _rate_limit_exceeded_handler(*_args, **_kwargs):
        return None

app = FastAPI(title="Second Brain API")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dump.router, prefix="/dump", tags=["dump"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(memory.router, prefix="/memory", tags=["memory"])
app.include_router(goals.router, prefix="/goals", tags=["goals"])
app.include_router(reflections.router, prefix="/reflections", tags=["reflections"])
app.include_router(premium.router, prefix="/premium", tags=["premium"])
app.include_router(revenuecat_webhook.router, prefix="/webhooks", tags=["webhooks"])

@app.get("/health")
async def health():
    return {"status": "ok"}
