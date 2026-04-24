from __future__ import annotations
from typing import NamedTuple
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings

try:
    import jwt
except ModuleNotFoundError:  # pragma: no cover - local/dev fallback
    jwt = None  # type: ignore[assignment]

_bearer = HTTPBearer(auto_error=False)


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user_id(
    user: CurrentUser = Depends(get_current_user),
) -> str:
    return user.id
