import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

import pytest

# Ensure models are imported so Base.metadata is populated.
import db.models  # noqa: F401
from db.database import Base

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")


@pytest.fixture(scope="session", autouse=True)
def init_database():
    """Create all tables once before the test session using a throwaway engine."""
    loop = asyncio.new_event_loop()

    async def _create_tables():
        eng = create_async_engine(DATABASE_URL)
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await eng.dispose()

    loop.run_until_complete(_create_tables())
    loop.close()
