"""30 Russian reference phrases for the extended task parser.

Each entry:
  text                — raw user input
  expected            — fields the parser should return (key → expected value)
  must_have           — list of keys that *must* be populated for accuracy metric
  ambiguous           — True if parser is expected to return clarification_questions

Accuracy is computed per field: for each CORPUS entry where field in must_have,
parser must populate that field (non-empty). Used in test_corpus_accuracy.
"""
from __future__ import annotations

CORPUS: list[dict] = [
    # ── Time + contact + duration (high precision) ──
    {
        "text": "позвонить Маше завтра в 15:00 на 30 минут",
        "expected": {
            "title_contains": "Маше",
            "time_of_day": "15:00",
            "duration_estimated_min": 30,
            "contact": "Маша",
        },
        "must_have": ["time_of_day", "contact"],
        "ambiguous": False,
    },
    {
        "text": "встретиться с Иваном завтра в 09:30",
        "expected": {
            "title_contains": "Иваном",
            "time_of_day": "09:30",
            "contact": "Иван",
        },
        "must_have": ["time_of_day", "contact"],
        "ambiguous": False,
    },
    {
        "text": "созвон с Петром в 14:00",
        "expected": {"time_of_day": "14:00", "contact": "Пётр"},
        "must_have": ["time_of_day", "contact"],
        "ambiguous": False,
    },
    {
        "text": "позвонить врачу в 11:15",
        "expected": {"time_of_day": "11:15"},
        "must_have": ["time_of_day"],
        "ambiguous": False,
    },
    {
        "text": "напомнить позвонить бабушке вечером",
        "expected": {"time_of_day": "19:00", "contact": "бабушка"},
        "must_have": ["time_of_day", "contact"],
        "ambiguous": False,
    },
    # ── Fuzzy time of day ──
    {
        "text": "утром купить хлеб",
        "expected": {"time_of_day": "09:00"},
        "must_have": ["time_of_day"],
        "ambiguous": False,
    },
    {
        "text": "днём заехать в банк",
        "expected": {"time_of_day": "13:00"},
        "must_have": ["time_of_day"],
        "ambiguous": False,
    },
    {
        "text": "вечером сходить в зал",
        "expected": {"time_of_day": "19:00"},
        "must_have": ["time_of_day"],
        "ambiguous": False,
    },
    {
        "text": "ночью проверить почту",
        "expected": {"time_of_day": "22:00"},
        "must_have": ["time_of_day"],
        "ambiguous": False,
    },
    # ── Duration only ──
    {
        "text": "поработать над презентацией час",
        "expected": {"duration_estimated_min": 60},
        "must_have": ["duration_estimated_min"],
        "ambiguous": False,
    },
    {
        "text": "медитация 20 минут",
        "expected": {"duration_estimated_min": 20},
        "must_have": ["duration_estimated_min"],
        "ambiguous": False,
    },
    {
        "text": "сделать тренировку на 45 минут",
        "expected": {"duration_estimated_min": 45},
        "must_have": ["duration_estimated_min"],
        "ambiguous": False,
    },
    # ── Contact only ──
    {
        "text": "написать Алексею про дизайн",
        "expected": {"contact": "Алексей"},
        "must_have": ["contact"],
        "ambiguous": False,
    },
    {
        "text": "уточнить у Кати дату встречи",
        "expected": {"contact": "Катя"},
        "must_have": ["contact"],
        "ambiguous": False,
    },
    # ── URL ──
    {
        "text": "посмотреть https://example.com позже",
        "expected": {"url": "https://example.com"},
        "must_have": ["url"],
        "ambiguous": False,
    },
    {
        "text": "почитать статью https://docs.python.org/3/whatsnew",
        "expected": {"url": "https://docs.python.org/3/whatsnew"},
        "must_have": ["url"],
        "ambiguous": False,
    },
    # ── Today / urgency ──
    {
        "text": "сегодня обязательно сдать отчёт",
        "expected": {"is_today": True, "priority": 3},
        "must_have": ["is_today"],
        "ambiguous": False,
    },
    {
        "text": "срочно ответить клиенту",
        "expected": {"priority": 3},
        "must_have": ["priority"],
        "ambiguous": False,
    },
    # ── Spheres ──
    {
        "text": "оплатить интернет",
        "expected": {"sphere": "finance"},
        "must_have": ["sphere"],
        "ambiguous": False,
    },
    {
        "text": "записаться к стоматологу",
        "expected": {"sphere": "health"},
        "must_have": ["sphere"],
        "ambiguous": False,
    },
    {
        "text": "купить молоко",
        "expected": {"sphere": "family"},
        "must_have": ["sphere"],
        "ambiguous": False,
    },
    # ── Simple titles ──
    {
        "text": "разобрать почту",
        "expected": {"title_contains": "почт"},
        "must_have": ["title"],
        "ambiguous": False,
    },
    {
        "text": "проверить квартальные показатели",
        "expected": {"title_contains": "квартальные"},
        "must_have": ["title"],
        "ambiguous": False,
    },
    # ── Ambiguous → clarification_questions expected ──
    {
        "text": "подготовить отчёт",
        "expected": {},
        "must_have": [],
        "ambiguous": True,
    },
    {
        "text": "позвонить",
        "expected": {},
        "must_have": [],
        "ambiguous": True,
    },
    {
        "text": "обсудить вопрос",
        "expected": {},
        "must_have": [],
        "ambiguous": True,
    },
    # ── Combined ──
    {
        "text": "позвонить Маше сегодня в 16:00 на 15 минут про проект",
        "expected": {
            "time_of_day": "16:00",
            "duration_estimated_min": 15,
            "contact": "Маша",
            "is_today": True,
        },
        "must_have": ["time_of_day", "contact", "is_today"],
        "ambiguous": False,
    },
    {
        "text": "встреча с командой завтра в 10:00 на час",
        "expected": {"time_of_day": "10:00", "duration_estimated_min": 60},
        "must_have": ["time_of_day", "duration_estimated_min"],
        "ambiguous": False,
    },
    {
        "text": "забронировать столик на завтра вечером",
        "expected": {"time_of_day": "19:00"},
        "must_have": ["time_of_day"],
        "ambiguous": False,
    },
    {
        "text": "записаться к врачу утром",
        "expected": {"time_of_day": "09:00", "sphere": "health"},
        "must_have": ["time_of_day", "sphere"],
        "ambiguous": False,
    },
]

assert len(CORPUS) >= 30, f"Corpus too small: {len(CORPUS)}"
