import os
import re
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from paddleocr import PPStructureV3

app = FastAPI(title="INSUREIT Policy OCR", version="0.1.0")
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

FIELD_PATTERNS: list[tuple[str, str, list[str]]] = [
    ("policy_number", "Policy number", [r"(?:policy|certificate)\s*(?:no\.?|number)\s*[:\-]?\s*([A-Z0-9\-/]{6,})"]),
    ("registration_number", "Registration number", [r"(?:registration|regn\.?|vehicle)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{1,4})"]),
    ("chassis_number", "Chassis number", [r"chassis\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9]{8,24})"]),
    ("engine_number", "Engine number", [r"engine\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9]{6,24})"]),
    ("insured_name", "Insured name", [r"(?:insured(?:'s)?\s*name|name\s*of\s*insured)\s*[:\-]?\s*([^\n]{3,80})"]),
    ("idv", "IDV", [r"(?:insured\s*declared\s*value|\bIDV\b)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)"]),
    ("od_premium", "OD premium", [r"(?:own\s*damage|basic\s*od|od\s*premium)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)"]),
    ("tp_premium", "TP premium", [r"(?:third\s*party|tp\s*premium)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)"]),
    ("cpa_premium", "CPA premium", [r"(?:compulsory\s*personal\s*accident|cpa)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)"]),
    ("policy_start_date", "Valid from", [r"(?:period\s*of\s*insurance\s*from|valid\s*from|policy\s*start)\s*[:\-]?\s*(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})"]),
    ("policy_end_date", "Valid upto", [r"(?:to|valid\s*(?:upto|up\s*to)|policy\s*end)\s*[:\-]?\s*(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})"]),
    ("make", "Make", [r"(?:manufacturer|make)\s*[:\-]?\s*([^\n]{2,50})"]),
    ("model", "Model", [r"(?:model|variant)\s*[:\-]?\s*([^\n]{2,60})"]),
    ("fuel_type", "Fuel type", [r"fuel\s*(?:type)?\s*[:\-]?\s*(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID)"]),
    ("manufacturing_year", "Manufacturing year", [r"(?:year\s*of\s*manufacture|mfg\.?\s*year)\s*[:\-]?\s*((?:19|20)\d{2})"]),
]


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
        pages: list[str] = []
        for result in output:
            payload = result.json if isinstance(result.json, dict) else {}
            text = collect_text(payload)
            if text.strip():
                pages.append(text)

        full_text = "\n".join(pages)
        if not full_text.strip():
            raise HTTPException(status_code=422, detail="No readable text found")

        fields = extract_fields(full_text)
        warnings: list[str] = []
        if len(fields) < 4:
            warnings.append("Only a small number of fields were identified. Review the policy copy quality and all extracted values.")

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


def extract_fields(text: str) -> list[dict[str, Any]]:
    normalized = re.sub(r"[ \t]+", " ", text.upper())
    fields: list[dict[str, Any]] = []
    seen: set[str] = set()
    for key, label, patterns in FIELD_PATTERNS:
        for pattern in patterns:
            match = re.search(pattern, normalized, flags=re.IGNORECASE)
            if not match:
                continue
            value = clean_value(key, match.group(1))
            if not value or key in seen:
                break
            seen.add(key)
            fields.append({"key": key, "label": label, "value": value, "confidence": 0.82, "page": None})
            break
    return fields


def clean_value(key: str, value: str) -> str:
    value = value.strip(" :;-\n\t")
    if key in {"registration_number", "chassis_number", "engine_number", "policy_number"}:
        return re.sub(r"\s+", "", value).upper()
    if key in {"idv", "od_premium", "tp_premium", "cpa_premium"}:
        return value.replace(",", "")
    return re.sub(r"\s+", " ", value).strip()
