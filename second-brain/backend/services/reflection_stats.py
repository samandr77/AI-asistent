from datetime import date, timedelta
from typing import Optional
from database import get_supabase
from models.reflection import DailySummary, TaskBrief, GoalBrief, ReflectionStats, Reflection


def compute_daily_summary(user_id: str, target_date: date) -> DailySummary:
    db = get_supabase()

    # Completed tasks: is_done=True and completed_at on target_date
    # Fall back to updated_at if completed_at is null
    date_str = target_date.isoformat()
    date_next = (target_date + timedelta(days=1)).isoformat()

    tasks_result = (
        db.table("tasks")
        .select("id,title,goal_id,sphere,is_done,completed_at,updated_at")
        .eq("user_id", user_id)
        .eq("is_done", True)
        .execute()
    )
    all_done = tasks_result.data or []

    completed_today: list[dict] = []
    for t in all_done:
        ts = t.get("completed_at") or t.get("updated_at") or ""
        if ts:
            day_part = ts[:10]
            if day_part == date_str:
                completed_today.append(t)

    completed_tasks = [
        TaskBrief(
            id=t["id"],
            title=t["title"],
            goal_id=t.get("goal_id"),
            sphere=t.get("sphere"),
        )
        for t in completed_today
    ]

    goal_aligned_tasks = [t for t in completed_tasks if t.goal_id is not None]

    goal_id_counts: dict[str, int] = {}
    for t in goal_aligned_tasks:
        if t.goal_id:
            goal_id_counts[t.goal_id] = goal_id_counts.get(t.goal_id, 0) + 1

    goals_with_progress: list[GoalBrief] = []
    if goal_id_counts:
        goal_ids = list(goal_id_counts.keys())
        goals_result = (
            db.table("goals")
            .select("id,title,sphere")
            .eq("user_id", user_id)
            .in_("id", goal_ids)
            .execute()
        )
        for g in (goals_result.data or []):
            goals_with_progress.append(
                GoalBrief(
                    id=g["id"],
                    title=g["title"],
                    sphere=g.get("sphere"),
                    completed_task_count=goal_id_counts.get(g["id"], 0),
                )
            )

    dumps_result = (
        db.table("dumps")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", date_str + "T00:00:00")
        .lt("created_at", date_next + "T00:00:00")
        .execute()
    )
    total_dumps = dumps_result.count or 0

    existing_ref: Optional[Reflection] = None
    ref_result = (
        db.table("daily_reflections")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", date_str)
        .execute()
    )
    if ref_result.data:
        r = ref_result.data[0]
        existing_ref = Reflection(
            id=r["id"],
            user_id=r["user_id"],
            date=r["date"],
            mood=r["mood"],
            energy=r["energy"],
            notes=r.get("notes"),
            completed_count=r["completed_count"],
            goal_aligned_count=r["goal_aligned_count"],
            active_goal_ids=r.get("active_goal_ids") or [],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )

    return DailySummary(
        date=target_date,
        completed_tasks=completed_tasks,
        goal_aligned_tasks=goal_aligned_tasks,
        goals_with_progress=goals_with_progress,
        total_dumps=total_dumps,
        existing_reflection=existing_ref,
    )


def compute_streak(user_id: str) -> ReflectionStats:
    db = get_supabase()
    result = (
        db.table("daily_reflections")
        .select("date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return ReflectionStats(current_streak=0, longest_streak=0, total_reflections=0)

    dates = sorted(
        {date.fromisoformat(r["date"]) if isinstance(r["date"], str) else r["date"] for r in rows},
        reverse=True,
    )
    total = len(dates)

    today = date.today()
    yesterday = today - timedelta(days=1)

    # current streak: start from today or yesterday
    current = 0
    if dates[0] == today or dates[0] == yesterday:
        expected = dates[0]
        for d in dates:
            if d == expected:
                current += 1
                expected = expected - timedelta(days=1)
            else:
                break

    # longest streak
    longest = 0
    run = 1
    for i in range(1, len(dates)):
        if dates[i - 1] - dates[i] == timedelta(days=1):
            run += 1
        else:
            if run > longest:
                longest = run
            run = 1
    if run > longest:
        longest = run

    return ReflectionStats(
        current_streak=current,
        longest_streak=max(longest, current),
        total_reflections=total,
    )
