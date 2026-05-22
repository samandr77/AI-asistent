from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from postgrest.exceptions import APIError

from auth import get_current_user_id
from database import get_supabase
from models.health import (
    HealthActivityLogCreate,
    HealthBiomarkerCreate,
    HealthBarcodeLookup,
    HealthDailyLogCreate,
    HealthDailyLogUpdate,
    HealthDashboard,
    HealthFoodCreate,
    HealthInsight,
    HealthMealCreate,
    HealthMedicalRecordCreate,
    HealthNutritionLogCreate,
    HealthNutritionScanResult,
    HealthNutritionTargetCreate,
    HealthNutritionWeeklyReport,
    HealthRecipeCreate,
    HealthWaterLogCreate,
    HealthWeightLogCreate,
    HealthSleepGoal,
    HealthSleepLogCreate,
    HealthSleepLogUpdate,
    HealthSleepSessionStart,
    HealthSleepSessionWake,
    HealthWorkoutCreate,
)
from services import ai_budget
from services.health_ai_insights import fallback_insights, generate_health_insights
from services.health_nutrition import (
    analyze_package_photo,
    calculate_tdee_target,
    lookup_open_food_facts_barcode,
    meal_item_from_food,
    score_food,
    search_open_food_facts,
    weekly_window,
)
from services.health_sleep import (
    DEFAULT_TARGET_DURATION_MINUTES,
    duration_between_minutes,
    enrich_sleep_row,
    now_iso,
    parse_dt,
    sleep_stats,
)
from services.premium import get_ai_tier_policy, get_user_premium

router = APIRouter()
MISSING_HEALTH_TABLES_DETAIL = "Health database tables are missing. Apply migration 019_health.sql."
MAX_NUTRITION_PHOTO_SIZE = 10 * 1024 * 1024


def _now_iso() -> str:
    return now_iso()


def _date_to_str(value: object) -> object:
    if isinstance(value, date):
        return value.isoformat()
    return value


def _payload(body: object, *, partial: bool = False) -> dict:
    data = body.model_dump(exclude_unset=partial)  # type: ignore[attr-defined]
    return {key: _date_to_str(value) for key, value in data.items()}


def _time_label(value: str | None) -> str | None:
    parsed = parse_dt(value)
    return parsed.strftime("%H:%M") if parsed else None


def _assert_found(rows: list, detail: str) -> dict:
    if not rows:
        raise HTTPException(status_code=404, detail=detail)
    return rows[0]


def _handle_db_error(exc: APIError) -> None:
    payload = exc.args[0] if exc.args else {}
    code = payload.get("code") if isinstance(payload, dict) else None
    message = payload.get("message") if isinstance(payload, dict) else str(exc)
    raw = str(payload)
    if code == "PGRST205" or "PGRST205" in raw:
        raise HTTPException(status_code=503, detail=MISSING_HEALTH_TABLES_DETAIL) from exc
    if code == "23505" or "23505" in raw:
        raise HTTPException(status_code=409, detail="Health record already exists for this date") from exc
    raise HTTPException(status_code=502, detail=f"Health database request failed: {message}") from exc


def _list_table(
    table: str,
    user_id: str,
    *,
    order_by: str,
    desc: bool = True,
    limit: int = 100,
) -> list[dict]:
    try:
        result = (
            get_supabase()
            .table(table)
            .select("*")
            .eq("user_id", user_id)
            .order(order_by, desc=desc)
            .limit(limit)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    return result.data or []


def _create_row(table: str, body: object, user_id: str, detail: str) -> dict:
    row = _payload(body)
    row["user_id"] = user_id
    try:
        result = get_supabase().table(table).insert(row).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail=detail)
    return result.data[0]


