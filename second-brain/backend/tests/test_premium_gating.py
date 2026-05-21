from __future__ import annotations
import pytest
import math
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from models.premium import PremiumStatus
from services.premium import (
    get_daily_token_budget,
    get_daily_dump_limit,
    get_ai_tier_policy,
    get_max_active_goals,
    get_history_cutoff,
)

TEST_USER_ID = "gating-user-uuid-001"


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


# ── Service-level unit tests ──────────────────────────────────────────────────

def test_free_token_budget_uses_open_test_budget():
    p = PremiumStatus(is_premium=False)
    assert get_daily_token_budget(p) == 500_000


def test_premium_token_budget():
    p = PremiumStatus(is_premium=True)
    assert get_daily_token_budget(p) == 500_000


def test_free_dump_limit_is_open_for_test_build():
    p = PremiumStatus(is_premium=False)
    assert get_daily_dump_limit(p) == math.inf


def test_premium_dump_limit_is_inf():
    p = PremiumStatus(is_premium=True)
    assert get_daily_dump_limit(p) == math.inf


def test_free_ai_tier_policy_is_open_for_test_build():
    p = PremiumStatus(is_premium=False)
    assert get_ai_tier_policy(p) == ["groq_llama", "claude_haiku", "claude_sonnet"]


def test_premium_ai_tier_policy():
    p = PremiumStatus(is_premium=True)
    assert get_ai_tier_policy(p) == ["groq_llama", "claude_haiku", "claude_sonnet"]


def test_free_max_goals_is_open_for_test_build():
    p = PremiumStatus(is_premium=False)
    assert get_max_active_goals(p) == math.inf


def test_premium_max_goals_is_inf():
    p = PremiumStatus(is_premium=True)
    assert get_max_active_goals(p) == math.inf


def test_free_history_cutoff_is_none_for_test_build():
    p = PremiumStatus(is_premium=False)
    assert get_history_cutoff(p) is None


def test_premium_history_cutoff_is_none():
    p = PremiumStatus(is_premium=True)
    assert get_history_cutoff(p) is None


# ── HTTP-level dump limit enforcement ─────────────────────────────────────────

def _free_premium():
    return PremiumStatus(is_premium=False)


def _paid_premium():
    return PremiumStatus(is_premium=True)


def _mock_dump_db(today_count: int):
    """Returns a mock db whose count for today's dumps returns today_count."""
    mock_db = MagicMock()
    count_result = MagicMock()
    count_result.count = today_count
    (
        mock_db.table.return_value
        .select.return_value
        .eq.return_value
        .gte.return_value
        .execute.return_value
    ) = count_result
    return mock_db


@pytest.mark.anyio
async def test_dump_limit_10th_dump_allowed(client):
    """9 previous dumps → 10th should proceed (count=9 < limit=10)."""
    with (
        patch("api.dump.get_user_premium", new=AsyncMock(return_value=_free_premium())),
        patch("api.dump.get_supabase", return_value=_mock_dump_db(9)),
        patch("api.dump.ai_budget.has_budget", new=AsyncMock(return_value=True)),
        patch("api.dump.parse_dump", new=AsyncMock(side_effect=ValueError("stop early"))),
    ):
        resp = await client.post("/dump/text", json={"text": "hello"})
    # parse error → 422, meaning the limit gate passed
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_dump_limit_not_applied_for_free_test_build(client):
    """Test build: even a free/default user is not blocked by dump count."""
    with (
        patch("api.dump.get_user_premium", new=AsyncMock(return_value=_free_premium())),
        patch("api.dump.get_supabase", return_value=_mock_dump_db(10)),
        patch("api.dump.ai_budget.has_budget", new=AsyncMock(return_value=True)),
        patch("api.dump.parse_dump", new=AsyncMock(side_effect=ValueError("stop early"))),
    ):
        resp = await client.post("/dump/text", json={"text": "hello"})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_dump_limit_not_applied_for_premium(client):
    """Premium user with 100 dumps today should not be blocked."""
    with (
        patch("api.dump.get_user_premium", new=AsyncMock(return_value=_paid_premium())),
        patch("api.dump.ai_budget.has_budget", new=AsyncMock(return_value=True)),
        patch("api.dump.parse_dump", new=AsyncMock(side_effect=ValueError("stop early"))),
    ):
        resp = await client.post("/dump/text", json={"text": "hello"})
    # parse error → 422, not 402 — gate passed
    assert resp.status_code == 422


# ── HTTP-level goal limit enforcement ────────────────────────────────────────

def _mock_goals_db(active_count: int, insert_data: list | None = None):
    mock_db = MagicMock()
    count_result = MagicMock()
    count_result.count = active_count
    (
        mock_db.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .execute.return_value
    ) = count_result
    insert_result = MagicMock()
    insert_result.data = insert_data or []
    mock_db.table.return_value.insert.return_value.execute.return_value = insert_result
    return mock_db


@pytest.mark.anyio
async def test_goal_limit_3rd_goal_allowed(client):
    """2 active goals → 3rd should be allowed (count=2 < limit=3)."""
    new_goal = {
        "id": "goal-new",
        "user_id": TEST_USER_ID,
        "title": "Goal 3",
        "status": "active",
        "sphere": "work",
        "progress_percent": 0,
        "created_at": "2026-04-24T00:00:00+00:00",
        "updated_at": "2026-04-24T00:00:00+00:00",
    }
    with (
        patch("api.goals.get_user_premium", new=AsyncMock(return_value=_free_premium())),
        patch("api.goals.get_supabase", return_value=_mock_goals_db(2, [new_goal])),
    ):
        resp = await client.post("/goals/", json={"title": "Goal 3", "sphere": "work"})
    assert resp.status_code == 201


@pytest.mark.anyio
async def test_goal_limit_not_applied_for_free_test_build(client):
    """Test build: even a free/default user can create more than 3 active goals."""
    new_goal = {
        "id": "goal-new",
        "user_id": TEST_USER_ID,
        "title": "Goal 4",
        "status": "active",
        "sphere": "work",
        "progress_percent": 0,
        "created_at": "2026-04-24T00:00:00+00:00",
        "updated_at": "2026-04-24T00:00:00+00:00",
    }
    with (
        patch("api.goals.get_user_premium", new=AsyncMock(return_value=_free_premium())),
        patch("api.goals.get_supabase", return_value=_mock_goals_db(3, [new_goal])),
    ):
        resp = await client.post("/goals/", json={"title": "Goal 4", "sphere": "work"})
    assert resp.status_code == 201


@pytest.mark.anyio
async def test_goal_limit_not_applied_for_premium(client):
    """Premium user with 10 active goals should still be able to create one more."""
    new_goal = {
        "id": "goal-new",
        "user_id": TEST_USER_ID,
        "title": "Goal 11",
        "status": "active",
        "sphere": "work",
        "progress_percent": 0,
        "created_at": "2026-04-24T00:00:00+00:00",
        "updated_at": "2026-04-24T00:00:00+00:00",
    }
    with (
        patch("api.goals.get_user_premium", new=AsyncMock(return_value=_paid_premium())),
        patch("api.goals.get_supabase", return_value=_mock_goals_db(10, [new_goal])),
    ):
        resp = await client.post("/goals/", json={"title": "Goal 11", "sphere": "work"})
    assert resp.status_code == 201
