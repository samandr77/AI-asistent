from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user_id
from models.premium import PremiumStatus
from services.premium import get_user_premium

logger = logging.getLogger(__name__)

router = APIRouter()


class LinkRequest(BaseModel):
    revenuecat_app_user_id: str


@router.get("/status", response_model=PremiumStatus)
async def get_premium_status(user_id: str = Depends(get_current_user_id)):
    return await get_user_premium(user_id)


@router.post("/link")
async def link_revenuecat_user(
    body: LinkRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Validates that the RevenueCat app_user_id matches the Supabase user id.
    Actual linkage happens via RC SDK setAppUserID on the client; this endpoint
    is for confirmation logging only."""
    if body.revenuecat_app_user_id != user_id:
        raise HTTPException(
            status_code=400,
            detail="revenuecat_app_user_id does not match authenticated user",
        )
    logger.info(
        "RC linkage confirmed",
        extra={"user_id": user_id, "rc_app_user_id": body.revenuecat_app_user_id},
    )
    return {"linked": True, "user_id": user_id}
