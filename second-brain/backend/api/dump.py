from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, field_validator
from auth import get_current_user_id
from database import get_supabase
from services.stt import transcribe_audio_with_fallback
from services.parser import parse_dump
from models.task import ParsedDump

router = APIRouter()

MAX_AUDIO_SIZE = 25 * 1024 * 1024

class TextDumpRequest(BaseModel):
    text: str
    user_context: dict = {}

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("text cannot be empty")
        return v

async def save_tasks(parsed: ParsedDump, user_id: str, raw_text: str) -> tuple[str, list[str]]:
    db = get_supabase()
    dump_result = db.table("dumps").insert({
        "user_id": user_id,
        "raw_text": raw_text,
        "status": "done",
    }).execute()
    if not dump_result.data:
        raise HTTPException(status_code=500, detail="Failed to save dump")
    dump_id = dump_result.data[0]["id"]

    rows = [
        {
            "user_id": user_id,
            "dump_id": dump_id,
            "title": t.title,
            "sphere": t.sphere.value,
            "priority": t.priority.value,
            "is_today": t.is_today,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "notes": t.notes,
        }
        for t in parsed.tasks
    ]
    task_result = db.table("tasks").insert(rows).execute()
    if not task_result.data:
        raise HTTPException(status_code=500, detail="Failed to save tasks")
    task_ids = [r["id"] for r in task_result.data]
    return dump_id, task_ids

@router.post("/text")
async def dump_text(
    body: TextDumpRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        parsed = await parse_dump(body.text, body.user_context)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    dump_id, task_ids = await save_tasks(parsed, user_id, body.text)
    return {
        "dump_id": dump_id,
        "tasks": [t.model_dump() for t in parsed.tasks],
        "today_top3": [t.model_dump() for t in parsed.today_top3],
        "task_ids": task_ids,
    }

@router.post("/voice")
async def dump_voice(
    file: UploadFile,
    user_id: str = Depends(get_current_user_id),
):
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    transcription = await transcribe_audio_with_fallback(audio_bytes, file.filename or "audio.m4a")
    try:
        parsed = await parse_dump(transcription, {})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    dump_id, task_ids = await save_tasks(parsed, user_id, transcription)
    return {
        "dump_id": dump_id,
        "transcription": transcription,
        "tasks": [t.model_dump() for t in parsed.tasks],
        "today_top3": [t.model_dump() for t in parsed.today_top3],
        "task_ids": task_ids,
    }
