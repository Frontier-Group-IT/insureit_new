import html
import os
import re
import subprocess
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

app = FastAPI(title="INSUREIT Policy OCR", version="0.5.0")
SECRET = os.environ.get("POLICY_OCR_SERVICE_SECRET", "")
MAX_BYTES = 15 * 1024 * 1024
MONEY = r"[\d,]+(?:\.\d{1,2})?"
DATE_TOKEN = r"\d{1,2}[\-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[\-/]\d{2,4}"

_pipeline: Any | None = None
_pipeline_lock = threading.Lock()

FIELD_LABELS: dict[str, str] = {
    "insurer_name": "Insurance company",
    "policy_product": "Policy product",
    "idv": "IDV / Sum insured",
    "od_premium": "OD premium",
    "tp_premium": "Third party premium",
    "cpa_opted": "CPA opted",
    "cpa_premium": "CPA amount",
    "policy_number": "Policy number",
    "policy_start_date": "Valid from",
    "policy_end_date": "Valid upto",
    "total_premium": "Printed net premium",
    "tax_amount": "Printed GST",
    "gross_premium": "Printed gross premium",
    "insured_name": "Insured name",
    "registration_number": "Registration number",
    "make": "Make",
    "model": "Model",
    "manufacturing_year": "Manufacturing year",
    "chassis_number": "Chassis number",
    "engine_number": "Engine number",
    "gvw": "GVW",
}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "insureit-policy-ocr",
        "model": "PDF text first, PaddleOCR fallback",
        "schema": "indian_motor_policy_v1",
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
        raw_pages = extract_pdf_text(input_path) if suffix == ".pdf" else []
        extraction_method = "native_pdf_text" if raw_pages else "paddleocr"
        model_name = "Native PDF text" if raw_pages else "PaddleOCR PP-StructureV3"

        if not raw_pages:
            raw_pages = extract_with_paddle(input_path)

        if not raw_pages:
            raise HTTPException(status_code=422, detail="No readable text found")

        clean_pages = [sanitize_text(page) for page in raw_pages]
        full_text = "\n".join(clean_pages)
        parser_id = detect_parser(full_text)
        parser_version = "new_india_motor_v1.0.0" if parser_id == "new_india_motor_v1" else "generic_motor_v1.0.0"

        fields = extract_standard_fields(clean_pages, parser_id)
        warnings: list[str] = []

        required = {
            "insurer_name",
            "policy_product",
            "policy_number",
            "policy_start_date",
            "policy_end_date",
            "od_premium",
            "tp_premium",
        }
        present = {field["key"] for field in fields}
        missing = sorted(required - present)
        if missing:
            warnings.append("Review required. Missing or uncertain fields: " + ", ".join(missing) + ".")
        if parser_id == "generic_motor_v1":
            warnings.append("This insurer format is not yet fully supported. Verify every value before applying it.")

        return {
            "model": model_name,
            "schema": schema,
            "parser_id": parser_id,
            "parser_version": parser_version,
            "extraction_method": extraction_method,
            "fields": fields,
            "warnings": warnings,
        }
    finally:
        Path(input_path).unlink(missing_ok=True)


def extract_pdf_text(input_path: str) -> list[str]:
    try:
        completed = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", input_path, "-"],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (subprocess.SubprocessError, OSError):
        return []

    text = completed.stdout.replace("\x00", "")
    useful = sum(character.isalnum() for character in text)
    if useful < 200:
        return []
    return [page.strip() for page in text.split("\f") if page.strip()]


def get_pipeline() -> Any:
    global _pipeline
    if _pipeline is None:
        with _pipeline_lock:
            if _pipeline is None:
                from paddleocr import PPStructureV3

                _pipeline = PPStructureV3(
                    lang="en",
                    use_doc_orientation_classify=True,
                    use_doc_unwarping=True,
                    use_textline_orientation=True,
                    use_formula_recognition=False,
                    use_chart_recognition=False,
                )
    return _pipeline


def extract_with_paddle(input_path: str) -> list[str]:
    pages: list[str] = []
    for result in get_pipeline().predict(input_path):
        payload = result.json if isinstance(result.json, dict) else {}
        text = collect_text(payload)
        if text.strip():
            pages.append(text)
    return pages


def collect_text(value: Any) -> str:
    chunks: list[str] = []
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in {"rec_texts", "text", "markdown", "markdown_text", "content"}:
                if isinstance(item, list):
                    chunks.extend(str(entry) for entry in item if entry)
                elif item:
                    chunks.append(str(item))
            else:
                nested = collect_text(item)
                if nested:
                    chunks.append(nested)
    elif isinstance(value, list):
        for item in value:
            nested = collect_text(item)
            if nested:
                chunks.append(nested)
    return "\n".join(chunks)


