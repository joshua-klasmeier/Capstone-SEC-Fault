from __future__ import annotations

import os
import time
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

from dotenv import load_dotenv

load_dotenv()

import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

_MODEL = "models/gemini-embedding-001"
_BATCH_SIZE = 100
_EXPECTED_DIM = 3072


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts as retrieval documents. Returns one 3072-d vector per text."""
    if not texts:
        raise ValueError("texts list must not be empty")

    all_embeddings: list[list[float]] = []

    for start in range(0, len(texts), _BATCH_SIZE):
        batch = texts[start : start + _BATCH_SIZE]

        if start > 0:
            time.sleep(0.5)

        if start > 0 and start % _BATCH_SIZE == 0:
            print(f"  Embedding progress: {start}/{len(texts)} chunks")

        result = genai.embed_content(
            model=_MODEL,
            content=batch,
            task_type="retrieval_document",
        )

        embeddings = result["embedding"]
        # Single-text batches return a flat list instead of list-of-lists.
        if embeddings and not isinstance(embeddings[0], list):
            embeddings = [embeddings]

        all_embeddings.extend(embeddings)

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string for retrieval."""
    if not query:
        raise ValueError("query must not be empty")

    result = genai.embed_content(
        model=_MODEL,
        content=query,
        task_type="retrieval_query",
    )
    return result["embedding"]


def validate_embedding(embedding: list[float]) -> bool:
    """Check that an embedding vector has the expected shape and is non-zero."""
    if not isinstance(embedding, list):
        return False
    if len(embedding) != _EXPECTED_DIM:
        return False
    if not all(isinstance(v, float) for v in embedding):
        return False
    if all(v == 0.0 for v in embedding):
        return False
    return True
