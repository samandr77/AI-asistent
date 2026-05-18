"""Account deletion lifecycle.

Two surfaces:
  * `soft_delete_user(user_id)` — sets user_profiles.deleted_at = now().
    Called synchronously by `DELETE /auth/account`.
  * `purge_due_users(db)` — hard-deletes users whose 30-day grace window
    has expired. Called by the admin cleanup endpoint (scheduled via
    GitHub Actions; see .github/workflows/cleanup-cron.yml).

Deletion is ordered: Postgres rows first (via the `cascade_delete_user` RPC
from migration 009), then auth.users via the admin API. If the auth.users
delete fails we still report success for the row cleanup — the user is
already unable to sign in because their profile row is gone.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

GRACE_DAYS = 30


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def soft_delete_user(db: Any, user_id: str) -> datetime:
    """Mark the user as pending deletion. Returns the `deleted_at` timestamp.

    Raises `AlreadyDeleted` if the row is already soft-deleted.
    Raises `UserNotFound` if no profile row exists for this user.
    """
    existing = (
        db.table("user_profiles")
        .select("id,deleted_at")
        .eq("id", user_id)
        .execute()
    )
    if not existing.data:
        raise UserNotFound(user_id)

    if existing.data[0].get("deleted_at"):
        raise AlreadyDeleted(
            user_id=user_id,
            deleted_at=existing.data[0]["deleted_at"],
        )

    deleted_at = _utc_now()
    (
        db.table("user_profiles")
        .update({"deleted_at": deleted_at.isoformat()})
        .eq("id", user_id)
        .execute()
    )

    # Best-effort: invalidate live sessions for this user. If the SDK doesn't
    # expose this method (older versions), the client-side will sign out on
    # the next 410 response from /auth/me.
    try:
        admin = getattr(db.auth, "admin", None)
        if admin is not None and hasattr(admin, "sign_out"):
            admin.sign_out(user_id)  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover — depends on supabase-py version
        logger.exception(
            "soft_delete_user: admin.sign_out failed for user_id=%s", user_id,
        )

    return deleted_at


def scheduled_purge_at(deleted_at: datetime) -> datetime:
    return deleted_at + timedelta(days=GRACE_DAYS)


def purge_due_users(db: Any) -> dict[str, Any]:
    """Hard-delete every user whose soft-delete is > GRACE_DAYS old.

    Returns a dict suitable for CleanupRunReport:
      { processed: int, deleted_users: list[uuid], errors: list[{user_id, error}] }
    """
    cutoff = _utc_now() - timedelta(days=GRACE_DAYS)
    due = (
        db.table("user_profiles")
        .select("id,deleted_at")
        .not_.is_("deleted_at", "null")
        .lt("deleted_at", cutoff.isoformat())
        .execute()
    )

    rows = due.data or []
    processed = len(rows)
    deleted: list[str] = []
    errors: list[dict[str, str]] = []

    for row in rows:
        user_id = row["id"]
        try:
            db.rpc("cascade_delete_user", {"p_user_id": user_id}).execute()
            try:
                admin = getattr(db.auth, "admin", None)
                if admin is not None and hasattr(admin, "delete_user"):
                    admin.delete_user(user_id)  # type: ignore[attr-defined]
            except Exception as auth_err:  # pragma: no cover
                logger.exception(
                    "purge_due_users: auth.admin.delete_user failed user_id=%s",
                    user_id,
                )
                errors.append({"user_id": user_id, "error": f"auth: {auth_err}"})
                continue
            deleted.append(user_id)
        except Exception as exc:  # noqa: BLE001 — we record and continue
            logger.exception(
                "purge_due_users: cascade_delete_user failed user_id=%s", user_id,
            )
            errors.append({"user_id": user_id, "error": str(exc)})

    return {
        "processed": processed,
        "deleted_users": deleted,
        "errors": errors,
    }


class AccountDeletionError(Exception):
    pass


class AlreadyDeleted(AccountDeletionError):
    def __init__(self, user_id: str, deleted_at: str):
        super().__init__(f"user {user_id} already soft-deleted at {deleted_at}")
        self.user_id = user_id
        self.deleted_at = deleted_at


class UserNotFound(AccountDeletionError):
    def __init__(self, user_id: str):
        super().__init__(f"user {user_id} not found")
        self.user_id = user_id
