from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile

from auth import get_current_user_id
from database import get_supabase
from models.finance import (
    FinanceAccountCreate,
    FinanceAccountUpdate,
    FinanceAlert,
    FinanceAnalytics,
    FinanceAssetCreate,
    FinanceAssetUpdate,
    FinanceAnalyzeEntryConfirmRequest,
    FinanceAnalyzeEntryConfirmResponse,
    FinanceAnalyzeEntryRequest,
    FinanceAnalyzeEntryResponse,
    FinanceBudgetCreate,
    FinanceBudgetTemplate,
    FinanceBudgetTemplateItem,
    FinanceBudgetUpdate,
    FinanceChatRequest,
    FinanceChatResponse,
    FinanceCsvImportConfirmRequest,
    FinanceCsvImportPreview,
    FinanceCsvImportPreviewRow,
    FinanceDashboard,
    FinanceDebtCreate,
    FinanceDebtPayoffPlan,
    FinanceDebtSchedule,
    FinanceDebtScheduleItem,
    FinanceDebtUpdate,
    FinanceDocumentCreate,
    FinanceGoalCreate,
    FinanceGoalUpdate,
    FinanceIncomeCreate,
    FinanceNetWorth,
    FinanceNetWorthHistory,
    FinanceNetWorthPoint,
    FinanceNetWorthProjection,
    FinancePeriodCompare,
    FinanceRecommendation,
    FinanceRecommendationFeedback,
    FinanceSubscriptionDetection,
    FinanceSubscriptionCreate,
    FinanceTaxSummary,
    FinanceTaxEventCreate,
    FinanceTransactionCreate,
    FinanceTransactionUpdate,
)
from services.finance_analyzer import analyze_finance_entry

router = APIRouter()
MAX_RECEIPT_IMAGE_SIZE = 10 * 1024 * 1024
RECEIPT_UPLOAD_DIR = Path("uploads/finance")
SUPPORTED_RECEIPT_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
CSV_IMPORT_MAX_SIZE = 1024 * 1024
DEDUCTIBLE_CATEGORIES = {"health", "education", "charity", "business", "tax", "medical"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _date_to_str(value: object) -> object:
    if isinstance(value, date):
        return value.isoformat()
    return value


def _row_date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return None


def _payload(body: object, *, partial: bool = False) -> dict:
    data = body.model_dump(exclude_unset=partial)  # type: ignore[attr-defined]
    return {key: _date_to_str(value) for key, value in data.items()}


def _assert_found(rows: list, detail: str) -> dict:
    if not rows:
        raise HTTPException(status_code=404, detail=detail)
    return rows[0]


def _list_table(table: str, user_id: str, *, order_by: str = "created_at", desc: bool = True) -> list[dict]:
    db = get_supabase()
    result = (
        db.table(table)
        .select("*")
        .eq("user_id", user_id)
        .order(order_by, desc=desc)
        .execute()
    )
    return result.data or []


def _create_row(table: str, body: object, user_id: str, detail: str) -> dict:
    row = _payload(body)
    row["user_id"] = user_id
    result = get_supabase().table(table).insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail=detail)
    return result.data[0]


