from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from auth import get_current_user_id
from models.task import TaskProjectCreate, TaskProjectUpdate
from services import task_projects

router = APIRouter()


class ProjectFromTemplateRequest(BaseModel):
    template_id: str


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


@router.get("/{project_id}")
async def get_task_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    return task_projects.get_project(project_id, user_id)


@router.get("/{project_id}/tasks")
async def list_task_project_tasks(project_id: str, user_id: str = Depends(get_current_user_id)):
    return task_projects.list_project_tasks(project_id, user_id)


@router.post("/{project_id}/tasks/{task_id}")
async def add_task_to_project(project_id: str, task_id: str, user_id: str = Depends(get_current_user_id)):
    return task_projects.add_task_to_project(project_id, task_id, user_id)


@router.delete("/{project_id}/tasks/{task_id}", status_code=204, response_class=Response)
async def remove_task_from_project(project_id: str, task_id: str, user_id: str = Depends(get_current_user_id)):
    task_projects.remove_task_from_project(project_id, task_id, user_id)
    return Response(status_code=204)


@router.post("/{project_id}/archive")
async def archive_task_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    return task_projects.archive_project(project_id, user_id)


@router.delete("/{project_id}", status_code=204, response_class=Response)
async def delete_task_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    task_projects.delete_project(project_id, user_id)
    return Response(status_code=204)


@router.post("/templates", status_code=201)
async def create_task_project_template(
    body: TaskProjectCreate,
    user_id: str = Depends(get_current_user_id),
):
    return task_projects.create_template(body, user_id)


@router.post("/from-template", status_code=201)
async def create_task_project_from_template(
    body: ProjectFromTemplateRequest,
    user_id: str = Depends(get_current_user_id),
):
    return task_projects.create_from_template(body.template_id, user_id)
