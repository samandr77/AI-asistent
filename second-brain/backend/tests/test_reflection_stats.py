import pytest
from datetime import date, timedelta
from unittest.mock import patch, MagicMock


def _make_dates(*dates: date) -> list[dict]:
    return [{"date": d.isoformat()} for d in dates]


def _mock_db(rows: list[dict]):
    db = MagicMock()
    chain = db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value
    chain.data = rows
    return db


# ── compute_streak ─────────────────────────────────────────────────────────────

def test_streak_no_reflections():
    from services.reflection_stats import compute_streak
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db([])):
        stats = compute_streak("user-1")
    assert stats.current_streak == 0
    assert stats.longest_streak == 0
    assert stats.total_reflections == 0


def test_streak_single_today():
    from services.reflection_stats import compute_streak
    today = date.today()
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(_make_dates(today))):
        stats = compute_streak("user-1")
    assert stats.current_streak == 1
    assert stats.longest_streak == 1
    assert stats.total_reflections == 1


def test_streak_five_consecutive_ending_today():
    from services.reflection_stats import compute_streak
    today = date.today()
    rows = _make_dates(*[today - timedelta(days=i) for i in range(5)])
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.current_streak == 5
    assert stats.longest_streak == 5


def test_streak_today_not_done_yesterday_done():
    """If today's reflection not yet submitted but yesterday was, streak still counts."""
    from services.reflection_stats import compute_streak
    today = date.today()
    yesterday = today - timedelta(days=1)
    rows = _make_dates(*[yesterday - timedelta(days=i) for i in range(4)])
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.current_streak == 4


def test_streak_gap_resets_current():
    """A gap in the middle resets the current streak to the most recent run."""
    from services.reflection_stats import compute_streak
    today = date.today()
    # 3 consecutive, then gap, then 5 older
    recent = [today - timedelta(days=i) for i in range(3)]
    older = [today - timedelta(days=i) for i in range(5, 10)]
    rows = _make_dates(*(recent + older))
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.current_streak == 3
    assert stats.longest_streak == 5


def test_streak_longest_is_not_current():
    """Longest streak is tracked independently from current."""
    from services.reflection_stats import compute_streak
    today = date.today()
    # 2 recent + big old run of 10
    recent = [today - timedelta(days=i) for i in range(2)]
    old_run = [today - timedelta(days=i) for i in range(4, 14)]
    rows = _make_dates(*(recent + old_run))
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.current_streak == 2
    assert stats.longest_streak == 10


def test_streak_single_yesterday():
    from services.reflection_stats import compute_streak
    yesterday = date.today() - timedelta(days=1)
    rows = _make_dates(yesterday)
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.current_streak == 1


def test_streak_two_days_ago_breaks_streak():
    """If last reflection was 2 days ago (not yesterday or today), current streak = 0."""
    from services.reflection_stats import compute_streak
    two_days_ago = date.today() - timedelta(days=2)
    rows = _make_dates(*[two_days_ago - timedelta(days=i) for i in range(5)])
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.current_streak == 0
    assert stats.longest_streak == 5
    assert stats.total_reflections == 5


def test_streak_total_reflections_count():
    from services.reflection_stats import compute_streak
    today = date.today()
    rows = _make_dates(*[today - timedelta(days=i) for i in range(12)])
    with patch("services.reflection_stats.get_supabase", return_value=_mock_db(rows)):
        stats = compute_streak("user-1")
    assert stats.total_reflections == 12


# ── compute_daily_summary ──────────────────────────────────────────────────────

def test_daily_summary_empty_no_tasks():
    from services.reflection_stats import compute_daily_summary
    today = date.today()

    # call order: tasks → dumps → daily_reflections
    tasks_chain = MagicMock()
    tasks_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    dumps_chain = MagicMock()
    dumps_result = MagicMock()
    dumps_result.count = 0
    dumps_chain.select.return_value.eq.return_value.gte.return_value.lt.return_value.execute.return_value = dumps_result

    ref_chain = MagicMock()
    ref_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    db = MagicMock()
    db.table.side_effect = [tasks_chain, dumps_chain, ref_chain]

    with patch("services.reflection_stats.get_supabase", return_value=db):
        summary = compute_daily_summary("user-1", today)

    assert summary.completed_tasks == []
    assert summary.goal_aligned_tasks == []
    assert summary.goals_with_progress == []
    assert summary.existing_reflection is None


def test_daily_summary_goal_aligned_classification():
    from services.reflection_stats import compute_daily_summary
    today = date.today()
    today_str = today.isoformat()

    task_rows = [
        {"id": "t1", "title": "A", "goal_id": "g1", "sphere": "work",
         "is_done": True, "completed_at": today_str + "T10:00:00+00:00", "updated_at": today_str + "T10:00:00+00:00"},
        {"id": "t2", "title": "B", "goal_id": None, "sphere": "health",
         "is_done": True, "completed_at": today_str + "T11:00:00+00:00", "updated_at": today_str + "T11:00:00+00:00"},
        {"id": "t3", "title": "C", "goal_id": "g1", "sphere": "work",
         "is_done": True, "completed_at": today_str + "T12:00:00+00:00", "updated_at": today_str + "T12:00:00+00:00"},
    ]

    # call order: tasks → goals → dumps → daily_reflections
    tasks_chain = MagicMock()
    tasks_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = task_rows

    goals_chain = MagicMock()
    goals_chain.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = [
        {"id": "g1", "title": "Launch SaaS", "sphere": "work"}
    ]

    dumps_chain = MagicMock()
    dumps_result = MagicMock()
    dumps_result.count = 0
    dumps_chain.select.return_value.eq.return_value.gte.return_value.lt.return_value.execute.return_value = dumps_result

    ref_chain = MagicMock()
    ref_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    db = MagicMock()
    db.table.side_effect = [tasks_chain, goals_chain, dumps_chain, ref_chain]

    with patch("services.reflection_stats.get_supabase", return_value=db):
        summary = compute_daily_summary("user-1", today)

    assert len(summary.completed_tasks) == 3
    assert len(summary.goal_aligned_tasks) == 2
    assert len(summary.goals_with_progress) == 1
    assert summary.goals_with_progress[0].completed_task_count == 2


def test_daily_summary_existing_reflection_returned():
    from services.reflection_stats import compute_daily_summary
    today = date.today()

    ref_row = {
        "id": "refl-1", "user_id": "user-1", "date": today.isoformat(),
        "mood": 4, "energy": 5, "notes": "Nice",
        "completed_count": 3, "goal_aligned_count": 1,
        "active_goal_ids": ["g1"],
        "created_at": "2026-04-24T21:00:00+00:00",
        "updated_at": "2026-04-24T21:00:00+00:00",
    }

    # call order: tasks → dumps → daily_reflections (no goals since no aligned tasks)
    tasks_chain = MagicMock()
    tasks_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

    dumps_chain = MagicMock()
    dumps_result = MagicMock()
    dumps_result.count = 0
    dumps_chain.select.return_value.eq.return_value.gte.return_value.lt.return_value.execute.return_value = dumps_result

    ref_chain = MagicMock()
    ref_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [ref_row]

    db = MagicMock()
    db.table.side_effect = [tasks_chain, dumps_chain, ref_chain]

    with patch("services.reflection_stats.get_supabase", return_value=db):
        summary = compute_daily_summary("user-1", today)

    assert summary.existing_reflection is not None
    assert summary.existing_reflection.mood == 4
