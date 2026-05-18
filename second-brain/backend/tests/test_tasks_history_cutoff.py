"""Free-tier tasks list honours 30-day history cutoff; premium sees everything."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from models.premium import PremiumStatus


def _tasks_query_mock():
    """Returns (db_mock, chain) where chain tracks every .gte call applied."""
    db = MagicMock()
    chain = db.table.return_value
    # Build nested chain that returns itself on any attribute to absorb arbitrary
    # fluent calls in any order.
    for method in ("select", "eq", "gte", "order", "range", "limit"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = []
    return db, chain


@pytest.mark.anyio
async def test_free_user_gets_cutoff_applied(client):
    db, chain = _tasks_query_mock()
    with patch("api.tasks.get_supabase", return_value=db), patch(
        "api.tasks.get_user_premium", return_value=PremiumStatus(is_premium=False)
    ):
        resp = await client.get("/tasks/")
    assert resp.status_code == 200
    # .gte("created_at", ...) must have been called at least once
    gte_calls = [c for c in chain.gte.call_args_list if c.args and c.args[0] == "created_at"]
    assert gte_calls, "free user should get created_at >= cutoff filter"


@pytest.mark.anyio
async def test_premium_user_no_cutoff(client):
    db, chain = _tasks_query_mock()
    with patch("api.tasks.get_supabase", return_value=db), patch(
        "api.tasks.get_user_premium", return_value=PremiumStatus(is_premium=True)
    ):
        resp = await client.get("/tasks/")
    assert resp.status_code == 200
    gte_calls = [c for c in chain.gte.call_args_list if c.args and c.args[0] == "created_at"]
    assert not gte_calls, "premium user should see full history (no created_at cutoff)"


@pytest.mark.anyio
async def test_missing_premium_row_treated_as_free(client):
    """Fail-safe: if get_user_premium itself errors or returns default, treat as free."""
    db, chain = _tasks_query_mock()
    with patch("api.tasks.get_supabase", return_value=db), patch(
        "api.tasks.get_user_premium", return_value=PremiumStatus()  # default → free
    ):
        resp = await client.get("/tasks/")
    assert resp.status_code == 200
    gte_calls = [c for c in chain.gte.call_args_list if c.args and c.args[0] == "created_at"]
    assert gte_calls, "missing premium row must default to free (cutoff applied)"


@pytest.mark.anyio
async def test_today_tasks_honours_cutoff(client):
    db, chain = _tasks_query_mock()
    with patch("api.tasks.get_supabase", return_value=db), patch(
        "api.tasks.get_user_premium", return_value=PremiumStatus(is_premium=False)
    ):
        resp = await client.get("/tasks/today")
    assert resp.status_code == 200
    gte_calls = [c for c in chain.gte.call_args_list if c.args and c.args[0] == "created_at"]
    assert gte_calls
