from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER_ID = "workouts-user-0001"


SESSION_ROW = {
    "id": "session-1",
    "user_id": TEST_USER_ID,
    "session_type": "strength",
    "sport_kind": None,
    "title": "Push day",
    "location": "gym",
    "occurred_on": "2026-05-22",
    "started_at": None,
    "ended_at": None,
    "duration_minutes": None,
    "rpe": None,
    "mood_before": None,
    "mood_after": None,
    "energy_before": None,
    "energy_after": None,
    "training_load_score": None,
    "intensity_minutes": None,
    "calories": None,
    "program_session_id": None,
    "program_id": None,
    "goal_id": None,
    "source": "manual",
    "raw_text": None,
    "weather_conditions": None,
    "is_completed": False,
    "is_planned": False,
    "planned_for": None,
    "notes": None,
    "distance_km": None,
    "avg_pace_per_km_seconds": None,
    "elevation_gain_m": None,
    "max_speed_kmh": None,
    "vertical_descent_m": None,
    "cadence_avg": None,
    "stroke_rate": None,
    "swolf": None,
    "pool_length_m": None,
    "laps": None,
    "created_at": "2026-05-22T10:00:00+00:00",
    "updated_at": "2026-05-22T10:00:00+00:00",
}

SET_ROW = {
    "id": "set-1",
    "user_id": TEST_USER_ID,
    "session_id": "session-1",
    "exercise_id": "ex-bench",
    "set_number": 1,
    "reps": 8,
    "weight_kg": 80,
    "weight_unit": "kg",
    "rir": None,
    "rpe": 7,
    "tempo": None,
    "is_warmup": False,
    "is_dropset": False,
    "dropset_group": None,
    "superset_id": None,
    "rest_seconds_actual": None,
    "distance_m": None,
    "duration_seconds": None,
    "completed_at": "2026-05-22T10:05:00+00:00",
    "notes": None,
    "created_at": "2026-05-22T10:05:00+00:00",
    "updated_at": "2026-05-22T10:05:00+00:00",
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


# ----------------------------------------------------------------
# Sessions
# ----------------------------------------------------------------

@pytest.mark.anyio
async def test_create_session_inserts_user_id(client):
    with patch("services.workout_logger.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [
            SESSION_ROW
        ]

        resp = await client.post(
            "/workouts/sessions",
            json={
                "session_type": "strength",
                "title": "Push day",
                "occurred_on": "2026-05-22",
                "location": "gym",
            },
        )

    assert resp.status_code == 201
    inserted = mock_db.return_value.table.return_value.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
    assert inserted["session_type"] == "strength"
    assert resp.json()["title"] == "Push day"


@pytest.mark.anyio
async def test_create_session_rejects_invalid_session_type(client):
    resp = await client.post(
        "/workouts/sessions",
        json={
            "session_type": "dance_off",
            "title": "Bad",
            "occurred_on": "2026-05-22",
        },
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_get_session_includes_sets(client):
    with patch("services.workout_logger.get_supabase") as mock_db:
        sel = mock_db.return_value.table.return_value.select.return_value
        # get_session
        sel.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            SESSION_ROW
        ]
        # list_sets: select.eq.eq.order.order
        sel.eq.return_value.eq.return_value.order.return_value.order.return_value.execute.return_value.data = [
            SET_ROW
        ]

        resp = await client.get("/workouts/sessions/session-1")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "session-1"
    assert len(body["sets"]) == 1
    assert body["sets"][0]["weight_kg"] == 80


@pytest.mark.anyio
async def test_get_session_404_when_missing(client):
    with patch("services.workout_logger.get_supabase") as mock_db:
        sel = mock_db.return_value.table.return_value.select.return_value
        sel.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

        resp = await client.get("/workouts/sessions/missing")

    assert resp.status_code == 404


@pytest.mark.anyio
async def test_finish_session_sets_completed_and_computes_load(client):
    started_row = {
        **SESSION_ROW,
        "started_at": "2026-05-22T10:00:00+00:00",
        "duration_minutes": 45,
        "rpe": 7,
        "is_completed": False,
    }
    finished_row = {
        **started_row,
        "is_completed": True,
        "ended_at": "2026-05-22T10:45:00+00:00",
        "training_load_score": 315.0,
        "intensity_minutes": 45,
    }
    with patch("services.workout_logger.get_supabase") as mock_db:
        sel = mock_db.return_value.table.return_value.select.return_value
        # get_session inside finish_session
        sel.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            started_row
        ]
        # list_sets inside finish_session
        sel.eq.return_value.eq.return_value.order.return_value.order.return_value.execute.return_value.data = []
        # update inside update_session
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            finished_row
        ]

        resp = await client.post("/workouts/sessions/session-1/finish")

    assert resp.status_code == 200
    body = resp.json()
    assert body["is_completed"] is True
    assert body["training_load_score"] == 315.0
    update_payload = mock_db.return_value.table.return_value.update.call_args.args[0]
    assert update_payload["is_completed"] is True


