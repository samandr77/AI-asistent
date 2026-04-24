import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport

WEBHOOK_SECRET = "test-webhook-secret-abc"
AUTH_HEADER = {"Authorization": f"Bearer {WEBHOOK_SECRET}"}

PURCHASE_EVENT = {
    "event": {
        "type": "INITIAL_PURCHASE",
        "app_user_id": "user-uuid-001",
        "product_id": "com.secondbrain.premium.monthly",
        "period_type": "normal",
        "purchased_at_ms": 1745500000000,
        "expiration_at_ms": 1748092000000,
        "store": "APP_STORE",
        "entitlement_id": "premium",
    }
}


@pytest.fixture(autouse=True)
def patch_webhook_secret(monkeypatch):
    monkeypatch.setenv("REVENUECAT_WEBHOOK_SECRET", WEBHOOK_SECRET)
    import config
    config.settings.revenuecat_webhook_secret = WEBHOOK_SECRET


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _mock_upsert():
    mock_db = MagicMock()
    mock_db.table.return_value.upsert.return_value.execute.return_value.data = [{"user_id": "user-uuid-001"}]
    return mock_db


# ── Auth ──────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_webhook_missing_auth_returns_401(client):
    resp = await client.post("/webhooks/revenuecat", json=PURCHASE_EVENT)
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_webhook_wrong_secret_returns_401(client):
    resp = await client.post(
        "/webhooks/revenuecat",
        json=PURCHASE_EVENT,
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 401


# ── INITIAL_PURCHASE ──────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_initial_purchase_sets_premium(client):
    with patch("api.revenuecat_webhook.get_supabase", return_value=_mock_upsert()):
        resp = await client.post("/webhooks/revenuecat", json=PURCHASE_EVENT, headers=AUTH_HEADER)
    assert resp.status_code == 200
    assert resp.json()["received"] is True


@pytest.mark.anyio
async def test_initial_purchase_upsert_row(client):
    mock_db = _mock_upsert()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        await client.post("/webhooks/revenuecat", json=PURCHASE_EVENT, headers=AUTH_HEADER)
    upsert_call = mock_db.table.return_value.upsert.call_args
    row = upsert_call[0][0]
    assert row["is_premium"] is True
    assert row["user_id"] == "user-uuid-001"
    assert row["store"] == "app_store"


# ── RENEWAL ───────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_renewal_sets_premium(client):
    event = {**PURCHASE_EVENT["event"], "type": "RENEWAL"}
    with patch("api.revenuecat_webhook.get_supabase", return_value=_mock_upsert()):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200


# ── CANCELLATION ──────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_cancellation_sets_cancelled_at_not_is_premium(client):
    event = {**PURCHASE_EVENT["event"], "type": "CANCELLATION"}
    mock_db = _mock_upsert()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200
    row = mock_db.table.return_value.upsert.call_args[0][0]
    # is_premium should NOT be in the row (not set to False on cancellation)
    assert "is_premium" not in row
    assert "cancelled_at" in row


# ── EXPIRATION ────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_expiration_sets_is_premium_false(client):
    event = {**PURCHASE_EVENT["event"], "type": "EXPIRATION"}
    mock_db = _mock_upsert()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200
    row = mock_db.table.return_value.upsert.call_args[0][0]
    assert row["is_premium"] is False


# ── SUBSCRIPTION_PAUSED ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_subscription_paused_sets_is_premium_false(client):
    event = {**PURCHASE_EVENT["event"], "type": "SUBSCRIPTION_PAUSED"}
    mock_db = _mock_upsert()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200
    row = mock_db.table.return_value.upsert.call_args[0][0]
    assert row["is_premium"] is False


# ── UNCANCELLATION ────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_uncancellation_sets_premium(client):
    event = {**PURCHASE_EVENT["event"], "type": "UNCANCELLATION"}
    with patch("api.revenuecat_webhook.get_supabase", return_value=_mock_upsert()):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200


# ── NON_RENEWING_PURCHASE ─────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_non_renewing_purchase_sets_premium(client):
    event = {**PURCHASE_EVENT["event"], "type": "NON_RENEWING_PURCHASE"}
    with patch("api.revenuecat_webhook.get_supabase", return_value=_mock_upsert()):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200


# ── PRODUCT_CHANGE ────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_product_change_sets_premium(client):
    event = {**PURCHASE_EVENT["event"], "type": "PRODUCT_CHANGE"}
    with patch("api.revenuecat_webhook.get_supabase", return_value=_mock_upsert()):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200


# ── TRANSFER ──────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_transfer_sets_premium(client):
    event = {**PURCHASE_EVENT["event"], "type": "TRANSFER"}
    with patch("api.revenuecat_webhook.get_supabase", return_value=_mock_upsert()):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200


# ── Unknown event ─────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_unknown_event_returns_200_no_upsert(client):
    event = {**PURCHASE_EVENT["event"], "type": "TOTALLY_UNKNOWN_EVENT"}
    mock_db = MagicMock()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200
    mock_db.table.assert_not_called()


# ── Idempotency ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_same_event_twice_returns_200_both_times(client):
    mock_db = _mock_upsert()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        r1 = await client.post("/webhooks/revenuecat", json=PURCHASE_EVENT, headers=AUTH_HEADER)
        r2 = await client.post("/webhooks/revenuecat", json=PURCHASE_EVENT, headers=AUTH_HEADER)
    assert r1.status_code == 200
    assert r2.status_code == 200


# ── Missing app_user_id ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_missing_app_user_id_returns_200_no_upsert(client):
    event = {k: v for k, v in PURCHASE_EVENT["event"].items() if k != "app_user_id"}
    mock_db = MagicMock()
    with patch("api.revenuecat_webhook.get_supabase", return_value=mock_db):
        resp = await client.post("/webhooks/revenuecat", json={"event": event}, headers=AUTH_HEADER)
    assert resp.status_code == 200
    mock_db.table.assert_not_called()
