"""KPI analytics — trend, status, projection."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def compute_trend_percent(history: List[Dict[str, Any]]) -> Optional[float]:
    """Percent change between earliest and latest entries in history.

    History is expected sorted by recorded_on ascending. Returns None when
    less than 2 entries or earliest value is zero.
    """
    if not history or len(history) < 2:
        return None
    earliest = float(history[0].get("value") or 0)
    latest = float(history[-1].get("value") or 0)
    if earliest == 0:
        return None
    return round(((latest - earliest) / abs(earliest)) * 100, 1)


def derive_kpi_status(kpi: Dict[str, Any]) -> str:
    """Return 'ok' | 'warning' | 'breach' based on direction + thresholds."""
    target = kpi.get("target_value")
    current = kpi.get("current_value")
    warn = kpi.get("warning_threshold")
    direction = kpi.get("direction") or "increase"

    if current is None or target is None:
        return "ok"

    current = float(current)
    target = float(target)

    if direction == "increase":
        if current >= target:
            return "ok"
        if warn is not None and current < float(warn):
            return "breach"
        return "warning"

    if direction == "decrease":
        if current <= target:
            return "ok"
        if warn is not None and current > float(warn):
            return "breach"
        return "warning"

    # maintain
    if target == 0:
        return "ok" if current == 0 else "warning"
    deviation = abs(current - target) / abs(target)
    if deviation <= 0.05:
        return "ok"
    if warn is not None and deviation > float(warn):
        return "breach"
    return "warning"


def enrich_kpi(kpi: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Attach derived fields (history, trend_percent, status) to a kpi dict."""
    return {
        **kpi,
        "history": history,
        "trend_percent": compute_trend_percent(history),
        "status": derive_kpi_status(kpi),
    }
