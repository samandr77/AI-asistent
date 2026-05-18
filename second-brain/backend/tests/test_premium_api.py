import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport

from models.premium import PremiumStatus

TEST_USER_ID = "premium-api-user-001"

PREMIUM_ROW = {
    "user_id": TEST_USER_ID,
    "is_premium": True,
    "entitlement_id": "premium",
    "product_id": "com.secondbrain.premium.monthly",
    "period_type": "normal",
    "purchase_date": "2026-04-01T00:00:00+00:00",
    "expires_at": "2026-05-01T00:00:00+00:00",
    "store": "app_store",
    "cancelled_at": None,
}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    from main import app
    import auth
    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER_ID
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def unauthed_client():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ── GET /premium/status ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_status_no_row_returns_free_defaults(client):
    """When no user_premium row exists, endpoint returns free-tier defaults."""
    free = PremiumStatus()
    with patch("api.premium.get_user_premium", new=AsyncMock(return_value=free)):
        resp = await client.get("/premium/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_premium"] is False
    assert body["entitlement_id"] is None
    assert body["expires_at"] is None
    assert body["cancelled"] is False


@pytest.mark.anyio
async def test_status_premium_row_returns_premium(client):
    premium = PremiumStatus(
        is_premium=True,
        entitlement_id="premium",
        expires_at="2026-05-01T00:00:00+00:00",
        period_type="normal",
        store="app_store",
        cancelled=False,
    )
    with patch("api.premium.get_user_premium", new=AsyncMock(return_value=premium)):
        resp = await client.get("/premium/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_premium"] is True
    assert body["entitlement_id"] == "premium"
    assert body["store"] == "app_store"


@pytest.mark.anyio
async def test_status_cancelled_subscription(client):
    premium = PremiumStatus(is_premium=True, cancelled=True)
    with patch("api.premium.get_user_premium", new=AsyncMock(return_value=premium)):
        resp = await client.get("/premium/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_premium"] is True
    assert body["cancelled"] is True


@pytest.mark.anyio
async def test_status_unauthenticated_returns_401(unauthed_client):
    resp = await unauthed_client.get("/premium/status")
    assert resp.status_code == 401


# ── POST /premium/link ────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_link_matching_user_id_returns_200(client):
    resp = await client.post(
        "/premium/link",
        json={"revenuecat_app_user_id": TEST_USER_ID},
    )
    assert resp.status_code == 200
    assert resp.json()["linked"] is True


@pytest.mark.anyio
async def test_link_mismatched_user_id_returns_400(client):
    resp = await client.post(
        "/premium/link",
        json={"revenuecat_app_user_id": "some-other-user-id"},
    )
    assert resp.status_code == 400


@pytest.mark.anyio
async def test_link_unauthenticated_returns_401(unauthed_client):
    resp = await unauthed_client.post(
        "/premium/link",
        json={"revenuecat_app_user_id": TEST_USER_ID},
    )
    assert resp.status_code == 401


# ── get_user_premium service: fail-safe ──────────────────────────────────────

@pytest.mark.anyio
async def test_get_user_premium_db_error_returns_free():
    """DB error in get_user_premium must return free defaults, not raise."""
    from services.premium import get_user_premium
    with patch("services.premium.get_supabase", side_effect=RuntimeError("DB down")):
        result = await get_user_premium("any-user")
    assert result.is_premium is False
