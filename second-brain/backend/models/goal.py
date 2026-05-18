from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator

VALID_STATUSES = {"active", "paused", "achieved", "archived"}
VALID_SPHERES = {"work", "family", "study", "health", "travel", "finance", "goals"}


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None
    status: str = "active"
    sphere: Optional[str] = None
    progress_percent: int = 0

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty")
        if len(v) > 200:
            raise ValueError("title must be 200 characters or fewer")
        return v

    @field_validator("description")
    @classmethod
    def description_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 2000:
            raise ValueError("description must be 2000 characters or fewer")
        return v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
        return v

    @field_validator("sphere")
    @classmethod
    def sphere_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_SPHERES:
            raise ValueError(f"sphere must be one of {sorted(VALID_SPHERES)}")
        return v

    @field_validator("progress_percent")
    @classmethod
    def progress_range(cls, v: int) -> int:
        if v < 0 or v > 100:
            raise ValueError("progress_percent must be between 0 and 100")
        return v

    @model_validator(mode="after")
    def target_date_not_in_past(self) -> "GoalCreate":
        if self.target_date is not None and self.target_date < date.today():
            raise ValueError("target_date cannot be in the past")
        return self


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[date] = None
    status: Optional[str] = None
    sphere: Optional[str] = None
    progress_percent: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("title cannot be empty")
            if len(v) > 200:
                raise ValueError("title must be 200 characters or fewer")
        return v

    @field_validator("description")
    @classmethod
    def description_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 2000:
            raise ValueError("description must be 2000 characters or fewer")
        return v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
        return v

    @field_validator("sphere")
    @classmethod
    def sphere_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_SPHERES:
            raise ValueError(f"sphere must be one of {sorted(VALID_SPHERES)}")
        return v

    @field_validator("progress_percent")
    @classmethod
    def progress_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("progress_percent must be between 0 and 100")
        return v


class Goal(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None
    status: str
    sphere: Optional[str] = None
    progress_percent: int
    created_at: datetime
    updated_at: datetime


class GoalWithProgress(Goal):
    computed_progress: Optional[int] = None
    linked_tasks_count: int = 0
    completed_tasks_count: int = 0
