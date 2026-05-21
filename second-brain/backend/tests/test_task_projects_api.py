from __future__ import annotations

from unittest.mock import patch

import pytest


@pytest.mark.anyio
async def test_create_task_project(client):
    created = {"id": "project-1", "title": "Запуск", "status": "active"}
    with patch("api.task_projects.task_projects.create_project", return_value=created) as create:
        resp = await client.post("/task-projects/", json={"title": "Запуск"})

    assert resp.status_code == 201
    assert resp.json()["id"] == "project-1"
    assert create.call_args.args[0].title == "Запуск"


@pytest.mark.anyio
async def test_list_task_projects_includes_progress(client):
    rows = [{"id": "project-1", "title": "Запуск", "progress_percent": 50}]
    with patch("api.task_projects.task_projects.list_projects", return_value=rows):
        resp = await client.get("/task-projects/")

    assert resp.status_code == 200
    assert resp.json()[0]["progress_percent"] == 50
