from enum import Enum
from datetime import datetime
from pydantic import BaseModel

class Sphere(str, Enum):
    work = "work"
    family = "family"
    study = "study"
    health = "health"
    travel = "travel"

class Priority(int, Enum):
    low = 1
    medium = 2
    high = 3

class ParsedTask(BaseModel):
    title: str
    sphere: Sphere
    priority: Priority = Priority.medium
    deadline: datetime | None = None
    notes: str | None = None
    is_today: bool = False

class ParsedDump(BaseModel):
    tasks: list[ParsedTask]

    @property
    def today_top3(self) -> list[ParsedTask]:
        today = [t for t in self.tasks if t.is_today]
        return sorted(today, key=lambda t: t.priority, reverse=True)[:3]
