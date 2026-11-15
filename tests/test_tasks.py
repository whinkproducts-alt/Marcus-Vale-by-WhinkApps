import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_create_task():
    response = client.post("/tasks/", json={
        "title": "Test Task",
        "goal": "Test Goal",
        "lane": "lane1",
    })
    assert response.status_code == 200
    assert "task" in response.json()

def test_list_tasks():
    response = client.get("/tasks/")
    assert response.status_code == 200
    assert "tasks" in response.json()
