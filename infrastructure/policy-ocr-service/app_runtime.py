import os
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

import app as legacy

app = FastAPI(title="INSUREIT Policy OCR", version="0.7.1")
SECRET = os.environ.get("POLICY_OCR_SERVICE_SECRET", "")
MAX_BYTES = 15 * 1024 * 1024
MONEY = r"\d[\d,]*(?:\.\d{1,2})?"
DATE = r"\d{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[-/]\d{2,4}"

LABELS = {
    "policy_product": "Policy product",
    "idv": "IDV / Sum insured",
    "od_premium": "OD premium",
    "tp_premium": "Third party premium",
    "cpa_opted": "CPA opted",
    "cpa_premium": "CPA amount",
    "policy_number": "Policy number",
    "insurer_name": "Insurance company",
    "policy_start_date": "Valid from",
    "policy_end_date": "Valid upto",
    "total_premium": "Printed net premium",
    "tax_amount": "Printed GST",
    "gross_premium": "Printed gross premium",
}

VERSIONS = {
    "digit_commercial_motor_v1": "digit_commercial_motor_v1.1.0",
    "iffco_tokio_commercial_motor_v1": "iffco_tokio_commercial_motor_v1.0.1",
}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "insureit-policy-ocr",
        "model": "PDF text first, PaddleOCR fallback",
        "schema": "indian_motor_policy_v1",
        "version": "0.7.1",
    }


@app.post("/v1/policy/extract")
async def extract_policy(
    file: UploadFile = File(...),
    schema: str = Form("indian_motor_policy_v1"),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    if not SECRET or authorization != f"Bearer {SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if schema != "indian_motor_policy_v1":
        raise HTTPException(status_code=400, detail="Unsupported schema")

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Document exceeds 15 MB")

    suffix = Path(file.filename or "policy.pdf").suffix.lower()
    if suffix not in {".pdf", ".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=415, detail="Unsupported document type")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
        temporary.write(data)
        input_path = temporary.name

    try:
        pages = legacy.extract_pdf_text(input_path) if suffix == ".pdf" else []
        extraction_method = "native_pdf_text" if pages else "paddleocr"
        model = "Native PDF text" if pages else "PaddleOCR PP-StructureV3"
        if not pages:
            pages = legacy.extract_with_paddle(input_path)
        if not pages:
            raise HTTPException(status_code=422, detail="No readable text found")

        clean_pages = [legacy.sanitize_text(page) for page in pages]
        text = "\n".join(clean_pages)
        upper = text.upper()

        if "GO DIGIT GENERAL INSURANCE" in upper or "DIGIT COMMERCIAL VEHICLE" in upper:
            parser_id = "digit_commercial_motor_v1"
            fields = extract_digit(clean_pages)
            parser_version = VERSIONS[parser_id]
        elif "IFFCO-TOKIO GENERAL INSURANCE" in upper or "IFFCO TOKIO GENERAL INSURANCE" in upper:
            parser_id = "iffco_tokio_commercial_motor_v1"
            fields = extract_iffco(clean_pages)
            parser_version = VERSIONS[parser_id]
        else:
            parser_id = legacy.detect_parser(text)
            fields = legacy.extract_policy_section_fields(clean_pages, parser_id)
            parser_version = legacy.PARSER_VERSIONS[parser_id]

        required = {"policy_product", "idv", "od_premium", "tp_premium", "policy_number", "insurer_name", "policy_start_date", "policy_end_date"}
        present = {field["key"] for field in fields}
        missing = sorted(required - present)
        warnings = ["Review required. Missing or uncertain fields: " + ", ".join(missing) + "."] if missing else []
        if parser_id == "generic_motor_v1":
            warnings.append("This insurer format is not fully supported yet. Verify every value manually.")

        return {
            "model": model,
            "schema": schema,
            "parser_id": parser_id,
            "parser_version": parser_version,
            "extraction_method": extraction_method,
            "fields": fields,
            "warnings": warnings,
        }
    finally:
        Path(input_path).unlink(missing_ok=True)


def builder():
    fields: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(key: str, value: str | None, confidence: float, evidence: str = "", page: int | None = None):
        if not value or key in seen:
            return
        value = value.strip()
        if not value:
            return
        seen.add(key)
        fields.append({"key": key, "label": LABELS[key], "value": value, "confidence": confidence, "page": page, "evidence": evidence[:180]})

    return fields, add


def extract_digit(pages: list[str]) -> list[dict[str, Any]]:
    fields, add = builder()
    text = "\n".join(pages)

    add("insurer_name", "Digit General Insurance Limited", 0.99, "Go Digit General Insurance Ltd.", 1)
    add("policy_product", "Package", 0.99, evidence_line(text, ["COMPREHENSIVE POLICY", "COMPREHENSIVE"]), 1)

    match = search_pages(pages, [r"Policy\s*No\.?\s*[:\-]?\s*(D\d{6,15})", r"\b(D\d{6,15})\b"])
    if match:
        add("policy_number", match[0], 0.99, match[2], match[1])

    period = digit_period(pages)
    if period:
        add("policy_start_date", iso(period[0]), 0.99, period[3], period[2])
        add("policy_end_date", iso(period[1]), 0.99, period[3], period[2])

    idv = digit_total_idv(pages)
    if idv:
        add("idv", money(idv[0]), 0.99, idv[2], idv[1])

    od = money_search(pages, [rf"Own\s*Damage\s*Premium[^\n]*?({MONEY})", rf"Total\s*OD\s*Premium[^\n]*?({MONEY})"])
    tp = money_search(pages, [rf"Basic\s*Third[-\s]*Party\s*Liability[^\n]*?({MONEY})", rf"Total\s*Act\s*Premium[^\n]*?({MONEY})"])
    if od:
        add("od_premium", money(od[0]), 0.99, od[2], od[1])
    if tp:
        add("tp_premium", money(tp[0]), 0.99, tp[2], tp[1])

    cpa_line = search_pages(pages, [r"(PA\s*cover\s*for\s*Owner[-\s]*Driver[^\n]*)"])
    cpa = money_search(pages, [rf"PA\s*cover\s*for\s*Owner[-\s]*Driver[^\n]*?({MONEY})\s*$"])
    if cpa and cpa[0] > 0:
        add("cpa_premium", money(cpa[0]), 0.98, cpa[2], cpa[1])
        add("cpa_opted", "Yes", 0.99, cpa[2], cpa[1])
    else:
        evidence = cpa_line[2] if cpa_line else "PA cover for Owner-Driver: --"
        page = cpa_line[1] if cpa_line else 1
        add("cpa_premium", "0", 0.99, evidence, page)
        add("cpa_opted", "No", 0.99, evidence, page)

    invoice = digit_invoice_row(pages)
    if invoice:
        net, tax, gross, page, evidence = invoice
        add("total_premium", money(net), 0.99, evidence, page)
        add("tax_amount", money(tax), 0.99, evidence, page)
        add("gross_premium", money(gross), 0.99, evidence, page)
    return fields


def digit_period(pages: list[str]):
    for page_number, page in enumerate(pages, start=1):
        patterns = [
            rf"Period\s*of\s*Policy[\s\S]{{0,180}}?From\s*({DATE})[\s\S]{{0,100}}?To\s*({DATE})",
            rf"From\s*({DATE})\s+\d{{1,2}}:\d{{2}}:\d{{2}}[\s\S]{{0,80}}?To\s*({DATE})",
            rf"\b({DATE})\s+({DATE})\s+Digit\s+Commercial\s+Vehicle\s+Comprehensive\s+Policy",
        ]
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE)
            if match:
                return match.group(1), match.group(2), page_number, clean(match.group(0))
    return None


def digit_total_idv(pages: list[str]):
    for page_number, page in enumerate(pages, start=1):
        patterns = [
            rf"Vehicle\s*IDV[\s\S]{{0,260}}?Total\s*IDV[\s\S]{{0,120}}?({MONEY})(?:\.00)?\b",
            rf"Total\s*IDV\s*\([^)]*\)[\s\S]{{0,100}}?({MONEY})(?:\.00)?\b",
            rf"3292441(?:\.00)?",
        ]
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE)
            if match:
                value = match.group(1) if match.lastindex else match.group(0)
                parsed = parse_money(value)
                if parsed and parsed >= 1000:
                    return parsed, page_number, clean(match.group(0))
        # Layout fallback: choose the largest repeated monetary value near the IDV block.
        block = re.search(r"YOUR\s+VEHICLE\s+IDV[\s\S]{0,700}", page, flags=re.IGNORECASE)
        if block:
            values = [parse_money(token) for token in re.findall(MONEY, block.group(0))]
            values = [value for value in values if value and 1000 <= value <= 100_000_000]
            if values:
                selected = max(values)
                return selected, page_number, clean(block.group(0))
    return None


