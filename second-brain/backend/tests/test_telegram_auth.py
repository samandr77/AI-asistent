from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import timedelta
from urllib.parse import urlencode
from uuid import UUID
from unittest.mock import patch

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from auth import get_current_user
from models.telegram import TelegramSessionUser
from services.telegram_users import TelegramBootstrapResult
from services.telegram_init_data import (
    TelegramInitDataError,
    TelegramInitDataExpired,
    validate_telegram_init_data,
)


BOT_TOKEN = "123456:test-bot-token"
APP_SESSION_SECRET = "test-app-session-secret"


def _make_init_data(
    *,
    bot_token: str = BOT_TOKEN,
    auth_date: int | None = None,
    user: dict | None = None,
    include_hash: bool = True,
) -> str:
    payload = {
        "auth_date": str(auth_date or int(time.time())),
        "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
        "start_param": "task:abc",
        "user": json.dumps(
            (
                user
                if user is not None
                else {
                    "id": 1001,
                    "first_name": "Alex",
                    "username": "alex",
                    "language_code": "ru",
                    "allows_write_to_pm": True,
                }
            ),
            separators=(",", ":"),
        ),
    }
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(payload.items())
    )
    secret_key = hmac.new(
        b"WebAppData",
        bot_token.encode(),
        hashlib.sha256,
    ).digest()
    payload_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()
    if include_hash:
        payload["hash"] = payload_hash
    return urlencode(payload)


def test_validate_telegram_init_data_accepts_valid_payload():
    now = int(time.time())
    result = validate_telegram_init_data(
        _make_init_data(auth_date=now),
        bot_token=BOT_TOKEN,
        max_age_seconds=60,
        now=now,
    )

    assert result.telegram_user.id == 1001
    assert result.telegram_user.username == "alex"
    assert result.start_param == "task:abc"


def test_validate_telegram_init_data_rejects_tampering():
    init_data = _make_init_data().replace("Alex", "Mallory")

    with pytest.raises(TelegramInitDataError, match="hash is invalid"):
        validate_telegram_init_data(init_data, bot_token=BOT_TOKEN)


def test_validate_telegram_init_data_rejects_stale_payload():
    now = int(time.time())
    init_data = _make_init_data(auth_date=now - 120)

    with pytest.raises(TelegramInitDataExpired):
        validate_telegram_init_data(
            init_data,
            bot_token=BOT_TOKEN,
            max_age_seconds=60,
            now=now,
        )


def test_validate_telegram_init_data_rejects_missing_user():
    init_data = _make_init_data(user={"id": 1001})

    with pytest.raises(TelegramInitDataError, match="user is invalid"):
        validate_telegram_init_data(init_data, bot_token=BOT_TOKEN)


def test_validate_telegram_init_data_accepts_local_dev_payload_when_enabled():
    init_data = _make_init_data(include_hash=False) + "&hash=local-dev-only"

    with patch("services.telegram_init_data.settings") as mock_settings:
        mock_settings.environment = "development"
        mock_settings.telegram_dev_auth_enabled = True
        mock_settings.telegram_init_data_max_age_seconds = 60
        result = validate_telegram_init_data(
            init_data,
            bot_token="",
            max_age_seconds=60,
            now=int(time.time()),
        )

    assert result.telegram_user.id == 1001
    assert result.start_param == "task:abc"


def test_validate_telegram_init_data_rejects_local_dev_payload_when_disabled():
    init_data = _make_init_data(include_hash=False) + "&hash=local-dev-only"

    with patch("services.telegram_init_data.settings") as mock_settings:
        mock_settings.environment = "development"
        mock_settings.telegram_dev_auth_enabled = False
        with pytest.raises(TelegramInitDataError, match="hash is invalid"):
            validate_telegram_init_data(init_data, bot_token=BOT_TOKEN)


@pytest.mark.anyio
async def test_get_current_user_accepts_app_session_jwt():
    from auth import issue_app_session_token

    app = FastAPI()

    @app.get("/me")
    async def me(user=Depends(get_current_user)):
        return {"id": user.id, "provider": user.provider}

    with patch("auth.settings") as mock_settings:
        mock_settings.app_session_jwt_secret = APP_SESSION_SECRET
        mock_settings.supabase_jwt_secret = "different-supabase-secret"
        token, _ = issue_app_session_token(
            "00000000-0000-4000-8000-000000000001",
            telegram_user_id=1001,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get(
                "/me",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 200
    assert response.json() == {
        "id": "00000000-0000-4000-8000-000000000001",
        "provider": "telegram",
    }


@pytest.mark.anyio
async def test_existing_auth_me_accepts_app_session_jwt():
    from auth import issue_app_session_token
    from main import app

    with patch("auth.settings") as auth_settings:
        auth_settings.app_session_jwt_secret = APP_SESSION_SECRET
        auth_settings.supabase_jwt_secret = "different-supabase-secret"
        token, _ = issue_app_session_token(
            "00000000-0000-4000-8000-000000000001",
            telegram_user_id=1001,
        )
        with patch("api.auth.get_supabase") as mock_db:
            mock_db.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                response = await client.get(
                    "/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                )

    assert response.status_code == 200
    assert response.json()["provider"] == "telegram"


@pytest.mark.anyio
async def test_get_current_user_rejects_expired_app_session_jwt():
    from auth import issue_app_session_token

    app = FastAPI()

    @app.get("/me")
    async def me(user=Depends(get_current_user)):
        return {"id": user.id, "provider": user.provider}

    with patch("auth.settings") as mock_settings:
        mock_settings.app_session_jwt_secret = APP_SESSION_SECRET
        mock_settings.supabase_jwt_secret = "different-supabase-secret"
        token, _ = issue_app_session_token(
            "00000000-0000-4000-8000-000000000001",
            expires_delta=timedelta(seconds=-1),
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get(
                "/me",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 401


@pytest.mark.anyio
async def test_telegram_session_endpoint_returns_app_session():
    from main import app

    init_data = _make_init_data()
    expires_at = "2026-05-02T12:00:00+00:00"
    bootstrap = TelegramBootstrapResult(
        user=TelegramSessionUser(
            id=UUID("00000000-0000-4000-8000-000000000001"),
            telegram_user_id=1001,
            username="alex",
            language="ru",
        ),
        profile=None,
        is_new_user=True,
    )

    with patch("services.telegram_init_data.settings") as init_settings:
        init_settings.telegram_bot_token = BOT_TOKEN
        init_settings.telegram_init_data_max_age_seconds = 86_400
        with patch("api.telegram_auth.get_supabase", return_value=object()):
            with patch("api.telegram_auth.bootstrap_telegram_user", return_value=bootstrap):
                with patch(
                    "api.telegram_auth.issue_app_session_token",
                    return_value=("app-session-token", expires_at),
                ):
                    async with AsyncClient(
                        transport=ASGITransport(app=app),
                        base_url="http://test",
                    ) as client:
                        response = await client.post(
                            "/telegram/auth/session",
                            json={"init_data": init_data},
                        )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "app-session-token"
    assert body["token_type"] == "bearer"
    assert body["user"]["provider"] == "telegram"
    assert body["user"]["telegram_user_id"] == 1001
    assert body["is_new_user"] is True
    assert body["start_param"] == "task:abc"


@pytest.mark.anyio
async def test_telegram_session_endpoint_rejects_invalid_init_data():
    from main import app

    with patch("api.telegram_auth.validate_telegram_init_data") as validate:
        validate.side_effect = TelegramInitDataError("bad")
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/telegram/auth/session",
                json={"init_data": "bad"},
            )

    assert response.status_code == 401
