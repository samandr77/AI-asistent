from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any


DEFAULT_TARGET_DURATION_MINUTES = 480


def _clamp(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, round(value)))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _time_to_minutes(value: Any) -> int | None:
    if not value:
        return None
    try:
        hour, minute = str(value).split(":", 1)
        return int(hour) * 60 + int(minute[:2])
    except (TypeError, ValueError):
        return None


def duration_between_minutes(started_at: Any, ended_at: Any) -> int | None:
    start = parse_dt(started_at)
    end = parse_dt(ended_at)
    if not start or not end:
        return None
    if end <= start:
        end = end + timedelta(days=1)
    minutes = round((end - start).total_seconds() / 60)
    if minutes <= 0:
        return None
    return min(minutes, 1440)


def _duration_score(minutes: int | None, target_minutes: int = DEFAULT_TARGET_DURATION_MINUTES) -> int:
    if not minutes:
        return 35
    low = max(240, target_minutes - 60)
    high = min(720, target_minutes + 60)
    if low <= minutes <= high:
        return 100
    if minutes < low:
        if minutes >= 360:
            return _clamp(70 + ((minutes - 360) / max(1, low - 360)) * 30)
        if minutes >= 240:
            return _clamp(35 + ((minutes - 240) / 120) * 35)
        return _clamp((minutes / 240) * 35)
    if minutes <= 600:
        return _clamp(100 - ((minutes - high) / max(1, 600 - high)) * 15)
    return _clamp(70 - ((minutes - 600) / 180) * 40, low=25)


def _clock_midpoint_minutes(row: dict[str, Any]) -> int | None:
    start = parse_dt(row.get("bedtime_at"))
    end = parse_dt(row.get("wake_at"))
    if start and end:
        duration = duration_between_minutes(start, end)
        if duration:
            midpoint = start + timedelta(minutes=duration / 2)
            return midpoint.hour * 60 + midpoint.minute

    bedtime = _time_to_minutes(row.get("bedtime"))
    wake = _time_to_minutes(row.get("wake_time"))
    if bedtime is None or wake is None:
        return None
    span = wake - bedtime
    if span <= 0:
        span += 1440
    return int((bedtime + span / 2) % 1440)


def _circular_mean(minutes: list[int]) -> int | None:
    if not minutes:
        return None
    radians = [2 * math.pi * minute / 1440 for minute in minutes]
    sin_avg = sum(math.sin(value) for value in radians) / len(radians)
    cos_avg = sum(math.cos(value) for value in radians) / len(radians)
    if sin_avg == 0 and cos_avg == 0:
        return None
    angle = math.atan2(sin_avg, cos_avg)
    if angle < 0:
        angle += 2 * math.pi
    return round(angle * 1440 / (2 * math.pi)) % 1440


def _clock_distance_minutes(left: int, right: int) -> int:
    raw = abs(left - right)
    return min(raw, 1440 - raw)


def _routine_score(current: dict[str, Any], prior_sleep: list[dict[str, Any]]) -> tuple[int, int | None]:
    current_midpoint = _clock_midpoint_minutes(current)
    prior_midpoints = [
        value
        for row in prior_sleep[:7]
        if (value := _clock_midpoint_minutes(row)) is not None
    ]
    if current_midpoint is None or len(prior_midpoints) < 3:
        return 70, None
    average = _circular_mean(prior_midpoints)
    if average is None:
        return 70, None
    deviation = _clock_distance_minutes(current_midpoint, average)
    if deviation <= 30:
        return 100, deviation
    if deviation <= 60:
        return 85, deviation
    if deviation <= 90:
        return 70, deviation
    if deviation <= 120:
        return 55, deviation
    return _clamp(55 - ((deviation - 120) / 120) * 35, low=20), deviation


def sleep_tone(duration_minutes: int | None) -> str:
    if not duration_minutes:
        return "unknown"
    if 420 <= duration_minutes <= 540:
        return "good"
    if 360 <= duration_minutes < 420 or 540 < duration_minutes <= 600:
        return "warn"
    return "low"


