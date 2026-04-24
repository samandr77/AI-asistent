import pytest
from unittest.mock import patch, MagicMock
from datetime import date
from httpx import AsyncClient, ASGITransport

TEST_USER_A = "user-a-refl-0001"
TEST_USER_B = "user-b-refl-0002"

REF_ROW = {
    "id": "refl-uuid-0001",
    "user_id": TEST_USER_A,
    "date": "2026-04-24",
    "mood": 4,
    "energy": 3,
    "notes": "Good day",
    "completed_count": 5,
    "goal_aligned_count": 2,
    "active_goal_ids": ["goal-uuid-0001"],
    "created_at": "2026-04-24T21:00:00+00:00",
    "updated_at": "2026-04-24T21:00:00+00:00",
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


# ── TODAY SUMMARY ─────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_today_summary_empty(client_a):
    with patch("api.reflections.compute_daily_summary") as mock_summary:
        from models.reflection import DailySummary
        mock_summary.return_value = DailySummary(
            date=date.today(),
            completed_tasks=[],
            goal_aligned_tasks=[],
            goals_with_progress=[],
            total_dumps=0,
            existing_reflection=None,
        )
        resp = await client_a.get("/reflections/today/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed_tasks"] == []
    assert body["goal_aligned_tasks"] == []
    assert body["existing_reflection"] is None


@pytest.mark.anyio
async def test_today_summary_with_goal_aligned(client_a):
    with patch("api.reflections.compute_daily_summary") as mock_summary:
        from models.reflection import DailySummary, TaskBrief, GoalBrief
        mock_summary.return_value = DailySummary(
            date=date.today(),
            completed_tasks=[
                TaskBrief(id="t1", title="Task A", goal_id="goal-1", sphere="work"),
                TaskBrief(id="t2", title="Task B", goal_id=None, sphere="health"),
            ],
            goal_aligned_tasks=[
                TaskBrief(id="t1", title="Task A", goal_id="goal-1", sphere="work"),
            ],
            goals_with_progress=[
                GoalBrief(id="goal-1", title="Launch SaaS", sphere="work", completed_task_count=1),
            ],
            total_dumps=2,
            existing_reflection=None,
        )
        resp = await client_a.get("/reflections/today/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["completed_tasks"]) == 2
    assert len(body["goal_aligned_tasks"]) == 1
    assert len(body["goals_with_progress"]) == 1
    assert body["total_dumps"] == 2


@pytest.mark.anyio
async def test_today_summary_no_auth():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/reflections/today/summary")
    assert resp.status_code == 401


# ── CREATE (POST) ─────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_create_reflection_success(client_a):
    with patch("api.reflections.compute_daily_summary") as mock_summary, \
         patch("api.reflections.get_supabase") as mock_db:
        from models.reflection import DailySummary
        mock_summary.return_value = DailySummary(
            date=date.today(),
            completed_tasks=[],
            goal_aligned_tasks=[],
            goals_with_progress=[],
            total_dumps=0,
            existing_reflection=None,
        )
        db = mock_db.return_value
        # no existing → insert
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        db.table.return_value.insert.return_value.execute.return_value.data = [REF_ROW]

        resp = await client_a.post("/reflections/", json={"mood": 4, "energy": 3, "notes": "Good day"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["mood"] == 4
    assert body["energy"] == 3


@pytest.mark.anyio
async def test_create_reflection_upsert(client_a):
    """When reflection for that date already exists, it updates instead of inserting."""
    with patch("api.reflections.compute_daily_summary") as mock_summary, \
         patch("api.reflections.get_supabase") as mock_db:
        from models.reflection import DailySummary
        mock_summary.return_value = DailySummary(
            date=date.today(),
            completed_tasks=[],
            goal_aligned_tasks=[],
            goals_with_progress=[],
            total_dumps=0,
            existing_reflection=None,
        )
        db = mock_db.return_value
        # existing found → update path
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": "refl-uuid-0001"}]
        updated_row = {**REF_ROW, "mood": 5}
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [updated_row]

        resp = await client_a.post("/reflections/", json={"mood": 5, "energy": 3})
    assert resp.status_code == 201
    assert resp.json()["mood"] == 5


@pytest.mark.anyio
async def test_create_reflection_mood_zero_returns_422(client_a):
    resp = await client_a.post("/reflections/", json={"mood": 0, "energy": 3})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_reflection_mood_six_returns_422(client_a):
    resp = await client_a.post("/reflections/", json={"mood": 6, "energy": 3})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_reflection_energy_zero_returns_422(client_a):
    resp = await client_a.post("/reflections/", json={"mood": 3, "energy": 0})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_reflection_notes_too_long_returns_422(client_a):
    resp = await client_a.post("/reflections/", json={"mood": 3, "energy": 3, "notes": "x" * 4001})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_reflection_notes_exactly_4000_ok(client_a):
    with patch("api.reflections.compute_daily_summary") as mock_summary, \
         patch("api.reflections.get_supabase") as mock_db:
        from models.reflection import DailySummary
        mock_summary.return_value = DailySummary(
            date=date.today(), completed_tasks=[], goal_aligned_tasks=[],
            goals_with_progress=[], total_dumps=0, existing_reflection=None,
        )
        db = mock_db.return_value
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        db.table.return_value.insert.return_value.execute.return_value.data = [REF_ROW]

        resp = await client_a.post("/reflections/", json={"mood": 3, "energy": 3, "notes": "x" * 4000})
    assert resp.status_code == 201


# ── PATCH ─────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_patch_reflection_success(client_a):
    updated = {**REF_ROW, "mood": 5, "notes": "Updated"}
    with patch("api.reflections.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [updated]
        resp = await client_a.patch("/reflections/refl-uuid-0001", json={"mood": 5, "notes": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["mood"] == 5


@pytest.mark.anyio
async def test_patch_reflection_rls_isolation(client_b):
    with patch("api.reflections.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_b.patch("/reflections/refl-uuid-0001", json={"mood": 1})
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_patch_reflection_no_fields_returns_422(client_a):
    resp = await client_a.patch("/reflections/refl-uuid-0001", json={})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_patch_reflection_invalid_mood_returns_422(client_a):
    resp = await client_a.patch("/reflections/refl-uuid-0001", json={"mood": 6})
    assert resp.status_code == 422


# ── LIST ──────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_reflections_returns_list(client_a):
    with patch("api.reflections.get_supabase") as mock_db:
        chain = mock_db.return_value.table.return_value.select.return_value.eq.return_value
        chain.order.return_value.limit.return_value.execute.return_value.data = [REF_ROW]
        resp = await client_a.get("/reflections/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["mood"] == 4


# ── GET BY DATE ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_by_date_found(client_a):
    with patch("api.reflections.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [REF_ROW]
        resp = await client_a.get("/reflections/2026-04-24")
    assert resp.status_code == 200
    assert resp.json()["date"] == "2026-04-24"


@pytest.mark.anyio
async def test_get_by_date_not_found_returns_404(client_a):
    with patch("api.reflections.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_a.get("/reflections/2020-01-01")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_get_by_date_invalid_format_returns_422(client_a):
    resp = await client_a.get("/reflections/not-a-date")
    assert resp.status_code == 422


# ── STATS ─────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_stats(client_a):
    with patch("api.reflections.compute_streak") as mock_streak:
        from models.reflection import ReflectionStats
        mock_streak.return_value = ReflectionStats(current_streak=3, longest_streak=7, total_reflections=15)
        resp = await client_a.get("/reflections/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["current_streak"] == 3
    assert body["longest_streak"] == 7


# ── DELETE ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_delete_reflection_success(client_a):
    with patch("api.reflections.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [REF_ROW]
        resp = await client_a.delete("/reflections/refl-uuid-0001")
    assert resp.status_code == 204


@pytest.mark.anyio
async def test_delete_reflection_not_found_returns_404(client_a):
    with patch("api.reflections.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        resp = await client_a.delete("/reflections/nonexistent")
    assert resp.status_code == 404
