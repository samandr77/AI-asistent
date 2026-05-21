from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator


class StrategyUpdate(BaseModel):
    mission: Optional[str] = None
    vision: Optional[str] = None
    values: Optional[List[str]] = None
    life_areas: Optional[List[str]] = None
    swot_strengths: Optional[List[str]] = None
    swot_weaknesses: Optional[List[str]] = None
    swot_opportunities: Optional[List[str]] = None
    swot_threats: Optional[List[str]] = None

    @field_validator(
        "values",
        "life_areas",
        "swot_strengths",
        "swot_weaknesses",
        "swot_opportunities",
        "swot_threats",
    )
    @classmethod
    def normalize_list(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip() for item in v if item and item.strip()]
        if len(cleaned) > 30:
            raise ValueError("list cannot have more than 30 items")
        for item in cleaned:
            if len(item) > 200:
                raise ValueError("each item must be 200 characters or fewer")
        return cleaned

    @field_validator("mission", "vision")
    @classmethod
    def text_length(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("text must be 2000 characters or fewer")
        return v


class Strategy(BaseModel):
    user_id: str
    mission: Optional[str] = None
    vision: Optional[str] = None
    values: List[str] = []
    life_areas: List[str] = []
    swot_strengths: List[str] = []
    swot_weaknesses: List[str] = []
    swot_opportunities: List[str] = []
    swot_threats: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
