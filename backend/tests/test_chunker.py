import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ingestion.chunker import (
    chunk_all_sections,
    chunk_section,
    chunk_text,
    get_chunk_stats,
)

# ---------------------------------------------------------------------------
# Shared sample data
# ---------------------------------------------------------------------------

SAMPLE_SECTIONS = {
    "item_1_business": (
        "Apple Inc. designs, manufactures, and markets smartphones, "
        "personal computers, tablets, wearables, and accessories worldwide. "
        "The Company also sells various related services. " * 50
    ),
    "item_1a_risk_factors": (
        "The Company faces substantial risks related to global operations. "
        "Economic downturns, supply chain disruptions, and regulatory changes "
        "could materially affect our business results and financial condition. " * 40
    ),
    "item_7_mdna": (
        "Net sales increased 8 percent or 31 billion dollars during fiscal 2024 "
        "compared to fiscal 2023. Services revenue reached an all-time high "
        "driven by growth across all services categories globally. " * 45
    ),
}

SAMPLE_TICKER = "AAPL"
SAMPLE_FORM = "10-K"
SAMPLE_DATE = "2024-11-01"
SAMPLE_ACCESSION = "0000320193-24-000123"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_chunk_text_basic():
    text = "This is a sample sentence for testing purposes. " * 60  # ~3000 chars
    result = chunk_text(text, chunk_size=1000, overlap=200)
    assert isinstance(result, list)
    assert len(result) >= 2
    for chunk in result:
        assert isinstance(chunk, str)
        assert len(chunk) > 50


def test_chunk_text_overlap():
    text = "Sentence number one is here. " * 100
    result = chunk_text(text, chunk_size=500, overlap=100)
    assert len(result) >= 2
    tail_of_first = result[0][-80:]
    assert tail_of_first in result[1], "Overlap content not found in next chunk"


def test_chunk_text_short_input():
    short = "This is a short text that is under chunk size but over fifty characters long."
    result = chunk_text(short, chunk_size=1000, overlap=200)
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0] == short.strip()


def test_chunk_text_empty_input():
    result = chunk_text("")
    assert isinstance(result, list)
    assert len(result) == 0


def test_chunk_section_metadata():
    result = chunk_section(
        section_name="item_1_business",
        section_text=SAMPLE_SECTIONS["item_1_business"],
        ticker=SAMPLE_TICKER,
        form_type=SAMPLE_FORM,
        filed_date=SAMPLE_DATE,
        accession_number=SAMPLE_ACCESSION,
    )
    assert isinstance(result, list)
    assert len(result) >= 1
    for chunk in result:
        assert "text" in chunk
        assert chunk["ticker"] == SAMPLE_TICKER
        assert chunk["form_type"] == SAMPLE_FORM
        assert chunk["filed_date"] == SAMPLE_DATE
        assert "accession_number" in chunk
        assert chunk["section"] == "item_1_business"
        assert "chunk_index" in chunk
        assert "chunk_total" in chunk
        assert "char_count" in chunk
        assert chunk["char_count"] == len(chunk["text"])


def test_chunk_section_indices():
    result = chunk_section(
        section_name="item_1_business",
        section_text=SAMPLE_SECTIONS["item_1_business"],
        ticker=SAMPLE_TICKER,
        form_type=SAMPLE_FORM,
        filed_date=SAMPLE_DATE,
        accession_number=SAMPLE_ACCESSION,
    )
    for i, chunk in enumerate(result):
        assert chunk["chunk_index"] == i
        assert chunk["chunk_total"] == len(result)


def test_chunk_all_sections():
    result = chunk_all_sections(
        sections=SAMPLE_SECTIONS,
        ticker=SAMPLE_TICKER,
        form_type=SAMPLE_FORM,
        filed_date=SAMPLE_DATE,
        accession_number=SAMPLE_ACCESSION,
    )
    assert isinstance(result, list)
    assert len(result) >= 3
    section_names = {c["section"] for c in result}
    assert section_names == set(SAMPLE_SECTIONS.keys())
    for i, chunk in enumerate(result):
        assert "global_chunk_index" in chunk
        assert chunk["global_chunk_index"] == i


def test_get_chunk_stats():
    chunks = chunk_all_sections(
        sections=SAMPLE_SECTIONS,
        ticker=SAMPLE_TICKER,
        form_type=SAMPLE_FORM,
        filed_date=SAMPLE_DATE,
        accession_number=SAMPLE_ACCESSION,
    )
    result = get_chunk_stats(chunks)
    assert "total_chunks" in result
    assert result["total_chunks"] == len(chunks)
    assert "sections_covered" in result
    assert len(result["sections_covered"]) == 3
    assert "avg_chunk_size" in result
    assert result["avg_chunk_size"] > 0
    assert "min_chunk_size" in result
    assert "max_chunk_size" in result
    assert result["min_chunk_size"] <= result["max_chunk_size"]
