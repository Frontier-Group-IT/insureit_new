import re
from datetime import datetime

import app_runtime as runtime

app = runtime.app
app.version = "0.7.4"

DATE_TOKEN = r"(?:\d{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{1,2})[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})"


def parse_date(value: str) -> datetime | None:
    cleaned = re.sub(r"\s+\d{1,2}:\d{2}(?::\d{2})?.*$", "", value.strip())
    for fmt in (
        "%d-%b-%Y", "%d/%b/%Y", "%d-%m-%Y", "%d/%m/%Y",
        "%Y-%m-%d", "%Y/%m/%d", "%d-%b-%y", "%d/%b/%y",
    ):
        try:
            return datetime.strptime(cleaned.upper(), fmt)
        except ValueError:
            continue
    return None


def digit_period(pages: list[str]):
    candidates: list[tuple[int, int, int, str, str]] = []

    for page_number, page in enumerate(pages, start=1):
        label = re.search(r"Period\s*of\s*Policy|Policy\s*Period|Policy\s*Validity", page, flags=re.IGNORECASE)
        if label:
            block = page[label.start():label.start() + 1200]
            dates = re.findall(DATE_TOKEN, block, flags=re.IGNORECASE)
            parsed = [(token, parse_date(token)) for token in dates]
            parsed = [(token, value) for token, value in parsed if value is not None]
            for index, (start_token, start_date) in enumerate(parsed):
                for end_token, end_date in parsed[index + 1:]:
                    if 330 <= (end_date - start_date).days <= 370:
                        return start_token, end_token, page_number, runtime.clean(block[:420])

        patterns = [
            rf"From\s*[:\-]?\s*({DATE_TOKEN})(?:\s+\d{{1,2}}:\d{{2}}(?::\d{{2}})?)?[\s\S]{{0,240}}?To\s*[:\-]?\s*({DATE_TOKEN})",
            rf"\b({DATE_TOKEN})\s+({DATE_TOKEN})\s+Digit\s+Commercial\s+Vehicle\s+Comprehensive\s+Policy",
            rf"Policy\s*Start\s*Date[\s\S]{{0,120}}?({DATE_TOKEN})[\s\S]{{0,220}}?Policy\s*End\s*Date[\s\S]{{0,120}}?({DATE_TOKEN})",
            rf"Policy\s*Inception\s*Date[\s\S]{{0,120}}?({DATE_TOKEN})[\s\S]{{0,220}}?(?:Expiry|Expiration)\s*Date[\s\S]{{0,120}}?({DATE_TOKEN})",
        ]
        for pattern in patterns:
            match = re.search(pattern, page, flags=re.IGNORECASE)
            if match:
                start_date = parse_date(match.group(1))
                end_date = parse_date(match.group(2))
                if start_date and end_date and 300 <= (end_date - start_date).days <= 400:
                    return match.group(1), match.group(2), page_number, runtime.clean(match.group(0))

        matches = list(re.finditer(DATE_TOKEN, page, flags=re.IGNORECASE))
        parsed_matches = [(match, parse_date(match.group(0))) for match in matches]
        parsed_matches = [(match, value) for match, value in parsed_matches if value is not None]
        for index, (start_match, start_date) in enumerate(parsed_matches):
            for end_match, end_date in parsed_matches[index + 1:]:
                if not 330 <= (end_date - start_date).days <= 370:
                    continue
                between = page[start_match.end():end_match.start()]
                context_start = max(0, start_match.start() - 220)
                context_end = min(len(page), end_match.end() + 220)
                context = page[context_start:context_end]
                upper_context = context.upper()
                score = 0
                if any(token in upper_context for token in ("PERIOD OF POLICY", "POLICY PERIOD", "VALIDITY", "FROM", " TO ")):
                    score += 5
                if any(token in upper_context for token in ("DIGIT COMMERCIAL VEHICLE", "COMPREHENSIVE POLICY", "POLICY DETAILS")):
                    score += 3
                if any(token in upper_context for token in ("INVOICE DATE", "ISSUE DATE", "RECEIPT DATE")):
                    score -= 4
                if len(between) <= 350:
                    score += 2
                candidates.append((score, -len(between), page_number, start_match.group(0), end_match.group(0)))

    if candidates:
        score, _, page_number, start_token, end_token = max(candidates, key=lambda item: (item[0], item[1]))
        if score >= 1:
            return start_token, end_token, page_number, f"Detected one-year Digit policy period: {start_token} to {end_token}"
    return None


def iso(value: str) -> str:
    parsed = parse_date(value)
    return parsed.strftime("%Y-%m-%d") if parsed else ""


def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "insureit-policy-ocr",
        "model": "PDF text first, PaddleOCR fallback",
        "schema": "indian_motor_policy_v1",
        "version": "0.7.4",
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
