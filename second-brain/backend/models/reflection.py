from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ReflectionCreate(BaseModel):
    mood: int
    energy: int
    notes: Optional[str] = None
    date: Optional[date] = None

    @field_validator("mood")
    @classmethod
    def mood_range(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("mood must be between 1 and 5")
        return v

    @field_validator("energy")
    @classmethod
    def energy_range(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("energy must be between 1 and 5")
        return v

    @field_validator("notes")
    @classmethod
    def notes_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 4000:
            raise ValueError("notes must be 4000 characters or fewer")
        return v


class ReflectionUpdate(BaseModel):
    mood: Optional[int] = None
    energy: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("mood")
    @classmethod
    def mood_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 5):
            raise ValueError("mood must be between 1 and 5")
        return v

    @field_validator("energy")
    @classmethod
    def energy_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 5):
            raise ValueError("energy must be between 1 and 5")
        return v

    @field_validator("notes")
    @classmethod
    def notes_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 4000:
            raise ValueError("notes must be 4000 characters or fewer")
        return v


class Reflection(BaseModel):
    id: str
    user_id: str
    date: date
    mood: int
    energy: int
    notes: Optional[str]
    completed_count: int
    goal_aligned_count: int
    active_goal_ids: list[str]
    created_at: datetime
    updated_at: datetime


class TaskBrief(BaseModel):
    id: str
    title: str
    goal_id: Optional[str]
    sphere: Optional[str]


class GoalBrief(BaseModel):
    id: str
    title: str
    sphere: Optional[str]
    completed_task_count: int


class DailySummary(BaseModel):
    date: date
    completed_tasks: list[TaskBrief]
    goal_aligned_tasks: list[TaskBrief]
    goals_with_progress: list[GoalBrief]
    total_dumps: int
    existing_reflection: Optional[Reflection]


class ReflectionStats(BaseModel):
    current_streak: int
    longest_streak: int
    total_reflections: int
