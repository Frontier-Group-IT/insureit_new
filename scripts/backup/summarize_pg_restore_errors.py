#!/usr/bin/env python3
"""Bounded, redacted summary of all errors in an offline diagnostic replay.

Only allowlisted category labels and counts are printed. Never print SQL,
customer data, identifiers, file paths, database names or log excerpts.
Must never convert a failed strict restore into success.
"""
import collections
from pathlib import Path
import re
import sys

from classify_pg_restore_error import classify

LIMIT_BYTES = 2_000_000
LIMIT_ERRORS = 25000
ERROR = re.compile(r'(?:ERROR:|FATAL:|psql:.*error:)', re.I)


def summarize(raw):
    counts = collections.Counter()
    for line in raw.splitlines():
        if not ERROR.search(line):
            continue
        counts[classify(line)] += 1
        if sum(counts.values()) >= LIMIT_ERRORS:
            break
    return counts


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: summarize_pg_restore_errors.py LOGFILE")
    path = Path(sys.argv[1])
    with path.open("rb") as handle:
        raw = handle.read(LIMIT_BYTES + 1)
    if len(raw) > LIMIT_BYTES:
        print("ISOLATED SQL DIAGNOSTIC: output exceeded safe limit; no SQL output published")
        raw = raw[:LIMIT_BYTES]
    counts = summarize(raw.decode("utf-8", "replace"))
    if not counts:
        print("ISOLATED SQL DIAGNOSTIC: no categorized SQL errors found")
        return
    print("ISOLATED SQL DIAGNOSTIC: redacted error category counts; failed restore remains FAILED")
    for category, count in sorted(counts.items()):
        print(f"ISOLATED SQL ERROR: category={category} count={count}")
    print("Isolated diagnostic replay never proves a successful database restoration.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ISOLATED SQL DIAGNOSTIC FAILED: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