@pytest.mark.anyio
async def test_finish_session_idempotent_on_already_completed(client):
    completed_row = {**SESSION_ROW, "is_completed": True}
    with patch("services.workout_logger.get_supabase") as mock_db:
        sel = mock_db.return_value.table.return_value.select.return_value
        sel.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            completed_row
        ]

        resp = await client.post("/workouts/sessions/session-1/finish")

    assert resp.status_code == 200
    # No update should be called when already completed
    assert not mock_db.return_value.table.return_value.update.called


# ----------------------------------------------------------------
# Sets
# ----------------------------------------------------------------

@pytest.mark.anyio
async def test_create_set_validates_session_ownership(client):
    """If session_id doesn't belong to user → 404."""
    with patch("services.workout_logger.get_supabase") as mock_db:
        sel = mock_db.return_value.table.return_value.select.return_value
        sel.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

        resp = await client.post(
            "/workouts/sessions/other-user-session/sets",
            json={"exercise_id": "ex-bench", "set_number": 1, "reps": 8, "weight_kg": 80},
        )

    assert resp.status_code == 404


@pytest.mark.anyio
async def test_create_set_inserts_with_user_and_session(client):
    with patch("services.workout_logger.get_supabase") as mock_db:
        sel = mock_db.return_value.table.return_value.select.return_value
        # session ownership check passes
        sel.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            SESSION_ROW
        ]
        # insert
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [
            SET_ROW
        ]

        resp = await client.post(
            "/workouts/sessions/session-1/sets",
            json={"exercise_id": "ex-bench", "set_number": 1, "reps": 8, "weight_kg": 80, "rpe": 7},
        )

    assert resp.status_code == 201
    inserted = mock_db.return_value.table.return_value.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
    assert inserted["session_id"] == "session-1"
    assert inserted["exercise_id"] == "ex-bench"


@pytest.mark.anyio
async def test_create_set_rejects_invalid_weight_unit(client):
    resp = await client.post(
        "/workouts/sessions/session-1/sets",
        json={"exercise_id": "ex-1", "set_number": 1, "weight_unit": "stone"},
    )
    assert resp.status_code == 422


# ----------------------------------------------------------------
# Exercises
# ----------------------------------------------------------------

@pytest.mark.anyio
async def test_list_exercises_passes_filters(client):
    with patch("services.workout_exercise_library.get_supabase") as mock_db:
        query = mock_db.return_value.table.return_value.select.return_value
        # All chained calls return query itself; final execute returns rows
        query.or_.return_value = query
        query.contains.return_value = query
        query.eq.return_value = query
        query.ilike.return_value = query
        query.order.return_value = query
        query.range.return_value.execute.return_value.data = [
            {
                "id": "ex-bench",
                "user_id": None,
                "slug": "barbell-bench-press",
                "name_ru": "Жим лёжа",
                "name_en": "Bench Press",
                "primary_muscle": "chest",
                "secondary_muscles": [],
                "equipment": ["barbell"],
                "category": "strength",
                "is_compound": True,
                "is_unilateral": False,
                "default_rest_seconds": 180,
                "metadata": {},
            }
        ]

        resp = await client.get("/exercises?muscle=chest&equipment=barbell")

    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["slug"] == "barbell-bench-press"
