import os
import ssl

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# asyncpg doesn't understand query params like sslmode; strip them all and pass ssl via connect_args
if DATABASE_URL:
    clean_url = DATABASE_URL.split("?")[0]
    ssl_ctx = ssl.create_default_context()
    engine = create_async_engine(clean_url, echo=True, connect_args={"ssl": ssl_ctx})
else:
    engine = None

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
) if engine else None

Base = declarative_base()


async def get_db():
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables defined on Base.metadata."""
    import db.models  # noqa: F401 — ensure all models are registered on Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
