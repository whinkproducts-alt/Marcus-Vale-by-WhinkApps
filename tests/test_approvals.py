import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base, engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
import os

# Test setup
@pytest.fixture
def test_db():
    # Use in-memory SQLite for testing
    async def get_test_db():
        async with AsyncSession(engine) as session:
            yield session
    
    app.dependency_overrides[get_db] = get_test_db
    yield
    app.dependency_overrides.clear()

client = TestClient(app)

def test_create_approval(test_db):
    response = client.post("/approvals/", json={
        "task_id": "123e4567-e89b-12d3-a456-426614174000",
        "content_hash": "abc123",
        "method": "voice",
    })
    assert response.status_code == 200
    assert "approval" in response.json()

def test_approve_task(test_db):
    # Create a task first
    response = client.post("/tasks/", json={
        "title": "Test Task",
        "goal": "Test Goal",
        "lane": "lane1",
    })
    assert response.status_code == 200
    task_id = response.json()["task"]["id"]
    
    # Approve the task
    response = client.post(f"/tasks/{task_id}/approve", json={"method": "voice"})
    assert response.status_code == 200
    assert "approval" in response.json()