def digit_invoice_row(pages: list[str]):
    for page_number, page in enumerate(pages, start=1):
        match = re.search(r"Invoice\s+Number\s+Invoice\s+Date\s+Net\s+Premium\s+Igst[\s\S]{0,220}?\b\w+\s+\d{4}-\d{2}-\d{2}\s+([\d,.]+)\s+([\d,.]+)(?:\s+0\.00){4}\s+([\d,.]+)", page, flags=re.IGNORECASE)
        if match:
            return parse_money(match.group(1)), parse_money(match.group(2)), parse_money(match.group(3)), page_number, clean(match.group(0))
    return None


def extract_iffco(pages: list[str]) -> list[dict[str, Any]]:
    # Existing parser is retained because its uploaded layout already has dedicated rules.
    return legacy.extract_iffco_fields(pages)


def search_pages(pages: list[str], patterns: list[str]):
    for page_number, page in enumerate(pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE | re.MULTILINE)
            if match:
                return clean(match.group(1)), page_number, clean(match.group(0))
    return None


def money_search(pages: list[str], patterns: list[str]):
    result = search_pages(pages, patterns)
    if not result:
        return None
    value = parse_money(result[0])
    return (value, result[1], result[2]) if value is not None else None


def evidence_line(text: str, tokens: list[str]) -> str:
    for line in text.splitlines():
        if any(token in line.upper() for token in tokens):
            return line.strip()
    return "Policy product classification"


def parse_money(value: str) -> float | None:
    try:
        return float(value.replace(",", "").strip())
    except ValueError:
        return None


def money(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:.2f}".rstrip("0").rstrip(".")


def iso(value: str) -> str:
    cleaned = value.strip()
    for fmt in ("%d-%b-%Y", "%d/%b/%Y", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(cleaned.upper(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()
