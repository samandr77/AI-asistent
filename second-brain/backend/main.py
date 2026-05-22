import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api import (
    admin,
    auth,
    dump,
    exercises,
    finance,
    goals,
    health,
    kpis,
    memory,
    premium,
    reflections,
    reviews,
    revenuecat_webhook,
    strategy,
    task_projects,
    tasks,
    telegram_auth,
    telegram_payments,
    telegram_reminders,
    telegram_webhook,
    workouts,
)
from config import settings

logger = logging.getLogger(__name__)


_REDACTED_FIELDS = ("raw_text", "source_text")


def _redact_raw_text(value):
    if isinstance(value, dict):
        return {
            k: ("<redacted>" if k in _REDACTED_FIELDS else _redact_raw_text(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact_raw_text(item) for item in value]
    return value


def _sentry_before_send(event, _hint):
    # Drop user-typed task content from any payload before it leaves the process.
    for key in ("request", "extra", "contexts"):
        if key in event and event[key]:
            event[key] = _redact_raw_text(event[key])
    return event


def _init_sentry() -> None:
    if not settings.sentry_dsn:
        logger.warning("Sentry DSN not set — errors will not be reported")
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.sentry_release or None,
        traces_sample_rate=0.2,
        integrations=[FastApiIntegration()],
        send_default_pii=False,
        before_send=_sentry_before_send,
    )
    logger.info("Sentry initialized (env=%s)", settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed system exercises catalog idempotently. Fails open — if Supabase
    # is unavailable or the migration hasn't been applied, the app still
    # starts (the /exercises endpoint will surface a 503 to the caller).
    try:
        from services.workout_exercise_library import seed_if_empty
        inserted = seed_if_empty()
        if inserted:
            logger.info("seeded %d system exercises on startup", inserted)
    except Exception as exc:  # noqa: BLE001 — startup must never fail
        logger.warning("exercise library seed skipped: %s", exc)
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
app.include_router(task_projects.router, prefix="/task-projects", tags=["task-projects"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(memory.router, prefix="/memory", tags=["memory"])
app.include_router(goals.router, prefix="/goals", tags=["goals"])
app.include_router(strategy.router, prefix="/strategy", tags=["strategy"])
app.include_router(kpis.router, prefix="/kpis", tags=["kpis"])
app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
app.include_router(finance.router, prefix="/finance", tags=["finance"])
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(workouts.router, prefix="/workouts", tags=["workouts"])
app.include_router(exercises.router, prefix="/exercises", tags=["exercises"])
app.include_router(reflections.router, prefix="/reflections", tags=["reflections"])
app.include_router(premium.router, prefix="/premium", tags=["premium"])
app.include_router(telegram_auth.router, prefix="/telegram", tags=["telegram"])
app.include_router(telegram_payments.router, prefix="/telegram", tags=["telegram"])
app.include_router(telegram_reminders.router, prefix="/telegram", tags=["telegram"])
app.include_router(telegram_webhook.router, prefix="/telegram", tags=["telegram"])
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
