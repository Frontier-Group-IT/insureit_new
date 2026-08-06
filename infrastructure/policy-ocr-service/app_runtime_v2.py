import re
from datetime import datetime

import app_runtime as runtime

app = runtime.app
app.version = "0.7.3"

DATE_TOKEN = r"(?:\d{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})"


def digit_period(pages: list[str]):
    for page_number, page in enumerate(pages, start=1):
        label = re.search(r"Period\s*of\s*Policy|Policy\s*Period", page, flags=re.IGNORECASE)
        if label:
            block = page[label.start():label.start() + 700]
            dates = re.findall(DATE_TOKEN, block, flags=re.IGNORECASE)
            if len(dates) >= 2:
                return dates[0], dates[1], page_number, runtime.clean(block[:300])

        patterns = [
            rf"From\s*[:\-]?\s*({DATE_TOKEN})(?:\s+\d{{1,2}}:\d{{2}}(?::\d{{2}})?)?[\s\S]{{0,180}}?To\s*[:\-]?\s*({DATE_TOKEN})",
            rf"\b({DATE_TOKEN})\s+({DATE_TOKEN})\s+Digit\s+Commercial\s+Vehicle\s+Comprehensive\s+Policy",
        ]
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE)
            if match:
                return match.group(1), match.group(2), page_number, runtime.clean(match.group(0))
    return None


def iso(value: str) -> str:
    cleaned = re.sub(r"\s+\d{1,2}:\d{2}(?::\d{2})?.*$", "", value.strip())
    for fmt in (
        "%d-%b-%Y", "%d/%b/%Y", "%d-%m-%Y", "%d/%m/%Y",
        "%Y-%m-%d", "%Y/%m/%d", "%d-%b-%y", "%d/%b/%y",
    ):
        try:
            return datetime.strptime(cleaned.upper(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "insureit-policy-ocr",
        "model": "PDF text first, PaddleOCR fallback",
        "schema": "indian_motor_policy_v1",
        "version": "0.7.3",
    }


runtime.digit_period = digit_period
runtime.iso = iso
extract_digit = runtime.extract_digit
extract_iffco = runtime.extract_iffco

for route in app.routes:
    if getattr(route, "path", None) == "/health":
        route.endpoint = health
        if getattr(route, "dependant", None) is not None:
            route.dependant.call = health
