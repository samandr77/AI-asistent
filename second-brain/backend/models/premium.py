from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PremiumStatus(BaseModel):
    is_premium: bool = False
    entitlement_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    period_type: Optional[str] = None
    store: Optional[str] = None
    cancelled: bool = False
