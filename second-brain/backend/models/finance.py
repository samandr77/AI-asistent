from __future__ import annotations

from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


VALID_ACCOUNT_TYPES = {"cash", "card", "checking", "savings", "investment", "loan", "other"}
VALID_TRANSACTION_TYPES = {"expense", "income", "transfer"}
VALID_BUDGET_PERIODS = {"monthly", "weekly"}
VALID_GOAL_STATUSES = {"active", "paused", "achieved", "archived"}
VALID_DEBT_TYPES = {"credit_card", "loan", "mortgage", "installment", "personal", "other"}
VALID_ASSET_TYPES = {"cash", "brokerage", "retirement", "real_estate", "vehicle", "other"}
VALID_ANALYZE_ACTIONS = {
    "transaction",
    "income",
    "subscription",
    "budget_update",
    "goal",
    "debt",
    "asset",
    "tax_event",
    "document",
    "note",
    "question",
}


def _clean_text(value: Optional[str], *, max_len: int, field_name: str) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if len(cleaned) > max_len:
        raise ValueError(f"{field_name} must be {max_len} characters or fewer")
    return cleaned or None


def _positive_cents(value: int, field_name: str) -> int:
    if value <= 0:
        raise ValueError(f"{field_name} must be greater than 0")
    return value


def _non_negative_cents(value: int, field_name: str) -> int:
    if value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


class FinanceAccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = "cash"
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    balance_cents: int = 0
    is_archived: bool = False

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in VALID_ACCOUNT_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_ACCOUNT_TYPES)}")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class FinanceAccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    balance_cents: Optional[int] = None
    is_archived: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=120, field_name="name")

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_ACCOUNT_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_ACCOUNT_TYPES)}")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        return value.upper() if value is not None else None


class FinanceTransactionCreate(BaseModel):
    occurred_on: date
    type: str = "expense"
    amount_cents: int
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    category: str = Field(min_length=1, max_length=80)
    merchant: Optional[str] = None
    note: Optional[str] = None
    account_id: Optional[str] = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in VALID_TRANSACTION_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_TRANSACTION_TYPES)}")
        return value

    @field_validator("amount_cents")
    @classmethod
    def positive_amount(cls, value: int) -> int:
        return _positive_cents(value, "amount_cents")

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("category cannot be empty")
        return cleaned

    @field_validator("merchant")
    @classmethod
    def clean_merchant(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=160, field_name="merchant")

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="note")


class FinanceTransactionUpdate(BaseModel):
    occurred_on: Optional[date] = None
    type: Optional[str] = None
    amount_cents: Optional[int] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    note: Optional[str] = None
    account_id: Optional[str] = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_TRANSACTION_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_TRANSACTION_TYPES)}")
        return value

    @field_validator("amount_cents")
    @classmethod
    def positive_amount(cls, value: Optional[int]) -> Optional[int]:
        return _positive_cents(value, "amount_cents") if value is not None else None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        return value.upper() if value is not None else None

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=80, field_name="category")

    @field_validator("merchant")
    @classmethod
    def clean_merchant(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=160, field_name="merchant")

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="note")


