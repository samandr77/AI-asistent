from __future__ import annotations

from fastapi import APIRouter, Depends

from auth import get_current_user_id
from models.task import TaskProjectCreate, TaskProjectUpdate
from services import task_projects

router = APIRouter()


@router.get("/")
async def list_task_projects(user_id: str = Depends(get_current_user_id)):
    return task_projects.list_projects(user_id)


@router.post("/", status_code=201)
async def create_task_project(
    body: TaskProjectCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_projects.create_project(body, user_id)


@router.patch("/{project_id}")
async def update_task_project(
    project_id: str,
    body: TaskProjectUpdate,
    user_id: str = Depends(get_current_user_id),
):
    return task_projects.update_project(project_id, body, user_id)
