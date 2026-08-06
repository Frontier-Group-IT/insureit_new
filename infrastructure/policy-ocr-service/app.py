import html
import os
import re
import subprocess
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

app = FastAPI(title="INSUREIT Policy OCR", version="0.6.0")
SECRET = os.environ.get("POLICY_OCR_SERVICE_SECRET", "")
MAX_BYTES = 15 * 1024 * 1024
MONEY = r"\d[\d,]*(?:\.\d{1,2})?"
DATE_TOKEN = r"\d{1,2}[\-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[\-/]\d{2,4}"

_pipeline: Any | None = None
_pipeline_lock = threading.Lock()

FIELD_LABELS = {
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


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "insureit-policy-ocr",
        "model": "PDF text first, PaddleOCR fallback",
        "schema": "indian_motor_policy_v1",
        "version": "0.6.0",
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
        pages = extract_pdf_text(input_path) if suffix == ".pdf" else []
        extraction_method = "native_pdf_text" if pages else "paddleocr"
        model_name = "Native PDF text" if pages else "PaddleOCR PP-StructureV3"
        if not pages:
            pages = extract_with_paddle(input_path)
        if not pages:
            raise HTTPException(status_code=422, detail="No readable text found")

        clean_pages = [sanitize_text(page) for page in pages]
        full_text = "\n".join(clean_pages)
        parser_id = detect_parser(full_text)
        parser_version = "new_india_motor_v1.1.0" if parser_id == "new_india_motor_v1" else "generic_motor_v1.1.0"
        fields = extract_policy_section_fields(clean_pages, parser_id)

        required = {
            "policy_product",
            "idv",
            "od_premium",
            "tp_premium",
            "policy_number",
            "insurer_name",
            "policy_start_date",
            "policy_end_date",
        }
        present = {field["key"] for field in fields}
        missing = sorted(required - present)
        warnings: list[str] = []
        if missing:
            warnings.append("Review required. Missing or uncertain fields: " + ", ".join(missing) + ".")
        if parser_id == "generic_motor_v1":
            warnings.append("This insurer format is not fully supported yet. Verify every value manually.")

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
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", input_path, "-"],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (subprocess.SubprocessError, OSError):
        return []
    text = result.stdout.replace("\x00", "")
    if sum(character.isalnum() for character in text) < 200:
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
    upper = text.upper()
    if "THE NEW INDIA ASSURANCE" in upper or "NEW INDIA ASSURANCE COMPANY" in upper:
        return "new_india_motor_v1"
    return "generic_motor_v1"


def extract_policy_section_fields(clean_pages: list[str], parser_id: str) -> list[dict[str, Any]]:
    full_text = "\n".join(clean_pages)
    full_upper = full_text.upper()
    fields: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(key: str, value: str | None, confidence: float, evidence: str = "", page: int | None = None) -> None:
        if key in seen or not value:
            return
        cleaned = value.strip()
        if not cleaned:
            return
        seen.add(key)
        fields.append({
            "key": key,
            "label": FIELD_LABELS[key],
            "value": cleaned,
            "confidence": confidence,
            "page": page,
            "evidence": evidence[:180],
        })

    if parser_id == "new_india_motor_v1":
        add("insurer_name", "The New India Assurance Co. Ltd.", 0.99, "The New India Assurance Co. Ltd.", 1)
    else:
        insurer = find_labeled_text(clean_pages, ["Insurance Company", "Insurer", "Issued By"])
        if insurer:
            add("insurer_name", insurer[0], 0.78, insurer[2], insurer[1])

    product = classify_policy_product(full_upper)
    if product:
        add("policy_product", product, 0.98 if parser_id == "new_india_motor_v1" else 0.86, product_evidence(full_text), 1)

    policy_number = find_first(clean_pages, [
        r"Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})",
        r"Policy\s*Number\s*[:\-]?\s*([A-Z0-9\-/]{8,30})",
    ])
    if policy_number:
        add("policy_number", compact_identifier(policy_number[0]), 0.98, policy_number[2], policy_number[1])

    period = find_period(clean_pages)
    if period:
        start, end, page, evidence = period
        add("policy_start_date", to_iso_date(start), 0.98, evidence, page)
        add("policy_end_date", to_iso_date(end), 0.98, evidence, page)

    idv = extract_money_near_labels(
        clean_pages,
        ["Total IDV", "Total Insured Declared Value", "Insured Declared Value"],
        chooser=lambda values: max((value for value in values if value >= 1000), default=0),
    )
    if idv and idv[0] > 0:
        add("idv", money_string(idv[0]), 0.98, idv[2], idv[1])

    od = extract_money_near_labels(clean_pages, ["Net Own Damage Premium (A)", "Net Own Damage Premium", "OD Premium"])
    if od:
        add("od_premium", money_string(od[0]), 0.98, od[2], od[1])

    tp = extract_money_near_labels(clean_pages, ["Net Liability Premium (B)", "Net Liability Premium", "Third Party Premium"])
    if tp:
        add("tp_premium", money_string(tp[0]), 0.98, tp[2], tp[1])

    cpa = extract_cpa_premium(clean_pages)
    if cpa and cpa[0] > 0:
        add("cpa_premium", money_string(cpa[0]), 0.96, cpa[2], cpa[1])
        add("cpa_opted", "Yes", 0.97, cpa[2], cpa[1])
    else:
        add("cpa_premium", "0", 0.86, "No payable CPA premium identified")
        add("cpa_opted", "No", 0.88, "Derived from CPA amount")

    net = extract_money_near_labels(clean_pages, ["Total Premium (A+B)", "Net Premium"])
    if net:
        add("total_premium", money_string(net[0]), 0.97, net[2], net[1])

    tax = extract_money_near_labels(clean_pages, ["IGST", "CGST", "SGST", "GST"])
    if tax:
        add("tax_amount", money_string(tax[0]), 0.95, tax[2], tax[1])

    gross = extract_money_near_labels(clean_pages, ["Gross Premium Paid", "Gross Premium", "Total Premium Payable"])
    if gross:
        add("gross_premium", money_string(gross[0]), 0.98, gross[2], gross[1])

    return fields


def classify_policy_product(text_upper: str) -> str | None:
    if re.search(r"\b(?:LONG\s+TERM|MULTI\s*YEAR)\s+(?:THIRD\s+PARTY|LIABILITY)\b", text_upper):
        return "Long Term Third Party"
    if re.search(r"\b(?:LONG\s+TERM|MULTI\s*YEAR)\s+(?:PACKAGE|COMPREHENSIVE)\b", text_upper):
        return "Long Term Package"
    if "BUNDLED" in text_upper:
        return "Bundled"
    if re.search(r"\b(?:STANDALONE|STAND\s+ALONE)\s+(?:OWN\s+DAMAGE|OD)\b|\bSAOD\b", text_upper):
        return "SAOD"
    if re.search(r"\b(?:LIABILITY\s+ONLY|ACT\s+ONLY|THIRD\s+PARTY)\b", text_upper):
        return "Third Party"
    if re.search(r"\bPACKAGE\s+POLICY\b|\bCOMPREHENSIVE\b", text_upper):
        return "Package"
    return None


def product_evidence(text: str) -> str:
    for line in text.splitlines():
        upper = line.upper()
        if any(token in upper for token in ("PACKAGE POLICY", "COMPREHENSIVE", "LIABILITY ONLY", "THIRD PARTY", "STANDALONE", "SAOD", "BUNDLED", "LONG TERM")):
            return line.strip()
    return "Policy product classification"


def find_period(pages: list[str]) -> tuple[str, str, int, str] | None:
    patterns = [
        rf"Own\s*Damage\s*Period\s*[:\-]?\s*({DATE_TOKEN})(?:\([^)]*\))?\s*To\s*({DATE_TOKEN})",
        rf"Period\s*of\s*Insurance\s*[:\-]?\s*From\s*({DATE_TOKEN}).{{0,80}}?To\s*({DATE_TOKEN})",
        rf"Policy\s*Period\s*[:\-]?\s*({DATE_TOKEN}).{{0,80}}?To\s*({DATE_TOKEN})",
    ]
    for page_number, page in enumerate(pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1), match.group(2), page_number, clean_generic(match.group(0))
    return None


def extract_money_near_labels(
    pages: list[str],
    labels: list[str],
    chooser: Callable[[list[float]], float] | None = None,
) -> tuple[float, int, str] | None:
    normalized_labels = [normalize_label(label) for label in labels]
    for page_number, page in enumerate(pages, start=1):
        lines = page.splitlines()
        for index, line in enumerate(lines):
            normalized_line = normalize_label(line)
            matched_label = next((label for label in normalized_labels if label in normalized_line), None)
            if not matched_label:
                continue

            candidate_lines = [line]
            if index + 1 < len(lines):
                candidate_lines.append(lines[index + 1])
            if index + 2 < len(lines):
                candidate_lines.append(lines[index + 2])

            values: list[float] = []
            for candidate_line in candidate_lines:
                for token in re.findall(MONEY, candidate_line):
                    number = parse_money(token)
                    if number is not None:
                        values.append(number)

            if not values:
                continue
            selected = chooser(values) if chooser else select_likely_premium(values)
            if selected <= 0:
                continue
            evidence = clean_generic(" | ".join(candidate_lines))
            return selected, page_number, evidence
    return None


def select_likely_premium(values: list[float]) -> float:
    plausible = [value for value in values if 1 <= value <= 100_000_000]
    if not plausible:
        return 0
    non_percent = [value for value in plausible if value > 100]
    return non_percent[-1] if non_percent else plausible[-1]


def extract_cpa_premium(pages: list[str]) -> tuple[float, int, str] | None:
    labels = [
        "Compulsory Personal Accident",
        "CPA Cover",
        "Owner Driver",
        "PA Cover for Owner Driver",
    ]
    result = extract_money_near_labels(pages, labels)
    if not result:
        return None
    amount, page, evidence = result
    if amount <= 0 or amount > 100_000:
        return None
    return amount, page, evidence


def find_first(pages: list[str], patterns: list[str]) -> tuple[str, int, str] | None:
    for page_number, page in enumerate(pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE | re.MULTILINE)
            if match:
                return clean_generic(match.group(1)), page_number, clean_generic(match.group(0))
    return None


def find_labeled_text(pages: list[str], labels: list[str]) -> tuple[str, int, str] | None:
    for page_number, page in enumerate(pages, start=1):
        for label in labels:
            match = re.search(rf"{re.escape(label)}\s*[:\-]?\s*([^\n]{{3,100}})", page, flags=re.IGNORECASE)
            if match:
                return clean_generic(match.group(1)), page_number, clean_generic(match.group(0))
    return None


def parse_money(value: str) -> float | None:
    cleaned = value.replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def money_string(value: float) -> str:
    return str(int(value)) if value.is_integer() else f"{value:.2f}".rstrip("0").rstrip(".")


def compact_identifier(value: str) -> str:
    return re.sub(r"[^A-Z0-9\-/.]", "", value.upper())


def clean_generic(value: str) -> str:
    return re.sub(r"\s+", " ", sanitize_text(value)).strip(" :;-\n\t")


def normalize_label(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def to_iso_date(value: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", value).strip()
    for fmt in ("%d-%b-%Y", "%d/%b/%Y", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%y", "%d/%b/%y"):
        try:
            return datetime.strptime(cleaned.upper(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""
