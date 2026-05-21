from __future__ import annotations

from services.kpi_analytics import compute_trend_percent, derive_kpi_status, enrich_kpi


def test_trend_percent_growth():
    history = [{"value": 50}, {"value": 60}, {"value": 75}]
    assert compute_trend_percent(history) == 50.0


def test_trend_percent_decline():
    history = [{"value": 100}, {"value": 80}]
    assert compute_trend_percent(history) == -20.0


def test_trend_percent_returns_none_for_single_point():
    assert compute_trend_percent([{"value": 10}]) is None


def test_status_increase_ok():
    assert (
        derive_kpi_status(
            {"direction": "increase", "target_value": 10, "current_value": 12}
        )
        == "ok"
    )


def test_status_increase_warning():
    assert (
        derive_kpi_status(
            {"direction": "increase", "target_value": 10, "current_value": 5}
        )
        == "warning"
    )


def test_status_increase_breach():
    assert (
        derive_kpi_status(
            {
                "direction": "increase",
                "target_value": 10,
                "current_value": 2,
                "warning_threshold": 4,
            }
        )
        == "breach"
    )


def test_status_decrease_ok():
    assert (
        derive_kpi_status(
            {"direction": "decrease", "target_value": 10, "current_value": 8}
        )
        == "ok"
    )


def test_status_maintain_ok_within_5_percent():
    assert (
        derive_kpi_status(
            {"direction": "maintain", "target_value": 100, "current_value": 103}
        )
        == "ok"
    )


def test_enrich_attaches_history_and_trend():
    kpi = {"direction": "increase", "target_value": 100, "current_value": 70}
    history = [{"value": 50}, {"value": 70}]
    enriched = enrich_kpi(kpi, history)
    assert enriched["history"] == history
    assert enriched["trend_percent"] == 40.0
    assert enriched["status"] == "warning"
