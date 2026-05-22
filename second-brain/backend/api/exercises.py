from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError

from auth import get_current_user_id
from database import get_supabase
from models.workout import Exercise, ExerciseCreate, _slugify
from services import workout_exercise_library as library

router = APIRouter()

MISSING_TABLES_DETAIL = (
    "Workout database tables are missing. Apply migration 023_workouts.sql."
)


def _handle_apierror(exc: APIError) -> HTTPException:
    if "health_exercises" in str(exc) and "does not exist" in str(exc).lower():
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, MISSING_TABLES_DETAIL)
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


@router.get("", response_model=list[Exercise])
async def list_exercises(
    user_id: str = Depends(get_current_user_id),
    muscle: Optional[str] = Query(None),
    equipment: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sport_kind: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=80),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    try:
        rows = library.list_exercises(
            user_id=user_id,
            muscle=muscle,
            equipment=equipment,
            category=category,
            sport_kind=sport_kind,
            difficulty=difficulty,
            search=search,
            limit=limit,
            offset=offset,
        )
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    return rows


@router.get("/popular", response_model=list[Exercise])
async def popular_exercises(
    user_id: str = Depends(get_current_user_id),
    limit: int = Query(10, ge=1, le=50),
):
    try:
        return library.popular_for_user(user_id=user_id, limit=limit)
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.get("/{slug}", response_model=Exercise)
async def get_exercise(
    slug: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        row = library.get_exercise(slug=slug, user_id=user_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "exercise not found")
    return row


@router.post("", response_model=Exercise, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    body: ExerciseCreate,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    slug = body.slug or _slugify(body.name_en or body.name_ru)
    if not slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "could not derive slug from name")

    payload = body.model_dump(exclude_unset=True, exclude={"slug"})
    payload["slug"] = slug
    payload["user_id"] = user_id

    try:
        result = db.table("health_exercises").insert(payload).execute()
    except APIError as exc:
        msg = str(exc).lower()
        if "duplicate" in msg or "unique" in msg:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"exercise with slug '{slug}' already exists for this user",
            ) from exc
        raise _handle_apierror(exc) from exc
    if not result.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create exercise")
    return result.data[0]


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    try:
        # Only allow deleting own exercises (not system)
        result = (
            db.table("health_exercises")
            .delete()
            .eq("user_id", user_id)
            .eq("id", exercise_id)
            .execute()
        )
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "exercise not found")
    return None
