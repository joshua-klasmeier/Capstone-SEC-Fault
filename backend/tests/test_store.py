import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from ingestion.store import (
    ensure_qdrant_collection,
    get_filings_for_ticker,
    get_qdrant_client,
    save_chunks_to_qdrant,
    save_filing_to_postgres,
    search_similar_chunks,
)

TEST_TICKER = "AAPL"
TEST_CIK = "0000320193"
TEST_ACCESSION = "0000320193-24-999999"
TEST_COLLECTION = "sec_filings_test"

DATABASE_URL = os.getenv("DATABASE_URL")


def _make_session_factory():
    """Build a fresh engine + session factory on the *current* event loop."""
    eng = create_async_engine(DATABASE_URL)
    return sessionmaker(bind=eng, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Qdrant tests
# ---------------------------------------------------------------------------


def test_qdrant_connection():
    client = get_qdrant_client()
    assert client is not None
    result = client.get_collections()
    assert result is not None


def test_ensure_collection_creates():
    ensure_qdrant_collection(TEST_COLLECTION)
    client = get_qdrant_client()
    assert client.collection_exists(TEST_COLLECTION) is True


def test_ensure_collection_idempotent():
    ensure_qdrant_collection(TEST_COLLECTION)
    ensure_qdrant_collection(TEST_COLLECTION)


def test_save_chunks_to_qdrant():
    chunks = [
        {
            "text": "Apple revenue grew strongly.",
            "ticker": TEST_TICKER,
            "form_type": "10-K",
            "filed_date": "2024-01-01",
            "accession_number": TEST_ACCESSION,
            "section": "item_7_mdna",
            "chunk_index": i,
        }
        for i in range(3)
    ]
    embeddings = [[0.1 + i * 0.001] * 3072 for i in range(3)]
    save_chunks_to_qdrant(chunks, embeddings, TEST_COLLECTION)


def test_search_similar_chunks():
    query_vec = [0.1] * 3072
    result = search_similar_chunks(
        query_embedding=query_vec,
        ticker=TEST_TICKER,
        limit=3,
        collection_name=TEST_COLLECTION,
    )
    assert isinstance(result, list)
    assert len(result) >= 1
    assert result[0]["ticker"] == TEST_TICKER


# ---------------------------------------------------------------------------
# PostgreSQL tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_postgres_connection():
    from sqlalchemy import text as sa_text

    SessionLocal = _make_session_factory()
    async with SessionLocal() as session:
        result = await session.execute(sa_text("SELECT 1"))
        assert result.scalar() == 1


@pytest.mark.asyncio
async def test_save_filing_to_postgres():
    SessionLocal = _make_session_factory()
    async with SessionLocal() as session:
        filing_id = await save_filing_to_postgres(
            {
                "ticker": TEST_TICKER,
                "cik": TEST_CIK,
                "company_name": "Apple Inc.",
                "form_type": "10-K",
                "accession_number": TEST_ACCESSION,
                "filed_date": "2024-01-01",
                "raw_html": "<html>test</html>",
            },
            session,
        )
    assert isinstance(filing_id, str)
    assert len(filing_id) > 0


@pytest.mark.asyncio
async def test_save_filing_duplicate_skips():
    filing_data = {
        "ticker": TEST_TICKER,
        "cik": TEST_CIK,
        "company_name": "Apple Inc.",
        "form_type": "10-K",
        "accession_number": TEST_ACCESSION,
        "filed_date": "2024-01-01",
        "raw_html": "<html>test</html>",
    }
    SessionLocal = _make_session_factory()
    async with SessionLocal() as session:
        id1 = await save_filing_to_postgres(filing_data, session)
    async with SessionLocal() as session:
        id2 = await save_filing_to_postgres(filing_data, session)
    assert id1 == id2


@pytest.mark.asyncio
async def test_get_filings_for_ticker():
    SessionLocal = _make_session_factory()
    async with SessionLocal() as session:
        result = await get_filings_for_ticker(TEST_TICKER, session)
    assert isinstance(result, list)
    assert len(result) >= 1
    assert result[0]["ticker"] == TEST_TICKER
    assert "raw_html" not in result[0]


# ---------------------------------------------------------------------------
# Teardown — clean up the test Qdrant collection
# ---------------------------------------------------------------------------


def pytest_sessionfinish(session, exitstatus):
    client = get_qdrant_client()
    try:
        client.delete_collection(TEST_COLLECTION)
    except Exception:
        pass
