import html
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from paddleocr import PPStructureV3

app = FastAPI(title="INSUREIT Policy OCR", version="0.2.0")
SECRET = os.environ.get("POLICY_OCR_SERVICE_SECRET", "")
MAX_BYTES = 15 * 1024 * 1024

pipeline = PPStructureV3(
    lang="en",
    use_doc_orientation_classify=True,
    use_doc_unwarping=True,
    use_textline_orientation=True,
    use_formula_recognition=False,
    use_chart_recognition=False,
)

MONTH_DATE = r"\d{1,2}[\-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[\-/]\d{2,4}"
MONEY = r"[\d,]+(?:\.\d{1,2})?"

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
    return {"status": "ok", "service": "insureit-policy-ocr", "model": "PP-StructureV3"}


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
        output = pipeline.predict(input_path)
        raw_pages: list[str] = []
        for result in output:
            payload = result.json if isinstance(result.json, dict) else {}
            text = collect_text(payload)
            if text.strip():
                raw_pages.append(text)

        if not raw_pages:
            raise HTTPException(status_code=422, detail="No readable text found")

        fields = extract_fields(raw_pages)
        warnings: list[str] = []
        if len(fields) < 8:
            warnings.append(
                "Only a limited number of fields were identified. Review the document quality and all extracted values."
            )
        if not any(field["key"] == "policy_number" for field in fields):
            warnings.append("Current policy number could not be identified reliably.")
        if not any(field["key"] == "registration_number" for field in fields):
            warnings.append("Vehicle registration number could not be identified reliably.")

        return {
            "model": "PaddleOCR PP-StructureV3",
            "schema": schema,
            "fields": fields,
            "warnings": warnings,
        }
    finally:
        Path(input_path).unlink(missing_ok=True)


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


def cell_text(value: str) -> str:
    return re.sub(r"\s+", " ", sanitize_text(value)).strip(" :;-\n\t")


