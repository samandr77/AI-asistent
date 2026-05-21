"""Phase 1: validate migration 015 SQL is shape-correct (without applying it).

We don't have a live test DB here — tests run against mocked Supabase. So this
suite asserts:
- migration file exists
- contains all expected ALTER/UPDATE statements
- backfill maps is_done → status correctly via a tiny Python simulation
"""
from __future__ import annotations

from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "015_tasks_inbox.sql"
)


def test_migration_file_exists():
    assert MIGRATION.is_file(), f"missing: {MIGRATION}"


def test_migration_contains_status_column():
    sql = MIGRATION.read_text()
    assert "add column if not exists status text" in sql.lower()
    assert "tasks_status_check" in sql.lower()
    assert "alter column status set not null" in sql.lower()


def test_migration_contains_raw_text_column():
    sql = MIGRATION.read_text()
    assert "add column if not exists raw_text text" in sql.lower()


def test_migration_contains_partial_indices():
    sql = MIGRATION.read_text()
    assert "tasks_status_idx" in sql.lower()
    assert "tasks_inbox_idx" in sql.lower()
    assert "where status <> 'done'" in sql.lower()
    assert "where status = 'inbox'" in sql.lower()


def test_migration_expands_sphere_check():
    sql = MIGRATION.read_text().lower()
    assert "'finance'" in sql
    assert "'goals'" in sql


def _simulate_backfill(rows: list[dict]) -> list[dict]:
    """Mirror the UPDATE logic in migration 015 (CASE WHEN is_done THEN done ELSE active)."""
    out = []
    for row in rows:
        new = dict(row)
        if "status" not in new or new["status"] is None:
            new["status"] = "done" if new.get("is_done") else "active"
        out.append(new)
    return out


def test_backfill_logic_done_and_active():
    rows = [
        {"id": "1", "is_done": False},
        {"id": "2", "is_done": True},
        {"id": "3", "is_done": False, "status": None},
        {"id": "4", "is_done": True, "status": None},
    ]
    backfilled = _simulate_backfill(rows)
    assert backfilled[0]["status"] == "active"
    assert backfilled[1]["status"] == "done"
    assert backfilled[2]["status"] == "active"
    assert backfilled[3]["status"] == "done"
