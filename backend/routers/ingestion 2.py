from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.database import get_db
from ingestion import pipeline

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class IngestRequest(BaseModel):
    ticker: str
    form_type: str = "10-K"


class QueryRequest(BaseModel):
    query: str
    ticker: str = None
    form_type: str = None
    limit: int = 5


@router.post("/ingest")
async def ingest(req: IngestRequest, db=Depends(get_db)):
    if not req.ticker.strip():
        raise HTTPException(status_code=400, detail="ticker must not be empty")
    result = await pipeline.ingest_filing(req.ticker, req.form_type, db)
    return result


@router.post("/query")
async def query(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")
    try:
        results = await pipeline.query_filings(
            req.query, req.ticker, req.form_type, req.limit
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return results


@router.get("/filings/{ticker}")
async def filings_for_ticker(ticker: str, db=Depends(get_db)):
    if not ticker.strip():
        raise HTTPException(status_code=400, detail="ticker must not be empty")
    return await pipeline.get_ticker_filings(ticker, db)
