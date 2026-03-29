from __future__ import annotations

import os
import uuid
from datetime import date

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
from qdrant_client import models
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

_VECTOR_SIZE = 3072


def _ensure_qdrant_payload_indexes(
    client: QdrantClient, collection_name: str
) -> None:
    """Ensure payload indexes exist for fields used in query filters."""
    for field_name in ("ticker", "form_type"):
        client.create_payload_index(
            collection_name=collection_name,
            field_name=field_name,
            field_schema=models.PayloadSchemaType.KEYWORD,
        )


def get_qdrant_client() -> QdrantClient:
    """Create and return a QdrantClient."""
    kwargs = {"url": QDRANT_URL}
    if QDRANT_API_KEY:
        kwargs["api_key"] = QDRANT_API_KEY
    return QdrantClient(**kwargs)


def ensure_qdrant_collection(collection_name: str = "sec_filings") -> None:
    """Create the Qdrant collection and filter indexes if needed."""
    client = get_qdrant_client()
    if not client.collection_exists(collection_name):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=_VECTOR_SIZE,
                distance=Distance.COSINE,
            ),
        )
    _ensure_qdrant_payload_indexes(client, collection_name)


async def save_filing_to_postgres(
    filing_data: dict,
    db_session: AsyncSession,
) -> str:
    """Insert a Filing row if it does not exist; return the filing id."""
    from db.models import Filing

    accession = filing_data["accession_number"]
    result = await db_session.execute(
        select(Filing).where(Filing.accession_number == accession)
    )
    existing = result.scalars().first()
    if existing:
        return str(existing.id)

    raw_date = filing_data.get("filed_date")
    if isinstance(raw_date, str):
        raw_date = date.fromisoformat(raw_date)

    filing = Filing(
        ticker=filing_data["ticker"],
        cik=filing_data["cik"],
        company_name=filing_data.get("company_name"),
        form_type=filing_data["form_type"],
        accession_number=accession,
        filed_date=raw_date,
        raw_html=filing_data.get("raw_html"),
    )
    db_session.add(filing)
    await db_session.commit()
    await db_session.refresh(filing)
    return str(filing.id)


def save_chunks_to_qdrant(
    chunks: list[dict],
    embeddings: list[list[float]],
    collection_name: str = "sec_filings",
) -> None:
    """Upsert chunk embeddings into Qdrant."""
    ensure_qdrant_collection(collection_name)
    client = get_qdrant_client()

    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point_id = str(
            uuid.uuid5(
                uuid.NAMESPACE_DNS,
                chunk["accession_number"] + str(chunk["chunk_index"]),
            )
        )
        points.append(
            PointStruct(id=point_id, vector=embedding, payload=chunk)
        )

    client.upsert(collection_name=collection_name, points=points)


def search_similar_chunks(
    query_embedding: list[float],
    ticker: str = None,
    form_type: str = None,
    limit: int = 5,
    collection_name: str = "sec_filings",
) -> list[dict]:
    """Search Qdrant for chunks similar to query_embedding."""
    ensure_qdrant_collection(collection_name)
    client = get_qdrant_client()

    must_conditions = []
    if ticker:
        must_conditions.append(
            models.FieldCondition(
                key="ticker", match=models.MatchValue(value=ticker)
            )
        )
    if form_type:
        must_conditions.append(
            models.FieldCondition(
                key="form_type", match=models.MatchValue(value=form_type)
            )
        )

    query_filter = (
        models.Filter(must=must_conditions) if must_conditions else None
    )

    result = client.query_points(
        collection_name=collection_name,
        query=query_embedding,
        limit=limit,
        query_filter=query_filter,
    )
    return [point.payload for point in result.points]


async def get_filings_for_ticker(
    ticker: str,
    db_session: AsyncSession,
) -> list[dict]:
    """Return all filings for a ticker, ordered by filed_date descending."""
    from db.models import Filing

    result = await db_session.execute(
        select(Filing)
        .where(Filing.ticker == ticker)
        .order_by(Filing.filed_date.desc())
    )
    filings = result.scalars().all()
    return [
        {
            "id": str(f.id),
            "ticker": f.ticker,
            "cik": f.cik,
            "company_name": f.company_name,
            "form_type": f.form_type,
            "accession_number": f.accession_number,
            "filed_date": str(f.filed_date) if f.filed_date else None,
            "created_at": str(f.created_at) if f.created_at else None,
        }
        for f in filings
    ]
