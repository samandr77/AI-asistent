from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER_ID = "health-user-0001"

DAILY_ROW = {
    "id": "daily-0001",
    "user_id": TEST_USER_ID,
    "log_date": "2026-05-21",
    "mood": 7,
    "energy": 6,
    "stress": 4,
    "readiness_override": None,
    "symptoms": [],
    "notes": None,
    "created_at": "2026-05-21T00:00:00+00:00",
    "updated_at": "2026-05-21T00:00:00+00:00",
}


def test_sleep_quality_score_rewards_efficiency_and_duration():
    from services.health_sleep import calculate_sleep_quality

    good_score, good_parts = calculate_sleep_quality(
        {
            "sleep_date": "2026-05-21",
            "bedtime_at": "2026-05-20T23:30:00+00:00",
            "wake_at": "2026-05-21T07:20:00+00:00",
            "duration_minutes": 470,
        },
        prior_sleep=[
            {
                "duration_minutes": 460,
                "bedtime_at": "2026-05-19T23:20:00+00:00",
                "wake_at": "2026-05-20T07:00:00+00:00",
            },
            {
                "duration_minutes": 480,
                "bedtime_at": "2026-05-18T23:30:00+00:00",
                "wake_at": "2026-05-19T07:30:00+00:00",
            },
            {
                "duration_minutes": 455,
                "bedtime_at": "2026-05-17T23:40:00+00:00",
                "wake_at": "2026-05-18T07:15:00+00:00",
            },
        ],
    )
    bad_score, _ = calculate_sleep_quality(
        {
            "sleep_date": "2026-05-21",
            "bedtime_at": "2026-05-21T02:40:00+00:00",
            "wake_at": "2026-05-21T07:40:00+00:00",
            "duration_minutes": 300,
        }
    )

    assert good_score > bad_score
    assert good_parts["duration"] >= 90
    assert "routine" in good_parts


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


def _terminal(data: list[dict]):
    terminal = MagicMock()
    terminal.execute.return_value.data = data
    return terminal


@pytest.mark.anyio
async def test_create_daily_log_inserts_user_id(client):
    with patch("api.health.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [DAILY_ROW]

        resp = await client.post(
            "/health/daily",
            json={"log_date": "2026-05-21", "mood": 7, "energy": 6, "stress": 4},
        )

    assert resp.status_code == 201
    inserted = mock_db.return_value.table.return_value.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
    assert resp.json()["energy"] == 6


@pytest.mark.anyio
async def test_create_daily_log_validates_rating(client):
    resp = await client.post(
        "/health/daily",
        json={"log_date": "2026-05-21", "mood": 11},
    )

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_sleep_logs_returns_user_rows(client):
    sleep_row = {
        "id": "sleep-1",
        "user_id": TEST_USER_ID,
        "sleep_date": "2026-05-21",
        "duration_minutes": 450,
        "quality": 8,
        "phases": {},
        "factors": [],
    }
    terminal = _terminal([sleep_row])
    with patch("api.health.get_supabase") as mock_db:
        query = mock_db.return_value.table.return_value.select.return_value.eq.return_value
        query.order.return_value.limit.return_value = terminal

        resp = await client.get("/health/sleep")

    assert resp.status_code == 200
    assert resp.json()[0]["duration_minutes"] == 450


@pytest.mark.anyio
async def test_start_sleep_session_creates_active_session(client):
    session_row = {
        "id": "session-1",
        "user_id": TEST_USER_ID,
        "started_at": "2026-05-21T23:00:00+00:00",
        "status": "active",
        "source": "manual",
        "created_at": "2026-05-21T23:00:00+00:00",
        "updated_at": "2026-05-21T23:00:00+00:00",
    }
    with patch("api.health.get_supabase") as mock_db:
        table = mock_db.return_value.table.return_value
        table.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
        table.insert.return_value.execute.return_value.data = [session_row]

        resp = await client.post(
            "/health/sleep/sessions/start",
            json={"started_at": "2026-05-21T23:00:00+00:00"},
        )

    assert resp.status_code == 201
    assert resp.json()["status"] == "active"
    inserted = table.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID


@pytest.mark.anyio
async def test_dashboard_combines_manual_health_signals(client):
    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        assert user_id == TEST_USER_ID
        if table == "health_daily_logs":
            return [DAILY_ROW]
        if table == "health_sleep_logs":
            return [{"duration_minutes": 360, "quality": 5, "sleep_date": "2026-05-21"}]
        if table == "health_activity_logs":
            return [{"steps": 2500, "active_minutes": 15, "activity_date": "2026-05-21"}]
        if table == "health_biomarkers":
            return [{"kind": "hrv", "value": 45, "unit": "ms", "measured_on": "2026-05-21"}]
        if table == "health_workouts":
            return [{"title": "Walk", "kind": "walk", "occurred_on": "2026-05-21"}]
        return []

    with (
        patch("api.health._list_table", side_effect=list_table),
        patch("api.health._list_meals", return_value=[]),
        patch("api.health._nutrition_target", return_value=None),
        patch("api.health._sleep_target_minutes", return_value=480),
        patch("api.health.ai_budget.has_budget", return_value=False),
    ):
        resp = await client.get("/health/dashboard")

    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] > 0
    assert data["readiness_score"] > 0
    assert data["latest_daily_log"]["id"] == "daily-0001"
    assert "не заменяют врача" in data["safety_note"]
    assert data["biomarkers"] == []
    assert data["medical_records_count"] == 0
    assert any(item["id"] == "fallback-sleep-short" for item in data["insights"])