def _update_row(table: str, row_id: str, body: object, user_id: str, detail: str) -> dict:
    updates = _payload(body, partial=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    updates["updated_at"] = _now_iso()
    try:
        result = (
            get_supabase()
            .table(table)
            .update(updates)
            .eq("id", row_id)
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    return _assert_found(result.data or [], detail)


def _score_from_parts(parts: list[int | None], fallback: int = 50) -> int:
    values = [max(0, min(100, int(value))) for value in parts if value is not None]
    if not values:
        return fallback
    return round(sum(values) / len(values))


def _latest_biomarker(biomarkers: list[dict], kind: str) -> dict | None:
    for row in biomarkers:
        if row.get("kind") == kind:
            return row
    return None


def _sleep_score(sleep: dict | None) -> int | None:
    if not sleep:
        return None
    if sleep.get("quality_score") is not None:
        return int(sleep["quality_score"])
    if sleep.get("quality") is not None:
        return int(sleep["quality"]) * 10
    duration = int(sleep.get("duration_minutes") or 0)
    return min(100, round(duration / 480 * 100)) if duration else None


def _nutrition_score(summary: dict | None) -> int | None:
    if not summary:
        return None
    calories = float(summary.get("calories") or 0)
    protein = float(summary.get("protein_g") or 0)
    water = float(summary.get("water_ml") or 0)
    if not any((calories, protein, water)):
        return None
    return _score_from_parts(
        [
            min(100, round(calories / 2200 * 100)) if calories else None,
            min(100, round(protein / 120 * 100)) if protein else None,
            min(100, round(water / 2200 * 100)) if water else None,
        ],
        fallback=50,
    )


def _workout_score(workouts: list[dict]) -> int | None:
    if not workouts:
        return None
    minutes = sum(int(row.get("duration_minutes") or 0) for row in workouts)
    return min(100, round(minutes / 150 * 100))


def _readiness_score(
    sleep: dict | None,
    activity: dict | None,
    workouts: list[dict],
    nutrition_summary: dict | None,
) -> int:
    sleep_score = _sleep_score(sleep)
    activity_score = None
    if activity:
        steps = int(activity.get("steps") or 0)
        active_minutes = int(activity.get("active_minutes") or 0)
        activity_score = _score_from_parts(
            [min(100, round(steps / 8000 * 100)), min(100, round(active_minutes / 45 * 100))],
            fallback=50,
        )

    return _score_from_parts(
        [sleep_score, activity_score, _workout_score(workouts), _nutrition_score(nutrition_summary)]
    )


def _health_insights(
    *,
    readiness: int,
    sleep: dict | None,
    activity: dict | None,
    nutrition_summary: dict | None = None,
) -> list[HealthInsight]:
    return fallback_insights(
        {
            "readiness_score": readiness,
            "latest_sleep": sleep,
            "latest_activity": activity,
            "nutrition_summary": nutrition_summary,
        }
    )


def _list_meals(user_id: str, *, logged_on: str | None = None, limit: int = 100) -> list[dict]:
    try:
        query = get_supabase().table("health_meal_entries").select("*").eq("user_id", user_id)
        if logged_on:
            query = query.eq("logged_on", logged_on)
        result = query.order("logged_on", desc=True).limit(limit).execute()
    except APIError as exc:
        _handle_db_error(exc)
    meals = result.data or []
    if not meals:
        return []
    meal_ids = [row["id"] for row in meals if row.get("id")]
    try:
        items_result = (
            get_supabase()
            .table("health_meal_items")
            .select("*")
            .eq("user_id", user_id)
            .in_("meal_id", meal_ids)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    items_by_meal: dict[str, list[dict]] = {}
    for item in items_result.data or []:
        items_by_meal.setdefault(item.get("meal_id"), []).append(item)
    for meal in meals:
        meal["items"] = items_by_meal.get(meal.get("id"), [])
    return meals


def _nutrition_summary(logged_on: str, meals: list[dict], water_logs: list[dict]) -> dict:
    summary = {
        "logged_on": logged_on,
        "calories": 0,
        "protein_g": 0,
        "carbs_g": 0,
        "fat_g": 0,
        "fiber_g": 0,
        "water_ml": sum(int(row.get("amount_ml") or 0) for row in water_logs),
    }
    for meal in meals:
        for item in meal.get("items", []):
            summary["calories"] += float(item.get("calories") or 0)
            summary["protein_g"] += float(item.get("protein_g") or 0)
            summary["carbs_g"] += float(item.get("carbs_g") or 0)
            summary["fat_g"] += float(item.get("fat_g") or 0)
            summary["fiber_g"] += float(item.get("fiber_g") or 0)
    target = _nutrition_target_from_rows([])
    summary["target"] = target
    summary["remaining_calories"] = None
    return summary


def _nutrition_target_from_rows(rows: list[dict]) -> dict | None:
    return rows[0] if rows else None


def _nutrition_target(user_id: str) -> dict | None:
    try:
        result = (
            get_supabase()
            .table("health_nutrition_targets")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    return _nutrition_target_from_rows(result.data or [])


def _nutrition_summary_with_target(logged_on: str, meals: list[dict], water_logs: list[dict], user_id: str) -> dict:
    summary = _nutrition_summary(logged_on, meals, water_logs)
    target = _nutrition_target(user_id)
    summary["target"] = target
    summary["remaining_calories"] = (
        max(0, float(target.get("calories") or 0) - float(summary.get("calories") or 0)) if target else None
    )
    return summary


def _food_score(row: dict) -> str:
    return score_food(row)


def _save_food_candidate(candidate: dict, user_id: str, *, confirmed: bool | None = None) -> dict:
    row = dict(candidate)
    row["user_id"] = user_id
    if confirmed is not None:
        row["is_confirmed"] = confirmed
    row["food_score"] = row.get("food_score") or _food_score(row)
    try:
        result = get_supabase().table("health_foods").insert(row).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save food candidate")
    return result.data[0]


def _recipe_totals(items: list[dict], servings: float) -> dict:
    safe_servings = servings or 1
    return {
        "calories_per_serving": sum(float(item.get("calories") or 0) for item in items) / safe_servings,
        "protein_g_per_serving": sum(float(item.get("protein_g") or 0) for item in items) / safe_servings,
        "carbs_g_per_serving": sum(float(item.get("carbs_g") or 0) for item in items) / safe_servings,
        "fat_g_per_serving": sum(float(item.get("fat_g") or 0) for item in items) / safe_servings,
    }


def _frequent_foods(meals: list[dict]) -> list[dict]:
    counts: dict[str, dict] = {}
    for meal in meals:
        for item in meal.get("items", []):
            name = item.get("name") or "Еда"
            current = counts.setdefault(name, {"name": name, "count": 0, "calories": 0})
            current["count"] += 1
            current["calories"] += float(item.get("calories") or 0)
    return sorted(counts.values(), key=lambda row: (-row["count"], -row["calories"]))[:5]


def _sleep_goal(user_id: str) -> dict:
    try:
        result = (
            get_supabase()
            .table("health_sleep_goals")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    if result.data:
        return result.data[0]
    return {
        "user_id": user_id,
        "target_duration_minutes": DEFAULT_TARGET_DURATION_MINUTES,
        "target_bedtime": None,
        "target_wake_time": None,
    }


def _sleep_target_minutes(user_id: str) -> int:
    goal = _sleep_goal(user_id)
    return int(goal.get("target_duration_minutes") or DEFAULT_TARGET_DURATION_MINUTES)


def _sleep_row_from_times(row: dict) -> dict:
    result = dict(row)
    duration = result.get("duration_minutes") or duration_between_minutes(
        result.get("bedtime_at"),
        result.get("wake_at"),
    )
    if duration:
        result["duration_minutes"] = duration
    if result.get("bedtime_at") and not result.get("bedtime"):
        result["bedtime"] = _time_label(result.get("bedtime_at"))
    if result.get("wake_at") and not result.get("wake_time"):
        result["wake_time"] = _time_label(result.get("wake_at"))
    if result.get("wake_at") and not result.get("sleep_date"):
        parsed = parse_dt(result.get("wake_at"))
        if parsed:
            result["sleep_date"] = parsed.date().isoformat()
    return result


def _enrich_sleep_payload(row: dict, user_id: str, *, exclude_id: str | None = None) -> dict:
    prior_sleep = _list_table("health_sleep_logs", user_id, order_by="sleep_date", limit=8)
    if exclude_id:
        prior_sleep = [item for item in prior_sleep if item.get("id") != exclude_id]
    return enrich_sleep_row(
        _sleep_row_from_times(row),
        prior_sleep=prior_sleep,
        target_duration_minutes=_sleep_target_minutes(user_id),
    )


def _create_meal(body: HealthMealCreate, user_id: str) -> dict:
    db = get_supabase()
    meal_row = _payload(body)
    items = meal_row.pop("items")
    meal_row["user_id"] = user_id
    try:
        meal_result = db.table("health_meal_entries").insert(meal_row).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not meal_result.data:
        raise HTTPException(status_code=500, detail="Failed to create meal")
    meal = meal_result.data[0]
    item_rows = []
    for item in items:
        row = item
        row["user_id"] = user_id
        row["meal_id"] = meal["id"]
        item_rows.append(row)
    try:
        item_result = db.table("health_meal_items").insert(item_rows).execute()
    except APIError as exc:
        _handle_db_error(exc)
    meal["items"] = item_result.data or []
    return meal


@router.get("/dashboard", response_model=HealthDashboard)
async def get_health_dashboard(
    days: int = Query(default=30, ge=7, le=90),
    user_id: str = Depends(get_current_user_id),
):
    today = date.today()
    today_str = today.isoformat()
    daily_logs = _list_table("health_daily_logs", user_id, order_by="log_date", limit=days)
    sleep_logs = _list_table("health_sleep_logs", user_id, order_by="sleep_date", limit=days)
    activity_logs = _list_table("health_activity_logs", user_id, order_by="activity_date", limit=days)
    workouts = _list_table("health_workouts", user_id, order_by="occurred_on", limit=5)
    nutrition = _list_table("health_nutrition_logs", user_id, order_by="logged_on", limit=days)
    meals_today = _list_meals(user_id, logged_on=today_str, limit=50)
    water_logs = _list_table("health_water_logs", user_id, order_by="logged_on", limit=days)
    sleep_target = _sleep_target_minutes(user_id)

    latest_daily = daily_logs[0] if daily_logs else None
    latest_sleep = (
        enrich_sleep_row(sleep_logs[0], prior_sleep=sleep_logs[1:], target_duration_minutes=sleep_target)
        if sleep_logs
        else None
    )
    latest_activity = activity_logs[0] if activity_logs else None
    nutrition_today = next((row for row in nutrition if row.get("logged_on") == today_str), nutrition[0] if nutrition else None)
    nutrition_summary = _nutrition_summary_with_target(
        today_str,
        meals_today,
        [row for row in water_logs if row.get("logged_on") == today_str],
        user_id,
    )
    if not any(nutrition_summary.get(key) for key in ("calories", "protein_g", "carbs_g", "fat_g", "water_ml")) and nutrition_today:
        nutrition_summary.update(
            {
                "calories": nutrition_today.get("calories") or 0,
                "protein_g": nutrition_today.get("protein_g") or 0,
                "carbs_g": nutrition_today.get("carbs_g") or 0,
                "fat_g": nutrition_today.get("fat_g") or 0,
                "water_ml": nutrition_today.get("water_ml") or 0,
            }
        )
    readiness = _readiness_score(latest_sleep, latest_activity, workouts, nutrition_summary)
    score = readiness
    insights_payload = {
        "period_days": days,
        "readiness_score": readiness,
        "score": score,
        "latest_sleep": latest_sleep,
        "latest_activity": latest_activity,
        "recent_workouts": workouts,
        "nutrition_summary": nutrition_summary,
        "meals_today": meals_today,
        "safety_frame": "assistant guidance only, not diagnosis or treatment",
    }
    insights = _health_insights(
        readiness=readiness,
        sleep=latest_sleep,
        activity=latest_activity,
        nutrition_summary=nutrition_summary,
    )
    if await ai_budget.has_budget(user_id):
        premium = await get_user_premium(user_id)
        generated, tokens = await generate_health_insights(
            user_id,
            insights_payload,
            period_days=days,
            tier_policy=get_ai_tier_policy(premium),
        )
        if tokens:
            await ai_budget.record_usage(user_id, tokens)
        if generated:
            insights = generated

    return HealthDashboard(
        score=score,
        readiness_score=readiness,
        trend_days=days,
        latest_daily_log=latest_daily,
        latest_sleep=latest_sleep,
        latest_activity=latest_activity,
        recent_workouts=workouts,
        nutrition_today=nutrition_today,
        nutrition_summary=nutrition_summary,
        meals_today=meals_today,
        biomarkers=[],
        medical_records_count=0,
        insights=insights,
        safety_note="Подсказки по здоровью являются справочной поддержкой и не заменяют врача, диагностику или лечение.",
    )


@router.get("/daily")
async def list_daily_logs(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_daily_logs", user_id, order_by="log_date")


@router.post("/daily", status_code=status.HTTP_201_CREATED)
async def create_daily_log(body: HealthDailyLogCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_daily_logs", body, user_id, "Failed to create health daily log")


@router.patch("/daily/{row_id}")
async def update_daily_log(row_id: str, body: HealthDailyLogUpdate, user_id: str = Depends(get_current_user_id)):
    return _update_row("health_daily_logs", row_id, body, user_id, "Health daily log not found")


@router.get("/sleep")
async def list_sleep_logs(user_id: str = Depends(get_current_user_id)):
    rows = _list_table("health_sleep_logs", user_id, order_by="sleep_date")
    target = _sleep_target_minutes(user_id)
    return [
        enrich_sleep_row(row, prior_sleep=rows[index + 1 : index + 8], target_duration_minutes=target)
        for index, row in enumerate(rows)
    ]


@router.post("/sleep", status_code=status.HTTP_201_CREATED)
async def create_sleep_log(body: HealthSleepLogCreate, user_id: str = Depends(get_current_user_id)):
    row = _sleep_row_from_times(_payload(body))
    if not row.get("duration_minutes"):
        raise HTTPException(status_code=422, detail="Sleep duration or bedtime/wake time is required")
    enriched = _enrich_sleep_payload(row, user_id)
    enriched["user_id"] = user_id
    try:
        result = get_supabase().table("health_sleep_logs").insert(enriched).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create sleep log")
    return result.data[0]


@router.patch("/sleep/{row_id}")
async def update_sleep_log(row_id: str, body: HealthSleepLogUpdate, user_id: str = Depends(get_current_user_id)):
    updates = _sleep_row_from_times(_payload(body, partial=True))
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    if not updates.get("duration_minutes"):
        try:
            existing = (
                get_supabase()
                .table("health_sleep_logs")
                .select("*")
                .eq("id", row_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
        except APIError as exc:
            _handle_db_error(exc)
        current = _assert_found(existing.data or [], "Sleep log not found")
        merged = {**current, **updates}
        updates = _sleep_row_from_times(merged)
    enriched = _enrich_sleep_payload(updates, user_id, exclude_id=row_id)
    enriched["updated_at"] = _now_iso()
    try:
        result = (
            get_supabase()
            .table("health_sleep_logs")
            .update(enriched)
            .eq("id", row_id)
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    return _assert_found(result.data or [], "Sleep log not found")


@router.get("/sleep/sessions/active")
async def get_active_sleep_session(user_id: str = Depends(get_current_user_id)):
    try:
        result = (
            get_supabase()
            .table("health_sleep_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    return (result.data or [None])[0]


@router.post("/sleep/sessions/start", status_code=status.HTTP_201_CREATED)
async def start_sleep_session(body: HealthSleepSessionStart, user_id: str = Depends(get_current_user_id)):
    active = await get_active_sleep_session(user_id)
    if active:
        return active
    row = {
        "user_id": user_id,
        "started_at": body.started_at or _now_iso(),
        "status": "active",
        "source": body.source,
    }
    try:
        result = get_supabase().table("health_sleep_sessions").insert(row).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to start sleep session")
    return result.data[0]


@router.post("/sleep/sessions/{session_id}/wake")
async def wake_sleep_session(
    session_id: str,
    body: HealthSleepSessionWake,
    user_id: str = Depends(get_current_user_id),
):
    try:
        session_result = (
            get_supabase()
            .table("health_sleep_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    session = _assert_found(session_result.data or [], "Sleep session not found")
    if session.get("status") == "completed" and session.get("sleep_log_id"):
        return session

    ended_at = body.ended_at or _now_iso()
    duration = body.duration_minutes or duration_between_minutes(session.get("started_at"), ended_at)
    if not duration:
        raise HTTPException(status_code=422, detail="Wake time must be after bedtime")
    parsed_wake = parse_dt(ended_at)
    sleep_row = {
        "sleep_date": parsed_wake.date().isoformat() if parsed_wake else date.today().isoformat(),
        "bedtime_at": session.get("started_at"),
        "wake_at": ended_at,
        "bedtime": _time_label(session.get("started_at")),
        "wake_time": _time_label(ended_at),
        "duration_minutes": duration,
        "source": session.get("source") or "manual",
        "notes": body.notes,
    }
    enriched = _enrich_sleep_payload(sleep_row, user_id)
    enriched["user_id"] = user_id
    try:
        log_result = get_supabase().table("health_sleep_logs").insert(enriched).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not log_result.data:
        raise HTTPException(status_code=500, detail="Failed to create sleep log")
    sleep_log = log_result.data[0]
    try:
        update_result = (
            get_supabase()
            .table("health_sleep_sessions")
            .update(
                {
                    "ended_at": ended_at,
                    "status": "completed",
                    "sleep_log_id": sleep_log.get("id"),
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    completed = _assert_found(update_result.data or [], "Sleep session not found")
    completed["sleep_log"] = sleep_log
    return completed


@router.get("/sleep/goal")
async def get_sleep_goal(user_id: str = Depends(get_current_user_id)):
    return _sleep_goal(user_id)


@router.put("/sleep/goal")
async def upsert_sleep_goal(body: HealthSleepGoal, user_id: str = Depends(get_current_user_id)):
    row = _payload(body)
    row["user_id"] = user_id
    row["updated_at"] = _now_iso()
    try:
        result = (
            get_supabase()
            .table("health_sleep_goals")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save sleep goal")
    return result.data[0]


@router.get("/sleep/stats")
async def get_sleep_stats(
    days: int = Query(default=30, ge=7, le=90),
    user_id: str = Depends(get_current_user_id),
):
    rows = _list_table("health_sleep_logs", user_id, order_by="sleep_date", limit=days)
    return sleep_stats(rows, target_duration_minutes=_sleep_target_minutes(user_id))


@router.get("/activity")
async def list_activity_logs(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_activity_logs", user_id, order_by="activity_date")


@router.post("/activity", status_code=status.HTTP_201_CREATED)
async def create_activity_log(body: HealthActivityLogCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_activity_logs", body, user_id, "Failed to create activity log")


@router.get("/workouts")
async def list_workouts(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_workouts", user_id, order_by="occurred_on")


@router.post("/workouts", status_code=status.HTTP_201_CREATED)
async def create_workout(body: HealthWorkoutCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_workouts", body, user_id, "Failed to create workout")


@router.get("/nutrition")
async def list_nutrition_logs(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_nutrition_logs", user_id, order_by="logged_on")


@router.post("/nutrition", status_code=status.HTTP_201_CREATED)
async def create_nutrition_log(body: HealthNutritionLogCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_nutrition_logs", body, user_id, "Failed to create nutrition log")


@router.get("/nutrition/diary")
async def get_nutrition_diary(
    logged_on: date | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    day = (logged_on or date.today()).isoformat()
    meals = _list_meals(user_id, logged_on=day, limit=50)
    water_logs = [
        row
        for row in _list_table("health_water_logs", user_id, order_by="logged_on", limit=100)
        if row.get("logged_on") == day
    ]
    return {
        "logged_on": day,
        "meals": meals,
        "water_logs": water_logs,
        "summary": _nutrition_summary_with_target(day, meals, water_logs, user_id),
    }


@router.post("/nutrition/meals", status_code=status.HTTP_201_CREATED)
async def create_meal(body: HealthMealCreate, user_id: str = Depends(get_current_user_id)):
    return _create_meal(body, user_id)


@router.get("/nutrition/foods")
async def list_foods(
    query: str = Query(default="", max_length=120),
    user_id: str = Depends(get_current_user_id),
):
    try:
        request = get_supabase().table("health_foods").select("*").eq("user_id", user_id)
        if query.strip():
            request = request.ilike("name", f"%{query.strip()}%")
        result = request.order("updated_at", desc=True).limit(30).execute()
    except APIError as exc:
        _handle_db_error(exc)
    local_rows = result.data or []
    if query.strip():
        external = await search_open_food_facts(query, limit=max(0, 10 - len(local_rows)))
        return local_rows + [candidate.as_row() for candidate in external]
    return local_rows


@router.post("/nutrition/foods", status_code=status.HTTP_201_CREATED)
async def create_food(body: HealthFoodCreate, user_id: str = Depends(get_current_user_id)):
    row = _payload(body)
    row["food_score"] = row.get("food_score") or _food_score(row)
    row["user_id"] = user_id
    try:
        result = get_supabase().table("health_foods").insert(row).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create food")
    return result.data[0]


@router.post("/nutrition/barcode", response_model=HealthNutritionScanResult)
async def lookup_food_barcode(body: HealthBarcodeLookup, user_id: str = Depends(get_current_user_id)):
    try:
        local = (
            get_supabase()
            .table("health_foods")
            .select("*")
            .eq("user_id", user_id)
            .eq("barcode", body.barcode)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    if local.data:
        return {
            "candidate": local.data[0],
            "saved_food": local.data[0],
            "needs_confirmation": False,
            "source": "local",
            "confidence": local.data[0].get("confidence"),
        }

    candidate = await lookup_open_food_facts_barcode(body.barcode)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Food was not found by barcode")
    saved = _save_food_candidate(candidate.as_row(), user_id, confirmed=True)
    return {
        "candidate": candidate.as_row(),
        "saved_food": saved,
        "needs_confirmation": False,
        "source": "open_food_facts",
        "confidence": candidate.confidence,
    }


@router.post("/nutrition/scan-photo", response_model=HealthNutritionScanResult)
async def scan_nutrition_photo(file: UploadFile, user_id: str = Depends(get_current_user_id)):
    if not await ai_budget.has_budget(user_id):
        raise HTTPException(status_code=402, detail="AI budget is exhausted for today")
    image_bytes = await file.read()
    if len(image_bytes) > MAX_NUTRITION_PHOTO_SIZE:
        raise HTTPException(status_code=413, detail="Image too large (max 10MB)")
    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image/* files are supported")
    try:
        candidate = await analyze_package_photo(image_bytes, mime)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if candidate.barcode:
        off_candidate = await lookup_open_food_facts_barcode(candidate.barcode)
        if off_candidate is not None:
            saved = _save_food_candidate(off_candidate.as_row(), user_id, confirmed=False)
            await ai_budget.record_usage(user_id, 900)
            return {
                "candidate": off_candidate.as_row(),
                "saved_food": saved,
                "needs_confirmation": True,
                "source": "open_food_facts",
                "confidence": off_candidate.confidence,
            }
    saved = _save_food_candidate(candidate.as_row(), user_id, confirmed=False)
    # Vision calls are direct OpenAI calls; record a conservative estimate so budget UX remains fail-safe.
    await ai_budget.record_usage(user_id, 900)
    return {
        "candidate": candidate.as_row(),
        "saved_food": saved,
        "needs_confirmation": True,
        "source": "ai_photo",
        "confidence": candidate.confidence,
    }


@router.post("/nutrition/foods/{food_id}/quick-meal", status_code=status.HTTP_201_CREATED)
async def create_meal_from_food(
    food_id: str,
    meal_type: str = Query(default="snack"),
    grams: float | None = Query(default=None, gt=0, le=5000),
    logged_on: date | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    try:
        result = (
            get_supabase()
            .table("health_foods")
            .select("*")
            .eq("id", food_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    food = _assert_found(result.data or [], "Food not found")
    body = HealthMealCreate(
        logged_on=logged_on or date.today(),
        meal_type=meal_type,
        title=food.get("name"),
        source="food_database",
        confidence=food.get("confidence"),
        items=[meal_item_from_food(food, grams=grams)],
    )
    return _create_meal(body, user_id)


@router.post("/nutrition/water", status_code=status.HTTP_201_CREATED)
async def create_water_log(body: HealthWaterLogCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_water_logs", body, user_id, "Failed to create water log")


@router.post("/nutrition/targets", status_code=status.HTTP_201_CREATED)
async def upsert_nutrition_target(
    body: HealthNutritionTargetCreate,
    user_id: str = Depends(get_current_user_id),
):
    row = _payload(body)
    calculated = calculate_tdee_target(row)
    for key, value in calculated.items():
        if row.get(key) is None or key in {"bmr", "tdee"}:
            row[key] = value
    row["user_id"] = user_id
    row["updated_at"] = _now_iso()
    try:
        result = (
            get_supabase()
            .table("health_nutrition_targets")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save nutrition target")
    return result.data[0]


@router.get("/nutrition/targets")
async def get_nutrition_target(user_id: str = Depends(get_current_user_id)):
    return _nutrition_target(user_id) or {}


@router.get("/nutrition/weight")
async def list_weight_logs(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_weight_logs", user_id, order_by="logged_on", limit=120)


@router.post("/nutrition/weight", status_code=status.HTTP_201_CREATED)
async def create_weight_log(body: HealthWeightLogCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_weight_logs", body, user_id, "Failed to create weight log")


@router.get("/nutrition/recipes")
async def list_recipes(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_recipes", user_id, order_by="updated_at", limit=100)


@router.post("/nutrition/recipes", status_code=status.HTTP_201_CREATED)
async def create_recipe(body: HealthRecipeCreate, user_id: str = Depends(get_current_user_id)):
    row = _payload(body)
    row.update(_recipe_totals(row["items"], row["servings"]))
    row["user_id"] = user_id
    try:
        result = get_supabase().table("health_recipes").insert(row).execute()
    except APIError as exc:
        _handle_db_error(exc)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create recipe")
    return result.data[0]


@router.get("/nutrition/report/weekly", response_model=HealthNutritionWeeklyReport)
async def get_weekly_nutrition_report(
    week_start: date | None = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    start, end = weekly_window(week_start)
    meals = [
        meal
        for meal in _list_meals(user_id, limit=300)
        if start <= str(meal.get("logged_on")) <= end
    ]
    water_logs = [
        row
        for row in _list_table("health_water_logs", user_id, order_by="logged_on", limit=300)
        if start <= str(row.get("logged_on")) <= end
    ]
    weights = [
        row
        for row in _list_table("health_weight_logs", user_id, order_by="logged_on", limit=90)
        if start <= str(row.get("logged_on")) <= end
    ]
    target = _nutrition_target(user_id) or {}
    day_summaries = []
    for day_index in range(7):
        day = (date.fromisoformat(start) + timedelta(days=day_index)).isoformat()
        day_meals = [meal for meal in meals if meal.get("logged_on") == day]
        day_water = [row for row in water_logs if row.get("logged_on") == day]
        day_summaries.append(_nutrition_summary(day, day_meals, day_water))
    avg_calories = sum(row["calories"] for row in day_summaries) / 7
    avg_protein = sum(row["protein_g"] for row in day_summaries) / 7
    avg_water = sum(row["water_ml"] for row in day_summaries) / 7
    weight_trend = None
    if len(weights) >= 2:
        sorted_weights = sorted(weights, key=lambda row: row.get("logged_on"))
        weight_trend = float(sorted_weights[-1].get("weight_kg") or 0) - float(sorted_weights[0].get("weight_kg") or 0)
    macro_completion = {
        "calories": round(avg_calories / float(target.get("calories") or 2200) * 100, 1),
        "protein": round(avg_protein / float(target.get("protein_g") or 120) * 100, 1),
        "water": round(avg_water / float(target.get("water_ml") or 2200) * 100, 1),
    }
    water_days = len({row.get("logged_on") for row in water_logs if int(row.get("amount_ml") or 0) > 0})
    ai_summary = (
        f"За неделю в среднем {round(avg_calories)} ккал, белка {round(avg_protein)} г, воды {round(avg_water)} мл. "
        "Это справочная сводка по твоим записям, не медицинская рекомендация."
    )
    return {
        "week_start": start,
        "week_end": end,
        "average_calories": round(avg_calories, 1),
        "average_protein_g": round(avg_protein, 1),
        "average_water_ml": round(avg_water, 1),
        "macro_completion_pct": macro_completion,
        "water_consistency_days": water_days,
        "weight_trend_kg": weight_trend,
        "frequent_foods": _frequent_foods(meals),
        "ai_summary": ai_summary,
        "safety_note": "Сводка питания является справочной поддержкой и не заменяет врача или нутрициолога.",
    }


@router.get("/biomarkers")
async def list_biomarkers(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_biomarkers", user_id, order_by="measured_on")


@router.post("/biomarkers", status_code=status.HTTP_201_CREATED)
async def create_biomarker(body: HealthBiomarkerCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_biomarkers", body, user_id, "Failed to create biomarker")


@router.get("/medical-records")
async def list_medical_records(user_id: str = Depends(get_current_user_id)):
    return _list_table("health_medical_records", user_id, order_by="record_date")


@router.post("/medical-records", status_code=status.HTTP_201_CREATED)
async def create_medical_record(body: HealthMedicalRecordCreate, user_id: str = Depends(get_current_user_id)):
    return _create_row("health_medical_records", body, user_id, "Failed to create medical record")
