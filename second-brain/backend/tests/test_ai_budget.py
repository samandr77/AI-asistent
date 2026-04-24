from unittest.mock import MagicMock, patch

import pytest

from services import ai_budget


@pytest.mark.anyio
async def test_record_usage_calls_rpc():
    db = MagicMock()
    db.rpc.return_value.execute.return_value.data = 5000
    with patch("services.ai_budget.get_supabase", return_value=db):
        await ai_budget.record_usage("user-1", 1234)
    db.rpc.assert_called_once_with("add_ai_tokens", {"p_user_id": "user-1", "p_tokens": 1234})


@pytest.mark.anyio
async def test_record_usage_skips_zero():
    db = MagicMock()
    with patch("services.ai_budget.get_supabase", return_value=db):
        await ai_budget.record_usage("user-1", 0)
    db.rpc.assert_not_called()


@pytest.mark.anyio
async def test_check_within_budget_returns_true():
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value
    chain.data = {"total_tokens": 10_000}
    with patch("services.ai_budget.get_supabase", return_value=db), \
         patch("services.ai_budget.settings") as mock_settings:
        mock_settings.daily_user_token_budget = 200_000
        ok = await ai_budget.has_budget("user-1")
    assert ok is True


@pytest.mark.anyio
async def test_check_over_budget_returns_false():
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value
    chain.data = {"total_tokens": 250_000}
    with patch("services.ai_budget.get_supabase", return_value=db), \
         patch("services.ai_budget.settings") as mock_settings:
        mock_settings.daily_user_token_budget = 200_000
        ok = await ai_budget.has_budget("user-1")
    assert ok is False


@pytest.mark.anyio
async def test_budget_zero_disables_enforcement():
    db = MagicMock()
    with patch("services.ai_budget.get_supabase", return_value=db), \
         patch("services.ai_budget.settings") as mock_settings:
        mock_settings.daily_user_token_budget = 0
        ok = await ai_budget.has_budget("user-1")
    assert ok is True
    db.table.assert_not_called()