def calculate_sleep_quality(
    sleep: dict[str, Any],
    *,
    prior_sleep: list[dict[str, Any]] | None = None,
    target_duration_minutes: int = DEFAULT_TARGET_DURATION_MINUTES,
) -> tuple[int, dict[str, int | None]]:
    duration = int(sleep.get("duration_minutes") or 0)
    duration_part = _duration_score(duration, target_duration_minutes)
    routine_part, deviation = _routine_score(sleep, prior_sleep or [])
    score = _clamp(duration_part * 0.60 + routine_part * 0.40)
    return score, {
        "duration": duration_part,
        "routine": routine_part,
        "duration_minutes": duration,
        "midpoint_deviation_minutes": deviation,
        "target_duration_minutes": target_duration_minutes,
    }


def enrich_sleep_row(
    sleep: dict[str, Any],
    *,
    prior_sleep: list[dict[str, Any]] | None = None,
    target_duration_minutes: int = DEFAULT_TARGET_DURATION_MINUTES,
) -> dict[str, Any]:
    row = dict(sleep)
    if not row.get("duration_minutes"):
        duration = duration_between_minutes(row.get("bedtime_at"), row.get("wake_at"))
        if duration:
            row["duration_minutes"] = duration
    score, breakdown = calculate_sleep_quality(
        row,
        prior_sleep=prior_sleep,
        target_duration_minutes=target_duration_minutes,
    )
    row["quality_score"] = score
    row["quality_breakdown"] = breakdown
    row["quality"] = round(score / 10)
    row["tone"] = sleep_tone(int(row.get("duration_minutes") or 0))
    return row


def sleep_stats(
    sleep_logs: list[dict[str, Any]],
    *,
    target_duration_minutes: int = DEFAULT_TARGET_DURATION_MINUTES,
) -> dict[str, Any]:
    enriched: list[dict[str, Any]] = []
    ordered = sorted(sleep_logs, key=lambda row: str(row.get("sleep_date") or ""), reverse=True)
    for index, row in enumerate(ordered):
        enriched.append(
            enrich_sleep_row(
                row,
                prior_sleep=ordered[index + 1 : index + 8],
                target_duration_minutes=target_duration_minutes,
            )
        )

    durations = [int(row.get("duration_minutes") or 0) for row in enriched if row.get("duration_minutes")]
    scores = [int(row.get("quality_score") or 0) for row in enriched if row.get("quality_score") is not None]
    deviations = [
        int(value)
        for row in enriched
        if (value := (row.get("quality_breakdown") or {}).get("midpoint_deviation_minutes")) is not None
    ]
    good_streak = 0
    for row in enriched:
        if int(row.get("quality_score") or 0) >= 80:
            good_streak += 1
        else:
            break

    tips = []
    average_duration = round(sum(durations) / len(durations)) if durations else 0
    average_score = round(sum(scores) / len(scores)) if scores else 0
    average_deviation = round(sum(deviations) / len(deviations)) if deviations else None
    if average_duration and average_duration < 420:
        tips.append(
            {
                "id": "sleep-duration-short",
                "severity": "warning",
                "title": "Сна меньше нормы",
                "message": "Данные показывают, что средняя длительность ниже 7 часов. Для взрослых обычно ориентируются на 7-9 часов сна.",
                "suggested_action": "Попробуй сдвинуть отход ко сну на 20-30 минут раньше несколько дней подряд.",
            }
        )
    if average_deviation is not None and average_deviation > 90:
        tips.append(
            {
                "id": "sleep-routine-irregular",
                "severity": "info",
                "title": "Режим плавает",
                "message": "Данные показывают заметный разброс середины сна. Регулярность помогает циркадному ритму.",
                "suggested_action": "Выбери стабильное окно отхода ко сну и подъема хотя бы на будние дни.",
            }
        )
    if not tips:
        tips.append(
            {
                "id": "sleep-baseline",
                "severity": "info",
                "title": "Собираем базу сна",
                "message": "После нескольких ночей приложение точнее покажет регулярность и тренды.",
                "suggested_action": "Записывай хотя бы время лег/встал в течение недели.",
            }
        )

    return {
        "average_duration_minutes": average_duration,
        "average_score": average_score,
        "average_midpoint_deviation_minutes": average_deviation,
        "good_sleep_streak": good_streak,
        "target_duration_minutes": target_duration_minutes,
        "nights_count": len(enriched),
        "series": [
            {
                "sleep_date": row.get("sleep_date"),
                "duration_minutes": row.get("duration_minutes"),
                "quality_score": row.get("quality_score"),
                "tone": row.get("tone"),
            }
            for row in reversed(enriched)
        ],
        "tips": tips,
    }
