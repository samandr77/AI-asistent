from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


class Sphere(str, Enum):
    work = "work"
    family = "family"
    study = "study"
    health = "health"
    travel = "travel"
    finance = "finance"
    goals = "goals"


class Priority(int, Enum):
    low = 1
    medium = 2
    high = 3


class TaskStatus(str, Enum):
    inbox = "inbox"
    active = "active"
    done = "done"
    archived = "archived"
    delegated = "delegated"


class EisenhowerQuadrant(str, Enum):
    do_now = "do_now"
    schedule = "schedule"
    delegate = "delegate"
    delete = "delete"


class CaptureSource(str, Enum):
    manual = "manual"
    telegram = "telegram"
    voice = "voice"
    browser = "browser"
    email = "email"
    whatsapp = "whatsapp"
    linear = "linear"
    asana = "asana"
    notion = "notion"


class RecurrenceFrequency(str, Enum):
    daily = "daily"
    weekdays = "weekdays"
    weekly = "weekly"
    monthly = "monthly"
    every_n_days = "every_n_days"


class ProjectStatus(str, Enum):
    active = "active"
    archived = "archived"


class TaskProcessType(str, Enum):
    schedule = "schedule"
    delegate = "delegate"
    delete = "delete"
    convert_project = "convert_project"
    do_now = "do_now"
    split_checklist = "split_checklist"


class AttachmentKind(str, Enum):
    link = "link"
    file = "file"


def _clean_text(value: Optional[str], *, max_len: int, field_name: str) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if len(cleaned) > max_len:
        raise ValueError(f"{field_name} must be {max_len} characters or fewer")
    return cleaned or None


# ── Legacy parser models (kept for backwards compatibility with /dump v1 callers). ──
class ParsedTask(BaseModel):
    title: str
    sphere: Sphere
    priority: Priority = Priority.medium
    deadline: Optional[datetime] = None
    notes: Optional[str] = None
    is_today: bool = False
    goal_id: Optional[str] = None


class ParsedHealthEvent(BaseModel):
    type: str = Field(pattern=r"^(sleep_log|activity_log|workout|nutrition_meal|water_log)$")
    event_date: Optional[date] = None
    source_text: str = Field(default="", max_length=2000)
    confidence: float = Field(default=0.75, ge=0, le=1)
    data: dict[str, Any] = Field(default_factory=dict)


class ParsedDump(BaseModel):
    tasks: List[ParsedTask]
    health_events: List[ParsedHealthEvent] = Field(default_factory=list)

    @property
    def today_top3(self) -> List[ParsedTask]:
        today = [t for t in self.tasks if t.is_today]
        return sorted(today, key=lambda t: t.priority, reverse=True)[:3]


# ── Phase 1 (spec 006): extended parser output. ──
class ParsedTaskV2(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source_text: str = Field(min_length=1, max_length=2000)
    sphere: Optional[Sphere] = None
    priority: Priority = Priority.medium
    is_today: bool = False
    deadline: Optional[datetime] = None
    time_of_day: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    duration_estimated_min: Optional[int] = Field(default=None, ge=1, le=24 * 60)
    contact: Optional[str] = Field(default=None, max_length=100)
    url: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    goal_id: Optional[str] = None
    clarification_questions: List[str] = Field(default_factory=list, max_length=2)


class ParsedDumpV2(BaseModel):
    tasks: List[ParsedTaskV2]
    tokens_used: int = 0
    used_fallback: bool = False


# ── Phase 1: API request models. ──
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    raw_text: Optional[str] = Field(default=None, max_length=2000)
    sphere: Optional[Sphere] = None
    priority: Priority = Priority.medium
    deadline: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    is_today: bool = False
    status: TaskStatus = TaskStatus.active
    goal_id: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    context: Optional[str] = Field(default=None, max_length=80)
    tags: list[str] = Field(default_factory=list, max_length=20)
    eisenhower_quadrant: Optional[EisenhowerQuadrant] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    duration_estimated_min: Optional[int] = Field(default=None, ge=1, le=24 * 60)
    duration_actual_min: Optional[int] = Field(default=None, ge=0, le=24 * 60)
    deep_work: bool = False
    project_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    recurrence_rule: Optional[dict[str, Any]] = None
    habit_mode: bool = False
    source: CaptureSource = CaptureSource.manual
    parser_metadata: dict[str, Any] = Field(default_factory=dict)
    assignee_name: Optional[str] = Field(default=None, max_length=100)
    assignee_contact: Optional[str] = Field(default=None, max_length=160)
    delegation_status: Optional[str] = Field(default=None, max_length=40)


class TaskBulkUpdate(BaseModel):
    task_ids: list[str] = Field(min_length=1, max_length=100)
    status: Optional[TaskStatus] = None
    project_id: Optional[str] = None
    tags: Optional[list[str]] = Field(default=None, max_length=20)
    deadline: Optional[datetime] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    eisenhower_quadrant: Optional[EisenhowerQuadrant] = None
    context: Optional[str] = Field(default=None, max_length=80)


class TaskSearchFilters(BaseModel):
    status: Optional[TaskStatus] = None
    sphere: Optional[Sphere] = None
    project_id: Optional[str] = None
    context: Optional[str] = None
    tags: list[str] = Field(default_factory=list, max_length=20)
    priority: Optional[Priority] = None
    deadline_from: Optional[datetime] = None
    deadline_to: Optional[datetime] = None
    scheduled_from: Optional[datetime] = None
    scheduled_to: Optional[datetime] = None
    deep_work: Optional[bool] = None
    habit_mode: Optional[bool] = None
    overdue: bool = False
    no_date: bool = False
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class TaskProcessAction(BaseModel):
    action: TaskProcessType
    # schedule payload
    is_today: Optional[bool] = None
    deadline: Optional[datetime] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    # delegate payload
    delegate_to: Optional[str] = Field(default=None, max_length=100)
    delegate_contact: Optional[str] = Field(default=None, max_length=160)
    checklist_items: list[str] = Field(default_factory=list, max_length=50)


class TaskCaptureRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    source: CaptureSource = CaptureSource.manual
    user_context: dict[str, Any] = Field(default_factory=dict)

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("text cannot be empty")
        return cleaned


class TaskProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)
    goal_id: Optional[str] = None
    deadline: Optional[date] = None
    status: ProjectStatus = ProjectStatus.active


class TaskProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)
    goal_id: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[ProjectStatus] = None


class ChecklistItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    position: Optional[int] = Field(default=None, ge=0)


class ChecklistItemUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    is_done: Optional[bool] = None
    position: Optional[int] = Field(default=None, ge=0)


class ChecklistReorder(BaseModel):
    item_ids: list[str] = Field(min_length=1, max_length=100)


class TimeBlockCreate(BaseModel):
    task_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    deep_work: bool = False


class FocusSessionCreate(BaseModel):
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_min: Optional[int] = Field(default=None, ge=1, le=24 * 60)
    mode: str = Field(default="pomodoro", max_length=40)
    completed: bool = True


class FocusSessionUpdate(BaseModel):
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_min: Optional[int] = Field(default=None, ge=1, le=24 * 60)
    mode: Optional[str] = Field(default=None, max_length=40)
    completed: Optional[bool] = None


class FocusSettingsUpdate(BaseModel):
    pomodoro_min: int = Field(default=25, ge=1, le=180)
    short_break_min: int = Field(default=5, ge=1, le=60)
    long_break_min: int = Field(default=15, ge=1, le=120)
    sessions_before_long_break: int = Field(default=4, ge=1, le=12)
    sound_enabled: bool = True
    dnd_enabled: bool = False


class SavedFilterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    definition: dict[str, Any]


class SavedFilterUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    definition: Optional[dict[str, Any]] = None


class BigThreeRequest(BaseModel):
    date: date
    task_ids: list[str] = Field(min_length=0, max_length=3)


class AnalyticsRange(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class DependencyCreate(BaseModel):
    depends_on_task_id: str


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class AttachmentCreate(BaseModel):
    kind: AttachmentKind = AttachmentKind.link
    url: str = Field(min_length=1, max_length=2000)
    title: Optional[str] = Field(default=None, max_length=200)


class AttachmentUpdate(BaseModel):
    kind: Optional[AttachmentKind] = None
    url: Optional[str] = Field(default=None, max_length=2000)
    title: Optional[str] = Field(default=None, max_length=200)


class RecurrenceUpdate(BaseModel):
    frequency: RecurrenceFrequency
    interval: int = Field(default=1, ge=1, le=365)
    days_of_week: list[int] = Field(default_factory=list, max_length=7)
    next_occurrence_at: Optional[datetime] = None
    habit_mode: bool = False


class CaptureIntegrationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    external_id: Optional[str] = Field(default=None, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AIPlanningRequest(BaseModel):
    task_id: Optional[str] = None
    text: Optional[str] = Field(default=None, max_length=20_000)
    date: Optional[date] = None
    task_ids: list[str] = Field(default_factory=list, max_length=100)
    context: dict[str, Any] = Field(default_factory=dict)
