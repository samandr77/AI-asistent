from __future__ import annotations

import re
from datetime import date

from models.finance import FinanceAnalyzeEntryAction

_AMOUNT_RE = re.compile(
    r"(?P<amount>\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[,.]\d{1,2})?)\s*(?:₽|руб(?:\.|лей|ля|ль)?|р\b)?",
    re.IGNORECASE,
)

_CATEGORY_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("transport", ("такси", "метро", "автобус", "транспорт", "бензин", "парковк")),
    ("food", ("продукт", "еда", "кафе", "ресторан", "обед", "ужин", "завтрак", "кофе")),
    ("health", ("аптек", "врач", "здоров", "лекарств", "анализ")),
    ("subscriptions", ("подписк", "сервис", "netflix", "spotify", "gpt", "chatgpt")),
    ("home", ("квартир", "аренд", "коммунал", "дом")),
    ("education", ("курс", "обуч", "книг", "университет")),
    ("income", ("зарплат", "доход", "аванс", "фриланс", "получил", "получила")),
)

_EXPENSE_WORDS = (
    "потрат",
    "купил",
    "купила",
    "оплат",
    "заплат",
    "списал",
    "списали",
    "расход",
)
_INCOME_WORDS = ("получил", "получила", "пришл", "зарплат", "доход", "аванс", "фриланс")


def _amount_to_cents(raw: str) -> int:
    normalized = raw.replace(" ", "").replace("\u00a0", "").replace(",", ".")
    return int(round(float(normalized) * 100))


def _first_amount(text: str) -> int | None:
    match = _AMOUNT_RE.search(text)
    if not match:
        return None
    return _amount_to_cents(match.group("amount"))


def _category(text: str) -> str:
    lowered = text.lower()
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return category
    return "other"


def _confidence(text: str, *keywords: str) -> float:
    lowered = text.lower()
    hits = sum(1 for keyword in keywords if keyword in lowered)
    return min(0.95, 0.55 + hits * 0.15)


def analyze_finance_entry(
    *,
    text: str,
    occurred_on: date,
    currency: str,
) -> list[FinanceAnalyzeEntryAction]:
    lowered = text.lower()
    amount_cents = _first_amount(text)
    actions: list[FinanceAnalyzeEntryAction] = []

    if amount_cents and any(word in lowered for word in _INCOME_WORDS):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="income",
                confidence=_confidence(text, *_INCOME_WORDS),
                reason="Нашел сумму и признаки дохода.",
                payload={
                    "source": "Запись пользователя",
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "received_on": occurred_on,
                    "category": _category(text),
                },
            )
        )
    elif amount_cents and any(word in lowered for word in _EXPENSE_WORDS):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="transaction",
                confidence=_confidence(text, *_EXPENSE_WORDS),
                reason="Нашел сумму и признаки расхода.",
                payload={
                    "occurred_on": occurred_on,
                    "type": "expense",
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "category": _category(text),
                    "merchant": None,
                    "note": text,
                },
            )
        )

    if amount_cents and "подписк" in lowered:
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="subscription",
                confidence=0.82,
                reason="Запись похожа на регулярную подписку.",
                payload={
                    "name": "Подписка",
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "next_charge_date": occurred_on,
                    "category": "subscriptions",
                    "is_active": True,
                },
            )
        )

    if amount_cents and any(word in lowered for word in ("накоп", "отлож", "цель", "подушк")):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="goal",
                confidence=0.78,
                reason="Запись похожа на финансовую цель или накопление.",
                payload={
                    "title": "Финансовая цель",
                    "target_amount_cents": amount_cents,
                    "saved_amount_cents": 0,
                    "status": "active",
                },
            )
        )

    if amount_cents and any(word in lowered for word in ("долг", "кредит", "ипотек", "займ")):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="debt",
                confidence=0.78,
                reason="Запись похожа на долг или кредит.",
                payload={
                    "name": "Долг",
                    "type": "other",
                    "balance_cents": amount_cents,
                },
            )
        )

    if amount_cents and any(word in lowered for word in ("актив", "брокер", "инвест", "машин", "недвиж")):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="asset",
                confidence=0.74,
                reason="Запись похожа на актив или инвестицию.",
                payload={
                    "name": "Актив",
                    "type": "other",
                    "current_value_cents": amount_cents,
                    "currency": currency,
                },
            )
        )

    if any(word in lowered for word in ("налог", "деклараци", "ндфл")):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="tax_event",
                confidence=0.76,
                reason="Запись похожа на налоговое событие.",
                payload={
                    "title": "Налоговое событие",
                    "due_date": occurred_on,
                    "amount_cents": amount_cents,
                    "notes": text,
                },
            )
        )

    if any(word in lowered for word in ("чек", "счет", "счёт", "квитанц", "договор", "акт")):
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="document",
                confidence=0.72,
                reason="Запись похожа на финансовый документ.",
                payload={
                    "title": "Финансовый документ",
                    "kind": "receipt",
                    "extracted_total_cents": amount_cents,
                    "extracted_date": occurred_on,
                },
            )
        )

    if not actions:
        actions.append(
            FinanceAnalyzeEntryAction(
                kind="note",
                confidence=0.45,
                reason="Не нашел уверенного финансового действия, сохранил как заметку для будущей памяти.",
                payload={"text": text, "occurred_on": occurred_on, "currency": currency},
            )
        )

    return actions
