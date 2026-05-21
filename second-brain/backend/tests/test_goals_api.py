from __future__ import annotations
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from models.premium import PremiumStatus
from httpx import AsyncClient, ASGITransport

TEST_USER_A = "user-a-uuid-0001"
TEST_USER_B = "user-b-uuid-0002"

GOAL_ROW = {
    "id": "goal-uuid-0001",
    "user_id": TEST_USER_A,
    "title": "Запустить SaaS",
    "description": None,
    "target_date": None,
    "status": "active",
    "sphere": "work",
    "progress_percent": 0,
    "created_at": "2026-04-24T00:00:00+00:00",
    "updated_at": "2026-04-24T00:00:00+00:00",
}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client_a():
    from main import app
    import auth
    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER_A
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def client_b():
    from main import app
    import auth
    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER_B
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _mock_db_chain(return_data):
    mock = MagicMock()
    terminal = MagicMock()
    terminal.execute.return_value.data = return_data
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value = terminal
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.range.return_value = terminal
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.lte.return_value.order.return_value.range.return_value = terminal
    return mock


# ── LIST ──────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_goals_returns_list(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        chain = mock_db.return_value.table.return_value.select.return_value
        chain.eq.return_value.order.return_value.range.return_value.execute.return_value.data = [GOAL_ROW]
        resp = await client_a.get("/goals/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["title"] == "Запустить SaaS"


@pytest.mark.anyio
async def test_list_goals_no_auth_returns_401():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/goals/")
    assert resp.status_code == 401


# ── GET BY ID ─────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_goal_found(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [GOAL_ROW]
        resp = await client_a.get("/goals/goal-uuid-0001")
    assert resp.status_code == 200
    assert resp.json()["id"] == "goal-uuid-0001"


@pytest.mark.anyio
async def test_get_goal_rls_isolation(client_b):
    """User B cannot read User A's goal — DB returns empty (RLS filters it)."""
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_b.get("/goals/goal-uuid-0001")
    assert resp.status_code == 404


# ── CREATE ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_create_goal_success(client_a):
    created = {**GOAL_ROW, "id": "goal-new-001"}
    with (
        patch("api.goals.get_user_premium", new=AsyncMock(return_value=PremiumStatus(is_premium=True))),
        patch("api.goals.get_supabase") as mock_db,
    ):
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [created]
        resp = await client_a.post("/goals/", json={"title": "Запустить SaaS", "sphere": "work"})
    assert resp.status_code == 201
    assert resp.json()["id"] == "goal-new-001"


@pytest.mark.anyio
async def test_create_goal_empty_title_returns_422(client_a):
    resp = await client_a.post("/goals/", json={"title": ""})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_goal_title_too_long_returns_422(client_a):
    resp = await client_a.post("/goals/", json={"title": "x" * 201})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_goal_past_target_date_returns_422(client_a):
    resp = await client_a.post("/goals/", json={"title": "Old goal", "target_date": "2020-01-01"})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_goal_invalid_status_returns_422(client_a):
    resp = await client_a.post("/goals/", json={"title": "X", "status": "deleted"})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_goal_invalid_sphere_returns_422(client_a):
    resp = await client_a.post("/goals/", json={"title": "X", "sphere": "unicorn"})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_goal_progress_out_of_range_returns_422(client_a):
    resp = await client_a.post("/goals/", json={"title": "X", "progress_percent": 150})
    assert resp.status_code == 422


# ── UPDATE ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_patch_goal_success(client_a):
    updated = {**GOAL_ROW, "title": "Обновлено"}
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [updated]
        resp = await client_a.patch("/goals/goal-uuid-0001", json={"title": "Обновлено"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Обновлено"


@pytest.mark.anyio
async def test_patch_goal_rls_isolation(client_b):
    """User B cannot update User A's goal."""
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_b.patch("/goals/goal-uuid-0001", json={"title": "Hacked"})
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_patch_goal_no_fields_returns_422(client_a):
    resp = await client_a.patch("/goals/goal-uuid-0001", json={})
    assert resp.status_code == 422


# ── DELETE ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_delete_goal_success(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [GOAL_ROW]
        resp = await client_a.delete("/goals/goal-uuid-0001")
    assert resp.status_code == 204


@pytest.mark.anyio
async def test_delete_goal_not_found_returns_404(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_a.delete("/goals/nonexistent")
    assert resp.status_code == 404


# ── LINK / UNLINK ─────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_link_task_to_goal_success(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        db = mock_db.return_value
        # goal ownership check
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "goal-uuid-0001"}]
        # task update
        db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "task-001"}]
        resp = await client_a.post("/goals/goal-uuid-0001/tasks/task-001")
    assert resp.status_code == 200
    body = resp.json()
    assert body["goal_id"] == "goal-uuid-0001"
    assert body["task_id"] == "task-001"


@pytest.mark.anyio
async def test_link_task_goal_not_found_returns_404(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_a.post("/goals/bad-goal/tasks/task-001")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_unlink_task_from_goal_success(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "task-001"}]
        resp = await client_a.delete("/goals/goal-uuid-0001/tasks/task-001")
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_unlink_task_not_linked_returns_404(client_a):
    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_a.delete("/goals/goal-uuid-0001/tasks/task-999")
    assert resp.status_code == 404


# ── GOAL TASKS LIST ───────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_goal_tasks(client_a):
    tasks = [{"id": "t1", "goal_id": "goal-uuid-0001", "title": "Build MVP"}]
    with patch("api.goals.get_supabase") as mock_db:
        db = mock_db.return_value
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "goal-uuid-0001"}]
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value.data = tasks
        resp = await client_a.get("/goals/goal-uuid-0001/tasks")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── PROGRESS ──────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_goal_progress_computed(client_a):
    tasks_data = [
        {"is_done": True},
        {"is_done": True},
        {"is_done": False},
        {"is_done": False},
    ]
    # The endpoint makes two separate db.table() calls with different tables.
    # We use side_effect to return different mocks per call.
    goal_chain = MagicMock()
    goal_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [GOAL_ROW]

    kr_chain = MagicMock()
    kr_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    tasks_chain = MagicMock()
    tasks_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = tasks_data

    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.side_effect = [goal_chain, kr_chain, tasks_chain]
        resp = await client_a.get("/goals/goal-uuid-0001/progress")
    assert resp.status_code == 200
    body = resp.json()
    assert body["computed_progress"] == 50
    assert body["linked_tasks_count"] == 4
    assert body["completed_tasks_count"] == 2


@pytest.mark.anyio
async def test_get_goal_progress_no_tasks(client_a):
    goal_chain = MagicMock()
    goal_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [GOAL_ROW]

    kr_chain = MagicMock()
    kr_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    tasks_chain = MagicMock()
    tasks_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    with patch("api.goals.get_supabase") as mock_db:
        mock_db.return_value.table.side_effect = [goal_chain, kr_chain, tasks_chain]
        resp = await client_a.get("/goals/goal-uuid-0001/progress")
    assert resp.status_code == 200
    body = resp.json()
    # With no KRs and no tasks, computed falls back to manual progress (0)
    assert body["computed_progress"] == 0
    assert body["linked_tasks_count"] == 0
