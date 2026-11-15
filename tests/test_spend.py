import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_spend_status():
    response = client.get("/spend/status")
    assert response.status_code == 200
    assert "total_spend" in response.json()
    assert "cap" in response.json()

def test_log_spend():
    response = client.post("/spend/log", json={
        "amount_usd": 5.0,
        "description": "Test spend",
        "category": "money",
    })
    assert response.status_code == 200
    assert "spend" in response.json()

def test_spend_cap_blocked():
    # Log spend up to cap (assuming cap is $20)
    for _ in range(4):  # 4 * $5 = $20 (cap)
        client.post("/spend/log", json={
            "amount_usd": 5.0,
            "description": "Test spend",
            "category": "money",
        })
    
    # Next spend should be blocked
    response = client.post("/spend/log", json={
        "amount_usd": 1.0,
        "description": "Test spend",
        "category": "money",
    })
    assert response.status_code == 400
    assert "Spend cap reached" in response.json()["detail"]
