from __future__ import annotations
import importlib
import pytest
import time
import hmac
import hashlib
import base64
import json
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

pytestmark = pytest.mark.skipif(
    importlib.util.find_spec("jwt") is None,
    reason="PyJWT not installed",
)

TEST_USER_ID = "test-auth-user-uuid-5678"
TEST_JWT_SECRET = "test-jwt-secret-that-is-long-enough-for-hs256"


def _make_jwt(user_id: str, provider: str | None = None, secret: str = TEST_JWT_SECRET, expired: bool = False) -> str:
    """Build a minimal Supabase-style HS256 JWT for testing."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    now = int(time.time())
    exp = now - 10 if expired else now + 3600
    payload_data: dict = {
        "sub": user_id,
        "aud": "authenticated",
        "iat": now,
        "exp": exp,
    }
    if provider is not None:
        payload_data["app_metadata"] = {"provider": provider}

    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b"=").decode()
    signing_input = f"{header}.{payload_b64}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{header}.{payload_b64}.{sig_b64}"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def app_with_real_auth():
    """Client that does NOT override auth dependency — uses real JWT verification."""
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_jwt_with_apple_provider_accepted(app_with_real_auth):
    token = _make_jwt(TEST_USER_ID, provider="apple", secret=TEST_JWT_SECRET)
    with patch("config.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = TEST_JWT_SECRET
        with patch("auth.settings", mock_settings):
            with patch("api.auth.get_supabase") as mock_db:
                mock_db.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
                resp = await app_with_real_auth.get(
                    "/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == TEST_USER_ID
    assert body["provider"] == "apple"


@pytest.mark.anyio
async def test_jwt_with_google_provider_accepted(app_with_real_auth):
    token = _make_jwt(TEST_USER_ID, provider="google", secret=TEST_JWT_SECRET)
    with patch("config.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = TEST_JWT_SECRET
        with patch("auth.settings", mock_settings):
            with patch("api.auth.get_supabase") as mock_db:
                mock_db.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
                resp = await app_with_real_auth.get(
                    "/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == TEST_USER_ID
    assert body["provider"] == "google"


@pytest.mark.anyio
async def test_jwt_without_provider_returns_none(app_with_real_auth):
    token = _make_jwt(TEST_USER_ID, provider=None, secret=TEST_JWT_SECRET)
    with patch("config.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = TEST_JWT_SECRET
        with patch("auth.settings", mock_settings):
            with patch("api.auth.get_supabase") as mock_db:
                mock_db.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
                resp = await app_with_real_auth.get(
                    "/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] is None


@pytest.mark.anyio
async def test_jwt_expired_returns_401(app_with_real_auth):
    token = _make_jwt(TEST_USER_ID, provider="apple", secret=TEST_JWT_SECRET, expired=True)
    with patch("config.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = TEST_JWT_SECRET
        with patch("auth.settings", mock_settings):
            resp = await app_with_real_auth.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_no_token_returns_401(app_with_real_auth):
    resp = await app_with_real_auth.get("/auth/me")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_invalid_token_returns_401(app_with_real_auth):
    with patch("config.settings") as mock_settings:
        mock_settings.supabase_jwt_secret = TEST_JWT_SECRET
        with patch("auth.settings", mock_settings):
            resp = await app_with_real_auth.get(
                "/auth/me",
                headers={"Authorization": "Bearer not.a.jwt"},
            )
    assert resp.status_code == 401
