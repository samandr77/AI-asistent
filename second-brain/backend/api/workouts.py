from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError

from auth import get_current_user_id
from models.workout import (
    Superset,
    SupersetCreate,
    WorkoutSession,
    WorkoutSessionCreate,
    WorkoutSessionUpdate,
    WorkoutSet,
    WorkoutSetCreate,
    WorkoutSetUpdate,
)
from services import workout_logger

router = APIRouter()

MISSING_TABLES_DETAIL = (
    "Workout database tables are missing. Apply migration 023_workouts.sql."
)


def _handle_apierror(exc: APIError) -> HTTPException:
    msg = str(exc).lower()
    if "does not exist" in msg and "health_workout" in msg:
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, MISSING_TABLES_DETAIL)
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


# ============================================================
# Sessions
# ============================================================

@router.get("/sessions/active", response_model=Optional[WorkoutSession])
async def get_active_session(user_id: str = Depends(get_current_user_id)):
    try:
        row = workout_logger.get_active_session(user_id=user_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    return row


@router.get("/sessions", response_model=list[WorkoutSession])
async def list_sessions(
    user_id: str = Depends(get_current_user_id),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    sport_kind: Optional[str] = Query(None),
    is_completed: Optional[bool] = Query(None),
    goal_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    try:
        return workout_logger.list_sessions(
            user_id=user_id,
            from_date=from_date,
            to_date=to_date,
            sport_kind=sport_kind,
            is_completed=is_completed,
            goal_id=goal_id,
            limit=limit,
            offset=offset,
        )
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.get("/sessions/{session_id}", response_model=WorkoutSession)
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        session = workout_logger.get_session(user_id=user_id, session_id=session_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    try:
        sets = workout_logger.list_sets(user_id=user_id, session_id=session_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    session["sets"] = sets
    return session


@router.post("/sessions", response_model=WorkoutSession, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: WorkoutSessionCreate,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.create_session(
            user_id=user_id,
            body=body.model_dump(exclude_unset=True),
        )
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.patch("/sessions/{session_id}", response_model=WorkoutSession)
async def update_session(
    session_id: str,
    body: WorkoutSessionUpdate,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.update_session(
            user_id=user_id,
            session_id=session_id,
            body=body.model_dump(exclude_unset=True),
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        workout_logger.delete_session(user_id=user_id, session_id=session_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    return None


@router.post("/sessions/{session_id}/start", response_model=WorkoutSession)
async def start_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.start_session(user_id=user_id, session_id=session_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.post("/sessions/{session_id}/finish", response_model=WorkoutSession)
async def finish_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.finish_session(user_id=user_id, session_id=session_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except APIError as exc:
        raise _handle_apierror(exc) from exc


# ============================================================
# Sets
# ============================================================

@router.get("/sessions/{session_id}/sets", response_model=list[WorkoutSet])
async def list_sets(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.list_sets(user_id=user_id, session_id=session_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.post(
    "/sessions/{session_id}/sets",
    response_model=WorkoutSet,
    status_code=status.HTTP_201_CREATED,
)
async def create_set(
    session_id: str,
    body: WorkoutSetCreate,
    user_id: str = Depends(get_current_user_id),
):
    # Verify the session belongs to the user
    session = workout_logger.get_session(user_id=user_id, session_id=session_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    try:
        return workout_logger.create_set(
            user_id=user_id,
            session_id=session_id,
            body=body.model_dump(exclude_unset=True),
        )
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.patch("/sets/{set_id}", response_model=WorkoutSet)
async def update_set(
    set_id: str,
    body: WorkoutSetUpdate,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.update_set(
            user_id=user_id,
            set_id=set_id,
            body=body.model_dump(exclude_unset=True),
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_set(
    set_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        workout_logger.delete_set(user_id=user_id, set_id=set_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc
    return None


# ============================================================
# Supersets
# ============================================================

@router.get("/sessions/{session_id}/supersets", response_model=list[Superset])
async def list_supersets(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return workout_logger.list_supersets(user_id=user_id, session_id=session_id)
    except APIError as exc:
        raise _handle_apierror(exc) from exc


@router.post(
    "/sessions/{session_id}/supersets",
    response_model=Superset,
    status_code=status.HTTP_201_CREATED,
)
async def create_superset(
    session_id: str,
    body: SupersetCreate,
    user_id: str = Depends(get_current_user_id),
):
    session = workout_logger.get_session(user_id=user_id, session_id=session_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    try:
        return workout_logger.create_superset(
            user_id=user_id,
            session_id=session_id,
            group_index=body.group_index,
            kind=body.kind,
            notes=body.notes,
            set_ids=body.set_ids,
        )
    except APIError as exc:
        raise _handle_apierror(exc) from exc
