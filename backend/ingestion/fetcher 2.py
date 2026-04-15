import os

import httpx
from dotenv import load_dotenv

load_dotenv()

SEC_USER_AGENT = os.getenv("SEC_USER_AGENT", "SEC-Fault contact@secfault.com")
_HEADERS = {"User-Agent": SEC_USER_AGENT}

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data"


async def get_cik_from_ticker(ticker: str) -> str:
    """Resolve a stock ticker to a zero-padded 10-digit CIK string."""
    async with httpx.AsyncClient(headers=_HEADERS, timeout=30) as client:
        resp = await client.get(TICKERS_URL)
        resp.raise_for_status()
        data = resp.json()

    ticker_upper = ticker.upper()
    for entry in data.values():
        if entry.get("ticker", "").upper() == ticker_upper:
            return str(entry["cik_str"]).zfill(10)

    raise ValueError(f"Ticker '{ticker}' not found in SEC company tickers")


async def get_company_info(cik: str) -> dict:
    """Fetch basic company information from SEC EDGAR submissions."""
    url = SUBMISSIONS_URL.format(cik=cik)
    async with httpx.AsyncClient(headers=_HEADERS, timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    return {
        "name": data.get("name"),
        "cik": data.get("cik"),
        "tickers": data.get("tickers", []),
        "sic": data.get("sic"),
        "sicDescription": data.get("sicDescription"),
    }


async def get_recent_filings(
    ticker: str, form_type: str = "10-K", limit: int = 5
) -> list[dict]:
    """Return recent filings of the given form type for a ticker."""
    cik = await get_cik_from_ticker(ticker)
    url = SUBMISSIONS_URL.format(cik=cik)

    async with httpx.AsyncClient(headers=_HEADERS, timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    accession_numbers = recent.get("accessionNumber", [])
    filing_dates = recent.get("filingDate", [])
    forms = recent.get("form", [])
    primary_docs = recent.get("primaryDocument", [])

    results = []
    for i, form in enumerate(forms):
        if form != form_type:
            continue

        raw_accession = accession_numbers[i]
        # raw_accession already has dashes like "0000320193-24-000123"
        accession_no_dashes = raw_accession.replace("-", "")

        doc_url = (
            f"{ARCHIVES_BASE}/{int(cik)}/{accession_no_dashes}/{primary_docs[i]}"
        )

        results.append(
            {
                "accession_number": raw_accession,
                "filed_date": filing_dates[i],
                "form_type": form,
                "primary_document_url": doc_url,
                "cik": cik,
                "ticker": ticker.upper(),
            }
        )

        if len(results) >= limit:
            break

    return results


async def download_filing_html(primary_document_url: str) -> str:
    """Download the raw HTML of a filing document."""
    async with httpx.AsyncClient(headers=_HEADERS, timeout=30) as client:
        resp = await client.get(primary_document_url)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to download filing from {primary_document_url}: "
                f"HTTP {resp.status_code}"
            )
        return resp.text


async def get_filing_index(cik: str, accession_number: str) -> dict:
    """Fetch the filing index JSON for a given CIK and accession number."""
    accession_no_dashes = accession_number.replace("-", "")
    url = f"{ARCHIVES_BASE}/{int(cik)}/{accession_no_dashes}/{accession_no_dashes}-index.json"

    async with httpx.AsyncClient(headers=_HEADERS, timeout=30) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to fetch filing index from {url}: HTTP {resp.status_code}"
            )
        return resp.json()
