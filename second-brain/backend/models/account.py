from __future__ import annotations
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class AccountDeletionResponse(BaseModel):
    status: Literal["scheduled"] = "scheduled"
    scheduled_for: datetime  # deleted_at + 30 days (UTC)


class CleanupError(BaseModel):
    user_id: UUID
    error: str


class CleanupRunReport(BaseModel):
    processed: int
    deleted_users: list[UUID]
    errors: list[CleanupError]
    ran_at: datetime
