import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ingestion.fetcher import (
    download_filing_html,
    get_cik_from_ticker,
    get_company_info,
    get_recent_filings,
)


@pytest.mark.asyncio
async def test_get_cik_from_ticker():
    result = await get_cik_from_ticker("AAPL")
    assert isinstance(result, str)
    assert result == "0000320193"
    assert len(result) == 10


@pytest.mark.asyncio
async def test_get_cik_invalid_ticker():
    with pytest.raises(ValueError):
        await get_cik_from_ticker("INVALIDTICKER999")


@pytest.mark.asyncio
async def test_get_company_info():
    result = await get_company_info("0000320193")
    assert isinstance(result, dict)
    assert "name" in result
    assert "Apple" in result["name"]


@pytest.mark.asyncio
async def test_get_recent_filings():
    result = await get_recent_filings("AAPL", form_type="10-K", limit=3)
    assert isinstance(result, list)
    assert len(result) >= 1
    assert len(result) <= 3
    first = result[0]
    assert "accession_number" in first
    assert "filed_date" in first
    assert "form_type" in first
    assert first["form_type"] == "10-K"
    assert first["ticker"] == "AAPL"
    assert "-" in first["accession_number"]


@pytest.mark.asyncio
async def test_download_filing_html():
    filings = await get_recent_filings("AAPL", form_type="10-K", limit=1)
    url = filings[0]["primary_document_url"]
    html = await download_filing_html(url)
    assert isinstance(html, str)
    assert len(html) > 1000
    assert "<" in html
