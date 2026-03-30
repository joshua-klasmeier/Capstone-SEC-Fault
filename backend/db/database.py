import os
import ssl
from urllib.parse import parse_qs, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# asyncpg doesn't understand query params like sslmode; strip query params and
# translate sslmode into asyncpg connect_args when explicitly provided.
if DATABASE_URL:
    parsed = urlsplit(DATABASE_URL)
    query = parse_qs(parsed.query)
    sslmode = (query.get("sslmode", [""])[0] or "").lower()

    clean_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
    connect_args = {}
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = ssl.create_default_context()

    engine = create_async_engine(clean_url, echo=True, connect_args=connect_args)
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