def _update_row(table: str, row_id: str, body: object, user_id: str, detail: str) -> dict:
    updates = _payload(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    result = (
        get_supabase()
        .table(table)
        .update(updates)
        .eq("id", row_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_found(result.data or [], detail)


def _month_bounds(today: date | None = None) -> tuple[date, date]:
    current = today or date.today()
    start = current.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def _monthly_transactions(user_id: str, start: date, end: date) -> list[dict]:
    db = get_supabase()
    result = (
        db.table("finance_transactions")
        .select("*")
        .eq("user_id", user_id)
        .gte("occurred_on", start.isoformat())
        .lt("occurred_on", end.isoformat())
        .order("occurred_on", desc=True)
        .execute()
    )
    return result.data or []


def _sum_transactions(rows: list[dict], tx_type: str) -> int:
    return sum(int(row.get("amount_cents") or 0) for row in rows if row.get("type") == tx_type)


def _period_transactions(user_id: str, period_start: date, period_end: date, *, limit: int = 1000) -> list[dict]:
    return _list_transactions(
        user_id=user_id,
        limit=limit,
        offset=0,
        date_from=period_start,
        date_to=period_end,
    )


def _category_totals(rows: list[dict]) -> list[dict]:
    by_category: dict[str, int] = defaultdict(int)
    for row in rows:
        if row.get("type") != "expense":
            continue
        category = str(row.get("category") or "uncategorized")
        by_category[category] += int(row.get("amount_cents") or 0)
    return [
        {"category": category, "expense_cents": amount}
        for category, amount in sorted(by_category.items(), key=lambda item: item[1], reverse=True)
    ]


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, 28)
    return date(year, month, day)


def _safe_filename(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg"
    return f"{uuid4().hex}{suffix}"


def _net_worth(user_id: str) -> FinanceNetWorth:
    accounts = _list_table("finance_accounts", user_id, order_by="created_at")
    assets = _list_table("finance_assets", user_id, order_by="created_at")
    debts = _list_table("finance_debts", user_id, order_by="created_at")
    accounts_cents = sum(int(row.get("balance_cents") or 0) for row in accounts if not row.get("is_archived"))
    assets_cents = sum(int(row.get("current_value_cents") or 0) for row in assets)
    debts_cents = sum(int(row.get("balance_cents") or 0) for row in debts)
    return FinanceNetWorth(
        accounts_cents=accounts_cents,
        assets_cents=assets_cents,
        debts_cents=debts_cents,
        net_worth_cents=accounts_cents + assets_cents - debts_cents,
    )


def _rub(amount_cents: int | None) -> str:
    amount = int(amount_cents or 0) / 100
    return f"{amount:,.0f} ₽".replace(",", " ")


def _finance_recommendations(user_id: str) -> list[FinanceRecommendation]:
    today = date.today()
    start, end = _month_bounds(today)
    rows = _monthly_transactions(user_id, start, end)
    budgets = _list_table("finance_budgets", user_id, order_by="category", desc=False)
    subscriptions = _list_table("finance_subscriptions", user_id, order_by="next_charge_date", desc=False)
    debts = _list_table("finance_debts", user_id, order_by="next_payment_date", desc=False)

    recommendations: list[FinanceRecommendation] = []
    category_spend = {item["category"]: int(item["expense_cents"]) for item in _category_totals(rows)}
    for budget in budgets:
        if budget.get("period") != "monthly":
            continue
        category = str(budget.get("category") or "")
        limit_cents = int(budget.get("limit_cents") or 0)
        spent_cents = category_spend.get(category, 0)
        if limit_cents and spent_cents > limit_cents:
            recommendations.append(
                FinanceRecommendation(
                    id=f"budget-overrun-{category}",
                    kind="budget",
                    severity="warning",
                    title="Категория вышла за лимит",
                    message=f"{category}: потрачено {_rub(spent_cents)}, лимит {_rub(limit_cents)}.",
                    suggested_action="Остановить новые траты в категории или перераспределить бюджет.",
                    amount_cents=spent_cents - limit_cents,
                    used_data=["finance_budgets", "finance_transactions"],
                )
            )
        elif limit_cents and spent_cents >= int(limit_cents * 0.8):
            recommendations.append(
                FinanceRecommendation(
                    id=f"budget-near-limit-{category}",
                    kind="budget",
                    severity="info",
                    title="Категория близко к лимиту",
                    message=f"{category}: уже использовано около {round(spent_cents / limit_cents * 100)}% бюджета.",
                    suggested_action="Планировать оставшиеся покупки осторожнее до конца месяца.",
                    amount_cents=limit_cents - spent_cents,
                    used_data=["finance_budgets", "finance_transactions"],
                )
            )

    active_subscriptions = [row for row in subscriptions if row.get("is_active", True)]
    subscriptions_total = sum(int(row.get("amount_cents") or 0) for row in active_subscriptions)
    if subscriptions_total:
        recommendations.append(
            FinanceRecommendation(
                id="subscriptions-monthly-total",
                kind="subscription",
                severity="info",
                title="Постоянные платежи месяца",
                message=f"Активные подписки сейчас стоят {_rub(subscriptions_total)} в месяц.",
                suggested_action="Проверить подписки, которыми ты редко пользуешься.",
                amount_cents=subscriptions_total,
                used_data=["finance_subscriptions"],
            )
        )

    for debt in debts:
        payment = int(debt.get("monthly_payment_cents") or 0)
        balance = int(debt.get("balance_cents") or 0)
        if balance > 0 and payment <= 0:
            recommendations.append(
                FinanceRecommendation(
                    id=f"debt-payment-missing-{debt.get('id') or debt.get('name')}",
                    kind="debt",
                    severity="warning",
                    title="Для долга не задан платеж",
                    message=f"{debt.get('name') or 'Долг'} есть в учете, но без ежемесячного платежа.",
                    suggested_action="Добавить платеж, чтобы ассистент мог считать срок погашения.",
                    amount_cents=balance,
                    used_data=["finance_debts"],
                )
            )

    income = _sum_transactions(rows, "income")
    expense = _sum_transactions(rows, "expense")
    if income and expense > income:
        recommendations.append(
            FinanceRecommendation(
                id="negative-cash-flow-month",
                kind="cash_flow",
                severity="warning",
                title="Расходы выше доходов",
                message=f"За месяц доход {_rub(income)}, расход {_rub(expense)}.",
                suggested_action="Разобрать крупные категории и зафиксировать лимиты на остаток месяца.",
                amount_cents=expense - income,
                used_data=["finance_transactions"],
            )
        )

    return recommendations


def _build_debt_schedule(debt: dict, debt_id: str, monthly_payment_cents: Optional[int]) -> FinanceDebtSchedule:
    balance_cents = int(debt.get("balance_cents") or 0)
    payment_cents = monthly_payment_cents or int(debt.get("monthly_payment_cents") or 0)
    annual_rate = float(debt.get("interest_rate_percent") or 0)
    monthly_rate = annual_rate / 100 / 12

    if balance_cents <= 0:
        return FinanceDebtSchedule(debt_id=debt_id, is_payoff_possible=True, message="Долг уже погашен.")
    if payment_cents <= 0:
        return FinanceDebtSchedule(
            debt_id=debt_id,
            is_payoff_possible=False,
            message="Нужно указать ежемесячный платеж, чтобы построить график.",
        )
    if monthly_rate > 0 and payment_cents <= balance_cents * monthly_rate:
        return FinanceDebtSchedule(
            debt_id=debt_id,
            is_payoff_possible=False,
            message="Платеж не покрывает месячные проценты, долг не будет уменьшаться.",
        )

    remaining = float(balance_cents)
    items: list[FinanceDebtScheduleItem] = []
    payment_date = date.today()
    month = 0
    while remaining > 0 and month < 600:
        month += 1
        interest = int(round(remaining * monthly_rate))
        principal = min(payment_cents - interest, int(round(remaining)))
        if principal <= 0:
            return FinanceDebtSchedule(
                debt_id=debt_id,
                is_payoff_possible=False,
                items=items,
                message="Платеж слишком маленький для погашения основного долга.",
            )
        remaining = max(0.0, remaining + interest - payment_cents)
        items.append(
            FinanceDebtScheduleItem(
                month_number=month,
                payment_cents=interest + principal,
                principal_cents=principal,
                interest_cents=interest,
                remaining_balance_cents=int(round(remaining)),
                payment_date=_add_months(payment_date, month),
            )
        )

    if remaining > 0:
        return FinanceDebtSchedule(
            debt_id=debt_id,
            is_payoff_possible=False,
            items=items,
            message="График выходит за горизонт 50 лет, нужен больший платеж.",
        )
    return FinanceDebtSchedule(
        debt_id=debt_id,
        is_payoff_possible=True,
        items=items,
        message="График погашения рассчитан.",
    )


def _csv_amount_to_cents(raw_amount: str | None, raw_amount_cents: str | None) -> int:
    if raw_amount_cents and raw_amount_cents.strip():
        return abs(int(float(raw_amount_cents.strip().replace(",", "."))))
    if not raw_amount or not raw_amount.strip():
        raise ValueError("amount or amount_cents is required")
    normalized = raw_amount.strip().replace(" ", "").replace(",", ".")
    return abs(int(round(float(normalized) * 100)))


def _parse_csv_import(content: bytes) -> FinanceCsvImportPreview:
    if len(content) > CSV_IMPORT_MAX_SIZE:
        raise HTTPException(status_code=413, detail="CSV file is too large (max 1MB)")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="CSV must be UTF-8 encoded") from exc

    sample = text[:2048]
    dialect = csv.Sniffer().sniff(sample) if sample.strip() else csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows: list[FinanceCsvImportPreviewRow] = []
    for row_number, raw in enumerate(reader, start=2):
        try:
            raw_amount = raw.get("amount")
            raw_amount_cents = raw.get("amount_cents")
            amount_cents = _csv_amount_to_cents(raw_amount, raw_amount_cents)
            raw_type = (raw.get("type") or "").strip().lower()
            if raw_type:
                tx_type = raw_type
            else:
                tx_type = "expense" if str(raw_amount or raw_amount_cents or "").strip().startswith("-") else "income"
            payload = FinanceTransactionCreate(
                occurred_on=date.fromisoformat((raw.get("occurred_on") or raw.get("date") or "").strip()),
                type=tx_type,
                amount_cents=amount_cents,
                currency=(raw.get("currency") or "RUB").strip() or "RUB",
                category=(raw.get("category") or "uncategorized").strip() or "uncategorized",
                merchant=(raw.get("merchant") or raw.get("description") or "").strip() or None,
                note=(raw.get("note") or "").strip() or None,
                account_id=(raw.get("account_id") or "").strip() or None,
            ).model_dump()
            payload["occurred_on"] = payload["occurred_on"].isoformat()
            rows.append(FinanceCsvImportPreviewRow(row_number=row_number, payload=payload))
        except Exception as exc:  # noqa: BLE001
            rows.append(FinanceCsvImportPreviewRow(row_number=row_number, error=str(exc)))

    return FinanceCsvImportPreview(
        rows=rows,
        valid_count=sum(1 for row in rows if row.payload is not None),
        error_count=sum(1 for row in rows if row.error is not None),
    )


@router.get("/dashboard", response_model=FinanceDashboard)
async def get_finance_dashboard(user_id: str = Depends(get_current_user_id)):
    start, end = _month_bounds()
    accounts = _list_table("finance_accounts", user_id, order_by="created_at")
    budgets = _list_table("finance_budgets", user_id, order_by="category", desc=False)
    goals = _list_table("finance_goals", user_id, order_by="target_date", desc=False)
    subscriptions = _list_table("finance_subscriptions", user_id, order_by="next_charge_date", desc=False)
    net_worth = _net_worth(user_id)
    transactions = _monthly_transactions(user_id, start, end)
    recent_transactions = _list_transactions(user_id=user_id, limit=5, offset=0)

    expense_cents = _sum_transactions(transactions, "expense")
    income_cents = _sum_transactions(transactions, "income")
    budget_limit_cents = sum(int(row.get("limit_cents") or 0) for row in budgets if row.get("period") == "monthly")
    subscriptions_monthly_cents = sum(
        int(row.get("amount_cents") or 0) for row in subscriptions if row.get("is_active", True)
    )
    active_goals = [row for row in goals if row.get("status") == "active"]
    remaining_budget = budget_limit_cents - expense_cents if budget_limit_cents else None

    alerts: list[dict] = []
    if remaining_budget is not None and remaining_budget < 0:
        alerts.append(
            {
                "kind": "budget_overrun",
                "severity": "warning",
                "message": "Месячный бюджет превышает запланированный лимит.",
                "amount_cents": abs(remaining_budget),
            }
        )
    if subscriptions_monthly_cents > 0:
        alerts.append(
            {
                "kind": "subscriptions_total",
                "severity": "info",
                "message": "Активные подписки учтены в постоянных расходах месяца.",
                "amount_cents": subscriptions_monthly_cents,
            }
        )

    return FinanceDashboard(
        total_balance_cents=net_worth.accounts_cents,
        monthly_income_cents=income_cents,
        monthly_expense_cents=expense_cents,
        remaining_budget_cents=remaining_budget,
        net_worth_cents=net_worth.net_worth_cents,
        accounts_count=len([row for row in accounts if not row.get("is_archived")]),
        active_goals_count=len(active_goals),
        subscriptions_monthly_cents=subscriptions_monthly_cents,
        recent_transactions=recent_transactions,
        budgets=budgets,
        alerts=alerts,
    )


def _list_transactions(
    *,
    user_id: str,
    limit: int,
    offset: int,
    type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[dict]:
    db = get_supabase()
    q = db.table("finance_transactions").select("*").eq("user_id", user_id)
    if type:
        q = q.eq("type", type)
    if category:
        q = q.eq("category", category)
    if search:
        safe_search = search.replace("%", "").replace(",", " ").strip()
        if safe_search:
            q = q.or_(
                f"merchant.ilike.%{safe_search}%,note.ilike.%{safe_search}%,category.ilike.%{safe_search}%"
            )
    if date_from:
        q = q.gte("occurred_on", date_from.isoformat())
    if date_to:
        q = q.lte("occurred_on", date_to.isoformat())
    result = q.order("occurred_on", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


@router.get("/transactions")
async def list_transactions(
    type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    return _list_transactions(
        user_id=user_id,
        limit=limit,
        offset=offset,
        type=type,
        category=category,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/transactions", status_code=201)
async def create_transaction(
    body: FinanceTransactionCreate,
    user_id: str = Depends(get_current_user_id),
):
    row = _payload(body)
    row["user_id"] = user_id
    result = get_supabase().table("finance_transactions").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create transaction")
    return result.data[0]


@router.patch("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: str,
    body: FinanceTransactionUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = _payload(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    result = (
        get_supabase()
        .table("finance_transactions")
        .update(updates)
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_found(result.data or [], "Transaction not found")


@router.delete("/transactions/{transaction_id}", status_code=204, response_class=Response)
async def delete_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    result = (
        get_supabase()
        .table("finance_transactions")
        .delete()
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return Response(status_code=204)


@router.post("/analyze-entry", response_model=FinanceAnalyzeEntryResponse)
async def analyze_entry(
    body: FinanceAnalyzeEntryRequest,
    user_id: str = Depends(get_current_user_id),  # noqa: ARG001
):
    occurred_on = body.occurred_on or date.today()
    return FinanceAnalyzeEntryResponse(
        source_text=body.text,
        actions=analyze_finance_entry(
            text=body.text,
            occurred_on=occurred_on,
            currency=body.currency,
        ),
    )


@router.post("/analyze-entry/confirm", response_model=FinanceAnalyzeEntryConfirmResponse)
async def confirm_analyzed_entry(
    body: FinanceAnalyzeEntryConfirmRequest,
    user_id: str = Depends(get_current_user_id),
):
    created: list[dict] = []
    skipped: list[dict] = []
    table_by_kind = {
        "transaction": ("finance_transactions", FinanceTransactionCreate, "Failed to create transaction"),
        "income": ("finance_income", FinanceIncomeCreate, "Failed to create income"),
        "subscription": ("finance_subscriptions", FinanceSubscriptionCreate, "Failed to create subscription"),
        "goal": ("finance_goals", FinanceGoalCreate, "Failed to create finance goal"),
        "debt": ("finance_debts", FinanceDebtCreate, "Failed to create debt"),
        "asset": ("finance_assets", FinanceAssetCreate, "Failed to create asset"),
        "tax_event": ("finance_tax_events", FinanceTaxEventCreate, "Failed to create tax event"),
        "document": ("finance_documents", FinanceDocumentCreate, "Failed to create document"),
    }

    for action in body.actions:
        mapping = table_by_kind.get(action.kind)
        if not mapping:
            skipped.append(
                {
                    "kind": action.kind,
                    "reason": "Этот тип действия пока не записывается в финансовые таблицы.",
                }
            )
            continue
        table, model, detail = mapping
        payload = model(**action.payload)
        created.append(
            {
                "kind": action.kind,
                "row": _create_row(table, payload, user_id, detail),
            }
        )

    return FinanceAnalyzeEntryConfirmResponse(created=created, skipped=skipped)


@router.post("/intake/analyze", response_model=FinanceAnalyzeEntryResponse)
async def analyze_finance_intake(
    body: FinanceAnalyzeEntryRequest,
    user_id: str = Depends(get_current_user_id),
):
    return await analyze_entry(body, user_id)


@router.post("/intake/confirm", response_model=FinanceAnalyzeEntryConfirmResponse)
async def confirm_finance_intake(
    body: FinanceAnalyzeEntryConfirmRequest,
    user_id: str = Depends(get_current_user_id),
):
    return await confirm_analyzed_entry(body, user_id)


@router.post("/chat", response_model=FinanceChatResponse)
async def chat_with_finance_assistant(
    body: FinanceChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    start, next_month = _month_bounds()
    period_start = body.period_start or start
    period_end = body.period_end or next_month
    rows = _period_transactions(user_id, period_start, period_end)
    income_cents = _sum_transactions(rows, "income")
    expense_cents = _sum_transactions(rows, "expense")
    categories = _category_totals(rows)
    subscriptions = _list_table("finance_subscriptions", user_id, order_by="next_charge_date", desc=False)
    debts = _list_table("finance_debts", user_id, order_by="next_payment_date", desc=False)
    budgets = _list_table("finance_budgets", user_id, order_by="category", desc=False)
    message = body.message.lower()
    used_data = ["finance_transactions"]
    safety_note = None

    if any(word in message for word in ("подпис", "постоянн", "списан")):
        total = sum(int(row.get("amount_cents") or 0) for row in subscriptions if row.get("is_active", True))
        used_data.append("finance_subscriptions")
        answer = f"Активные подписки сейчас дают постоянную нагрузку {_rub(total)} в месяц."
        if subscriptions:
            names = ", ".join(str(row.get("name") or "подписка") for row in subscriptions[:5])
            answer += f" Ближайшие для проверки: {names}."
    elif any(word in message for word in ("долг", "кредит", "рассроч")):
        total = sum(int(row.get("balance_cents") or 0) for row in debts)
        payment = sum(int(row.get("monthly_payment_cents") or 0) for row in debts)
        used_data.append("finance_debts")
        answer = f"Общий остаток долгов: {_rub(total)}. Плановые месячные платежи: {_rub(payment)}."
        safety_note = "Это расчетная справка, не финансовая консультация."
    elif any(word in message for word in ("бюджет", "лимит", "остат")):
        limit = sum(int(row.get("limit_cents") or 0) for row in budgets if row.get("period") == "monthly")
        used_data.append("finance_budgets")
        if limit:
            answer = f"Месячный бюджет {_rub(limit)}, уже потрачено {_rub(expense_cents)}, осталось {_rub(limit - expense_cents)}."
        else:
            answer = "Месячные лимиты пока не заданы. Можно создать бюджет по категориям или взять шаблон из прошлых месяцев."
    elif any(word in message for word in ("налог", "деклара", "вычет")):
        used_data.extend(["finance_tax_events", "finance_documents"])
        tax_events = _list_table("finance_tax_events", user_id, order_by="due_date", desc=False)
        answer = f"В налоговом календаре {len(tax_events)} событий. Для вычетов я проверяю категории здоровья, образования, бизнеса и документы."
        safety_note = "Налоговые подсказки требуют проверки по правилам твоей юрисдикции."
    elif categories:
        top = categories[0]
        answer = (
            f"За выбранный период доход {_rub(income_cents)}, расход {_rub(expense_cents)}, "
            f"кэшфлоу {_rub(income_cents - expense_cents)}. Больше всего ушло на "
            f"{top['category']}: {_rub(top['expense_cents'])}."
        )
    else:
        answer = "За выбранный период пока мало финансовых данных. Добавь расходы, доходы или чек, и я смогу дать разбор."

    recommendations = [item.model_dump() for item in _finance_recommendations(user_id)[:3]]
    return FinanceChatResponse(
        answer=answer,
        used_data=sorted(set(used_data)),
        recommendations=recommendations,
        safety_note=safety_note,
    )


@router.get("/recommendations", response_model=list[FinanceRecommendation])
async def list_finance_recommendations(user_id: str = Depends(get_current_user_id)):
    return _finance_recommendations(user_id)


@router.post("/recommendations/{recommendation_id}/feedback")
async def record_finance_recommendation_feedback(
    recommendation_id: str,
    body: FinanceRecommendationFeedback,
    user_id: str = Depends(get_current_user_id),  # noqa: ARG001
):
    return {
        "id": recommendation_id,
        "status": body.status,
        "note": body.note,
        "recorded": True,
    }


@router.get("/subscriptions/detect", response_model=list[FinanceSubscriptionDetection])
async def detect_finance_subscriptions(
    days: int = 120,
    user_id: str = Depends(get_current_user_id),
):
    today = date.today()
    period_days = max(30, min(days, 365))
    rows = _period_transactions(user_id, today - timedelta(days=period_days), today, limit=2000)
    grouped: dict[tuple[str, int, str], list[dict]] = defaultdict(list)
    for row in rows:
        if row.get("type") != "expense":
            continue
        merchant = str(row.get("merchant") or "").strip()
        if not merchant:
            continue
        key = (merchant.lower(), int(row.get("amount_cents") or 0), str(row.get("currency") or "RUB"))
        grouped[key].append(row)

    detections: list[FinanceSubscriptionDetection] = []
    for (merchant_key, amount_cents, currency), items in grouped.items():
        if len(items) < 2 or amount_cents <= 0:
            continue
        dates = sorted(filter(None, (_row_date(item.get("occurred_on")) for item in items)))
        if len(dates) < 2:
            continue
        intervals = [(dates[index] - dates[index - 1]).days for index in range(1, len(dates))]
        monthly_like = [interval for interval in intervals if 20 <= interval <= 40]
        if not monthly_like:
            continue
        confidence = min(0.95, 0.55 + 0.15 * len(monthly_like))
        detections.append(
            FinanceSubscriptionDetection(
                merchant=str(items[0].get("merchant") or merchant_key),
                amount_cents=amount_cents,
                currency=currency,
                category=str(items[0].get("category") or "subscriptions"),
                occurrences=len(items),
                confidence=confidence,
                suggested_next_charge_date=_add_months(dates[-1], 1),
                transaction_ids=[str(item.get("id")) for item in items if item.get("id")],
            )
        )
    return sorted(detections, key=lambda item: item.confidence, reverse=True)


@router.get("/budgets/suggest-template", response_model=FinanceBudgetTemplate)
async def suggest_budget_template(
    months: int = 3,
    user_id: str = Depends(get_current_user_id),
):
    period_months = max(1, min(months, 12))
    today = date.today()
    month_start = today.replace(day=1)
    monthly_by_category: dict[str, list[int]] = defaultdict(list)
    for index in range(period_months, 0, -1):
        start = _add_months(month_start, -index)
        end = _add_months(start, 1)
        rows = _monthly_transactions(user_id, start, end)
        totals = {item["category"]: int(item["expense_cents"]) for item in _category_totals(rows)}
        for category, amount in totals.items():
            monthly_by_category[category].append(amount)

    items: list[FinanceBudgetTemplateItem] = []
    for category, amounts in monthly_by_category.items():
        average = int(round(sum(amounts) / len(amounts)))
        peak = max(amounts)
        suggested = max(average, int(round(peak * 0.9)))
        confidence = min(0.95, 0.45 + 0.15 * len(amounts))
        items.append(
            FinanceBudgetTemplateItem(
                category=category,
                suggested_limit_cents=suggested,
                average_monthly_spend_cents=average,
                peak_monthly_spend_cents=peak,
                confidence=confidence,
            )
        )

    return FinanceBudgetTemplate(
        period_months=period_months,
        items=sorted(items, key=lambda item: item.suggested_limit_cents, reverse=True),
    )


@router.get("/alerts", response_model=list[FinanceAlert])
async def list_finance_alerts(
    days: int = 7,
    user_id: str = Depends(get_current_user_id),
):
    today = date.today()
    due_until = today + timedelta(days=max(0, min(days, 90)))
    start, end = _month_bounds(today)
    month_rows = _monthly_transactions(user_id, start, end)
    month_expense_cents = _sum_transactions(month_rows, "expense")
    budgets = _list_table("finance_budgets", user_id, order_by="category", desc=False)
    subscriptions = _list_table("finance_subscriptions", user_id, order_by="next_charge_date", desc=False)
    debts = _list_table("finance_debts", user_id, order_by="next_payment_date", desc=False)
    tax_events = _list_table("finance_tax_events", user_id, order_by="due_date", desc=False)

    alerts: list[FinanceAlert] = []
    for budget in budgets:
        if budget.get("period") != "monthly":
            continue
        category = str(budget.get("category") or "")
        limit_cents = int(budget.get("limit_cents") or 0)
        spent_cents = sum(
            int(row.get("amount_cents") or 0)
            for row in month_rows
            if row.get("type") == "expense" and str(row.get("category") or "") == category
        )
        if limit_cents and spent_cents > limit_cents:
            alerts.append(
                FinanceAlert(
                    kind="budget_overrun",
                    severity="warning",
                    title="Бюджет превышен",
                    message=f"Категория {category} вышла за месячный лимит.",
                    amount_cents=spent_cents - limit_cents,
                    entity_id=budget.get("id"),
                    entity_type="budget",
                )
            )
    total_budget_cents = sum(int(row.get("limit_cents") or 0) for row in budgets if row.get("period") == "monthly")
    if total_budget_cents and month_expense_cents > total_budget_cents:
        alerts.append(
            FinanceAlert(
                kind="total_budget_overrun",
                severity="warning",
                title="Общий бюджет превышен",
                message="Расходы месяца больше суммы месячных бюджетов.",
                amount_cents=month_expense_cents - total_budget_cents,
                entity_type="budget",
            )
        )

    for subscription in subscriptions:
        due_date = _row_date(subscription.get("next_charge_date"))
        if subscription.get("is_active", True) and due_date and today <= due_date <= due_until:
            alerts.append(
                FinanceAlert(
                    kind="subscription_due",
                    severity="info",
                    title="Скоро списание подписки",
                    message=f"{subscription.get('name') or 'Подписка'} будет списана в ближайшие дни.",
                    amount_cents=int(subscription.get("amount_cents") or 0),
                    due_date=due_date,
                    entity_id=subscription.get("id"),
                    entity_type="subscription",
                )
            )

    for debt in debts:
        due_date = _row_date(debt.get("next_payment_date"))
        if due_date and today <= due_date <= due_until:
            alerts.append(
                FinanceAlert(
                    kind="debt_payment_due",
                    severity="warning",
                    title="Скоро платеж по долгу",
                    message=f"{debt.get('name') or 'Долг'} требует платежа в ближайшие дни.",
                    amount_cents=debt.get("monthly_payment_cents"),
                    due_date=due_date,
                    entity_id=debt.get("id"),
                    entity_type="debt",
                )
            )

    for tax_event in tax_events:
        due_date = _row_date(tax_event.get("due_date"))
        if due_date and today <= due_date <= due_until:
            alerts.append(
                FinanceAlert(
                    kind="tax_event_due",
                    severity="warning",
                    title="Скоро налоговый срок",
                    message=f"{tax_event.get('title') or 'Налоговое событие'} приближается.",
                    amount_cents=tax_event.get("amount_cents"),
                    due_date=due_date,
                    entity_id=tax_event.get("id"),
                    entity_type="tax_event",
                )
            )

    return alerts


@router.get("/accounts")
async def list_accounts(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_accounts", user_id, order_by="created_at")


@router.post("/accounts", status_code=201)
async def create_account(
    body: FinanceAccountCreate,
    user_id: str = Depends(get_current_user_id),
):
    row = _payload(body)
    row["user_id"] = user_id
    result = get_supabase().table("finance_accounts").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create account")
    return result.data[0]


@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: str,
    body: FinanceAccountUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = _payload(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    result = (
        get_supabase()
        .table("finance_accounts")
        .update(updates)
        .eq("id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_found(result.data or [], "Account not found")


@router.get("/budgets")
async def list_budgets(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_budgets", user_id, order_by="category", desc=False)


@router.post("/budgets", status_code=201)
async def create_budget(
    body: FinanceBudgetCreate,
    user_id: str = Depends(get_current_user_id),
):
    row = _payload(body)
    row["user_id"] = user_id
    result = get_supabase().table("finance_budgets").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create budget")
    return result.data[0]


@router.patch("/budgets/{budget_id}")
async def update_budget(
    budget_id: str,
    body: FinanceBudgetUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = _payload(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    result = (
        get_supabase()
        .table("finance_budgets")
        .update(updates)
        .eq("id", budget_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_found(result.data or [], "Budget not found")


@router.get("/goals")
async def list_finance_goals(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_goals", user_id, order_by="target_date", desc=False)


@router.post("/goals", status_code=201)
async def create_finance_goal(
    body: FinanceGoalCreate,
    user_id: str = Depends(get_current_user_id),
):
    row = _payload(body)
    row["user_id"] = user_id
    result = get_supabase().table("finance_goals").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create finance goal")
    return result.data[0]


@router.patch("/goals/{goal_id}")
async def update_finance_goal(
    goal_id: str,
    body: FinanceGoalUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = _payload(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    result = (
        get_supabase()
        .table("finance_goals")
        .update(updates)
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _assert_found(result.data or [], "Finance goal not found")


@router.get("/subscriptions")
async def list_subscriptions(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_subscriptions", user_id, order_by="next_charge_date", desc=False)


@router.post("/subscriptions", status_code=201)
async def create_subscription(
    body: FinanceSubscriptionCreate,
    user_id: str = Depends(get_current_user_id),
):
    row = _payload(body)
    row["user_id"] = user_id
    result = get_supabase().table("finance_subscriptions").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create subscription")
    return result.data[0]


@router.get("/net-worth", response_model=FinanceNetWorth)
async def get_net_worth(user_id: str = Depends(get_current_user_id)):
    return _net_worth(user_id)


@router.get("/net-worth/history", response_model=FinanceNetWorthHistory)
async def get_net_worth_history(
    months: int = 12,
    user_id: str = Depends(get_current_user_id),
):
    period_months = max(1, min(months, 60))
    today = date.today()
    current = _net_worth(user_id)
    month_start = today.replace(day=1)
    points: list[FinanceNetWorthPoint] = []
    running_net_worth = current.net_worth_cents

    monthly_cash_flow: dict[str, int] = {}
    for index in range(period_months):
        start = _add_months(month_start, -index)
        end = _add_months(start, 1)
        rows = _monthly_transactions(user_id, start, end)
        monthly_cash_flow[start.isoformat()] = _sum_transactions(rows, "income") - _sum_transactions(rows, "expense")

    for index in range(period_months - 1, -1, -1):
        point_date = _add_months(month_start, -index)
        if index != 0:
            later_start = _add_months(month_start, -index + 1)
            future_cash_flow = sum(
                amount
                for key, amount in monthly_cash_flow.items()
                if date.fromisoformat(key) >= later_start
            )
            point_net_worth = current.net_worth_cents - future_cash_flow
        else:
            point_net_worth = running_net_worth
        points.append(
            FinanceNetWorthPoint(
                date=point_date,
                net_worth_cents=point_net_worth,
                assets_cents=max(0, point_net_worth + current.debts_cents),
                debts_cents=current.debts_cents,
            )
        )

    return FinanceNetWorthHistory(points=points)


@router.get("/net-worth/projection", response_model=FinanceNetWorthProjection)
async def get_net_worth_projection(
    years: int = 5,
    user_id: str = Depends(get_current_user_id),
):
    horizon_years = max(1, min(years, 30))
    current = _net_worth(user_id)
    today = date.today()
    start = _add_months(today.replace(day=1), -6)
    rows = _period_transactions(user_id, start, today, limit=3000)
    active_months = max(1, min(6, (today.year - start.year) * 12 + today.month - start.month + 1))
    monthly_cash_flow = int(round((_sum_transactions(rows, "income") - _sum_transactions(rows, "expense")) / active_months))

    points: list[FinanceNetWorthPoint] = []
    for year in range(1, horizon_years + 1):
        projected = current.net_worth_cents + monthly_cash_flow * 12 * year
        points.append(
            FinanceNetWorthPoint(
                date=_add_months(today, year * 12),
                net_worth_cents=projected,
                assets_cents=max(0, projected + current.debts_cents),
                debts_cents=current.debts_cents,
            )
        )

    return FinanceNetWorthProjection(
        current_net_worth_cents=current.net_worth_cents,
        monthly_cash_flow_cents=monthly_cash_flow,
        years=horizon_years,
        projected_net_worth_cents=points[-1].net_worth_cents,
        points=points,
    )


@router.get("/debts")
async def list_debts(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_debts", user_id, order_by="next_payment_date", desc=False)


@router.post("/debts", status_code=201)
async def create_debt(
    body: FinanceDebtCreate,
    user_id: str = Depends(get_current_user_id),
):
    return _create_row("finance_debts", body, user_id, "Failed to create debt")


@router.get("/debts/{debt_id}/payoff-plan", response_model=FinanceDebtPayoffPlan)
async def get_debt_payoff_plan(
    debt_id: str,
    monthly_payment_cents: Optional[int] = None,
    user_id: str = Depends(get_current_user_id),
):
    result = (
        get_supabase()
        .table("finance_debts")
        .select("*")
        .eq("id", debt_id)
        .eq("user_id", user_id)
        .execute()
    )
    debt = _assert_found(result.data or [], "Debt not found")
    balance_cents = int(debt.get("balance_cents") or 0)
    payment_cents = monthly_payment_cents or int(debt.get("monthly_payment_cents") or 0)
    annual_rate = float(debt.get("interest_rate_percent") or 0)

    if balance_cents <= 0:
        return FinanceDebtPayoffPlan(
            debt_id=debt_id,
            balance_cents=balance_cents,
            monthly_payment_cents=payment_cents,
            annual_interest_rate_percent=annual_rate,
            is_payoff_possible=True,
            months_remaining=0,
            payoff_date=date.today(),
            total_interest_cents=0,
            message="Долг уже погашен.",
        )

    if payment_cents <= 0:
        return FinanceDebtPayoffPlan(
            debt_id=debt_id,
            balance_cents=balance_cents,
            monthly_payment_cents=payment_cents,
            annual_interest_rate_percent=annual_rate,
            is_payoff_possible=False,
            message="Нужно указать ежемесячный платеж, чтобы построить план погашения.",
        )

    monthly_rate = annual_rate / 100 / 12
    if monthly_rate > 0 and payment_cents <= balance_cents * monthly_rate:
        return FinanceDebtPayoffPlan(
            debt_id=debt_id,
            balance_cents=balance_cents,
            monthly_payment_cents=payment_cents,
            annual_interest_rate_percent=annual_rate,
            is_payoff_possible=False,
            message="Платеж не покрывает месячные проценты, долг не будет уменьшаться.",
        )

    remaining = float(balance_cents)
    total_interest = 0.0
    months = 0
    while remaining > 0 and months < 600:
        interest = remaining * monthly_rate
        total_interest += interest
        remaining = remaining + interest - payment_cents
        months += 1

    if remaining > 0:
        return FinanceDebtPayoffPlan(
            debt_id=debt_id,
            balance_cents=balance_cents,
            monthly_payment_cents=payment_cents,
            annual_interest_rate_percent=annual_rate,
            is_payoff_possible=False,
            message="План выходит за горизонт 50 лет, нужен больший ежемесячный платеж.",
        )

    return FinanceDebtPayoffPlan(
        debt_id=debt_id,
        balance_cents=balance_cents,
        monthly_payment_cents=payment_cents,
        annual_interest_rate_percent=annual_rate,
        is_payoff_possible=True,
        months_remaining=months,
        payoff_date=_add_months(date.today(), months),
        total_interest_cents=int(round(total_interest)),
        message="План погашения рассчитан.",
    )


@router.get("/debts/{debt_id}/schedule", response_model=FinanceDebtSchedule)
async def get_debt_payment_schedule(
    debt_id: str,
    monthly_payment_cents: Optional[int] = None,
    user_id: str = Depends(get_current_user_id),
):
    result = (
        get_supabase()
        .table("finance_debts")
        .select("*")
        .eq("id", debt_id)
        .eq("user_id", user_id)
        .execute()
    )
    debt = _assert_found(result.data or [], "Debt not found")
    return _build_debt_schedule(debt, debt_id, monthly_payment_cents)


@router.patch("/debts/{debt_id}")
async def update_debt(
    debt_id: str,
    body: FinanceDebtUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return _update_row("finance_debts", debt_id, body, user_id, "Debt not found")


@router.get("/assets")
async def list_assets(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_assets", user_id, order_by="created_at")


@router.post("/assets", status_code=201)
async def create_asset(
    body: FinanceAssetCreate,
    user_id: str = Depends(get_current_user_id),
):
    return _create_row("finance_assets", body, user_id, "Failed to create asset")


@router.patch("/assets/{asset_id}")
async def update_asset(
    asset_id: str,
    body: FinanceAssetUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return _update_row("finance_assets", asset_id, body, user_id, "Asset not found")


@router.get("/income")
async def list_income(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_income", user_id, order_by="received_on")


@router.post("/income", status_code=201)
async def create_income(
    body: FinanceIncomeCreate,
    user_id: str = Depends(get_current_user_id),
):
    return _create_row("finance_income", body, user_id, "Failed to create income")


@router.get("/tax-events")
async def list_tax_events(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_tax_events", user_id, order_by="due_date", desc=False)


@router.post("/tax-events", status_code=201)
async def create_tax_event(
    body: FinanceTaxEventCreate,
    user_id: str = Depends(get_current_user_id),
):
    return _create_row("finance_tax_events", body, user_id, "Failed to create tax event")


@router.get("/taxes/summary", response_model=FinanceTaxSummary)
async def get_tax_summary(
    year: Optional[int] = None,
    user_id: str = Depends(get_current_user_id),
):
    selected_year = year or date.today().year
    start = date(selected_year, 1, 1)
    end = date(selected_year, 12, 31)
    rows = _period_transactions(user_id, start, end, limit=3000)
    tax_events = _list_table("finance_tax_events", user_id, order_by="due_date", desc=False)
    documents = _list_table("finance_documents", user_id, order_by="created_at")
    deductible_by_category: dict[str, int] = defaultdict(int)
    for row in rows:
        category = str(row.get("category") or "").lower()
        if row.get("type") == "expense" and category in DEDUCTIBLE_CATEGORIES:
            deductible_by_category[category] += int(row.get("amount_cents") or 0)

    upcoming_events = [
        event
        for event in tax_events
        if (due_date := _row_date(event.get("due_date"))) and start <= due_date <= end
    ]
    return FinanceTaxSummary(
        upcoming_events=upcoming_events,
        deductible_candidates=[
            {"category": category, "amount_cents": amount}
            for category, amount in sorted(deductible_by_category.items(), key=lambda item: item[1], reverse=True)
        ],
        documents_count=len(documents),
        safety_note="Это предварительная финансовая сводка, налоговые решения нужно проверять с актуальными правилами.",
    )


@router.get("/documents")
async def list_documents(user_id: str = Depends(get_current_user_id)):
    return _list_table("finance_documents", user_id, order_by="created_at")


@router.post("/documents", status_code=201)
async def create_document(
    body: FinanceDocumentCreate,
    user_id: str = Depends(get_current_user_id),
):
    return _create_row("finance_documents", body, user_id, "Failed to create document")


@router.post("/documents/upload", status_code=201)
async def upload_finance_document(
    file: UploadFile,
    title: Optional[str] = Form(default=None),
    kind: str = Form(default="receipt"),
    linked_transaction_id: Optional[str] = Form(default=None),
    extracted_total_cents: Optional[int] = Form(default=None),
    extracted_date: Optional[date] = Form(default=None),
    user_id: str = Depends(get_current_user_id),
):
    if file.content_type not in SUPPORTED_RECEIPT_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP receipt images are supported")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Receipt image cannot be empty")
    if len(content) > MAX_RECEIPT_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Receipt image is too large (max 10MB)")

    user_dir = RECEIPT_UPLOAD_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    stored_name = _safe_filename(file.filename or "receipt.jpg")
    storage_path = user_dir / stored_name
    storage_path.write_bytes(content)

    document = FinanceDocumentCreate(
        title=title or "Чек",
        kind=kind,
        storage_path=str(storage_path),
        linked_transaction_id=linked_transaction_id,
        extracted_total_cents=extracted_total_cents,
        extracted_date=extracted_date,
    )
    return _create_row("finance_documents", document, user_id, "Failed to create document")


@router.post("/imports/csv/preview", response_model=FinanceCsvImportPreview)
async def preview_finance_csv_import(
    file: UploadFile,
    user_id: str = Depends(get_current_user_id),  # noqa: ARG001
):
    if file.content_type not in {"text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"}:
        raise HTTPException(status_code=415, detail="Only CSV files are supported")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="CSV file cannot be empty")
    return _parse_csv_import(content)


@router.post("/imports/csv/confirm")
async def confirm_finance_csv_import(
    body: FinanceCsvImportConfirmRequest,
    user_id: str = Depends(get_current_user_id),
):
    created: list[dict] = []
    skipped: list[dict] = []
    for index, payload in enumerate(body.rows, start=1):
        try:
            transaction = FinanceTransactionCreate(**payload)
            created.append(
                _create_row(
                    "finance_transactions",
                    transaction,
                    user_id,
                    "Failed to create imported transaction",
                )
            )
        except Exception as exc:  # noqa: BLE001
            skipped.append({"row_number": index, "reason": str(exc)})
    return {"created_count": len(created), "skipped_count": len(skipped), "created": created, "skipped": skipped}


@router.get("/analytics/period-compare", response_model=FinancePeriodCompare)
async def compare_finance_periods(
    date_from: date,
    date_to: date,
    user_id: str = Depends(get_current_user_id),
):
    if date_to < date_from:
        raise HTTPException(status_code=422, detail="date_to must be greater than or equal to date_from")
    period_days = (date_to - date_from).days + 1
    previous_to = date_from - timedelta(days=1)
    previous_from = previous_to - timedelta(days=period_days - 1)

    current_rows = _list_transactions(
        user_id=user_id,
        limit=1000,
        offset=0,
        date_from=date_from,
        date_to=date_to,
    )
    previous_rows = _list_transactions(
        user_id=user_id,
        limit=1000,
        offset=0,
        date_from=previous_from,
        date_to=previous_to,
    )
    current_income = _sum_transactions(current_rows, "income")
    current_expense = _sum_transactions(current_rows, "expense")
    previous_income = _sum_transactions(previous_rows, "income")
    previous_expense = _sum_transactions(previous_rows, "expense")
    current_cash_flow = current_income - current_expense
    previous_cash_flow = previous_income - previous_expense

    return FinancePeriodCompare(
        current_period_start=date_from,
        current_period_end=date_to,
        previous_period_start=previous_from,
        previous_period_end=previous_to,
        current_income_cents=current_income,
        current_expense_cents=current_expense,
        current_cash_flow_cents=current_cash_flow,
        previous_income_cents=previous_income,
        previous_expense_cents=previous_expense,
        previous_cash_flow_cents=previous_cash_flow,
        income_delta_cents=current_income - previous_income,
        expense_delta_cents=current_expense - previous_expense,
        cash_flow_delta_cents=current_cash_flow - previous_cash_flow,
        current_by_category=_category_totals(current_rows),
        previous_by_category=_category_totals(previous_rows),
    )


@router.get("/analytics", response_model=FinanceAnalytics)
async def get_finance_analytics(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user_id: str = Depends(get_current_user_id),
):
    start, next_month = _month_bounds()
    period_start = date_from or start
    period_end = date_to or next_month
    rows = _list_transactions(
        user_id=user_id,
        limit=500,
        offset=0,
        date_from=period_start,
        date_to=period_end,
    )
    income_cents = _sum_transactions(rows, "income")
    expense_cents = _sum_transactions(rows, "expense")
    by_category: dict[str, int] = defaultdict(int)
    daily: dict[str, int] = defaultdict(int)
    for row in rows:
        if row.get("type") != "expense":
            continue
        amount = int(row.get("amount_cents") or 0)
        by_category[str(row.get("category") or "uncategorized")] += amount
        daily[str(row.get("occurred_on"))] += amount

    return FinanceAnalytics(
        period_start=period_start,
        period_end=period_end,
        income_cents=income_cents,
        expense_cents=expense_cents,
        cash_flow_cents=income_cents - expense_cents,
        by_category=[
            {"category": category, "expense_cents": amount}
            for category, amount in sorted(by_category.items(), key=lambda item: item[1], reverse=True)
        ],
        daily=[
            {"date": item_date, "expense_cents": amount}
            for item_date, amount in sorted(daily.items())
        ],
    )
