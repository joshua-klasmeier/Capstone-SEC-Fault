import os
import ssl
from urllib.parse import parse_qs, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy import text
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
    """Create tables and apply lightweight compatibility patches."""
    if engine is None:
        return

    import db.models  # noqa: F401 — ensure all models are registered on Base.metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Compatibility patch for existing environments where users table was
        # created before response_complexity existed. This avoids runtime
        # failures when ORM selects include the new column.
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS response_complexity VARCHAR")
        )
        await conn.execute(
            text(
                "UPDATE users SET response_complexity = 'beginner' "
                "WHERE response_complexity IS NULL"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE users "
                "ALTER COLUMN response_complexity SET DEFAULT 'beginner'"
            )
        )
        # user_google_tokens is a newer table; ensure it exists for
        # environments that were provisioned before the YouTube upload feature.
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS user_google_tokens (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_expiry TIMESTAMPTZ,
                    scope TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
