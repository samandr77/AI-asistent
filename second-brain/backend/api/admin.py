"""Admin-only endpoints.

The cleanup endpoint is bearer-secured with a shared secret
(`ADMIN_CLEANUP_SECRET`) distinct from user JWTs so it can be invoked from
automation (GitHub Actions cron) without a user session.
"""
from __future__ import annotations

import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from config import settings
from database import get_supabase
from models.account import CleanupError, CleanupRunReport
from services.account_cleanup import purge_due_users

router = APIRouter()
logger = logging.getLogger(__name__)

# Advisory lock key — arbitrary int32 shared across all replicas. Documented here
# so it doesn't collide with other advisory locks (none currently in use).
_CLEANUP_ADVISORY_LOCK_KEY = 7231


def _require_admin_bearer(authorization: Optional[str]) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="admin bearer required",
        )
    provided = authorization.split(" ", 1)[1].strip()
    expected = settings.admin_cleanup_secret
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid admin bearer",
        )


@router.post("/cleanup-deleted", response_model=CleanupRunReport)
async def cleanup_deleted(authorization: Optional[str] = Header(default=None)):
    _require_admin_bearer(authorization)

    db = get_supabase()

    # pg_try_advisory_lock prevents concurrent cron invocations from
    # processing the same users twice. If another run holds the lock, return
    # 409 immediately — the caller can retry on the next scheduled tick.
    lock_taken = False
    try:
        lock_result = db.rpc(
            "pg_try_advisory_lock",
            {"key": _CLEANUP_ADVISORY_LOCK_KEY},
        ).execute()
        lock_taken = bool(
            (lock_result.data if hasattr(lock_result, "data") else lock_result)
        )
    except Exception:  # pragma: no cover — RPC unavailability shouldn't block cleanup
        logger.exception(
            "cleanup_deleted: pg_try_advisory_lock RPC unavailable — running without lock",
        )
        lock_taken = True  # graceful degradation; admin endpoint is manual-only

    if not lock_taken:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="cleanup already in progress",
        )

    try:
        report = purge_due_users(db)
    finally:
        if lock_taken:
            try:
                db.rpc(
                    "pg_advisory_unlock",
                    {"key": _CLEANUP_ADVISORY_LOCK_KEY},
                ).execute()
            except Exception:  # pragma: no cover
                logger.exception(
                    "cleanup_deleted: pg_advisory_unlock failed — connection will release on close",
                )

    return CleanupRunReport(
        processed=report["processed"],
        deleted_users=report["deleted_users"],
        errors=[CleanupError(**err) for err in report["errors"]],
        ran_at=datetime.now(timezone.utc),
    )
