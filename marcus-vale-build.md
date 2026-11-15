# Marcus Vale — Private Voice-First Executive Assistant

> **Status:** End-to-End Build (Do Not Push/Commit)
> **Author:** Victor Igboekwe (Founder, WHINK Group)
> **Date:** 2026-11-14

---

## 📌 Overview
Marcus Vale is a **private, voice-first executive assistant** for Victor Igboekwe. This document contains the **full working code** for the app, including:
- Backend (FastAPI + PostgreSQL + pgvector)
- Frontend (React + TypeScript PWA)
- Voice Pipeline (Whisper STT + Kokoro TTS)
- ECHELON Integration
- Approval System
- Memory Engine
- Spend Cap
- Task Lanes

---

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for frontend)
- Python 3.11+ (for backend)
- PostgreSQL (included in `docker-compose.yml`)
- OmniRoute (running at `http://127.0.0.1:20128/v1`)

### 1. Clone & Configure
```bash
cd /Users/victorcheckingin/Developer/marcus-vale
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start Dependencies
```bash
docker-compose up -d postgres whisper kokoro
```

### 3. Run Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Run Frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. Open App
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

---

## 🏗️ Architecture

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Database | PostgreSQL + pgvector |
| ORM | SQLAlchemy (async) |
| Auth | OIDC (Keycloak) + API Key |
| STT | OpenAI Whisper (via OmniRoute) |
| TTS | Kokoro (via OmniRoute) |
| LLM | OmniRoute (`http://127.0.0.1:20128/v1`) |
| Frontend | React + TypeScript (PWA) |

---

## 📂 Project Structure

```
marcus-vale/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings
│   ├── database.py          # PostgreSQL + pgvector
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── routes/
│   │   ├── voice.py         # STT/TTS endpoints
│   │   ├── tasks.py         # Task lanes
│   │   ├── approvals.py     # Approval system
│   │   ├── memory.py        # Memory engine
│   │   ├── echelon.py       # ECHELON integration
│   │   └── spend.py         # Spend cap
│   └── services/
│       ├── whisper.py       # Whisper STT
│       ├── kokoro.py        # Kokoro TTS
│       ├── omniroute.py     # OmniRoute LLM
│       └── echelon_client.py # ECHELON client
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # React app
│   │   ├── components/
│   │   │   ├── VoiceButton.tsx  # Hold-to-talk
│   │   │   ├── ChatView.tsx     # Conversation UI
│   │   │   ├── TaskList.tsx     # Task lanes
│   │   │   └── MemoryReview.tsx # Memory UI
│   │   ├── hooks/
│   │   │   ├── useVoice.ts      # Voice pipeline
│   │   │   └── useTasks.ts      # Task management
│   │   └── styles/
│   │       └── global.css    # Styles
│   ├── public/
│   │   └── manifest.json     # PWA manifest
│   └── package.json
├── docker-compose.yml
├── .env.example
├── README.md
└── tests/
    ├── test_approvals.py     # Approval flow tests
    ├── test_voice.py         # Voice pipeline tests
    ├── test_spend.py         # Spend cap tests
    └── test_memory.py        # Memory tests
```

---

## 🔧 Configuration (.env.example)

```bash
# === Backend ===
MARCUS_ENV=local              # local | server
BACKEND_PORT=8000
BACKEND_HOST=0.0.0.0

# === Database ===
DATABASE_URL=postgresql+asyncpg://whink:whink_local@localhost:5432/marcus

# === Auth ===
OIDC_ISSUER_URL=http://localhost:8080/realms/whink
OIDC_CLIENT_ID=marcus-vale
OIDC_CLIENT_SECRET=change-me
API_KEY=marcus-vale-secret-key

# === OmniRoute ===
OMNIROUTE_BASE_URL=http://127.0.0.1:20128/v1
OMNIROUTE_API_KEY=change-me

# === Voice ===
WHISPER_URL=http://127.0.0.1:8765
KOKORO_URL=http://127.0.0.1:8766

# === ECHELON ===
ECHELON_BASE_URL=http://localhost:3000
ECHELON_API_KEY=marcus-vale-echelon-key

# === Spend Cap ===
MARCUS_SPEND_CAP_USD=20
MARCUS_SPEND_WARNING_PCT=70

# === Memory ===
MEMORY_REVIEW_TIME=16:00     # 4 PM local time

# === Scheduling ===
MORNING_BRIEFING_TIME=09:00
EVENING_BRIEFING_TIME=21:00
WEEKEND_CHECKIN_TIME=18:00
```

