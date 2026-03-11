import os
import sys

import pytest

# Ensure the backend package root is on sys.path so "db" is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_models_importable():
    """All four ORM model classes can be imported and have __tablename__."""
    from db.models import Conversation, Filing, Message, User

    for model in (User, Conversation, Message, Filing):
        assert model is not None
        assert hasattr(model, "__tablename__")


def test_user_model_columns():
    """A User instance stores email and name; id is None before persisting."""
    from db.models import User

    user = User(email="test@test.com", name="Test User")
    assert user.email == "test@test.com"
    assert user.name == "Test User"
    assert user.id is None


def test_filing_model_columns():
    """A Filing instance stores ticker, cik, form_type, and accession_number."""
    from db.models import Filing

    filing = Filing(
        ticker="AAPL",
        cik="0000320193",
        form_type="10-K",
        accession_number="0000320193-24-000123",
    )
    assert filing.ticker == "AAPL"
    assert filing.cik == "0000320193"
    assert filing.form_type == "10-K"
    assert filing.accession_number == "0000320193-24-000123"


def test_database_url_loaded():
    """DATABASE_URL is present in the environment and points to PostgreSQL."""
    from dotenv import load_dotenv

    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    assert database_url is not None, "DATABASE_URL is not set in .env"
    assert "postgresql" in database_url


@pytest.mark.asyncio
async def test_async_engine_creation():
    """An async SQLAlchemy engine can be created from DATABASE_URL."""
    from dotenv import load_dotenv
    from sqlalchemy.ext.asyncio import create_async_engine

    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    engine = create_async_engine(database_url)
    assert engine is not None
    await engine.dispose()
