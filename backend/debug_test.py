
import asyncio
from httpx import AsyncClient
from main import app
from database import get_db, Base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        async def override_get_db():
            yield session
        app.dependency_overrides[get_db] = override_get_db
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            res = await ac.post("/tasks/", json={"title": "T1", "goal": "G1"})
            print("Status:", res.status_code)
            print("Response:", res.json())
        
        app.dependency_overrides.clear()
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

asyncio.run(test())