def sanitize_text(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"<\s*br\s*/?\s*>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<\s*/\s*(?:td|th|tr|p|div|li|h\d)\s*>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("\u00ad", "").replace("\ufffe", "-").replace("\u2013", "-").replace("\u2014", "-")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def detect_parser(text: str) -> str:
    normalized = text.upper()
    if "THE NEW INDIA ASSURANCE" in normalized or "NEW INDIA ASSURANCE COMPANY" in normalized:
        return "new_india_motor_v1"
    return "generic_motor_v1"


def extract_standard_fields(clean_pages: list[str], parser_id: str) -> list[dict[str, Any]]:
    full_text = "\n".join(clean_pages)
    full_upper = full_text.upper()
    fields: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(
        key: str,
        value: str | None,
        confidence: float,
        evidence: str = "",
        page: int | None = None,
    ) -> None:
        if key in seen or not value:
            return
        clean = value.strip()
        if not clean:
            return
        seen.add(key)
        fields.append(
            {
                "key": key,
                "label": FIELD_LABELS[key],
                "value": clean,
                "confidence": confidence,
                "page": page,
                "evidence": evidence[:180],
            }
        )

    if parser_id == "new_india_motor_v1":
        add("insurer_name", "The New India Assurance Co. Ltd.", 0.99, "The New India Assurance Co. Ltd.", 1)

    product = classify_policy_product(full_upper)
    if product:
        add("policy_product", product, 0.98 if parser_id == "new_india_motor_v1" else 0.86, product_heading_evidence(full_text), 1)

    match = find_first(clean_pages, [
        r"Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})",
        r"\b([0-9]{15,30})\b\s*\n\s*Policy\s*No\.?",
    ])
    if match:
        add("policy_number", compact_identifier(match[0]), 0.98, match[2], match[1])

    match = find_first(clean_pages, [r"Insured\s*Name\s*[:\-]?\s*([^\n]{3,80})"])
    if match:
        name = re.split(r"\b(?:Motor Liability Period|Own Damage Period|Policy No\.?)\b", match[0], maxsplit=1, flags=re.IGNORECASE)[0]
        add("insured_name", clean_generic(name).upper(), 0.97, match[2], match[1])

    period = find_period(clean_pages)
    if period:
        start, end, page, evidence = period
        add("policy_start_date", to_iso_date(start), 0.98, evidence, page)
        add("policy_end_date", to_iso_date(end), 0.98, evidence, page)

    for key, patterns, confidence in [
        ("idv", [rf"Total\s*IDV\s*[:\-]?\s*({MONEY})", rf"Total\s*Insured\s*Declared\s*Value\s*[:\-]?\s*({MONEY})"], 0.98),
        ("od_premium", [rf"Net\s*Own\s*Damage\s*Premium\s*\(A\)\s*[:\-]?\s*({MONEY})", rf"OD\s*Premium\s*[:\-]?\s*({MONEY})"], 0.98),
        ("tp_premium", [rf"Net\s*Liability\s*Premium\s*\(B\)\s*[:\-]?\s*({MONEY})", rf"Third\s*Party\s*Premium\s*[:\-]?\s*({MONEY})"], 0.98),
        ("total_premium", [rf"Total\s*Premium\s*\(A\+B\)\s*[:\-]?\s*({MONEY})", rf"Net\s*Premium\s*[:\-]?\s*({MONEY})"], 0.97),
        ("tax_amount", [rf"IGST[^\n]*?({MONEY})\s*$", rf"GST\s*[:\-]?\s*({MONEY})"], 0.96),
        ("gross_premium", [rf"Gross\s*Premium\s*Paid\s*[:\-]?\s*({MONEY})", rf"Gross\s*Premium\s*[:\-]?\s*({MONEY})"], 0.98),
    ]:
        match = find_first(clean_pages, patterns)
        if match:
            add(key, clean_money(match[0]), confidence, match[2], match[1])

    cpa = extract_cpa_premium(clean_pages, full_text)
    add("cpa_premium", cpa[0] if cpa else "0", 0.95 if cpa else 0.82, cpa[2] if cpa else "No payable CPA premium identified", cpa[1] if cpa else None)
    add("cpa_opted", "Yes" if cpa and float(cpa[0] or 0) > 0 else "No", 0.96 if cpa else 0.84, cpa[2] if cpa else "Derived from CPA amount", cpa[1] if cpa else None)

    auxiliary_specs = [
        ("registration_number", [r"Registration\s*No\.?[^\n]*?\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4})\b"], normalize_registration, 0.97),
        ("make", [r"Make\s*[:\-]?\s*([^\n]{2,50})"], clean_generic, 0.94),
        ("model", [r"Model\s*[:\-]?\s*([^\n]{2,70})"], normalize_model_spacing, 0.94),
        ("manufacturing_year", [r"Manufacturing\s*Year\s*[:\-]?\s*((?:19|20)\d{2})"], clean_integer, 0.96),
        ("chassis_number", [r"Chassis\s*No\.?[^\n]*?\b([A-Z0-9]{12,24})\b"], compact_identifier, 0.96),
        ("engine_number", [r"Engine(?:/Motor)?\s*No\.?[^\n]*?\b([A-Z0-9. ]{10,35})\b"], compact_identifier, 0.94),
        ("gvw", [r"GVW\s*[:\-]?\s*([\d,]{3,10})"], clean_integer, 0.95),
    ]
    for key, patterns, cleaner, confidence in auxiliary_specs:
        match = find_first(clean_pages, patterns)
        if match:
            add(key, cleaner(match[0]), confidence, match[2], match[1])

    return fields


def classify_policy_product(text_upper: str) -> str | None:
    if re.search(r"\b(?:LIABILITY\s+ONLY|ACT\s+ONLY|THIRD\s+PARTY)\b", text_upper):
        return "Third Party"
    if re.search(r"\b(?:STANDALONE|STAND\s+ALONE)\s+(?:OWN\s+DAMAGE|OD)\b|\bSAOD\b", text_upper):
        return "SAOD"
    if "BUNDLED" in text_upper:
        return "Bundled"
    if re.search(r"\bPACKAGE\s+POLICY\b|\bCOMPREHENSIVE\b", text_upper):
        return "Package"
    return None


def product_heading_evidence(text: str) -> str:
    for line in text.splitlines():
        upper = line.upper()
        if any(token in upper for token in ("PACKAGE POLICY", "LIABILITY ONLY", "THIRD PARTY", "STANDALONE", "BUNDLED", "COMPREHENSIVE")):
            return clean_generic(line)
    return "Policy heading"


def extract_cpa_premium(clean_pages: list[str], full_text: str) -> tuple[str, int, str] | None:
    patterns = [
        rf"(?:CPA|COMPULSORY\s+PERSONAL\s+ACCIDENT)[^\n]{{0,90}}?({MONEY})\s*$",
        rf"(?:PA\s+COVER\s+FOR\s+OWNER[- ]DRIVER|OWNER[- ]DRIVER\s+PA)[^\n]{{0,90}}?({MONEY})\s*$",
    ]
    match = find_first(clean_pages, patterns)
    if match:
        amount = clean_money(match[0])
        if amount and float(amount) < 100000:
            return amount, match[1], match[2]

    # A cover period alone proves coverage exists but not a payable premium.
    if re.search(r"CPA\s*Cover\s*Period", full_text, flags=re.IGNORECASE):
        return None
    return None


def find_first(clean_pages: list[str], patterns: list[str]) -> tuple[str, int, str] | None:
    for page_index, text in enumerate(clean_pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
            if match:
                return clean_generic(match.group(1)), page_index, clean_generic(match.group(0))
    return None


def find_period(clean_pages: list[str]) -> tuple[str, str, int, str] | None:
    patterns = [
        rf"Own\s*Damage\s*Period\s*[:\-]?\s*({DATE_TOKEN})(?:\([^)]*\))?\s*To\s*({DATE_TOKEN})",
        rf"Motor\s*Liability\s*Period\s*[:\-]?\s*({DATE_TOKEN})(?:\([^)]*\))?\s*To\s*({DATE_TOKEN})",
        rf"Period\s*of\s*Insurance\s*[:\-]?\s*From\s*({DATE_TOKEN}).{{0,50}}?To\s*({DATE_TOKEN})",
    ]
    for page_index, text in enumerate(clean_pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1), match.group(2), page_index, clean_generic(match.group(0))
    return None


def to_iso_date(value: str) -> str:
    clean = re.sub(r"[^A-Z0-9\-/]", "", value.upper())
    for fmt in ("%d-%b-%Y", "%d/%b/%Y", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%y", "%d/%b/%y"):
        try:
            return datetime.strptime(clean, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def clean_generic(value: str) -> str:
    return re.sub(r"\s+", " ", sanitize_text(value)).strip(" :;-\n\t")


def clean_money(value: str) -> str:
    match = re.search(MONEY, value.replace(" ", ""))
    return match.group(0).replace(",", "") if match else ""


def clean_integer(value: str) -> str:
    match = re.search(r"\d+", value.replace(",", ""))
    return match.group(0) if match else ""


def compact_identifier(value: str) -> str:
    return re.sub(r"[^A-Z0-9\-/.]", "", value.upper())


def normalize_registration(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def normalize_model_spacing(value: str) -> str:
    value = clean_generic(value)
    value = re.sub(r"([A-Z])(?=\d)", r"\1 ", value)
    value = re.sub(r"(?<=\d)(?=[A-Z])", " ", value)
    value = value.replace("SIGNA3530", "SIGNA 3530")
    return re.sub(r"\s+", " ", value).strip()
