from pathlib import Path


MIGRATION = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "017_tasks_stage03_completion.sql"


def test_migration_017_adds_delegation_and_recurrence_idempotency_fields():
    sql = MIGRATION.read_text()
    for column in (
        "assignee_name",
        "assignee_contact",
        "delegated_at",
        "delegation_status",
        "recurrence_instance_key",
    ):
        assert column in sql
    assert "tasks_recurrence_instance_key_idx" in sql


def test_migration_017_adds_focus_settings_and_project_templates_with_rls():
    sql = MIGRATION.read_text()
    for table in ("task_focus_settings", "task_project_templates"):
        assert f"create table if not exists public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql
        assert "auth.uid() = user_id" in sql


def test_migration_017_adds_filter_indexes():
    sql = MIGRATION.read_text()
    for index in (
        "tasks_status_project_idx",
        "tasks_deadline_idx",
        "tasks_context_idx",
        "tasks_tags_gin_idx",
        "tasks_habit_idx",
    ):
        assert index in sql
