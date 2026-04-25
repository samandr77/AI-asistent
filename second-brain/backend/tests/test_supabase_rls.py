"""RLS integration tests.

Runs only with `pytest -m integration` against a dev Supabase project.

For each user-owned table the fixture creates two fresh users (A and B),
seeds one row per user via the service-role client, then queries each
table with user A's anon JWT and asserts that only user A's row comes back.

Prerequisites (fail loudly if missing):
- `SUPABASE_URL` pointing to a non-prod project (conftest.py guards prod).
- `SUPABASE_SERVICE_KEY` in env.
- `SUPABASE_ANON_KEY` in env (needed to build a user-scoped client).
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any

import pytest

pytestmark = pytest.mark.integration


def _require(var: str) -> str:
    value = os.environ.get(var)
    if not value:
        pytest.skip(f"Integration test requires env var {var}")
    return value


@pytest.fixture(scope="module")
def supabase_service() -> Any:
    try:
        from supabase import create_client
    except ModuleNotFoundError:
        pytest.skip("supabase-py not installed")
    url = _require("SUPABASE_URL")
    service_key = _require("SUPABASE_SERVICE_KEY")
    return create_client(url, service_key)


@pytest.fixture(scope="module")
def supabase_anon_client_factory():
    """Returns a factory that builds an anon-key client authed as a specific user."""
    try:
        from supabase import create_client
    except ModuleNotFoundError:
        pytest.skip("supabase-py not installed")

    url = _require("SUPABASE_URL")
    anon_key = _require("SUPABASE_ANON_KEY")

    def _factory(access_token: str):
        client = create_client(url, anon_key)
        client.postgrest.auth(access_token)
        return client

    return _factory


@pytest.fixture(scope="module")
def two_test_users(supabase_service):
    """Create two anonymous users via the admin API. Teardown deletes both."""
    suffix = uuid.uuid4().hex[:8]
    email_a = f"rls-a-{suffix}@test.secondbrain.app"
    email_b = f"rls-b-{suffix}@test.secondbrain.app"
    password = "RlsTest!" + uuid.uuid4().hex[:12]

    admin = supabase_service.auth.admin
    user_a_resp = admin.create_user(
        {
            "email": email_a,
            "password": password,
            "email_confirm": True,
        }
    )
    user_b_resp = admin.create_user(
        {
            "email": email_b,
            "password": password,
            "email_confirm": True,
        }
    )

    user_a = getattr(user_a_resp, "user", user_a_resp.get("user") if isinstance(user_a_resp, dict) else user_a_resp)
    user_b = getattr(user_b_resp, "user", user_b_resp.get("user") if isinstance(user_b_resp, dict) else user_b_resp)

    # Sign them in with the anon client to get JWTs.
    from supabase import create_client

    anon_key = _require("SUPABASE_ANON_KEY")
    url = _require("SUPABASE_URL")

    client_a = create_client(url, anon_key)
    sess_a = client_a.auth.sign_in_with_password({"email": email_a, "password": password})
    client_b = create_client(url, anon_key)
    sess_b = client_b.auth.sign_in_with_password({"email": email_b, "password": password})

    jwt_a = sess_a.session.access_token if hasattr(sess_a, "session") else sess_a["session"]["access_token"]
    jwt_b = sess_b.session.access_token if hasattr(sess_b, "session") else sess_b["session"]["access_token"]
    id_a = user_a.id if hasattr(user_a, "id") else user_a["id"]
    id_b = user_b.id if hasattr(user_b, "id") else user_b["id"]

    yield {"jwt_a": jwt_a, "jwt_b": jwt_b, "id_a": id_a, "id_b": id_b}

    # Teardown — remove both users + their rows.
    try:
        supabase_service.rpc("cascade_delete_user", {"p_user_id": id_a}).execute()
    except Exception:
        pass
    try:
        supabase_service.rpc("cascade_delete_user", {"p_user_id": id_b}).execute()
    except Exception:
        pass
    try:
        admin.delete_user(id_a)
    except Exception:
        pass
    try:
        admin.delete_user(id_b)
    except Exception:
        pass


def _seed_row(
    service_client: Any,
    table: str,
    user_id: str,
    extra: dict | None = None,
) -> None:
    row = {"user_id": user_id} if table != "user_profiles" else {"id": user_id}
    if extra:
        row.update(extra)
    service_client.table(table).insert(row).execute()


def _assert_user_sees_own_row_only(
    anon_factory, table: str, jwt: str, expected_owner: str
) -> None:
    client = anon_factory(jwt)
    result = client.table(table).select("*").execute()
    assert result.data is not None
    for row in result.data:
        owner_field = "id" if table == "user_profiles" else "user_id"
        assert (
            row[owner_field] == expected_owner
        ), f"RLS leak: {table} returned a row with owner {row.get(owner_field)} to user {expected_owner}"


# --- Table-by-table tests --------------------------------------------------


def test_rls_tasks_isolated(supabase_service, supabase_anon_client_factory, two_test_users):
    _seed_row(
        supabase_service,
        "tasks",
        two_test_users["id_a"],
        {"title": "A task", "sphere": "work"},
    )
    _seed_row(
        supabase_service,
        "tasks",
        two_test_users["id_b"],
        {"title": "B task", "sphere": "work"},
    )
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "tasks",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )


def test_rls_goals_isolated(supabase_service, supabase_anon_client_factory, two_test_users):
    _seed_row(
        supabase_service,
        "goals",
        two_test_users["id_a"],
        {"title": "A goal", "status": "active"},
    )
    _seed_row(
        supabase_service,
        "goals",
        two_test_users["id_b"],
        {"title": "B goal", "status": "active"},
    )
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "goals",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )


def test_rls_reflections_isolated(
    supabase_service, supabase_anon_client_factory, two_test_users
):
    _seed_row(
        supabase_service,
        "daily_reflections",
        two_test_users["id_a"],
        {"date": "2026-04-24", "mood": 4, "energy": 4},
    )
    _seed_row(
        supabase_service,
        "daily_reflections",
        two_test_users["id_b"],
        {"date": "2026-04-24", "mood": 3, "energy": 3},
    )
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "daily_reflections",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )


def test_rls_dumps_isolated(supabase_service, supabase_anon_client_factory, two_test_users):
    _seed_row(
        supabase_service,
        "dumps",
        two_test_users["id_a"],
        {"raw_text": "A dump"},
    )
    _seed_row(
        supabase_service,
        "dumps",
        two_test_users["id_b"],
        {"raw_text": "B dump"},
    )
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "dumps",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )


def test_rls_user_ai_usage_isolated(
    supabase_service, supabase_anon_client_factory, two_test_users
):
    _seed_row(
        supabase_service,
        "user_ai_usage",
        two_test_users["id_a"],
        {"total_tokens": 100},
    )
    _seed_row(
        supabase_service,
        "user_ai_usage",
        two_test_users["id_b"],
        {"total_tokens": 100},
    )
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "user_ai_usage",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )


def test_rls_user_premium_isolated(
    supabase_service, supabase_anon_client_factory, two_test_users
):
    _seed_row(
        supabase_service,
        "user_premium",
        two_test_users["id_a"],
        {"is_premium": False},
    )
    _seed_row(
        supabase_service,
        "user_premium",
        two_test_users["id_b"],
        {"is_premium": True},
    )
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "user_premium",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )


def test_rls_user_profiles_isolated(
    supabase_service, supabase_anon_client_factory, two_test_users
):
    # user_profiles rows are created by Supabase Auth at signup via trigger,
    # or may need to be seeded. Try upsert.
    supabase_service.table("user_profiles").upsert(
        {"id": two_test_users["id_a"], "name": "Alice"}
    ).execute()
    supabase_service.table("user_profiles").upsert(
        {"id": two_test_users["id_b"], "name": "Bob"}
    ).execute()
    _assert_user_sees_own_row_only(
        supabase_anon_client_factory,
        "user_profiles",
        two_test_users["jwt_a"],
        two_test_users["id_a"],
    )
