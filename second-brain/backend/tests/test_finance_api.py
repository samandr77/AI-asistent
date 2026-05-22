from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

TEST_USER_ID = "finance-user-0001"

TRANSACTION_ROW = {
    "id": "tx-0001",
    "user_id": TEST_USER_ID,
    "occurred_on": "2026-05-19",
    "type": "expense",
    "amount_cents": 120000,
    "currency": "RUB",
    "category": "transport",
    "merchant": "Taxi",
    "note": None,
    "account_id": None,
    "created_at": "2026-05-19T00:00:00+00:00",
    "updated_at": "2026-05-19T00:00:00+00:00",
}

BUDGET_ROW = {
    "id": "budget-0001",
    "user_id": TEST_USER_ID,
    "category": "transport",
    "period": "monthly",
    "limit_cents": 300000,
    "rollover_enabled": False,
    "created_at": "2026-05-19T00:00:00+00:00",
    "updated_at": "2026-05-19T00:00:00+00:00",
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


def _terminal(data: list[dict]):
    terminal = MagicMock()
    terminal.execute.return_value.data = data
    return terminal


@pytest.mark.anyio
async def test_list_transactions_returns_user_rows(client):
    terminal = _terminal([TRANSACTION_ROW])
    with patch("api.finance.get_supabase") as mock_db:
        query = mock_db.return_value.table.return_value.select.return_value.eq.return_value
        query.order.return_value.range.return_value = terminal

        resp = await client.get("/finance/transactions")

    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "tx-0001"


@pytest.mark.anyio
async def test_create_transaction_validates_positive_amount(client):
    resp = await client.post(
        "/finance/transactions",
        json={
            "occurred_on": "2026-05-19",
            "type": "expense",
            "amount_cents": 0,
            "category": "transport",
        },
    )

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_transaction_inserts_user_id(client):
    created = {**TRANSACTION_ROW, "id": "tx-new"}
    with (
        patch("api.finance.get_supabase") as mock_db,
        patch("api.finance._apply_categorization_rules", side_effect=lambda payload, user_id: payload),
        patch("api.finance._find_duplicate_import", return_value=None),
        patch("api.finance._remember_categorization_rule"),
    ):
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [created]

        resp = await client.post(
            "/finance/transactions",
            json={
                "occurred_on": "2026-05-19",
                "type": "expense",
                "amount_cents": 120000,
                "category": "transport",
                "merchant": "Taxi",
            },
        )

    assert resp.status_code == 201
    assert resp.json()["id"] == "tx-new"
    inserted = mock_db.return_value.table.return_value.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID


@pytest.mark.anyio
async def test_patch_transaction_not_found_returns_404(client):
    with patch("api.finance.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        resp = await client.patch("/finance/transactions/missing", json={"category": "food"})

    assert resp.status_code == 404


@pytest.mark.anyio
async def test_create_budget_success(client):
    with patch("api.finance.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [BUDGET_ROW]

        resp = await client.post(
            "/finance/budgets",
            json={"category": "transport", "limit_cents": 300000},
        )

    assert resp.status_code == 201
    assert resp.json()["category"] == "transport"


@pytest.mark.anyio
async def test_net_worth_combines_accounts_assets_and_debts(client):
    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        assert user_id == TEST_USER_ID
        if table == "finance_accounts":
            return [{"balance_cents": 1000000, "is_archived": False}]
        if table == "finance_assets":
            return [{"current_value_cents": 500000}]
        if table == "finance_debts":
            return [{"balance_cents": 250000}]
        return []

    with patch("api.finance._list_table", side_effect=list_table):
        resp = await client.get("/finance/net-worth")

    assert resp.status_code == 200
    assert resp.json() == {
        "accounts_cents": 1000000,
        "assets_cents": 500000,
        "debts_cents": 250000,
        "net_worth_cents": 1250000,
    }


@pytest.mark.anyio
async def test_create_debt_and_asset_insert_user_id(client):
    with patch("api.finance.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": "debt-new",
                "user_id": TEST_USER_ID,
                "name": "Card",
                "type": "credit_card",
                "balance_cents": 200000,
            }
        ]
        debt_resp = await client.post(
            "/finance/debts",
            json={"name": "Card", "type": "credit_card", "balance_cents": 200000},
        )

    assert debt_resp.status_code == 201
    assert mock_db.return_value.table.return_value.insert.call_args.args[0]["user_id"] == TEST_USER_ID

    with patch("api.finance.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": "asset-new",
                "user_id": TEST_USER_ID,
                "name": "Brokerage",
                "type": "brokerage",
                "current_value_cents": 900000,
                "currency": "RUB",
            }
        ]
        asset_resp = await client.post(
            "/finance/assets",
            json={"name": "Brokerage", "type": "brokerage", "current_value_cents": 900000},
        )

    assert asset_resp.status_code == 201
    assert mock_db.return_value.table.return_value.insert.call_args.args[0]["user_id"] == TEST_USER_ID


@pytest.mark.anyio
async def test_analyze_entry_extracts_expense_transaction(client):
    resp = await client.post(
        "/finance/analyze-entry",
        json={
            "text": "Потратил 1200 рублей на такси",
            "occurred_on": "2026-05-19",
        },
    )

    assert resp.status_code == 200
    action = resp.json()["actions"][0]
    assert action["kind"] == "transaction"
    assert action["payload"]["amount_cents"] == 120000
    assert action["payload"]["category"] == "transport"


@pytest.mark.anyio
async def test_confirm_analyzed_entry_creates_supported_rows_and_skips_notes(client):
    def create_row(table, body, user_id, detail):  # noqa: ARG001
        return {"id": "created-1", "table": table, "user_id": user_id, **body.model_dump()}

    with patch("api.finance._create_row", side_effect=create_row):
        resp = await client.post(
            "/finance/analyze-entry/confirm",
            json={
                "actions": [
                    {
                        "kind": "transaction",
                        "confidence": 0.9,
                        "reason": "Нашел расход",
                        "payload": {
                            "occurred_on": "2026-05-19",
                            "type": "expense",
                            "amount_cents": 120000,
                            "currency": "RUB",
                            "category": "transport",
                        },
                    },
                    {
                        "kind": "note",
                        "confidence": 0.45,
                        "reason": "Не финансовое действие",
                        "payload": {"text": "потом разобраться"},
                    },
                ]
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["created"][0]["kind"] == "transaction"
    assert data["created"][0]["row"]["table"] == "finance_transactions"
    assert data["created"][0]["row"]["user_id"] == TEST_USER_ID
    assert data["skipped"][0]["kind"] == "note"


@pytest.mark.anyio
async def test_finance_alerts_return_budget_and_due_items(client):
    today = date.today()

    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        assert user_id == TEST_USER_ID
        if table == "finance_budgets":
            return [{**BUDGET_ROW, "limit_cents": 50000}]
        if table == "finance_subscriptions":
            return [
                {
                    "id": "sub-1",
                    "name": "VPN",
                    "amount_cents": 99000,
                    "next_charge_date": (today + timedelta(days=2)).isoformat(),
                    "is_active": True,
                }
            ]
        if table == "finance_debts":
            return [
                {
                    "id": "debt-1",
                    "name": "Кредит",
                    "monthly_payment_cents": 200000,
                    "next_payment_date": (today + timedelta(days=3)).isoformat(),
                }
            ]
        if table == "finance_tax_events":
            return [
                {
                    "id": "tax-1",
                    "title": "НДФЛ",
                    "amount_cents": 130000,
                    "due_date": (today + timedelta(days=4)).isoformat(),
                }
            ]
        return []

    with (
        patch("api.finance._list_table", side_effect=list_table),
        patch("api.finance._monthly_transactions", return_value=[TRANSACTION_ROW]),
    ):
        resp = await client.get("/finance/alerts?days=7")

    assert resp.status_code == 200
    kinds = {item["kind"] for item in resp.json()}
    assert {"budget_overrun", "subscription_due", "debt_payment_due", "tax_event_due"} <= kinds


@pytest.mark.anyio
async def test_list_categories_falls_back_to_presets(client):
    with patch("api.finance._list_table", return_value=[]):
        resp = await client.get("/finance/categories")

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["is_preset"] is True
    assert {item["type"] for item in data} >= {"expense", "income"}


@pytest.mark.anyio
async def test_budget_envelopes_include_rollover_and_status(client):
    budget = {
        **BUDGET_ROW,
        "allocated_cents": 100000,
        "rollover_enabled": True,
        "rollover_cents": 50000,
    }

    with (
        patch("api.finance._list_table", return_value=[budget]),
        patch("api.finance._monthly_transactions", return_value=[TRANSACTION_ROW]),
    ):
        resp = await client.get("/finance/budgets/envelopes")

    assert resp.status_code == 200
    item = resp.json()[0]
    assert item["allocated_cents"] == 150000
    assert item["spent_cents"] == 120000
    assert item["remaining_cents"] == 30000
    assert item["status"] == "warning"


@pytest.mark.anyio
async def test_forecast_uses_history_and_flags_overrun(client):
    def monthly_transactions(user_id: str, start: date, end: date):  # noqa: ARG001
        if start == date.today().replace(day=1):
            return [TRANSACTION_ROW]
        return [{**TRANSACTION_ROW, "amount_cents": 200000}]

    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        if table == "finance_budgets":
            return [{**BUDGET_ROW, "limit_cents": 150000}]
        return []

    with (
        patch("api.finance._monthly_transactions", side_effect=monthly_transactions),
        patch("api.finance._list_table", side_effect=list_table),
    ):
        resp = await client.get("/finance/forecast?months=3")

    assert resp.status_code == 200
    data = resp.json()
    assert data["months_used"] == 3
    assert data["categories"][0]["category"] == "transport"
    assert data["categories"][0]["predicted_overrun_cents"] > 0


@pytest.mark.anyio
async def test_period_compare_returns_deltas(client):
    rows_by_start = {
        "2026-05-01": [
            {"type": "income", "amount_cents": 500000, "category": "income"},
            {"type": "expense", "amount_cents": 150000, "category": "food"},
        ],
        "2026-04-24": [
            {"type": "income", "amount_cents": 400000, "category": "income"},
            {"type": "expense", "amount_cents": 100000, "category": "food"},
        ],
    }

    def list_transactions(**kwargs):
        assert kwargs["user_id"] == TEST_USER_ID
        return rows_by_start[kwargs["date_from"].isoformat()]

    with patch("api.finance._list_transactions", side_effect=list_transactions):
        resp = await client.get("/finance/analytics/period-compare?date_from=2026-05-01&date_to=2026-05-07")

    assert resp.status_code == 200
    data = resp.json()
    assert data["income_delta_cents"] == 100000
    assert data["expense_delta_cents"] == 50000
    assert data["cash_flow_delta_cents"] == 50000
    assert data["current_by_category"][0] == {"category": "food", "expense_cents": 150000}


@pytest.mark.anyio
async def test_debt_payoff_plan_calculates_months(client):
    with patch("api.finance.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": "debt-1",
                "user_id": TEST_USER_ID,
                "balance_cents": 100000,
                "monthly_payment_cents": 25000,
                "interest_rate_percent": 0,
            }
        ]

        resp = await client.get("/finance/debts/debt-1/payoff-plan")

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_payoff_possible"] is True
    assert data["months_remaining"] == 4
    assert data["total_interest_cents"] == 0


@pytest.mark.anyio
async def test_finance_chat_answers_with_period_summary(client):
    def list_transactions(**kwargs):
        assert kwargs["user_id"] == TEST_USER_ID
        return [
            {"type": "income", "amount_cents": 500000, "category": "income"},
            {"type": "expense", "amount_cents": 120000, "category": "transport"},
            {"type": "expense", "amount_cents": 80000, "category": "food"},
        ]

    with (
        patch("api.finance._list_transactions", side_effect=list_transactions),
        patch("api.finance._list_table", return_value=[]),
        patch("api.finance._finance_recommendations", return_value=[]),
    ):
        resp = await client.post("/finance/chat", json={"message": "Куда ушли деньги?"})

    assert resp.status_code == 200
    data = resp.json()
    assert "Больше всего ушло на transport" in data["answer"]
    assert data["used_data"] == ["finance_transactions"]


@pytest.mark.anyio
async def test_finance_recommendations_include_budget_overrun(client):
    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        if table == "finance_budgets":
            return [{**BUDGET_ROW, "limit_cents": 50000}]
        return []

    with (
        patch("api.finance._list_table", side_effect=list_table),
        patch("api.finance._monthly_transactions", return_value=[TRANSACTION_ROW]),
    ):
        resp = await client.get("/finance/recommendations")

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["kind"] == "budget"
    assert data[0]["severity"] == "warning"


@pytest.mark.anyio
async def test_detect_subscriptions_finds_repeated_monthly_charge(client):
    today = date.today()
    rows = [
        {
            "id": "tx-1",
            "type": "expense",
            "amount_cents": 99000,
            "currency": "RUB",
            "category": "software",
            "merchant": "VPN",
            "occurred_on": (today - timedelta(days=30)).isoformat(),
        },
        {
            "id": "tx-2",
            "type": "expense",
            "amount_cents": 99000,
            "currency": "RUB",
            "category": "software",
            "merchant": "VPN",
            "occurred_on": today.isoformat(),
        },
    ]

    with patch("api.finance._list_transactions", return_value=rows):
        resp = await client.get("/finance/subscriptions/detect")

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["merchant"] == "VPN"
    assert data[0]["occurrences"] == 2


@pytest.mark.anyio
async def test_budget_template_uses_previous_month_spend(client):
    with patch("api.finance._monthly_transactions", return_value=[TRANSACTION_ROW]):
        resp = await client.get("/finance/budgets/suggest-template?months=2")

    assert resp.status_code == 200
    data = resp.json()
    assert data["period_months"] == 2
    assert data["items"][0]["category"] == "transport"
    assert data["items"][0]["suggested_limit_cents"] == 120000


@pytest.mark.anyio
async def test_debt_schedule_returns_monthly_items(client):
    with patch("api.finance.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": "debt-1",
                "user_id": TEST_USER_ID,
                "balance_cents": 100000,
                "monthly_payment_cents": 25000,
                "interest_rate_percent": 0,
            }
        ]

        resp = await client.get("/finance/debts/debt-1/schedule")

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_payoff_possible"] is True
    assert len(data["items"]) == 4
    assert data["items"][-1]["remaining_balance_cents"] == 0


@pytest.mark.anyio
async def test_tax_summary_returns_events_documents_and_deductibles(client):
    selected_year = date.today().year

    def list_table(table: str, user_id: str, **kwargs):  # noqa: ARG001
        if table == "finance_tax_events":
            return [{"id": "tax-1", "title": "НДФЛ", "due_date": f"{selected_year}-12-01"}]
        if table == "finance_documents":
            return [{"id": "doc-1", "title": "Чек"}]
        return []

    with (
        patch("api.finance._list_table", side_effect=list_table),
        patch(
            "api.finance._list_transactions",
            return_value=[{"type": "expense", "amount_cents": 100000, "category": "health"}],
        ),
    ):
        resp = await client.get(f"/finance/taxes/summary?year={selected_year}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["documents_count"] == 1
    assert data["upcoming_events"][0]["title"] == "НДФЛ"
    assert data["deductible_candidates"][0] == {"category": "health", "amount_cents": 100000}


@pytest.mark.anyio
async def test_csv_import_preview_parses_rows(client):
    csv_body = "date,amount,category,merchant\n2026-05-19,-1200,transport,Taxi\n"

    resp = await client.post(
        "/finance/imports/csv/preview",
        files={"file": ("transactions.csv", csv_body, "text/csv")},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["valid_count"] == 1
    assert data["error_count"] == 0
    assert data["rows"][0]["payload"]["amount_cents"] == 120000
    assert data["rows"][0]["payload"]["type"] == "expense"


@pytest.mark.anyio
async def test_csv_import_confirm_creates_transactions(client):
    created = {**TRANSACTION_ROW, "id": "tx-imported"}

    with (
        patch("api.finance.get_supabase") as mock_db,
        patch("api.finance._apply_categorization_rules", side_effect=lambda payload, user_id: payload),
        patch("api.finance._find_duplicate_import", return_value=None),
        patch("api.finance._remember_categorization_rule"),
    ):
        mock_db.return_value.table.return_value.insert.return_value.execute.return_value.data = [created]

        resp = await client.post(
            "/finance/imports/csv/confirm",
            json={
                "rows": [
                    {
                        "occurred_on": "2026-05-19",
                        "type": "expense",
                        "amount_cents": 120000,
                        "currency": "RUB",
                        "category": "transport",
                        "merchant": "Taxi",
                    }
                ]
            },
        )

    assert resp.status_code == 200
    assert resp.json()["created_count"] == 1
    inserted = mock_db.return_value.table.return_value.insert.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
