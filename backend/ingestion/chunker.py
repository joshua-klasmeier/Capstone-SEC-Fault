from __future__ import annotations

import re


def chunk_text(
    text: str, chunk_size: int = 1000, overlap: int = 200
) -> list[str]:
    """Split *text* into overlapping chunks, preferring sentence boundaries."""
    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text] if len(text) >= 50 else []

    # Split into sentences (keep the delimiter attached).
    parts = re.split(r"(?<=\. )|(?<=\n)", text)

    chunks: list[str] = []
    current = ""

    for part in parts:
        # If adding this part would exceed chunk_size, flush current chunk.
        if current and len(current) + len(part) > chunk_size:
            stripped = current.strip()
            if len(stripped) >= 50:
                chunks.append(stripped)

            # Start next chunk with overlap from the end of the previous.
            overlap_text = stripped[-overlap:] if len(stripped) > overlap else stripped
            current = overlap_text + part
        else:
            current += part

        # If a single sentence is longer than chunk_size, hard-split it.
        while len(current) > chunk_size * 1.5:
            piece = current[:chunk_size].strip()
            if len(piece) >= 50:
                chunks.append(piece)
            current = current[chunk_size - overlap:]

    # Flush remaining text.
    stripped = current.strip()
    if len(stripped) >= 50:
        chunks.append(stripped)

    return chunks


def chunk_section(
    section_name: str,
    section_text: str,
    ticker: str,
    form_type: str,
    filed_date: str,
    accession_number: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[dict]:
    """Chunk a single section and attach metadata to every chunk."""
    texts = chunk_text(section_text, chunk_size, overlap)
    total = len(texts)
    return [
        {
            "text": t,
            "ticker": ticker,
            "form_type": form_type,
            "filed_date": filed_date,
            "accession_number": accession_number,
            "section": section_name,
            "chunk_index": i,
            "chunk_total": total,
            "char_count": len(t),
        }
        for i, t in enumerate(texts)
    ]


def chunk_all_sections(
    sections: dict[str, str],
    ticker: str,
    form_type: str,
    filed_date: str,
    accession_number: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[dict]:
    """Chunk every section and return a single flat list with global indices."""
    all_chunks: list[dict] = []
    for section_name, section_text in sections.items():
        all_chunks.extend(
            chunk_section(
                section_name,
                section_text,
                ticker,
                form_type,
                filed_date,
                accession_number,
                chunk_size,
                overlap,
            )
        )
    for idx, chunk in enumerate(all_chunks):
        chunk["global_chunk_index"] = idx
    return all_chunks


def get_chunk_stats(chunks: list[dict]) -> dict:
    """Return summary statistics for a list of chunk dicts."""
    if not chunks:
        return {
            "total_chunks": 0,
            "sections_covered": [],
            "avg_chunk_size": 0.0,
            "min_chunk_size": 0,
            "max_chunk_size": 0,
        }
    sizes = [c["char_count"] for c in chunks]
    return {
        "total_chunks": len(chunks),
        "sections_covered": sorted({c["section"] for c in chunks}),
        "avg_chunk_size": sum(sizes) / len(sizes),
        "min_chunk_size": min(sizes),
        "max_chunk_size": max(sizes),
    }
