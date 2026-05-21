from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator

VALID_KPI_DIRECTIONS = {"increase", "decrease", "maintain"}


class KpiCreate(BaseModel):
    name: str
    unit: Optional[str] = None
    sphere: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    direction: str = "increase"
    warning_threshold: Optional[float] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        if len(v) > 120:
            raise ValueError("name must be 120 characters or fewer")
        return v

    @field_validator("direction")
    @classmethod
    def direction_valid(cls, v: str) -> str:
        if v not in VALID_KPI_DIRECTIONS:
            raise ValueError(
                f"direction must be one of {sorted(VALID_KPI_DIRECTIONS)}"
            )
        return v


class KpiUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    sphere: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    direction: Optional[str] = None
    warning_threshold: Optional[float] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        if len(v) > 120:
            raise ValueError("name must be 120 characters or fewer")
        return v

    @field_validator("direction")
    @classmethod
    def direction_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_KPI_DIRECTIONS:
            raise ValueError(
                f"direction must be one of {sorted(VALID_KPI_DIRECTIONS)}"
            )
        return v


class Kpi(BaseModel):
    id: str
    user_id: str
    name: str
    unit: Optional[str] = None
    sphere: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    direction: str = "increase"
    warning_threshold: Optional[float] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class KpiHistoryEntryCreate(BaseModel):
    value: float
    recorded_on: Optional[date] = None
    note: Optional[str] = None

    @field_validator("note")
    @classmethod
    def note_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("note must be 500 characters or fewer")
        return v


class KpiHistoryEntry(BaseModel):
    id: str
    kpi_id: str
    user_id: str
    recorded_on: date
    value: float
    note: Optional[str] = None
    created_at: datetime


class KpiWithTrend(Kpi):
    history: List[KpiHistoryEntry] = []
    trend_percent: Optional[float] = None
    status: str = "ok"  # ok | warning | breach
