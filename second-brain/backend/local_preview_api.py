from __future__ import annotations

import os
import uuid
from datetime import date, datetime, timezone
from typing import Any

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

DATABASE_URL = os.getenv(
    "LOCAL_DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:55432/second_brain",
)

app = FastAPI(title="Second Brain Local Preview API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def conn():
    return psycopg.connect(DATABASE_URL, row_factory=psycopg.rows.dict_row)


def init_db() -> None:
    with conn() as db:
        db.execute(
            """
            create table if not exists tasks (
              id text primary key,
              title text not null,
              sphere text not null default 'work',
              priority int not null default 2,
              is_done boolean not null default false,
              is_today boolean not null default true,
              deadline text,
              reminder_at text,
              notes text,
              goal_id text
            );
            create table if not exists goals (
              id text primary key,
              user_id text not null default 'local-preview-user',
              title text not null,
              description text,
              target_date text,
              status text not null default 'active',
              sphere text,
              progress_percent int not null default 0,
              created_at text not null,
              updated_at text not null
            );
            create table if not exists reflections (
              id text primary key,
              user_id text not null default 'local-preview-user',
              date text not null,
              mood int not null,
              energy int not null,
              notes text,
              completed_count int not null default 0,
              goal_aligned_count int not null default 0,
              active_goal_ids text[] not null default '{}',
              created_at text not null,
              updated_at text not null
            );
            create table if not exists reminder_settings (
              id int primary key default 1,
              daily_reflection_enabled boolean not null default true,
              daily_reflection_time text not null default '21:30',
              morning_enabled boolean not null default true,
              morning_time text not null default '09:00',
              timezone text
            );
            """
        )
        tasks = db.execute("select count(*) as count from tasks").fetchone()["count"]
        if tasks == 0:
            goal_id = "local-goal-1"
            db.execute(
                """
                insert into goals (id, title, description, target_date, status, sphere, progress_percent, created_at, updated_at)
                values (%s, %s, %s, %s, 'active', 'goals', 42, %s, %s)
                on conflict do nothing
                """,
                (
                    goal_id,
                    "Запустить Second Brain в Telegram",
                    "Локальная проверка без Supabase: Postgres + API + Mini App.",
                    date.today().isoformat(),
                    now(),
                    now(),
                ),
            )
            for title, sphere, priority, done in [
                ("Проверить miniapp в боковой панели Codex", "goals", 1, False),
                ("Создать задачу из дампа", "work", 2, False),
                ("Сохранить вечернюю рефлексию", "health", 3, True),
            ]:
                db.execute(
                    """
                    insert into tasks (id, title, sphere, priority, is_done, is_today, goal_id)
                    values (%s, %s, %s, %s, %s, true, %s)
                    """,
                    (f"local-task-{uuid.uuid4().hex[:8]}", title, sphere, priority, done, goal_id),
                )
        db.execute(
            """
            insert into reminder_settings (id, timezone)
            values (1, %s)
            on conflict (id) do nothing
            """,
            (os.getenv("TZ", "Europe/Minsk"),),
        )


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def rows(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with conn() as db:
        return list(db.execute(sql, params).fetchall())


@app.post("/telegram/auth/session")
def telegram_session() -> dict[str, Any]:
    return {
        "access_token": "local-preview-token",
        "token_type": "bearer",
        "expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc).isoformat(),
        "user": {
            "id": "local-preview-user",
            "telegram_user_id": 100000001,
            "provider": "telegram",
            "name": "Local Tester",
            "username": "second_brain_local",
            "language": "ru",
            "is_onboarded": True,
        },
        "profile": {"id": "local-preview-user", "name": "Local Tester", "language": "ru", "is_onboarded": True},
        "is_new_user": False,
        "start_param": None,
    }


@app.get("/tasks/today")
def today_tasks() -> list[dict[str, Any]]:
    return rows("select * from tasks where is_today = true order by priority asc")


@app.get("/tasks/")
def all_tasks(sphere: str | None = None) -> list[dict[str, Any]]:
    if sphere:
        return rows("select * from tasks where sphere = %s order by priority asc", (sphere,))
    return rows("select * from tasks order by priority asc")


@app.patch("/tasks/{task_id}")
def patch_task(task_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    allowed = {k: v for k, v in updates.items() if k in {"title", "sphere", "priority", "is_done", "is_today", "deadline", "reminder_at", "notes", "goal_id"}}
    if allowed:
        set_sql = ", ".join(f"{key} = %s" for key in allowed)
        with conn() as db:
            db.execute(f"update tasks set {set_sql} where id = %s", (*allowed.values(), task_id))
    return rows("select * from tasks where id = %s", (task_id,))[0]


@app.delete("/tasks/{task_id}")
def delete_task(task_id: str) -> dict[str, bool]:
    with conn() as db:
        db.execute("delete from tasks where id = %s", (task_id,))
    return {"ok": True}


@app.post("/dump/text")
def dump_text(body: dict[str, Any]) -> dict[str, Any]:
    title = (body.get("text") or "Новая задача из дампа").strip()[:120]
    task = {
        "id": f"local-dump-task-{uuid.uuid4().hex[:8]}",
        "title": title,
        "sphere": "work",
        "priority": 2,
        "is_done": False,
        "is_today": True,
        "deadline": None,
        "reminder_at": None,
        "notes": "Создано локальным Postgres API.",
        "goal_id": None,
    }
    with conn() as db:
        db.execute(
            """
            insert into tasks (id, title, sphere, priority, is_done, is_today, notes)
            values (%(id)s, %(title)s, %(sphere)s, %(priority)s, %(is_done)s, %(is_today)s, %(notes)s)
            """,
            task,
        )
    return {"dump_id": task["id"], "tasks": [task], "today_top3": [task], "task_ids": [task["id"]]}


@app.get("/dump/{dump_id}/result")
def dump_result(dump_id: str) -> dict[str, Any]:
    task = rows("select * from tasks where id = %s", (dump_id,))
    return {"dump_id": dump_id, "tasks": task, "today_top3": task, "task_ids": [item["id"] for item in task]}


@app.get("/goals/")
def goals(status: str | None = None) -> list[dict[str, Any]]:
    if status:
        return rows("select * from goals where status = %s order by created_at desc", (status,))
    return rows("select * from goals order by created_at desc")


@app.get("/goals/{goal_id}")
def goal(goal_id: str) -> dict[str, Any]:
    found = rows("select * from goals where id = %s", (goal_id,))
    return found[0]


@app.post("/goals/")
def create_goal(body: dict[str, Any]) -> dict[str, Any]:
    item = {
        "id": f"local-goal-{uuid.uuid4().hex[:8]}",
        "title": body["title"],
        "description": body.get("description"),
        "target_date": body.get("target_date"),
        "status": body.get("status", "active"),
        "sphere": body.get("sphere"),
        "progress_percent": body.get("progress_percent", 0),
        "created_at": now(),
        "updated_at": now(),
    }
    with conn() as db:
        db.execute(
            """
            insert into goals (id, title, description, target_date, status, sphere, progress_percent, created_at, updated_at)
            values (%(id)s, %(title)s, %(description)s, %(target_date)s, %(status)s, %(sphere)s, %(progress_percent)s, %(created_at)s, %(updated_at)s)
            """,
            item,
        )
    return {"user_id": "local-preview-user", **item}


@app.patch("/goals/{goal_id}")
def patch_goal(goal_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    allowed = {k: v for k, v in updates.items() if k in {"title", "description", "target_date", "status", "sphere", "progress_percent"}}
    allowed["updated_at"] = now()
    set_sql = ", ".join(f"{key} = %s" for key in allowed)
    with conn() as db:
        db.execute(f"update goals set {set_sql} where id = %s", (*allowed.values(), goal_id))
    return goal(goal_id)


@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: str) -> dict[str, bool]:
    with conn() as db:
        db.execute("delete from goals where id = %s", (goal_id,))
    return {"ok": True}


@app.get("/goals/{goal_id}/tasks")
def goal_tasks(goal_id: str) -> list[dict[str, Any]]:
    return rows("select * from tasks where goal_id = %s order by priority asc", (goal_id,))


@app.get("/goals/{goal_id}/progress")
def goal_progress(goal_id: str) -> dict[str, Any]:
    linked = rows("select * from tasks where goal_id = %s", (goal_id,))
    done = [task for task in linked if task["is_done"]]
    return {"goal_id": goal_id, "manual_progress": 42, "computed_progress": int(len(done) / max(len(linked), 1) * 100), "linked_tasks_count": len(linked), "completed_tasks_count": len(done)}


@app.get("/reflections/today/summary")
def reflection_summary(date_: str | None = None) -> dict[str, Any]:
    day = date_ or date.today().isoformat()
    completed = rows("select id, title, goal_id, sphere from tasks where is_done = true")
    aligned = rows("select id, title, goal_id, sphere from tasks where goal_id is not null")
    existing = rows("select * from reflections where date = %s", (day,))
    goals_progress = rows("select id, title, sphere, 1 as completed_task_count from goals")
    return {"date": day, "completed_tasks": completed, "goal_aligned_tasks": aligned, "goals_with_progress": goals_progress, "total_dumps": 1, "existing_reflection": existing[0] if existing else None}


@app.get("/reflections/")
def reflections() -> list[dict[str, Any]]:
    return rows("select * from reflections order by date desc")


@app.get("/reflections/stats")
def reflection_stats() -> dict[str, int]:
    total = rows("select count(*) as count from reflections")[0]["count"]
    return {"current_streak": total, "longest_streak": max(total, 1), "total_reflections": total}


@app.get("/reflections/{reflection_date}")
def reflection_by_date(reflection_date: str) -> dict[str, Any]:
    found = rows("select * from reflections where date = %s", (reflection_date,))
    return found[0] if found else {"id": "missing", "user_id": "local-preview-user", "date": reflection_date, "mood": 3, "energy": 3, "notes": None, "completed_count": 0, "goal_aligned_count": 0, "active_goal_ids": [], "created_at": now(), "updated_at": now()}


@app.post("/reflections/")
def create_reflection(body: dict[str, Any]) -> dict[str, Any]:
    item = {"id": f"local-reflection-{uuid.uuid4().hex[:8]}", "user_id": "local-preview-user", "date": body.get("date") or date.today().isoformat(), "mood": body["mood"], "energy": body["energy"], "notes": body.get("notes"), "completed_count": 0, "goal_aligned_count": 0, "active_goal_ids": [], "created_at": now(), "updated_at": now()}
    with conn() as db:
        db.execute(
            """
            insert into reflections (id, user_id, date, mood, energy, notes, completed_count, goal_aligned_count, active_goal_ids, created_at, updated_at)
            values (%(id)s, %(user_id)s, %(date)s, %(mood)s, %(energy)s, %(notes)s, 0, 0, '{}', %(created_at)s, %(updated_at)s)
            """,
            item,
        )
    return item


@app.patch("/reflections/{reflection_id}")
def patch_reflection(reflection_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    allowed = {k: v for k, v in updates.items() if k in {"mood", "energy", "notes"}}
    allowed["updated_at"] = now()
    set_sql = ", ".join(f"{key} = %s" for key in allowed)
    with conn() as db:
        db.execute(f"update reflections set {set_sql} where id = %s", (*allowed.values(), reflection_id))
    return rows("select * from reflections where id = %s", (reflection_id,))[0]


@app.get("/telegram/reminders/settings")
def reminder_settings() -> dict[str, Any]:
    return rows("select * from reminder_settings where id = 1")[0]


@app.put("/telegram/reminders/settings")
def save_reminder_settings(body: dict[str, Any]) -> dict[str, Any]:
    with conn() as db:
        db.execute(
            """
            update reminder_settings set daily_reflection_enabled=%s, daily_reflection_time=%s, morning_enabled=%s, morning_time=%s, timezone=%s where id=1
            """,
            (
                body["daily_reflection_enabled"],
                body["daily_reflection_time"],
                body["morning_enabled"],
                body["morning_time"],
                body.get("timezone"),
            ),
        )
    return reminder_settings()


@app.get("/premium/status")
def premium_status() -> dict[str, Any]:
    return {"is_premium": False, "entitlement_id": None, "expires_at": None, "period_type": None, "store": None, "cancelled": False}


@app.get("/auth/me")
def me() -> dict[str, Any]:
    return {"id": "local-preview-user", "provider": "telegram", "profile": {"id": "local-preview-user", "name": "Local Tester", "language": "ru", "is_onboarded": True}}


@app.post("/auth/profile")
def update_profile(body: dict[str, Any]) -> dict[str, Any]:
    return {"id": "local-preview-user", "name": body.get("name", "Local Tester"), "language": body.get("language", "ru"), "is_onboarded": body.get("is_onboarded", True)}


@app.get("/memory/profile")
def memory_profile() -> list[dict[str, Any]]:
    return [{"id": "memory-local-1", "content": "Локальный режим работает на Postgres без Supabase.", "metadata": {"source": "postgres-local"}, "created_at": now()}]