def extract_html_rows(raw: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_match in re.finditer(r"<tr\b[^>]*>(.*?)</tr>", raw, flags=re.IGNORECASE | re.DOTALL):
        row_html = row_match.group(1)
        cells = [
            cell_text(match.group(1))
            for match in re.finditer(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row_html, flags=re.IGNORECASE | re.DOTALL)
        ]
        if cells:
            rows.append(cells)
    return rows


def normalize_label(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def lookup_table_value(raw_pages: list[str], labels: list[str]) -> tuple[str, int, str] | None:
    wanted = {normalize_label(label) for label in labels}
    for page_index, raw in enumerate(raw_pages, start=1):
        rows = extract_html_rows(raw)
        for row_index, row in enumerate(rows):
            normalized_row = [normalize_label(cell) for cell in row]

            # Header row followed by a values row, such as Make / Model / Variant.
            for column_index, normalized_cell in enumerate(normalized_row):
                if normalized_cell not in wanted:
                    continue
                if row_index + 1 < len(rows) and column_index < len(rows[row_index + 1]):
                    candidate = clean_generic(rows[row_index + 1][column_index])
                    if is_valid_candidate(candidate):
                        return candidate, page_index, f"{row[column_index]}: {candidate}"

                # Label and value in the same row, such as Total IDV / 4,800,000.
                for candidate_index in range(column_index + 1, len(row)):
                    candidate = clean_generic(row[candidate_index])
                    if is_valid_candidate(candidate) and normalize_label(candidate) not in wanted:
                        return candidate, page_index, f"{row[column_index]}: {candidate}"
    return None


def find_pattern(
    clean_pages: list[str],
    patterns: list[str],
    *,
    flags: int = re.IGNORECASE,
    validator: Any | None = None,
) -> tuple[str, int, str] | None:
    for page_index, text in enumerate(clean_pages, start=1):
        for pattern in patterns:
            match = re.search(pattern, text, flags=flags)
            if not match:
                continue
            candidate = clean_generic(match.group(1))
            if validator and not validator(candidate):
                continue
            evidence = clean_generic(match.group(0))[:180]
            return candidate, page_index, evidence
    return None


def extract_fields(raw_pages: list[str]) -> list[dict[str, Any]]:
    clean_pages = [sanitize_text(page) for page in raw_pages]
    fields: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(
        key: str,
        result: tuple[str, int, str] | None,
        *,
        confidence: float,
        cleaner: Any | None = None,
    ) -> None:
        if not result or key in seen:
            return
        value, page, evidence = result
        if cleaner:
            value = cleaner(value)
        if not value or not is_valid_candidate(value):
            return
        seen.add(key)
        fields.append(
            {
                "key": key,
                "label": FIELD_LABELS[key],
                "value": value,
                "confidence": confidence,
                "page": page,
                "evidence": evidence,
            }
        )

    full_upper = "\n".join(clean_pages).upper()

    insurer = None
    if "THE NEW INDIA ASSURANCE" in full_upper:
        insurer = ("The New India Assurance Co. Ltd.", 1, "The New India Assurance Co. Ltd.")
    add("insurer_name", insurer, confidence=0.99)

    add(
        "policy_number",
        find_pattern(
            clean_pages,
            [
                r"(?im)^\s*Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})\s*$",
                r"Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})",
            ],
            validator=is_policy_number,
        ),
        confidence=0.97,
        cleaner=compact_identifier,
    )

    add(
        "insured_name",
        find_pattern(
            clean_pages,
            [r"Insured\s*Name\s*[:\-]?\s*([^\n]{3,80})"],
            validator=is_person_name,
        ),
        confidence=0.97,
        cleaner=clean_name,
    )

    add(
        "policy_issued_date",
        find_pattern(clean_pages, [rf"Policy\s*Issued\s*On\s*[:\-]?\s*({MONTH_DATE}(?:\s*\([^\n)]*\))?)"]),
        confidence=0.96,
    )

    period_result = find_pattern(
        clean_pages,
        [rf"Own\s*Damage\s*Period\s*[:\-]?\s*({MONTH_DATE}(?:\([^)]*\))?)\s*To\s*({MONTH_DATE}(?:\([^)]*\)|\s*Midnight)?)"],
    )
    if period_result:
        page_text = clean_pages[period_result[1] - 1]
        match = re.search(
            rf"Own\s*Damage\s*Period\s*[:\-]?\s*({MONTH_DATE}(?:\([^)]*\))?)\s*To\s*({MONTH_DATE}(?:\([^)]*\)|\s*Midnight)?)",
            page_text,
            flags=re.IGNORECASE,
        )
        if match:
            evidence = clean_generic(match.group(0))[:180]
            add("policy_start_date", (clean_generic(match.group(1)), period_result[1], evidence), confidence=0.97)
            add("policy_end_date", (clean_generic(match.group(2)), period_result[1], evidence), confidence=0.97)

    table_specs: list[tuple[str, list[str], float, Any | None]] = [
        ("make", ["Make", "Manufacturer"], 0.96, clean_generic),
        ("model", ["Model"], 0.96, clean_generic),
        ("variant", ["Variant"], 0.95, clean_generic),
        ("manufacturing_year", ["Manufacturing Year", "Year of Manufacture", "Mfg Year"], 0.96, clean_generic),
        ("seating_capacity", ["Seating capacity", "Seating Capacity"], 0.94, clean_integer),
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
    ]
    for key, labels, confidence, cleaner in table_specs:
        add(key, lookup_table_value(raw_pages, labels), confidence=confidence, cleaner=cleaner)

    if "registration_number" not in seen:
        registration = lookup_table_value(raw_pages, ["Registration No.", "Registration No", "Regn No."])
        if registration:
            value, page, evidence = registration
            normalized_registration = normalize_registration(value)
            if is_registration(normalized_registration):
                add("registration_number", (normalized_registration, page, evidence), confidence=0.98)
    if "registration_number" not in seen:
        add(
            "registration_number",
            find_pattern(
                clean_pages,
                [r"\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4})\b"],
                validator=lambda value: is_registration(normalize_registration(value)),
            ),
            confidence=0.88,
            cleaner=normalize_registration,
        )

    add(
        "previous_policy_number",
        find_pattern(
            clean_pages,
            [r"Previous\s*Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})"],
            validator=is_policy_number,
        ),
        confidence=0.97,
        cleaner=compact_identifier,
    )

    add(
        "proposal_number",
        find_pattern(clean_pages, [r"Proposal\s*No\.?\s*(?:&\s*Date)?\s*[:\-]?\s*([A-Z0-9\-/]{6,30})"]),
        confidence=0.95,
        cleaner=compact_identifier,
    )

    add(
        "hypothecation",
        find_pattern(clean_pages, [r"Hypothecation\s*Details\s*[:\-]?\s*([^\n]{3,120})"]),
        confidence=0.96,
    )

    addons: list[str] = []
    if re.search(r"\bNIL\s+DEPRECIATION\b", full_upper):
        addons.append("Nil Depreciation")
    if re.search(r"\bTOWING\b", full_upper):
        addons.append("Towing")
    if addons:
        add("add_ons", (", ".join(addons), 2 if len(clean_pages) > 1 else 1, ", ".join(addons)), confidence=0.94)

    return fields


def clean_generic(value: str) -> str:
    value = sanitize_text(value)
    value = re.sub(r"\s+", " ", value).strip(" :;-\n\t")
    return value


def compact_identifier(value: str) -> str:
    return re.sub(r"[^A-Z0-9\-/]", "", value.upper())


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
