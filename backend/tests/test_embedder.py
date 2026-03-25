import os
import sys
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from ingestion.embedder import embed_query, embed_texts, validate_embedding


def test_gemini_api_key_set():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        pytest.skip("GEMINI_API_KEY not set")
    assert len(key) > 10


def test_embed_single_text():
    result = embed_texts(["Apple reported strong quarterly earnings."])
    assert isinstance(result, list)
    assert len(result) == 1
    assert len(result[0]) == 3072
    assert all(isinstance(v, float) for v in result[0])


def test_embed_multiple_texts():
    result = embed_texts([
        "Apple reported strong quarterly earnings.",
        "Tesla delivered record number of vehicles.",
        "Microsoft Azure cloud revenue grew 30 percent.",
    ])
    assert len(result) == 3
    for vec in result:
        assert len(vec) == 3072
    # All three vectors should be different.
    assert result[0] != result[1]
    assert result[1] != result[2]
    assert result[0] != result[2]


def test_embed_query():
    result = embed_query("What is Apple's revenue?")
    assert isinstance(result, list)
    assert len(result) == 3072
    assert all(isinstance(v, float) for v in result)


def test_embed_query_vs_document_different():
    text = "Apple revenue grew this quarter."
    doc = embed_texts([text])[0]
    query = embed_query(text)
    assert len(doc) == 3072
    assert len(query) == 3072
    assert doc != query


def test_validate_embedding_valid():
    embedding = embed_query("test")
    assert validate_embedding(embedding) is True


def test_validate_embedding_invalid():
    assert validate_embedding([0.0] * 3072) is False
    assert validate_embedding([1.0] * 100) is False


def test_embed_empty_raises():
    with pytest.raises(ValueError):
        embed_texts([])


def test_embed_query_empty_raises():
    with pytest.raises(ValueError):
        embed_query("")