class FinanceBudgetCreate(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    period: str = "monthly"
    limit_cents: int
    rollover_enabled: bool = False

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("category cannot be empty")
        return cleaned

    @field_validator("period")
    @classmethod
    def valid_period(cls, value: str) -> str:
        if value not in VALID_BUDGET_PERIODS:
            raise ValueError(f"period must be one of {sorted(VALID_BUDGET_PERIODS)}")
        return value

    @field_validator("limit_cents")
    @classmethod
    def positive_limit(cls, value: int) -> int:
        return _positive_cents(value, "limit_cents")


class FinanceBudgetUpdate(BaseModel):
    category: Optional[str] = None
    period: Optional[str] = None
    limit_cents: Optional[int] = None
    rollover_enabled: Optional[bool] = None

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=80, field_name="category")

    @field_validator("period")
    @classmethod
    def valid_period(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_BUDGET_PERIODS:
            raise ValueError(f"period must be one of {sorted(VALID_BUDGET_PERIODS)}")
        return value

    @field_validator("limit_cents")
    @classmethod
    def positive_limit(cls, value: Optional[int]) -> Optional[int]:
        return _positive_cents(value, "limit_cents") if value is not None else None


class FinanceGoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    target_amount_cents: int
    saved_amount_cents: int = 0
    target_date: Optional[date] = None
    linked_account_id: Optional[str] = None
    status: str = "active"

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("title cannot be empty")
        return cleaned

    @field_validator("target_amount_cents")
    @classmethod
    def positive_target(cls, value: int) -> int:
        return _positive_cents(value, "target_amount_cents")

    @field_validator("saved_amount_cents")
    @classmethod
    def non_negative_saved(cls, value: int) -> int:
        return _non_negative_cents(value, "saved_amount_cents")

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in VALID_GOAL_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_GOAL_STATUSES)}")
        return value

    @model_validator(mode="after")
    def saved_not_greater_than_target(self) -> "FinanceGoalCreate":
        if self.saved_amount_cents > self.target_amount_cents:
            raise ValueError("saved_amount_cents cannot exceed target_amount_cents")
        return self


class FinanceGoalUpdate(BaseModel):
    title: Optional[str] = None
    target_amount_cents: Optional[int] = None
    saved_amount_cents: Optional[int] = None
    target_date: Optional[date] = None
    linked_account_id: Optional[str] = None
    status: Optional[str] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=160, field_name="title")

    @field_validator("target_amount_cents")
    @classmethod
    def positive_target(cls, value: Optional[int]) -> Optional[int]:
        return _positive_cents(value, "target_amount_cents") if value is not None else None

    @field_validator("saved_amount_cents")
    @classmethod
    def non_negative_saved(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "saved_amount_cents") if value is not None else None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_GOAL_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_GOAL_STATUSES)}")
        return value


class FinanceSubscriptionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount_cents: int
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    next_charge_date: date
    category: str = Field(default="subscriptions", min_length=1, max_length=80)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("amount_cents")
    @classmethod
    def positive_amount(cls, value: int) -> int:
        return _positive_cents(value, "amount_cents")

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class FinanceDebtCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = "other"
    balance_cents: int
    interest_rate_percent: Optional[float] = None
    monthly_payment_cents: Optional[int] = None
    next_payment_date: Optional[date] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in VALID_DEBT_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_DEBT_TYPES)}")
        return value

    @field_validator("balance_cents")
    @classmethod
    def non_negative_balance(cls, value: int) -> int:
        return _non_negative_cents(value, "balance_cents")

    @field_validator("monthly_payment_cents")
    @classmethod
    def non_negative_payment(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "monthly_payment_cents") if value is not None else None


class FinanceDebtUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    balance_cents: Optional[int] = None
    interest_rate_percent: Optional[float] = None
    monthly_payment_cents: Optional[int] = None
    next_payment_date: Optional[date] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=120, field_name="name")

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_DEBT_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_DEBT_TYPES)}")
        return value

    @field_validator("balance_cents")
    @classmethod
    def non_negative_balance(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "balance_cents") if value is not None else None

    @field_validator("monthly_payment_cents")
    @classmethod
    def non_negative_payment(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "monthly_payment_cents") if value is not None else None


class FinanceAssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = "other"
    current_value_cents: int
    currency: str = Field(default="RUB", min_length=3, max_length=3)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in VALID_ASSET_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_ASSET_TYPES)}")
        return value

    @field_validator("current_value_cents")
    @classmethod
    def non_negative_value(cls, value: int) -> int:
        return _non_negative_cents(value, "current_value_cents")

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class FinanceAssetUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    current_value_cents: Optional[int] = None
    currency: Optional[str] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=120, field_name="name")

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_ASSET_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_ASSET_TYPES)}")
        return value

    @field_validator("current_value_cents")
    @classmethod
    def non_negative_value(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "current_value_cents") if value is not None else None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        return value.upper() if value is not None else None


