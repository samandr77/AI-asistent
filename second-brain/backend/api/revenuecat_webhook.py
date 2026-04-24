import hmac
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from database import get_supabase

try:
    import sentry_sdk
except ModuleNotFoundError:
    sentry_sdk = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)

# RC event types that activate/maintain premium
_PREMIUM_ACTIVE_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "PRODUCT_CHANGE",
    "TRANSFER",
}
# RC event types that deactivate premium
_PREMIUM_INACTIVE_EVENTS = {"EXPIRATION", "SUBSCRIPTION_PAUSED"}
# RC event types handled but that don't change is_premium
_SOFT_EVENTS = {"CANCELLATION"}
# Known events we recognise (everything else is logged and ignored)
_KNOWN_EVENTS = _PREMIUM_ACTIVE_EVENTS | _PREMIUM_INACTIVE_EVENTS | _SOFT_EVENTS


def _verify_secret(cred: Optional[HTTPAuthorizationCredentials]) -> None:
    """Constant-time comparison of the webhook bearer token."""
    expected = settings.revenuecat_webhook_secret
    if not expected:
        raise HTTPException(status_code=401, detail="Webhook secret not configured")
    token = cred.credentials if cred else ""
    if not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


def _parse_timestamp(value: Optional[int]) -> Optional[datetime]:
    """Convert RC millisecond epoch → timezone-aware datetime."""
    if value is None:
        return None
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc)


@router.post("/revenuecat")
async def revenuecat_webhook(
    request: Request,
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    _verify_secret(cred)

    try:
        body = await request.json()
    except Exception as exc:
        logger.error("RC webhook: failed to parse JSON body: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = body.get("event", {})
    event_type: str = event.get("type", "UNKNOWN")
    app_user_id: Optional[str] = event.get("app_user_id")

    logger.info(
        "RC webhook received",
        extra={"event_type": event_type, "app_user_id": app_user_id},
    )

    if event_type not in _KNOWN_EVENTS:
        logger.info("RC webhook: ignoring unknown event type %s", event_type)
        return {"received": True}

    if not app_user_id:
        logger.warning("RC webhook: missing app_user_id for event %s", event_type)
        return {"received": True}

    try:
        _process_event(event_type, app_user_id, event)
    except Exception as exc:
        logger.exception("RC webhook: upsert failed for user %s event %s", app_user_id, event_type)
        if sentry_sdk:
            sentry_sdk.capture_exception(exc)
        raise HTTPException(status_code=500, detail="Internal processing error")

    return {"received": True}


def _process_event(event_type: str, user_id: str, event: dict) -> None:
    db = get_supabase()

    expires_at = _parse_timestamp(event.get("expiration_at_ms"))
    purchase_date = _parse_timestamp(event.get("purchased_at_ms"))
    product_id: Optional[str] = event.get("product_id")
    period_type: Optional[str] = event.get("period_type")
    store: Optional[str] = _normalise_store(event.get("store"))

    if event_type in _PREMIUM_ACTIVE_EVENTS:
        row = {
            "user_id": user_id,
            "is_premium": True,
            "entitlement_id": event.get("entitlement_id") or "premium",
            "product_id": product_id,
            "period_type": period_type,
            "purchase_date": purchase_date.isoformat() if purchase_date else None,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "store": store,
            "cancelled_at": None,
        }
        db.table("user_premium").upsert(row, on_conflict="user_id").execute()

    elif event_type == "CANCELLATION":
        now_iso = datetime.now(timezone.utc).isoformat()
        # is_premium stays true — subscription active until EXPIRATION fires
        db.table("user_premium").upsert(
            {
                "user_id": user_id,
                "cancelled_at": now_iso,
            },
            on_conflict="user_id",
        ).execute()

    elif event_type in _PREMIUM_INACTIVE_EVENTS:
        db.table("user_premium").upsert(
            {
                "user_id": user_id,
                "is_premium": False,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
            on_conflict="user_id",
        ).execute()

    logger.info(
        "RC webhook: processed event",
        extra={"event_type": event_type, "user_id": user_id, "product_id": product_id},
    )


def _normalise_store(store: Optional[str]) -> Optional[str]:
    _MAP = {
        "APP_STORE": "app_store",
        "PLAY_STORE": "play_store",
        "STRIPE": "stripe",
        "PROMOTIONAL": "promotional",
    }
    if store is None:
        return None
    return _MAP.get(store.upper(), store.lower())
