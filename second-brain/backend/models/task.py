from enum import Enum
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

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

class ParsedTask(BaseModel):
    title: str
    sphere: Sphere
    priority: Priority = Priority.medium
    deadline: Optional[datetime] = None
    notes: Optional[str] = None
    is_today: bool = False
    goal_id: Optional[str] = None

class ParsedDump(BaseModel):
    tasks: List[ParsedTask]

    @property
    def today_top3(self) -> List[ParsedTask]:
        today = [t for t in self.tasks if t.is_today]
        return sorted(today, key=lambda t: t.priority, reverse=True)[:3]
