from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup


def clean_html(raw_html: str) -> str:
    """Strip tags, scripts, styles, and hidden elements; return plain text."""
    soup = BeautifulSoup(raw_html, "lxml")

    for tag in soup.find_all(["script", "style", "meta", "link", "header", "footer", "nav"]):
        tag.decompose()

    for tag in soup.find_all(style=re.compile(r"display\s*:\s*none|visibility\s*:\s*hidden", re.I)):
        tag.decompose()

    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# Ordered list of item boundaries used for slicing the document.
_ITEM_PATTERNS = [
    ("item_1_business",             r"item\s+1[.\s]"),
    ("item_1a_risk_factors",        r"item\s+1a[.\s]"),
    ("item_1b",                     r"item\s+1b[.\s]"),
    ("item_2_properties",           r"item\s+2[.\s]"),
    ("item_3_legal_proceedings",    r"item\s+3[.\s]"),
    ("item_4",                      r"item\s+4[.\s]"),
    ("item_5",                      r"item\s+5[.\s]"),
    ("item_6",                      r"item\s+6[.\s]"),
    ("item_7_mdna",                 r"item\s+7[.\s]"),
    ("item_7a_market_risk",         r"item\s+7a[.\s]"),
    ("item_8_financial_statements", r"item\s+8[.\s]"),
    ("item_9",                      r"item\s+9[.\s]"),
]

_WANTED_KEYS = {
    "item_1_business",
    "item_1a_risk_factors",
    "item_2_properties",
    "item_3_legal_proceedings",
    "item_7_mdna",
    "item_7a_market_risk",
    "item_8_financial_statements",
}

_MAX_SECTION_LEN = 50_000


def _find_last_match(pattern: str, text: str) -> int | None:
    """Return the start position of the *last* occurrence of pattern."""
    match = None
    for m in re.finditer(pattern, text, re.IGNORECASE):
        match = m
    return match.start() if match else None


def extract_sections(raw_html: str) -> dict[str, str]:
    """Extract named SEC filing sections from raw HTML."""
    text = clean_html(raw_html)

    # Find the last occurrence of each item header in document order.
    positions: list[tuple[str, int]] = []
    for key, pattern in _ITEM_PATTERNS:
        pos = _find_last_match(pattern, text)
        if pos is not None:
            positions.append((key, pos))

    # Sort by position so we can slice between consecutive headers.
    positions.sort(key=lambda x: x[1])

    sections: dict[str, str] = {}
    for i, (key, start) in enumerate(positions):
        if key not in _WANTED_KEYS:
            continue
        end = positions[i + 1][1] if i + 1 < len(positions) else len(text)
        body = text[start:end].strip()
        if len(body) < 100:
            continue
        sections[key] = body[:_MAX_SECTION_LEN]

    return sections


def extract_tables_as_text(raw_html: str) -> list[str]:
    """Convert HTML <table> elements to pipe-separated text."""
    soup = BeautifulSoup(raw_html, "lxml")
    tables: list[str] = []

    for table in soup.find_all("table"):
        rows: list[list[str]] = []
        for tr in table.find_all("tr"):
            cells = [
                re.sub(r"\s+", " ", cell.get_text(strip=True))
                for cell in tr.find_all(["th", "td"])
            ]
            if cells:
                rows.append(cells)

        if len(rows) < 2 or max(len(r) for r in rows) < 2:
            continue

        lines = [" | ".join(row) for row in rows]
        tables.append("\n".join(lines))

        if len(tables) >= 20:
            break

    return tables


def get_filing_metadata(raw_html: str) -> dict:
    """Try to extract company name, period of report, and form type."""
    soup = BeautifulSoup(raw_html, "lxml")
    text = soup.get_text()
    metadata: dict[str, str] = {}

    # <company-name> tag
    tag = soup.find("company-name")
    if tag:
        metadata["company_name"] = tag.get_text(strip=True)
    else:
        m = re.search(r"COMPANY CONFORMED NAME:\s*(.+)", text)
        if m:
            metadata["company_name"] = m.group(1).strip()

    # <period-of-report> tag
    tag = soup.find("period-of-report")
    if tag:
        metadata["period_of_report"] = tag.get_text(strip=True)
    else:
        m = re.search(r"PERIOD OF REPORT:\s*(\S+)", text)
        if m:
            metadata["period_of_report"] = m.group(1).strip()

    # <type> tag
    tag = soup.find("type")
    if tag:
        metadata["form_type"] = tag.get_text(strip=True)
    else:
        m = re.search(r"FORM TYPE:\s*(\S+)", text)
        if m:
            metadata["form_type"] = m.group(1).strip()

    return metadata
