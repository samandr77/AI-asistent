from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import NamedTuple
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings

try:
    import jwt
except ModuleNotFoundError:  # pragma: no cover - local/dev fallback
    jwt = None  # type: ignore[assignment]

_bearer = HTTPBearer(auto_error=False)
APP_SESSION_AUDIENCE = "second-brain-miniapp"
APP_SESSION_ISSUER = "second-brain-api"
APP_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30


def _app_session_secret() -> str:
    secret = getattr(settings, "app_session_jwt_secret", "")
    return secret if isinstance(secret, str) else ""


class CurrentUser(NamedTuple):
    id: str
    provider: str | None


async def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    if cred is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    if jwt is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PyJWT is not installed",
        )

    expired = False
    if _app_session_secret():
        try:
            return verify_app_session_token(cred.credentials)
        except jwt.ExpiredSignatureError:
            expired = True
        except jwt.PyJWTError:
            pass

    try:
        payload = jwt.decode(
            cred.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        app_metadata = payload.get("app_metadata") or {}
        provider: str | None = app_metadata.get("provider") or None
        return CurrentUser(id=user_id, provider=provider)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        if expired:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user_id(
    user: CurrentUser = Depends(get_current_user),
) -> str:
    return user.id


def issue_app_session_token(
    user_id: str,
    *,
    telegram_user_id: int | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, datetime]:
    if jwt is None:
        raise RuntimeError("PyJWT is not installed")
    secret = _app_session_secret()
    if not secret:
        raise RuntimeError("APP_SESSION_JWT_SECRET is not configured")

    now = datetime.now(timezone.utc)
    expires_at = now + (expires_delta or timedelta(seconds=APP_SESSION_TTL_SECONDS))
    payload = {
        "sub": user_id,
        "provider": "telegram",
        "aud": APP_SESSION_AUDIENCE,
        "iss": APP_SESSION_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    if telegram_user_id is not None:
        payload["telegram_user_id"] = telegram_user_id

    token = jwt.encode(payload, secret, algorithm="HS256")
    return token, expires_at


def verify_app_session_token(token: str) -> CurrentUser:
    if jwt is None:
        raise RuntimeError("PyJWT is not installed")
    secret = _app_session_secret()
    if not secret:
        raise jwt.InvalidTokenError("APP_SESSION_JWT_SECRET is not configured")

    payload = jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience=APP_SESSION_AUDIENCE,
        issuer=APP_SESSION_ISSUER,
    )
    user_id = payload.get("sub")
    if not user_id:
        raise jwt.InvalidTokenError("App session subject is missing")
    return CurrentUser(id=user_id, provider="telegram")
