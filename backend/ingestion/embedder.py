from __future__ import annotations

import logging
import os
import time
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

from dotenv import load_dotenv

load_dotenv()

import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

_MODEL = "models/gemini-embedding-001"
_BATCH_SIZE = 16
_EXPECTED_DIM = 3072
_MAX_RETRIES = 3

logger = logging.getLogger(__name__)


def _embed_with_retry(model, content, task_type, retries=_MAX_RETRIES):
    """Call embed_content with exponential back-off on rate-limit errors."""
    for attempt in range(retries):
        try:
            return genai.embed_content(
                model=model, content=content, task_type=task_type
            )
        except Exception as exc:
            if "429" in str(exc) and attempt < retries - 1:
                wait = 20 * (attempt + 1)
                logger.warning("Rate limited, waiting %ds (attempt %d)", wait, attempt + 1)
                time.sleep(wait)
            else:
                raise


def _extract_embeddings(result) -> list[list[float]]:
    embeddings = result["embedding"]
    if embeddings and not isinstance(embeddings[0], list):
        embeddings = [embeddings]
    return embeddings


def _embed_batch(batch: list[str], task_type: str) -> list[list[float]]:
    try:
        result = _embed_with_retry(_MODEL, batch, task_type)
        return _extract_embeddings(result)
    except Exception as exc:
        if len(batch) == 1:
            raise

        logger.warning(
            "Batch embedding failed for %d texts; retrying smaller batches. Error: %s",
            len(batch),
            exc,
        )
        midpoint = len(batch) // 2
        left_embeddings = _embed_batch(batch[:midpoint], task_type)
        right_embeddings = _embed_batch(batch[midpoint:], task_type)
        return left_embeddings + right_embeddings


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
            logger.info("Embedding progress: %d/%d chunks", start, len(texts))

        all_embeddings.extend(_embed_batch(batch, "retrieval_document"))

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string for retrieval."""
    if not query:
        raise ValueError("query must not be empty")

    result = _embed_with_retry(_MODEL, query, "retrieval_query")
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