class FinanceIncomeCreate(BaseModel):
    source: str = Field(min_length=1, max_length=160)
    amount_cents: int
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    received_on: date
    category: str = Field(default="income", min_length=1, max_length=80)

    @field_validator("source")
    @classmethod
    def clean_source(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("source cannot be empty")
        return cleaned

    @field_validator("amount_cents")
    @classmethod
    def positive_amount(cls, value: int) -> int:
        return _positive_cents(value, "amount_cents")

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("category cannot be empty")
        return cleaned


class FinanceTaxEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    due_date: date
    amount_cents: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("title cannot be empty")
        return cleaned

    @field_validator("amount_cents")
    @classmethod
    def non_negative_amount(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "amount_cents") if value is not None else None

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class FinanceDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    kind: str = Field(default="receipt", min_length=1, max_length=80)
    storage_path: Optional[str] = None
    linked_transaction_id: Optional[str] = None
    extracted_total_cents: Optional[int] = None
    extracted_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("title cannot be empty")
        return cleaned

    @field_validator("kind")
    @classmethod
    def clean_kind(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("kind cannot be empty")
        return cleaned

    @field_validator("storage_path")
    @classmethod
    def clean_storage_path(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=500, field_name="storage_path")

    @field_validator("extracted_total_cents")
    @classmethod
    def non_negative_total(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative_cents(value, "extracted_total_cents") if value is not None else None


class FinanceAnalyzeEntryRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    occurred_on: Optional[date] = None
    currency: str = Field(default="RUB", min_length=3, max_length=3)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("text cannot be empty")
        return cleaned

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class FinanceAnalyzeEntryAction(BaseModel):
    kind: str
    confidence: float = Field(ge=0, le=1)
    payload: dict[str, Any]
    reason: str = Field(min_length=1, max_length=400)
    needs_confirmation: bool = True

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, value: str) -> str:
        if value not in VALID_ANALYZE_ACTIONS:
            raise ValueError(f"kind must be one of {sorted(VALID_ANALYZE_ACTIONS)}")
        return value

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("reason cannot be empty")
        return cleaned


class FinanceAnalyzeEntryResponse(BaseModel):
    source_text: str
    actions: list[FinanceAnalyzeEntryAction] = Field(default_factory=list)


class FinanceAnalyzeEntryConfirmRequest(BaseModel):
    actions: list[FinanceAnalyzeEntryAction] = Field(min_length=1)


class FinanceAnalyzeEntryConfirmResponse(BaseModel):
    created: list[dict] = Field(default_factory=list)
    skipped: list[dict] = Field(default_factory=list)


class FinanceAlert(BaseModel):
    kind: str
    severity: str
    title: str
    message: str
    amount_cents: Optional[int] = None
    due_date: Optional[date] = None
    entity_id: Optional[str] = None
    entity_type: Optional[str] = None


class FinancePeriodCompare(BaseModel):
    current_period_start: date
    current_period_end: date
    previous_period_start: date
    previous_period_end: date
    current_income_cents: int
    current_expense_cents: int
    current_cash_flow_cents: int
    previous_income_cents: int
    previous_expense_cents: int
    previous_cash_flow_cents: int
    income_delta_cents: int
    expense_delta_cents: int
    cash_flow_delta_cents: int
    current_by_category: list[dict] = Field(default_factory=list)
    previous_by_category: list[dict] = Field(default_factory=list)


class FinanceDebtPayoffPlan(BaseModel):
    debt_id: str
    balance_cents: int
    monthly_payment_cents: int
    annual_interest_rate_percent: float
    is_payoff_possible: bool
    months_remaining: Optional[int] = None
    payoff_date: Optional[date] = None
    total_interest_cents: Optional[int] = None
    message: str


class FinanceChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    period_start: Optional[date] = None
    period_end: Optional[date] = None

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message cannot be empty")
        return cleaned


class FinanceChatResponse(BaseModel):
    answer: str
    used_data: list[str] = Field(default_factory=list)
    recommendations: list[dict] = Field(default_factory=list)
    safety_note: Optional[str] = None


class FinanceRecommendation(BaseModel):
    id: str
    kind: str
    severity: str
    title: str
    message: str
    suggested_action: Optional[str] = None
    amount_cents: Optional[int] = None
    used_data: list[str] = Field(default_factory=list)


class FinanceRecommendationFeedback(BaseModel):
    status: str = Field(pattern="^(helpful|not_helpful|dismissed|accepted)$")
    note: Optional[str] = None


class FinanceSubscriptionDetection(BaseModel):
    merchant: str
    amount_cents: int
    currency: str = "RUB"
    category: str = "subscriptions"
    occurrences: int
    confidence: float = Field(ge=0, le=1)
    suggested_next_charge_date: Optional[date] = None
    transaction_ids: list[str] = Field(default_factory=list)


class FinanceBudgetTemplateItem(BaseModel):
    category: str
    suggested_limit_cents: int
    average_monthly_spend_cents: int
    peak_monthly_spend_cents: int
    confidence: float = Field(ge=0, le=1)


class FinanceBudgetTemplate(BaseModel):
    period_months: int
    items: list[FinanceBudgetTemplateItem] = Field(default_factory=list)


class FinanceDebtScheduleItem(BaseModel):
    month_number: int
    payment_cents: int
    principal_cents: int
    interest_cents: int
    remaining_balance_cents: int
    payment_date: date


class FinanceDebtSchedule(BaseModel):
    debt_id: str
    is_payoff_possible: bool
    items: list[FinanceDebtScheduleItem] = Field(default_factory=list)
    message: str


class FinanceTaxSummary(BaseModel):
    upcoming_events: list[dict] = Field(default_factory=list)
    deductible_candidates: list[dict] = Field(default_factory=list)
    documents_count: int = 0
    safety_note: str


class FinanceNetWorthPoint(BaseModel):
    date: date
    net_worth_cents: int
    assets_cents: int
    debts_cents: int


class FinanceNetWorthHistory(BaseModel):
    points: list[FinanceNetWorthPoint] = Field(default_factory=list)


class FinanceNetWorthProjection(BaseModel):
    current_net_worth_cents: int
    monthly_cash_flow_cents: int
    years: int
    projected_net_worth_cents: int
    points: list[FinanceNetWorthPoint] = Field(default_factory=list)


class FinanceCsvImportPreviewRow(BaseModel):
    row_number: int
    payload: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class FinanceCsvImportPreview(BaseModel):
    rows: list[FinanceCsvImportPreviewRow] = Field(default_factory=list)
    valid_count: int = 0
    error_count: int = 0


class FinanceCsvImportConfirmRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(min_length=1)


class FinanceNetWorth(BaseModel):
    accounts_cents: int = 0
    assets_cents: int = 0
    debts_cents: int = 0
    net_worth_cents: int = 0


class FinanceDashboard(BaseModel):
    currency: str = "RUB"
    total_balance_cents: int = 0
    monthly_income_cents: int = 0
    monthly_expense_cents: int = 0
    remaining_budget_cents: Optional[int] = None
    net_worth_cents: int = 0
    accounts_count: int = 0
    active_goals_count: int = 0
    subscriptions_monthly_cents: int = 0
    recent_transactions: list[dict] = Field(default_factory=list)
    budgets: list[dict] = Field(default_factory=list)
    alerts: list[dict] = Field(default_factory=list)


class FinanceAnalytics(BaseModel):
    period_start: date
    period_end: date
    income_cents: int
    expense_cents: int
    cash_flow_cents: int
    by_category: list[dict] = Field(default_factory=list)
    daily: list[dict] = Field(default_factory=list)
