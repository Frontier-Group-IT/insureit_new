#!/usr/bin/env python3
"""Safe first-error summary for isolated PostgreSQL SQL/COPY replay.

Reports only SQLSTATE, an allowlisted meaning, and psql input line number.
Never prints SQL, table/column names, customer values or full DB errors.
"""
from pathlib import Path
import re
import sys

MAX_LOG_BYTES = 2_000_000
CODE = re.compile(r"\b(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5}):", re.I)
LINE = re.compile(r"\bpsql:[^\n:]*:(\d{1,9}):", re.I)
ERROR = re.compile(r"\b(?:ERROR|FATAL|PANIC):", re.I)
SQLSTATES = {
    "23505": "unique_violation",
    "23503": "foreign_key_violation",
    "23502": "not_null_violation",
    "23514": "check_violation",
    "42P01": "relation_missing",
    "42703": "column_missing",
    "42701": "duplicate_column",
    "42710": "duplicate_object",
    "42804": "datatype_mismatch",
    "22P02": "invalid_text_representation",
    "22001": "string_too_long",
    "22003": "numeric_out_of_range",
    "42501": "insufficient_privilege",
    "42P07": "relation_exists",
    "42601": "syntax_error",
    "0A000": "unsupported_feature",
    "55000": "object_not_in_prerequisite_state",
    "XX000": "internal_error",
}


def diagnose(contents):
    """Return sanitized metadata for the earliest SQL error."""
    for line in contents.splitlines():
        if not ERROR.search(line):
            continue
        match = CODE.search(line)
        location = LINE.search(line)
        code = match.group(1).upper() if match else "unavailable"
        return {
            "sqlstate": code,
            "category": SQLSTATES.get(code, "unclassified_sqlstate"),
            "line": int(location.group(1)) if location else "unavailable",
        }
    return {"sqlstate": "unavailable", "category": "no_postgres_error_detected", "line": "unavailable"}


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: diagnose_pg_restore_data.py LOGFILE")
    with Path(sys.argv[1]).open("rb") as handle:
        raw = handle.read(MAX_LOG_BYTES + 1)
    if len(raw) > MAX_LOG_BYTES:
        print("ISOLATED DATA FIRST ERROR: log_limit_exceeded; no private SQL logged")
        return
    d = diagnose(raw.decode("utf-8", "replace"))
    print(f"ISOLATED DATA FIRST ERROR: sqlstate={d['sqlstate']} category={d['category']} sql_line={d['line']}")
    print("Strict data restoration remains FAILED; no source SQL or customer values printed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print(f"ISOLATED DATA ERROR INSPECTION FAILED: {type(ex).__name__}", file=sys.stderr)
        sys.exit(1)
