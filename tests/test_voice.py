import pytest
from fastapi.testclient import TestClient
from backend.main import app
import base64

client = TestClient(app)

def test_transcribe():
    # Mock audio (base64-encoded "test")
    audio = base64.b64encode(b"test").decode("utf-8")
    response = client.post("/voice/transcribe", json={"audio": audio, "language": "en"})
    assert response.status_code == 200
    assert "text" in response.json()

def test_synthesize():
    response = client.post("/voice/synthesize", json={"text": "Hello, Victor.", "language": "en"})
    assert response.status_code == 200
    assert "audio" in response.json()

def test_chat():
    response = client.post("/voice/chat", json={"prompt": "Hello, Marcus."})
    assert response.status_code == 200
    assert "response" in response.json()