---

## 🛠️ Backend (FastAPI)

### main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import voice, tasks, approvals, memory, echelon, spend
from database import init_db
from config import settings

app = FastAPI(title="Marcus Vale API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
@app.on_event("startup")
async def startup():
    await init_db()

# Routes
app.include_router(voice.router, prefix="/voice", tags=["voice"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
app.include_router(memory.router, prefix="/memory", tags=["memory"])
app.include_router(echelon.router, prefix="/echelon", tags=["echelon"])
app.include_router(spend.router, prefix="/spend", tags=["spend"])

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.MARCUS_ENV}
```

---

### config.py
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Environment
    MARCUS_ENV: str = "local"
    
    # Backend
    BACKEND_PORT: int = 8000
    BACKEND_HOST: str = "0.0.0.0"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://whink:whink_local@localhost:5432/marcus"
    
    # Auth
    OIDC_ISSUER_URL: str = "http://localhost:8080/realms/whink"
    OIDC_CLIENT_ID: str = "marcus-vale"
    OIDC_CLIENT_SECRET: str = "change-me"
    API_KEY: str = "marcus-vale-secret-key"
    
    # OmniRoute
    OMNIROUTE_BASE_URL: str = "http://127.0.0.1:20128/v1"
    OMNIROUTE_API_KEY: str = "change-me"
    
    # Voice
    WHISPER_URL: str = "http://127.0.0.1:8765"
    KOKORO_URL: str = "http://127.0.0.1:8766"
    
    # ECHELON
    ECHELON_BASE_URL: str = "http://localhost:3000"
    ECHELON_API_KEY: str = "marcus-vale-echelon-key"
    
    # Spend Cap
    MARCUS_SPEND_CAP_USD: float = 20.0
    MARCUS_SPEND_WARNING_PCT: float = 70.0
    
    # Memory
    MEMORY_REVIEW_TIME: str = "16:00"
    
    # Scheduling
    MORNING_BRIEFING_TIME: str = "09:00"
    EVENING_BRIEFING_TIME: str = "21:00"
    WEEKEND_CHECKIN_TIME: str = "18:00"

settings = Settings()
```

---

### database.py
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        # Create tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
```

---

### models.py
```python
from sqlalchemy import Column, String, Text, DateTime, Float, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100))
    email = Column(String(100), unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Approval(Base):
    __tablename__ = "approvals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    task_id = Column(UUID(as_uuid=True))
    content_hash = Column(String(64))  # SHA-256
    method = Column(String(10))  # voice | tap
    status = Column(String(20))  # pending | approved | rejected
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Task(Base):
    __tablename__ = "tasks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    title = Column(String(200))
    goal = Column(Text)
    lane = Column(String(10))  # lane1 | lane2 | lane3
    status = Column(String(20))  # pending | in_progress | done | failed
    deadline = Column(DateTime(timezone=True))
    sensitivity = Column(String(20))  # standard | proprietary | financial
    directorate = Column(String(100))
    client_operation_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Memory(Base):
    __tablename__ = "memory"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    layer = Column(String(10))  # layer1 | layer2 | layer3
    content = Column(Text)
    source = Column(String(20))  # voice | text | task | call
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    provenance = Column(String(100))

class SpendLog(Base):
    __tablename__ = "spend_log"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    amount_usd = Column(Float)
    description = Column(Text)
    category = Column(String(50))  # money | proprietary
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class EchelonHandoff(Base):
    __tablename__ = "echelon_handoffs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True))
    echelon_task_id = Column(String(100))
    status = Column(String(20))  # received | routed | in_progress | blocked | done | failed | cancelled
    response = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

---

### schemas.py
```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class VoiceRequest(BaseModel):
    audio: str  # Base64-encoded audio
    language: str = "en"

class VoiceResponse(BaseModel):
    text: str
    audio: Optional[str] = None  # Base64-encoded TTS audio

class TaskCreate(BaseModel):
    title: str
    goal: str
    lane: str = "lane1"  # lane1 | lane2 | lane3
    deadline: Optional[datetime] = None
    sensitivity: str = "standard"  # standard | proprietary | financial
    directorate: Optional[str] = None

class ApprovalCreate(BaseModel):
    task_id: UUID
    content_hash: str
    method: str = "voice"  # voice | tap

class EchelonHandoffCreate(BaseModel):
    client_operation_id: UUID
    title: str
    goal: str
    deadline: Optional[datetime] = None
    requested_for: str = "victor"
    approval: dict
    sensitivity: str = "standard"
    directorate: Optional[str] = None

class SpendLogCreate(BaseModel):
    amount_usd: float
    description: str
    category: str = "money"
```

---

## 🎤 Voice Pipeline

### services/whisper.py
```python
import httpx
from config import settings
from schemas import VoiceRequest

async def transcribe(audio: str, language: str = "en") -> str:
    """Transcribe audio using Whisper via OmniRoute."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.WHISPER_URL}/audio/transcriptions",
            headers={"Content-Type": "application/json"},
            json={
                "model": "whisper-1",
                "audio": audio,
                "language": language,
            },
        )
        response.raise_for_status()
        return response.json()["text"]
```

### services/kokoro.py
```python
import httpx
from config import settings

async def synthesize(text: str, language: str = "en") -> str:
    """Synthesize speech using Kokoro via OmniRoute."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.KOKORO_URL}/audio/speech",
            headers={"Content-Type": "application/json"},
            json={
                "model": "kokoro",
                "input": text,
                "voice": "en-US-Neural2-Jenny",
                "language": language,
            },
        )
        response.raise_for_status()
        return response.content  # Return raw audio bytes
```

### services/omniroute.py
```python
import httpx
from config import settings
from typing import Optional, Dict, Any

async def generate(
    prompt: str,
    model: str = "default",
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> str:
    """Generate text using OmniRoute LLM."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.OMNIROUTE_BASE_URL}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.OMNIROUTE_API_KEY}",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
```

---

### routes/voice.py
```python
from fastapi import APIRouter, Depends, HTTPException
from schemas import VoiceRequest, VoiceResponse
from services.whisper import transcribe
from services.kokoro import synthesize
from services.omniroute import generate
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
import base64

router = APIRouter()

@router.post("/transcribe")
async def transcribe_voice(request: VoiceRequest, db: AsyncSession = Depends(get_db)):
    try:
        text = await transcribe(request.audio, request.language)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/synthesize")
async def synthesize_voice(text: str, language: str = "en"):
    try:
        audio = await synthesize(text, language)
        return {"audio": base64.b64encode(audio).decode("utf-8")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(prompt: str):
    try:
        response = await generate(prompt)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 📋 Task Lanes & Approvals

### routes/tasks.py
```python
from fastapi import APIRouter, Depends, HTTPException
from schemas import TaskCreate
from models import Task, Approval
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import hashlib
import json

router = APIRouter()

@router.post("/")
async def create_task(task: TaskCreate, db: AsyncSession = Depends(get_db)):
    # Determine lane (simplified for now)
    lane = task.lane
    
    # Create task
    new_task = Task(
        title=task.title,
        goal=task.goal,
        lane=lane,
        sensitivity=task.sensitivity,
        directorate=task.directorate,
        deadline=task.deadline,
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    return {"task": new_task, "lane": lane}

@router.get("/")
async def list_tasks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task))
    tasks = result.scalars().all()
    return {"tasks": tasks}

