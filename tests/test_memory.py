import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_create_memory():
    response = client.post("/memory/", json={
        "content": "Test memory",
        "layer": "layer3",
        "source": "voice",
        "provenance": "test",
    })
    assert response.status_code == 200
    assert "memory" in response.json()

def test_list_memories():
    response = client.get("/memory/")
    assert response.status_code == 200
    assert "memories" in response.json()

def test_search_memory():
    response = client.get("/memory/search?query=test")
    assert response.status_code == 200
    assert "memories" in response.json()
