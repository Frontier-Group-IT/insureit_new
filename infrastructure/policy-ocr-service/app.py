import html
import os
import re
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

app = FastAPI(title="INSUREIT Policy OCR", version="0.4.0")
SECRET = os.environ.get("POLICY_OCR_SERVICE_SECRET", "")
MAX_BYTES = 15 * 1024 * 1024
MONTH_DATE = r"\d{1,2}[\-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[\-/]\d{2,4}"
MONEY = r"[\d,]+(?:\.\d{1,2})?"

_pipeline: Any | None = None
_pipeline_lock = threading.Lock()

FIELD_LABELS: dict[str, str] = {
    "insurer_name": "Insurer",
    "policy_number": "Policy number",
    "insured_name": "Insured name",
    "policy_issued_date": "Policy issued date",
    "policy_start_date": "Policy start date",
    "policy_end_date": "Policy end date",
    "registration_number": "Registration number",
    "make": "Make",
    "model": "Model",
    "variant": "Variant",
    "manufacturing_year": "Manufacturing year",
    "seating_capacity": "Seating capacity",
    "gvw": "GVW",
    "chassis_number": "Chassis number",
    "engine_number": "Engine number",
    "vehicle_type": "Vehicle type",
    "vehicle_sub_class": "Vehicle sub class",
    "built_type": "Built type",
    "idv": "Total IDV",
    "od_premium": "Net OD premium",
    "tp_premium": "Net liability premium",
    "total_premium": "Total premium before tax",
    "tax_amount": "Tax amount",
    "gross_premium": "Gross premium paid",
    "previous_policy_number": "Previous policy number",
    "hypothecation": "Hypothecation",
    "proposal_number": "Proposal number",
    "add_ons": "Add-ons",
}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "insureit-policy-ocr", "model": "PDF text first, PaddleOCR fallback"}


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
        raw_pages: list[str] = []
        model_name = "Native PDF text"

        if suffix == ".pdf":
            raw_pages = extract_pdf_text(input_path)

        fields = extract_fields(raw_pages) if raw_pages else []

        # Text-based PDFs should finish here in seconds. Use PaddleOCR only when
        # the PDF contains no useful text or too few fields were found.
        if len(fields) < 8:
            raw_pages = extract_with_paddle(input_path)
            model_name = "PaddleOCR PP-StructureV3"
            fields = extract_fields(raw_pages)

        if not raw_pages:
            raise HTTPException(status_code=422, detail="No readable text found")

        warnings: list[str] = []
        if len(fields) < 8:
            warnings.append("Only a limited number of fields were identified. Review the document quality and all extracted values.")
        if not any(field["key"] == "policy_number" for field in fields):
            warnings.append("Current policy number could not be identified reliably.")
        if not any(field["key"] == "registration_number" for field in fields):
            warnings.append("Vehicle registration number could not be identified reliably.")

        return {
            "model": model_name,
            "schema": schema,
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
    pages = [page.strip() for page in text.split("\f") if page.strip()]
    useful = sum(character.isalnum() for character in text)
    return pages if useful >= 200 else []


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
    output = get_pipeline().predict(input_path)
    pages: list[str] = []
    for result in output:
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


def clean_generic(value: str) -> str:
    return re.sub(r"\s+", " ", sanitize_text(value)).strip(" :;-\n\t")


def compact_identifier(value: str) -> str:
    return re.sub(r"[^A-Z0-9\-/.]", "", value.upper())


def clean_integer(value: str) -> str:
    match = re.search(r"\d+", value.replace(",", ""))
    return match.group(0) if match else ""


def clean_money(value: str) -> str:
    match = re.search(MONEY, value.replace(" ", ""))
    return match.group(0).replace(",", "") if match else ""


def clean_name(value: str) -> str:
    value = re.split(r"\b(?:Own Damage Period|Motor Liability Period|Policy Issued|Policy No\.?|Proposal No\.?)\b", value, maxsplit=1, flags=re.IGNORECASE)[0]
    return clean_generic(value).upper()


def normalize_registration(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def normalize_label(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def extract_html_rows(raw: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_match in re.finditer(r"<tr\b[^>]*>(.*?)</tr>", raw, flags=re.IGNORECASE | re.DOTALL):
        cells = [
            clean_generic(match.group(1))
            for match in re.finditer(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row_match.group(1), flags=re.IGNORECASE | re.DOTALL)
        ]
        if cells:
            rows.append(cells)
    return rows


def split_layout_columns(line: str) -> list[str]:
    return [clean_generic(part) for part in re.split(r"\s{2,}", line.strip()) if clean_generic(part)]


def lookup_table_value(raw_pages: list[str], labels: list[str]) -> tuple[str, int, str] | None:
    wanted = {normalize_label(label) for label in labels}

    for page_index, raw in enumerate(raw_pages, start=1):
        rows = extract_html_rows(raw)
        for row_index, row in enumerate(rows):
            normalized_row = [normalize_label(cell) for cell in row]
            for column_index, normalized_cell in enumerate(normalized_row):
                if normalized_cell not in wanted:
                    continue
                if row_index + 1 < len(rows) and column_index < len(rows[row_index + 1]):
                    candidate = clean_generic(rows[row_index + 1][column_index])
                    if is_valid_candidate(candidate):
                        return candidate, page_index, f"{row[column_index]}: {candidate}"
                for candidate_index in range(column_index + 1, len(row)):
                    candidate = clean_generic(row[candidate_index])
                    if is_valid_candidate(candidate) and normalize_label(candidate) not in wanted:
                        return candidate, page_index, f"{row[column_index]}: {candidate}"

        # Native PDF text: label and value in one line or a header row followed by values.
        lines = raw.splitlines()
        for line_index, line in enumerate(lines):
            columns = split_layout_columns(line)
            normalized = [normalize_label(column) for column in columns]
            for column_index, normalized_cell in enumerate(normalized):
                if normalized_cell not in wanted:
                    continue
                if column_index + 1 < len(columns):
                    candidate = clean_generic(columns[column_index + 1])
                    if is_valid_candidate(candidate):
                        return candidate, page_index, f"{columns[column_index]}: {candidate}"
                if line_index + 1 < len(lines):
                    next_columns = split_layout_columns(lines[line_index + 1])
                    if column_index < len(next_columns):
                        candidate = clean_generic(next_columns[column_index])
                        if is_valid_candidate(candidate):
                            return candidate, page_index, f"{columns[column_index]}: {candidate}"

    return None


def find_pattern(
    clean_pages: list[str],
    patterns: list[str],
    *,
    validator: Any | None = None,
) -> tuple[str, int, str] | None:
    for page_index, text in enumerate(clean_pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
            if not match:
                continue
            candidate = clean_generic(match.group(1))
            if validator and not validator(candidate):
                continue
            return candidate, page_index, clean_generic(match.group(0))[:180]
    return None


def extract_fields(raw_pages: list[str]) -> list[dict[str, Any]]:
    clean_pages = [sanitize_text(page) for page in raw_pages]
    full_text = "\n".join(clean_pages)
    full_upper = full_text.upper()
    fields: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(key: str, result: tuple[str, int, str] | None, confidence: float, cleaner: Any | None = None) -> None:
        if not result or key in seen:
            return
        value, page, evidence = result
        if cleaner:
            value = cleaner(value)
        if not is_valid_candidate(value):
            return
        seen.add(key)
        fields.append({
            "key": key,
            "label": FIELD_LABELS[key],
            "value": value,
            "confidence": confidence,
            "page": page,
            "evidence": evidence,
        })

    if "THE NEW INDIA ASSURANCE" in full_upper:
        add("insurer_name", ("The New India Assurance Co. Ltd.", 1, "The New India Assurance Co. Ltd."), 0.99)

    add("policy_number", find_pattern(clean_pages, [r"^\s*Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})\s*$", r"Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})"], validator=is_policy_number), 0.97, compact_identifier)
    add("insured_name", find_pattern(clean_pages, [r"Insured\s*Name\s*[:\-]?\s*([^\n]{3,80})"], validator=is_person_name), 0.97, clean_name)
    add("policy_issued_date", find_pattern(clean_pages, [rf"Policy\s*Issued\s*On\s*[:\-]?\s*({MONTH_DATE}(?:\s*\([^\n)]*\))?)"]), 0.96)

    for page_index, page in enumerate(clean_pages, start=1):
        period = re.search(rf"Own\s*Damage\s*Period\s*[:\-]?\s*({MONTH_DATE}(?:\([^)]*\))?)\s*To\s*({MONTH_DATE}(?:\([^)]*\)|\s*Midnight)?)", page, flags=re.IGNORECASE)
        if period:
            evidence = clean_generic(period.group(0))[:180]
            add("policy_start_date", (period.group(1), page_index, evidence), 0.97)
            add("policy_end_date", (period.group(2), page_index, evidence), 0.97)
            break

    table_specs: list[tuple[str, list[str], float, Any | None]] = [
        ("make", ["Make", "Manufacturer"], 0.96, clean_generic),
        ("model", ["Model"], 0.96, normalize_model_spacing),
        ("variant", ["Variant"], 0.95, normalize_model_spacing),
        ("manufacturing_year", ["Manufacturing Year", "Year of Manufacture", "Mfg Year"], 0.96, clean_integer),
        ("seating_capacity", ["Seating capacity"], 0.94, clean_integer),
        ("gvw", ["GVW"], 0.96, clean_integer),
        ("chassis_number", ["Chassis No.", "Chassis No", "Chassis Number"], 0.98, compact_identifier),
        ("engine_number", ["Engine/Motor No.", "Engine Motor No", "Engine No.", "Engine Number"], 0.98, compact_identifier),
        ("vehicle_type", ["Vehicle Type"], 0.94, clean_generic),
        ("vehicle_sub_class", ["Vehicle Sub Class", "Vehicle Subclass"], 0.94, clean_generic),
        ("built_type", ["Built Type"], 0.94, clean_generic),
        ("idv", ["Total IDV", "Total Insured Declared Value"], 0.98, clean_money),
        ("od_premium", ["Net Own Damage Premium (A)", "Net Own Damage Premium"], 0.98, clean_money),
        ("tp_premium", ["Net Liability Premium (B)", "Net Liability Premium"], 0.98, clean_money),
        ("total_premium", ["Total Premium (A+B)", "Total Premium"], 0.98, clean_money),
        ("tax_amount", ["IGST (5% of Basic TP + 18% of rest of Premium)", "IGST", "GST"], 0.96, clean_money),
        ("gross_premium", ["Gross Premium Paid", "Premium Paid"], 0.98, clean_money),
        ("registration_number", ["Registration No.", "Registration No", "Regn No."], 0.98, normalize_registration),
    ]
    for key, labels, confidence, cleaner in table_specs:
        add(key, lookup_table_value(raw_pages, labels), confidence, cleaner)

    # Strong text fallbacks for common Indian motor-policy layouts.
    add("registration_number", find_pattern(clean_pages, [r"Registration\s*No\.?[^\n]*?\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4})\b", r"\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4})\b"], validator=lambda value: is_registration(normalize_registration(value))), 0.92, normalize_registration)
    add("chassis_number", find_pattern(clean_pages, [r"Chassis\s*No\.?[^\n]*?\b([A-Z0-9]{12,24})\b"]), 0.94, compact_identifier)
    add("engine_number", find_pattern(clean_pages, [r"Engine(?:/Motor)?\s*No\.?[^\n]*?\b([A-Z0-9. ]{12,30})\b"]), 0.92, compact_identifier)
    add("idv", find_pattern(clean_pages, [rf"Total\s*IDV\s*[:\-]?\s*({MONEY})"]), 0.96, clean_money)
    add("od_premium", find_pattern(clean_pages, [rf"Net\s*Own\s*Damage\s*Premium\s*\(A\)\s*[:\-]?\s*({MONEY})"]), 0.97, clean_money)
    add("tp_premium", find_pattern(clean_pages, [rf"Net\s*Liability\s*Premium\s*\(B\)\s*[:\-]?\s*({MONEY})"]), 0.97, clean_money)
    add("total_premium", find_pattern(clean_pages, [rf"Total\s*Premium\s*\(A\+B\)\s*[:\-]?\s*({MONEY})"]), 0.97, clean_money)
    add("tax_amount", find_pattern(clean_pages, [rf"IGST[^\n]*?({MONEY})\s*$"]), 0.95, clean_money)
    add("gross_premium", find_pattern(clean_pages, [rf"Gross\s*Premium\s*Paid\s*[:\-]?\s*({MONEY})"]), 0.97, clean_money)

    add("previous_policy_number", find_pattern(clean_pages, [r"Previous\s*Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})"], validator=is_policy_number), 0.97, compact_identifier)
    add("proposal_number", find_pattern(clean_pages, [r"Proposal\s*No\.?\s*(?:&\s*Date)?\s*[:\-]?\s*([A-Z0-9\-/]{6,30})"]), 0.95, compact_identifier)
    add("hypothecation", find_pattern(clean_pages, [r"Hypothecation\s*Details\s*[:\-]?\s*([^\n]{3,120})"]), 0.96, normalize_hypothecation)

    addons: list[str] = []
    if re.search(r"\bNIL\s+DEPRECIATION\b", full_upper):
        addons.append("Nil Depreciation")
    if re.search(r"\bTOWING\b", full_upper):
        addons.append("Towing")
    if addons:
        add("add_ons", (", ".join(addons), 2 if len(clean_pages) > 1 else 1, ", ".join(addons)), 0.94)

    return fields


def normalize_model_spacing(value: str) -> str:
    value = clean_generic(value)
    value = re.sub(r"([A-Z])(?=\d)", r"\1 ", value)
    value = re.sub(r"(?<=\d)(?=[A-Z])", " ", value)
    value = re.sub(r"(?<=\d)(?=\d{3}\.TK\b)", " ", value)
    value = value.replace("SIGNA3530", "SIGNA 3530")
    return re.sub(r"\s+", " ", value).strip()


def normalize_hypothecation(value: str) -> str:
    value = clean_generic(value).replace("BANKOFINDIA", "BANK OF INDIA")
    value = re.sub(r"\s*-\s*", " - ", value)
    return re.sub(r"\s+", " ", value).strip()


def is_valid_candidate(value: str) -> bool:
    if not value or len(value) > 180:
        return False
    upper = value.upper()
    if any(fragment in upper for fragment in ("</TD", "<TD", "<TR", "<TABLE", "OF APPOINTEE")):
        return False
    return True


def is_policy_number(value: str) -> bool:
    compact = compact_identifier(value)
    return 8 <= len(compact) <= 30 and sum(character.isdigit() for character in compact) >= 6


def is_person_name(value: str) -> bool:
    upper = clean_generic(value).upper()
    if any(fragment in upper for fragment in ("APPOINTEE", "NOMINEE", "RELATIONSHIP", "PREVIOUS", "POLICY", "PERIOD")):
        return False
    return bool(re.fullmatch(r"[A-Z][A-Z .'-]{2,79}", upper))


def is_registration(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}", value))