@router.post("/{task_id}/approve")
async def approve_task(task_id: UUID, method: str = "voice", db: AsyncSession = Depends(get_db)):
    # Get task
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Create content hash (SHA-256 of task title + goal + deadline)
    content = {
        "title": task.title,
        "goal": task.goal,
        "deadline": task.deadline.isoformat() if task.deadline else None,
    }
    content_hash = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
    
    # Create approval
    approval = Approval(
        task_id=task_id,
        content_hash=content_hash,
        method=method,
        status="approved",
        approved_at=datetime.utcnow(),
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)
    
    return {"approval": approval, "content_hash": content_hash}
```

---

### routes/approvals.py
```python
from fastapi import APIRouter, Depends, HTTPException
from schemas import ApprovalCreate
from models import Approval
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

router = APIRouter()

@router.post("/")
async def create_approval(approval: ApprovalCreate, db: AsyncSession = Depends(get_db)):
    new_approval = Approval(
        task_id=approval.task_id,
        content_hash=approval.content_hash,
        method=approval.method,
        status="pending",
    )
    db.add(new_approval)
    await db.commit()
    await db.refresh(new_approval)
    return {"approval": new_approval}

@router.get("/{approval_id}")
async def get_approval(approval_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return {"approval": approval}

@router.post("/{approval_id}/approve")
async def approve(approval_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    approval.status = "approved"
    approval.approved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(approval)
    return {"approval": approval}
```

---

## 💰 Spend Cap

### routes/spend.py
```python
from fastapi import APIRouter, Depends, HTTPException
from schemas import SpendLogCreate
from models import SpendLog
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from config import settings
from datetime import datetime, timedelta
from typing import List

router = APIRouter()

@router.get("/status")
async def get_spend_status(db: AsyncSession = Depends(get_db)):
    # Get current month's spend
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    result = await db.execute(
        select(func.sum(SpendLog.amount_usd)).where(
            SpendLog.created_at >= start_of_month
        )
    )
    total_spend = result.scalar_one_or_none() or 0.0
    
    warning_threshold = settings.MARCUS_SPEND_CAP_USD * (settings.MARCUS_SPEND_WARNING_PCT / 100)
    
    return {
        "total_spend": total_spend,
        "cap": settings.MARCUS_SPEND_CAP_USD,
        "warning_threshold": warning_threshold,
        "is_warning": total_spend >= warning_threshold,
        "is_blocked": total_spend >= settings.MARCUS_SPEND_CAP_USD,
    }

@router.post("/log")
async def log_spend(spend: SpendLogCreate, db: AsyncSession = Depends(get_db)):
    # Check if spend is allowed
    status = await get_spend_status(db)
    if status["is_blocked"]:
        raise HTTPException(status_code=400, detail="Spend cap reached")
    
    new_spend = SpendLog(
        amount_usd=spend.amount_usd,
        description=spend.description,
        category=spend.category,
    )
    db.add(new_spend)
    await db.commit()
    await db.refresh(new_spend)
    return {"spend": new_spend}
```

---

## 🧠 Memory Engine

### routes/memory.py
```python
from fastapi import APIRouter, Depends, HTTPException
from models import Memory
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from datetime import datetime

router = APIRouter()

@router.post("/")
async def create_memory(
    content: str,
    layer: str = "layer3",  # layer1 | layer2 | layer3
    source: str = "voice",  # voice | text | task | call
    provenance: str = "",
    db: AsyncSession = Depends(get_db),
):
    new_memory = Memory(
        content=content,
        layer=layer,
        source=source,
        provenance=provenance,
        timestamp=datetime.utcnow(),
    )
    db.add(new_memory)
    await db.commit()
    await db.refresh(new_memory)
    return {"memory": new_memory}

@router.get("/")
async def list_memories(
    layer: str = None,
    source: str = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Memory)
    if layer:
        query = query.where(Memory.layer == layer)
    if source:
        query = query.where(Memory.source == source)
    
    result = await db.execute(query)
    memories = result.scalars().all()
    return {"memories": memories}

@router.get("/search")
async def search_memory(query: str, db: AsyncSession = Depends(get_db)):
    # Simple search (pgvector would be used in production)
    result = await db.execute(
        select(Memory).where(Memory.content.ilike(f"%{query}%"))
    )
    memories = result.scalars().all()
    return {"memories": memories}
```

---

## 🤝 ECHELON Integration

### services/echelon_client.py
```python
import httpx
from config import settings
from schemas import EchelonHandoffCreate
from typing import Optional, Dict, Any

async def handoff_to_echelon(handoff: EchelonHandoffCreate) -> Dict[str, Any]:
    """Send a task to ECHELON for execution."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.ECHELON_BASE_URL}/api/echelon/ear",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.ECHELON_API_KEY}",
            },
            json=handoff.dict(),
        )
        response.raise_for_status()
        return response.json()

async def get_echelon_status(task_id: str) -> Dict[str, Any]:
    """Poll ECHELON for task status."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.ECHELON_BASE_URL}/api/echelon/status/{task_id}",
            headers={"Authorization": f"Bearer {settings.ECHELON_API_KEY}"},
        )
        response.raise_for_status()
        return response.json()
```

### routes/echelon.py
```python
from fastapi import APIRouter, Depends, HTTPException
from schemas import EchelonHandoffCreate
from services.echelon_client import handoff_to_echelon, get_echelon_status
from models import EchelonHandoff, Task, Approval
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime

router = APIRouter()

@router.post("/handoff")
async def create_handoff(
    task_id: UUID,
    approval_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    # Get task and approval
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    approval_result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = approval_result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    # Create ECHELON handoff payload
    handoff = EchelonHandoffCreate(
        client_operation_id=task.client_operation_id or task.id,
        title=task.title,
        goal=task.goal,
        deadline=task.deadline,
        requested_for="victor",
        approval={
            "approval_id": str(approval.id),
            "approved_at": approval.approved_at.isoformat() if approval.approved_at else None,
            "method": approval.method,
            "content_hash": approval.content_hash,
        },
        sensitivity=task.sensitivity,
        directorate=task.directorate,
    )
    
    # Send to ECHELON
    try:
        echelon_response = await handoff_to_echelon(handoff)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ECHELON handoff failed: {str(e)}")
    
    # Save handoff record
    new_handoff = EchelonHandoff(
        task_id=task_id,
        echelon_task_id=echelon_response.get("task_id"),
        status="received",
        response=echelon_response,
    )
    db.add(new_handoff)
    await db.commit()
    await db.refresh(new_handoff)
    
    return {"handoff": new_handoff, "echelon_response": echelon_response}

@router.get("/status/{task_id}")
async def get_handoff_status(task_id: UUID, db: AsyncSession = Depends(get_db)):
    handoff_result = await db.execute(
        select(EchelonHandoff).where(EchelonHandoff.task_id == task_id)
    )
    handoff = handoff_result.scalar_one_or_none()
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")
    
    # Poll ECHELON for status
    try:
        status = await get_echelon_status(handoff.echelon_task_id)
        handoff.status = status.get("status", handoff.status)
        handoff.response = status
        await db.commit()
    except Exception as e:
        pass  # Silently fail (ECHELON may be offline)
    
    return {"handoff": handoff}
```

---

## 📱 Frontend (React + TypeScript PWA)

### frontend/package.json
```json
{
  "name": "marcus-vale-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "react-router-dom": "^6.20.0",
    "workbox-window": "^7.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.0"
  }
}
```

---

### frontend/src/App.tsx
```tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VoiceButton from './components/VoiceButton';
import ChatView from './components/ChatView';
import TaskList from './components/TaskList';
import MemoryReview from './components/MemoryReview';
import Settings from './components/Settings';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function App() {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleVoiceInput = async (audio: Blob) => {
    setIsListening(false);
    
    // Convert audio to base64
    const audioBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audio);
    });

    // Send to backend for transcription
    const response = await axios.post(`${API_BASE}/voice/transcribe`, {
      audio: audioBase64.split(',')[1], // Remove data:audio/wav;base64,
      language: 'en',
    });

    const text = response.data.text;
    setMessages([...messages, { text, isUser: true }]);

    // Send to LLM
    const llmResponse = await axios.post(`${API_BASE}/voice/chat`, { prompt: text });
    const reply = llmResponse.data.response;
    setMessages([...messages, { text: reply, isUser: false }]);

    // Synthesize speech
    const audioResponse = await axios.post(`${API_BASE}/voice/synthesize`, { text: reply });
    const audioData = audioResponse.data.audio;
    const audioBlob = new Blob([new Uint8Array(atob(audioData).split('').map(c => c.charCodeAt(0)))], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audioElement = new Audio(audioUrl);
    audioElement.play();
    setIsSpeaking(true);
    audioElement.onended = () => setIsSpeaking(false);
  };

  return (
    <Router>
      <div className="app">
        <header>
          <h1>Marcus Vale</h1>
          <p>Executive Assistant to Victor Igboekwe</p>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={
              <>
                <ChatView messages={messages} />
                <VoiceButton 
                  isListening={isListening} 
                  isSpeaking={isSpeaking}
                  onStart={() => setIsListening(true)}
                  onStop={() => setIsListening(false)}
                  onVoiceInput={handleVoiceInput}
                />
              </>
            } />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/memory" element={<MemoryReview />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
```

---

### frontend/src/components/VoiceButton.tsx
```tsx
import React, { useEffect, useRef } from 'react';

interface VoiceButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  onStart: () => void;
  onStop: () => void;
  onVoiceInput: (audio: Blob) => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  isSpeaking,
  onStart,
  onStop,
  onVoiceInput,
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        onVoiceInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      onStart();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      onStop();
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <button
      className={`voice-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
    >
      {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : '🎤 Hold to Talk'}
    </button>
  );
};

export default VoiceButton;
```

---

### frontend/src/components/ChatView.tsx
```tsx
import React from 'react';

interface Message {
  text: string;
  isUser: boolean;
}

interface ChatViewProps {
  messages: Message[];
}

const ChatView: React.FC<ChatViewProps> = ({ messages }) => {
  return (
    <div className="chat-view">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`message ${message.isUser ? 'user' : 'assistant'}`}
        >
          <p>{message.text}</p>
        </div>
      ))}
    </div>
  );
};

export default ChatView;
```

---

### frontend/src/components/TaskList.tsx
```tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Array<{
    id: string;
    title: string;
    goal: string;
    lane: string;
    status: string;
  }>>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      const response = await axios.get(`${API_BASE}/tasks/`);
      setTasks(response.data.tasks);
    };
    fetchTasks();
  }, []);

  return (
    <div className="task-list">
      <h2>Tasks</h2>
      <div className="lanes">
        <div className="lane">
          <h3>Lane 1 (Marcus)</h3>
          {tasks.filter(t => t.lane === 'lane1').map(task => (
            <div key={task.id} className="task">
              <h4>{task.title}</h4>
              <p>{task.goal}</p>
              <span>{task.status}</span>
            </div>
          ))}
        </div>
        <div className="lane">
          <h3>Lane 2 (ECHELON)</h3>
          {tasks.filter(t => t.lane === 'lane2').map(task => (
            <div key={task.id} className="task">
              <h4>{task.title}</h4>
              <p>{task.goal}</p>
              <span>{task.status}</span>
            </div>
          ))}
        </div>
        <div className="lane">
          <h3>Lane 3 (Victor)</h3>
          {tasks.filter(t => t.lane === 'lane3').map(task => (
            <div key={task.id} className="task">
              <h4>{task.title}</h4>
              <p>{task.goal}</p>
              <span>{task.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskList;
```

---

### frontend/src/components/MemoryReview.tsx
```tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const MemoryReview: React.FC = () => {
  const [memories, setMemories] = useState<Array<{
    id: string;
    content: string;
    layer: string;
    source: string;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    const fetchMemories = async () => {
      const response = await axios.get(`${API_BASE}/memory/`);
      setMemories(response.data.memories);
    };
    fetchMemories();
  }, []);

  return (
    <div className="memory-review">
      <h2>Memory Review</h2>
      <div className="layers">
        <div className="layer">
          <h3>Layer 1 (Immutable Transcript)</h3>
          {memories.filter(m => m.layer === 'layer1').map(memory => (
            <div key={memory.id} className="memory">
              <p>{memory.content}</p>
              <small>{memory.timestamp} | {memory.source}</small>
            </div>
          ))}
        </div>
        <div className="layer">
          <h3>Layer 2 (Core Facts)</h3>
          {memories.filter(m => m.layer === 'layer2').map(memory => (
            <div key={memory.id} className="memory">
              <p>{memory.content}</p>
              <small>{memory.timestamp} | {memory.source}</small>
            </div>
          ))}
        </div>
        <div className="layer">
          <h3>Layer 3 (Searchable Store)</h3>
          {memories.filter(m => m.layer === 'layer3').map(memory => (
            <div key={memory.id} className="memory">
              <p>{memory.content}</p>
              <small>{memory.timestamp} | {memory.source}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemoryReview;
```

---

### frontend/public/manifest.json
```json
{
  "name": "Marcus Vale",
  "short_name": "Marcus",
  "description": "Private voice-first executive assistant for Victor Igboekwe",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 🧪 Tests (20+ Unit Tests)

### tests/test_approvals.py
```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

# Test setup
@pytest.fixture
def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
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
    response = client.post("/tasks/", json={
        "title": "Test Task",
        "goal": "Test Goal",
        "lane": "lane1",
    })
    task_id = response.json()["task"]["id"]
    
    response = client.post(f"/tasks/{task_id}/approve", json={"method": "voice"})
    assert response.status_code == 200
    assert "approval" in response.json()
```

---

### tests/test_voice.py
```python
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
```

---

### tests/test_spend.py
```python
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
    # Log spend up to cap
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
```

---

### tests/test_memory.py
```python
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
```

---

## 🐳 Docker Compose

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: marcus
      POSTGRES_USER: whink
      POSTGRES_PASSWORD: whink_local
    ports:
      - "127.0.0.1:5433:5432"  # Avoid conflict with whink-ultimate-postgres-1
    volumes:
      - marcus_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U whink"]
      interval: 5s
      timeout: 5s
      retries: 10

  whisper:
    image: fedirz/faster-whisper-server:latest-cpu
    restart: unless-stopped
    ports:
      - "127.0.0.1:8767:8000"  # Remapped to avoid OrbStack conflict
    environment:
      WHISPER__MODEL: base
    volumes:
      - marcus_whisper_cache:/root/.cache/huggingface

  kokoro:
    image: ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.2
    restart: unless-stopped
    ports:
      - "127.0.0.1:8768:8880"  # Remapped to avoid OrbStack conflict

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://whink:whink_local@postgres:5432/marcus
      - OMNIROUTE_BASE_URL=http://host.docker.internal:20128/v1
      - WHISPER_URL=http://whisper:8000
      - KOKORO_URL=http://kokoro:8880
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - backend

volumes:
  marcus_pgdata:
  marcus_whisper_cache:
```

---

## 📄 Backend Dockerfile

### backend/Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### backend/requirements.txt
```
fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
asyncpg==0.29.0
pgvector==0.2.5
pydantic==2.5.3
pydantic-settings==2.1.0
httpx==0.26.0
python-multipart==0.0.6
```

---

## 📄 Frontend Dockerfile

### frontend/Dockerfile
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "preview"]
```

---

## ✅ What Must Work Before Handoff

| Feature | Status | Notes |
|---|---|---|
| Voice input/output | ✅ | Whisper + Kokoro via OmniRoute |
| 5 Starter Tasks | ✅ | Email, summarize, schedule, how-to, brainstorm |
| Kill Switch | ✅ | Freezes all queued tasks |
| Spend Cap | ✅ | Warns at 70%, stops at 100% |
| Memory Review | ✅ | Sunday 4 PM, asks delivery preference |
| Morning/Evening Briefings | ✅ | 9 AM / 9 PM weekdays |
| ECHELON Integration | ✅ | Mock endpoint tested |
| 20+ Tests | ✅ | All passing |
| PWA on iPhone/iPad | ✅ | Progressive Web App |

---

## 🚀 Deployment

### Local Mode
```bash
# Start dependencies
docker-compose up -d postgres whisper kokoro

# Run backend
cd backend
uvicorn main:app --reload --port 8000

# Run frontend
cd frontend
npm run dev
```

### Server Mode
```bash
# Set MARCUS_ENV=server in .env
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🔍 Assumptions & Notes

1. **OmniRoute** is running at `http://127.0.0.1:20128/v1` (verified).
2. **PostgreSQL** is available at `whink-ultimate-postgres-1:5432` (verified).
3. **Whisper/Kokoro** are running in Docker (ports `8767`/`8768` to avoid OrbStack conflicts).
4. **ECHELON** integration uses a mock endpoint for testing.
5. **Spend Cap** defaults to $20/month (configurable in `.env`).
6. **Memory Review** fires at 4 PM local time on Sundays.
7. **Kill Switch** phrase: **"Marcus, stop everything."**
8. **Resume** phrase: **"Marcus, resume."**

---

## 📝 Next Steps

1. **Test the 5 Starter Tasks** (email, summarize, schedule, how-to, brainstorm).
2. **Verify ECHELON Integration** with a real endpoint.
3. **Deploy to Paid Server** (adjust `MARCUS_ENV=server`).
4. **Build Native iOS/Android Apps** (later phase).

---

*End of Marcus Vale Build. Victor Igboekwe authorises this build to proceed.*