@pytest.mark.anyio
async def test_nutrition_target_calculates_tdee(client):
    with patch("api.health.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.upsert.return_value.execute.return_value.data = [
            {
                "user_id": TEST_USER_ID,
                "calories": 2034,
                "protein_g": 153,
                "carbs_g": 203,
                "fat_g": 68,
                "water_ml": 2450,
                "bmr": 1456,
                "tdee": 2434,
            }
        ]

        resp = await client.post(
            "/health/nutrition/targets",
            json={
                "sex": "female",
                "age": 32,
                "height_cm": 170,
                "weight_kg": 70,
                "goal_type": "lose",
                "activity_level": "moderate",
                "diet_mode": "balanced",
            },
        )

    assert resp.status_code == 201
    row = mock_db.return_value.table.return_value.upsert.call_args.args[0]
    assert row["user_id"] == TEST_USER_ID
    assert row["calories"] > 1200
    assert row["bmr"] > 0
    assert resp.json()["protein_g"] == 153


@pytest.mark.anyio
async def test_barcode_lookup_uses_open_food_facts_when_local_missing(client):
    local_query = MagicMock()
    local_query.execute.return_value.data = []
    insert_query = MagicMock()
    insert_query.execute.return_value.data = [
        {
            "id": "food-1",
            "user_id": TEST_USER_ID,
            "name": "Test Yogurt",
            "barcode": "4601234567890",
            "serving_name": "100 g",
            "serving_grams": 100,
            "source": "open_food_facts",
            "confidence": 0.86,
            "is_confirmed": True,
        }
    ]
    table = MagicMock()
    table.select.return_value.eq.return_value.eq.return_value.limit.return_value = local_query
    table.insert.return_value = insert_query

    candidate = MagicMock()
    candidate.confidence = 0.86
    candidate.as_row.return_value = {
        "name": "Test Yogurt",
        "barcode": "4601234567890",
        "serving_name": "100 g",
        "serving_grams": 100,
        "calories_per_100g": 92,
        "protein_per_100g": 8,
        "carbs_per_100g": 4,
        "fat_per_100g": 5,
        "source": "open_food_facts",
        "confidence": 0.86,
    }

    with (
        patch("api.health.get_supabase") as mock_db,
        patch("api.health.lookup_open_food_facts_barcode", return_value=candidate),
    ):
        mock_db.return_value.table.return_value = table
        resp = await client.post("/health/nutrition/barcode", json={"barcode": "4601234567890"})

    assert resp.status_code == 200
    assert resp.json()["source"] == "open_food_facts"
    inserted = table.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
    assert inserted["is_confirmed"] is True


@pytest.mark.anyio
async def test_scan_photo_saves_ai_candidate_as_draft(client):
    insert_query = MagicMock()
    insert_query.execute.return_value.data = [
        {
            "id": "food-ai",
            "user_id": TEST_USER_ID,
            "name": "AI Granola",
            "serving_name": "100 g",
            "serving_grams": 100,
            "source": "ai_photo",
            "confidence": 0.72,
            "is_confirmed": False,
        }
    ]
    table = MagicMock()
    table.insert.return_value = insert_query
    candidate = MagicMock()
    candidate.barcode = None
    candidate.confidence = 0.72
    candidate.as_row.return_value = {
        "name": "AI Granola",
        "serving_name": "100 g",
        "serving_grams": 100,
        "calories_per_100g": 410,
        "protein_per_100g": 9,
        "carbs_per_100g": 62,
        "fat_per_100g": 12,
        "source": "ai_photo",
        "confidence": 0.72,
        "is_confirmed": False,
    }

    with (
        patch("api.health.get_supabase") as mock_db,
        patch("api.health.ai_budget.has_budget", return_value=True),
        patch("api.health.ai_budget.record_usage", return_value=None),
        patch("api.health.analyze_package_photo", return_value=candidate),
    ):
        mock_db.return_value.table.return_value = table
        resp = await client.post(
            "/health/nutrition/scan-photo",
            files={"file": ("package.jpg", b"fake-image", "image/jpeg")},
        )

    assert resp.status_code == 200
    assert resp.json()["needs_confirmation"] is True
    assert table.insert.call_args.args[0]["is_confirmed"] is False


@pytest.mark.anyio
async def test_weekly_report_summarizes_meals_water_and_weight(client):
    meals = [
        {
            "id": "meal-1",
            "logged_on": "2026-05-18",
            "meal_type": "breakfast",
            "items": [{"name": "Yogurt", "calories": 200, "protein_g": 20}],
        }
    ]

    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        if table == "health_water_logs":
            return [{"logged_on": "2026-05-18", "amount_ml": 500}]
        if table == "health_weight_logs":
            return [{"logged_on": "2026-05-18", "weight_kg": 70}, {"logged_on": "2026-05-19", "weight_kg": 69.8}]
        return []

    with (
        patch("api.health._list_meals", return_value=meals),
        patch("api.health._list_table", side_effect=list_table),
        patch("api.health._nutrition_target", return_value={"calories": 2000, "protein_g": 120, "water_ml": 2200}),
    ):
        resp = await client.get("/health/nutrition/report/weekly?week_start=2026-05-18")

    assert resp.status_code == 200
    data = resp.json()
    assert data["average_calories"] == round(200 / 7, 1)
    assert data["water_consistency_days"] == 1
    assert data["frequent_foods"][0]["name"] == "Yogurt"
