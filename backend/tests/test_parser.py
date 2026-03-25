import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ingestion.fetcher import download_filing_html, get_recent_filings
from ingestion.parser import (
    clean_html,
    extract_sections,
    extract_tables_as_text,
    get_filing_metadata,
)

# ---------------------------------------------------------------------------
# Module-level cache: download the AAPL 10-K only once per test session.
# ---------------------------------------------------------------------------
_cached_html = None


def get_sample_html():
    global _cached_html
    if _cached_html is None:

        async def _fetch():
            filings = await get_recent_filings("AAPL", "10-K", limit=1)
            return await download_filing_html(filings[0]["primary_document_url"])

        _cached_html = asyncio.run(_fetch())
    return _cached_html


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_clean_html_removes_scripts():
    html = """
    <html><body>
        <script>var x = 'javascript code';</script>
        <style>.hidden { display: none; }</style>
        <p>Important filing text here</p>
    </body></html>
    """
    result = clean_html(html)
    assert "javascript" not in result.lower()
    assert "Important filing text here" in result


def test_clean_html_collapses_whitespace():
    html = """
    <html><body>
        <p>Word1     Word2


        Word3</p>
    </body></html>
    """
    result = clean_html(html)
    assert "  " not in result
    assert len(result) > 0


def test_extract_sections_returns_dict():
    html = get_sample_html()
    result = extract_sections(html)
    assert isinstance(result, dict)
    assert len(result) >= 2, f"Expected >=2 sections, got {len(result)}: {list(result.keys())}"
    for key, value in result.items():
        assert isinstance(key, str)
        assert isinstance(value, str)
        assert len(value) > 100


def test_extract_sections_known_sections():
    html = get_sample_html()
    result = extract_sections(html)
    known = {"item_1_business", "item_1a_risk_factors", "item_7_mdna"}
    found = known & set(result.keys())
    assert len(found) >= 1, f"Expected at least one of {known}, got {list(result.keys())}"
    for key in found:
        assert len(result[key]) > 500


def test_extract_sections_max_length():
    html = get_sample_html()
    result = extract_sections(html)
    for value in result.values():
        assert len(value) <= 50000


def test_extract_tables_returns_list():
    html = """
    <html><body>
    <table>
        <tr><th>Col1</th><th>Col2</th><th>Col3</th></tr>
        <tr><td>A</td><td>B</td><td>C</td></tr>
        <tr><td>D</td><td>E</td><td>F</td></tr>
    </table>
    </body></html>
    """
    result = extract_tables_as_text(html)
    assert isinstance(result, list)
    assert len(result) >= 1
    assert "|" in result[0]


def test_get_filing_metadata():
    html = get_sample_html()
    result = get_filing_metadata(html)
    assert isinstance(result, dict)
