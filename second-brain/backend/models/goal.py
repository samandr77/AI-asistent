from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator, model_validator

VALID_STATUSES = {"active", "paused", "achieved", "archived"}
VALID_SPHERES = {
    "work",
    "family",
    "study",
    "health",
    "travel",
    "finance",
    "goals",
    "mind",
    "personal",
}
VALID_LEVELS = {"life", "year", "quarter", "week"}


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[date] = None
    status: str = "active"
    sphere: Optional[str] = None
    progress_percent: int = 0
    level: str = "year"
    parent_goal_id: Optional[str] = None
    horizon_start: Optional[date] = None
    horizon_end: Optional[date] = None
    weight: int = 1

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

    @field_validator("level")
    @classmethod
    def level_valid(cls, v: str) -> str:
        if v not in VALID_LEVELS:
            raise ValueError(f"level must be one of {sorted(VALID_LEVELS)}")
        return v

    @field_validator("progress_percent")
    @classmethod
    def progress_range(cls, v: int) -> int:
        if v < 0 or v > 100:
            raise ValueError("progress_percent must be between 0 and 100")
        return v

    @field_validator("weight")
    @classmethod
    def weight_range(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("weight must be between 1 and 10")
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
    level: Optional[str] = None
    parent_goal_id: Optional[str] = None
    horizon_start: Optional[date] = None
    horizon_end: Optional[date] = None
    weight: Optional[int] = None

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

    @field_validator("level")
    @classmethod
    def level_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_LEVELS:
            raise ValueError(f"level must be one of {sorted(VALID_LEVELS)}")
        return v

    @field_validator("progress_percent")
    @classmethod
    def progress_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("progress_percent must be between 0 and 100")
        return v

    @field_validator("weight")
    @classmethod
    def weight_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 10):
            raise ValueError("weight must be between 1 and 10")
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
    level: str = "year"
    parent_goal_id: Optional[str] = None
    horizon_start: Optional[date] = None
    horizon_end: Optional[date] = None
    weight: int = 1
    created_at: datetime
    updated_at: datetime


class GoalWithProgress(Goal):
    computed_progress: Optional[int] = None
    linked_tasks_count: int = 0
    completed_tasks_count: int = 0
    key_results_count: int = 0
    key_results_done_count: int = 0
    children_count: int = 0


VALID_KR_DIRECTIONS = {"increase", "decrease", "maintain"}
VALID_KR_STATUSES = {"on_track", "at_risk", "off_track", "done"}


class KeyResultCreate(BaseModel):
    title: str
    metric: Optional[str] = None
    unit: Optional[str] = None
    start_value: float = 0
    target_value: float
    current_value: float = 0
    direction: str = "increase"
    status: str = "on_track"
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty")
        if len(v) > 200:
            raise ValueError("title must be 200 characters or fewer")
        return v

    @field_validator("direction")
    @classmethod
    def direction_valid(cls, v: str) -> str:
        if v not in VALID_KR_DIRECTIONS:
            raise ValueError(
                f"direction must be one of {sorted(VALID_KR_DIRECTIONS)}"
            )
        return v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in VALID_KR_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_KR_STATUSES)}")
        return v


class KeyResultUpdate(BaseModel):
    title: Optional[str] = None
    metric: Optional[str] = None
    unit: Optional[str] = None
    start_value: Optional[float] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    direction: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None

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

    @field_validator("direction")
    @classmethod
    def direction_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_KR_DIRECTIONS:
            raise ValueError(
                f"direction must be one of {sorted(VALID_KR_DIRECTIONS)}"
            )
        return v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_KR_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_KR_STATUSES)}")
        return v


class KeyResult(BaseModel):
    id: str
    goal_id: str
    user_id: str
    title: str
    metric: Optional[str] = None
    unit: Optional[str] = None
    start_value: float = 0
    target_value: float
    current_value: float = 0
    direction: str = "increase"
    status: str = "on_track"
    due_date: Optional[date] = None
    progress_percent: int = 0
    created_at: datetime
    updated_at: datetime


class GoalTree(BaseModel):
    """OKR tree node with nested children."""

    goal: GoalWithProgress
    children: List["GoalTree"] = []


GoalTree.model_rebuild()
