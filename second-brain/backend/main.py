import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api import admin, auth, dump, goals, memory, premium, reflections, revenuecat_webhook, tasks
from config import settings

logger = logging.getLogger(__name__)


def _init_sentry() -> None:
    if not settings.sentry_dsn:
        logger.warning("Sentry DSN not set — errors will not be reported")
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.2,
        integrations=[FastApiIntegration()],
        send_default_pii=False,
    )
    logger.info("Sentry initialized (env=%s)", settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


_init_sentry()

app = FastAPI(title="Second Brain API", lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
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
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness():
    return {
        "status": "ok",
        "environment": settings.environment,
        "sentry": bool(settings.sentry_dsn),
    }
