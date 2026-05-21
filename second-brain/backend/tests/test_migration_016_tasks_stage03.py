from __future__ import annotations

from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "016_tasks_stage03.sql"
)


def _sql() -> str:
    return MIGRATION.read_text().lower()


def test_migration_exists():
    assert MIGRATION.is_file()


def test_migration_adds_stage03_task_columns():
    sql = _sql()
    for column in (
        "context",
        "tags",
        "eisenhower_quadrant",
        "scheduled_start",
        "scheduled_end",
        "duration_estimated_min",
        "duration_actual_min",
        "deep_work",
        "project_id",
        "parent_task_id",
        "recurrence_rule",
        "next_occurrence_at",
        "habit_mode",
        "rollover_count",
        "source",
        "parser_metadata",
    ):
        assert f"add column if not exists {column}" in sql


def test_migration_creates_supporting_tables_with_rls():
    sql = _sql()
    for table in (
        "task_projects",
        "task_dependencies",
        "task_checklist_items",
        "task_comments",
        "task_attachments",
        "task_big_three",
        "task_focus_sessions",
        "task_saved_filters",
        "task_weekly_reports",
    ):
        assert f"create table if not exists public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql


def test_migration_enforces_big_three_and_focus_constraints():
    sql = _sql()
    assert "position int not null check (position between 1 and 3)" in sql
    assert "duration_min int not null check (duration_min between 1 and 1440)" in sql
    assert "tasks_recurrence_idx" in sql
    assert "tasks_eisenhower_idx" in sql
