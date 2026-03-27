from __future__ import annotations

import logging

from ingestion.fetcher import (
    download_filing_html,
    get_cik_from_ticker,
    get_recent_filings,
)
from ingestion.parser import extract_sections, get_filing_metadata
from ingestion.chunker import chunk_all_sections
from ingestion.embedder import embed_texts, embed_query
from ingestion.store import (
    save_filing_to_postgres,
    save_chunks_to_qdrant,
    search_similar_chunks,
    get_filings_for_ticker,
)

logger = logging.getLogger(__name__)


async def ingest_filing(
    ticker: str,
    form_type: str = "10-K",
    db_session=None,
) -> dict:
    """Orchestrate the full SEC filing ingestion pipeline."""

    # Step 1 — Resolve CIK
    try:
        cik = await get_cik_from_ticker(ticker)
    except ValueError:
        return {"status": "error", "message": f"Ticker {ticker} not found"}

    # Step 2 — Get latest filing
    filings = await get_recent_filings(ticker, form_type, limit=1)
    if not filings:
        return {
            "status": "error",
            "message": f"No {form_type} filings found for {ticker}",
        }
    filing = filings[0]

    # Step 3 — Check for duplicate
    if db_session is not None:
        from sqlalchemy import select
        from db.models import Filing

        result = await db_session.execute(
            select(Filing).where(
                Filing.accession_number == filing["accession_number"]
            )
        )
        existing = result.scalars().first()
        if existing:
            return {
                "status": "already_exists",
                "ticker": ticker,
                "accession_number": filing["accession_number"],
            }

    # Step 4 — Download HTML
    try:
        raw_html = await download_filing_html(filing["primary_document_url"])
    except Exception as exc:
        logger.error("Failed to download filing: %s", exc)
        return {"status": "error", "message": "Failed to download filing"}

    # Step 5 — Extract metadata and sections
    metadata = get_filing_metadata(raw_html)
    sections = extract_sections(raw_html)
    if not sections:
        return {
            "status": "error",
            "message": "No sections extracted from filing",
        }

    # Step 6 — Chunk sections
    chunks = chunk_all_sections(
        sections=sections,
        ticker=ticker,
        form_type=form_type,
        filed_date=filing["filed_date"],
        accession_number=filing["accession_number"],
    )
    if not chunks:
        return {
            "status": "error",
            "message": "No chunks produced from sections",
        }

    # Step 7 — Generate embeddings
    try:
        embeddings = embed_texts([chunk["text"] for chunk in chunks])
    except Exception as exc:
        logger.error("Failed to generate embeddings: %s", exc)
        return {
            "status": "error",
            "message": "Failed to generate embeddings",
        }

    # Step 8 — Save to PostgreSQL
    if db_session is not None:
        await save_filing_to_postgres(
            {
                "ticker": ticker,
                "cik": filing["cik"],
                "company_name": metadata.get("company_name", ""),
                "form_type": form_type,
                "accession_number": filing["accession_number"],
                "filed_date": filing["filed_date"],
                "raw_html": raw_html,
            },
            db_session,
        )

    # Step 9 — Save chunks to Qdrant
    try:
        save_chunks_to_qdrant(chunks, embeddings)
        qdrant_status = "success"
    except Exception as exc:
        logger.error("Failed to save chunks to Qdrant: %s", exc)
        qdrant_status = "failed"

    # Step 10 — Return success
    return {
        "status": "success",
        "ticker": ticker,
        "form_type": form_type,
        "accession_number": filing["accession_number"],
        "filed_date": filing["filed_date"],
        "sections_found": list(sections.keys()),
        "chunks_stored": len(chunks),
        "qdrant_indexed": qdrant_status == "success",
    }


async def query_filings(
    query: str,
    ticker: str = None,
    form_type: str = None,
    limit: int = 5,
) -> list[dict]:
    """Embed a query and search Qdrant for similar chunks."""
    if not query:
        raise ValueError("query must not be empty")

    try:
        embedding = embed_query(query)
        return search_similar_chunks(
            query_embedding=embedding,
            ticker=ticker,
            form_type=form_type,
            limit=limit,
        )
    except Exception as exc:
        logger.error("Failed to query Qdrant: %s", exc)
        raise ValueError("Vector database is currently unavailable. Please try again later.")


async def get_ticker_filings(
    ticker: str,
    db_session=None,
) -> list[dict]:
    """Return all ingested filings for a ticker from PostgreSQL."""
    if db_session is None:
        logger.warning("No db_session provided; returning empty list")
        return []
    return await get_filings_for_ticker(ticker, db_session)
