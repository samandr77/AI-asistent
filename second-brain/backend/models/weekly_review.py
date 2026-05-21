from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator


class WeeklyReviewCreate(BaseModel):
    week_start: date
    highlights: Optional[str] = None
    lessons: Optional[str] = None
    next_week_focus: Optional[str] = None
    mood: Optional[int] = None
    energy: Optional[int] = None

    @field_validator("mood", "energy")
    @classmethod
    def mood_energy_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 5):
            raise ValueError("mood/energy must be between 1 and 5")
        return v

    @field_validator("highlights", "lessons", "next_week_focus")
    @classmethod
    def text_length(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if len(v) > 4000:
            raise ValueError("text must be 4000 characters or fewer")
        return v


class WeeklyReviewUpdate(BaseModel):
    highlights: Optional[str] = None
    lessons: Optional[str] = None
    next_week_focus: Optional[str] = None
    mood: Optional[int] = None
    energy: Optional[int] = None

    @field_validator("mood", "energy")
    @classmethod
    def mood_energy_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 5):
            raise ValueError("mood/energy must be between 1 and 5")
        return v


class WeeklyReview(BaseModel):
    id: str
    user_id: str
    week_start: date
    highlights: Optional[str] = None
    lessons: Optional[str] = None
    next_week_focus: Optional[str] = None
    okr_progress: Dict[str, Any] = {}
    completed_tasks_count: int = 0
    carried_over_count: int = 0
    mood: Optional[int] = None
    energy: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class WeeklyReviewDraft(BaseModel):
    """Computed snapshot for the current week — used to pre-fill the review form."""

    week_start: date
    week_end: date
    completed_tasks_count: int = 0
    carried_over_count: int = 0
    active_goals: int = 0
    okr_progress: List[Dict[str, Any]] = []
    top_completed: List[Dict[str, Any]] = []
    suggestions: List[str] = []
