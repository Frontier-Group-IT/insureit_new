#!/usr/bin/env python3
"""Fail closed on incomplete PostgreSQL custom-archive table coverage.

Inspects only private pg_restore --list metadata. Logs aggregate counts only.
"""
from pathlib import Path
import re
import sys

# PostgreSQL 17 pg_restore -l lines: 1134; 1259 22831 TABLE DATA auth users postgres
RECORD = re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+(TABLE DATA|TABLE|POLICY|SEQUENCE SET)\s+(\S+)\s+(\S+)(?:\s|$)")
REQUIRED = {
    ("auth", "users"),
    ("storage", "buckets"),
    ("storage", "objects"),
    ("supabase_migrations", "schema_migrations"),
}
MAX_BYTES = 32 * 1024 * 1024


def inspect_toc(path, min_public=1):
    p = Path(path)
    if p.stat().st_size > MAX_BYTES:
        raise ValueError("Oversized pg_restore TOC")
    tables = set()
    data = set()
    policies = 0
    seqvals = 0
    for raw in p.read_text(encoding="utf-8", errors="strict").splitlines():
        if raw.lstrip().startswith(";"):
            continue
        found = RECORD.match(raw)
        if not found:
            continue
        kind, schema, table = found.groups()
        if kind == "TABLE":
            tables.add((schema, table))
        elif kind == "TABLE DATA":
            data.add((schema, table))
        elif kind == "POLICY":
            policies += 1
        elif kind == "SEQUENCE SET":
            seqvals += 1
    if not REQUIRED.issubset(data):
        raise ValueError("Critical managed or migration table data missing")
    if len({name for name in tables if name[0] == "public"}) < min_public:
        raise ValueError("Public table definitions missing from archive")
    if not any(table[0] == "public" for table in data):
        raise ValueError("No public business data destinations found")
    return {
        "table_definitions": len(tables),
        "copy_data_targets": len(data),
        "policies": policies,
        "sequences": seqvals,
        "missing_required_data": len(REQUIRED - data),
    }


def main():
    if len(sys.argv) != 2:
        raise ValueError("Usage: audit_postgres_v2_toc.py PRIVATE_TOC_FILE")
    result = inspect_toc(sys.argv[1])
    print("V2 CUSTOM ARCHIVE TOC: " + " ".join(f"{k}={v}" for k, v in result.items()))
    print("V2 TOC COVERAGE PASS: full restore and data parity still required")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"V2 TOC COVERAGE FAILED: {type(exc).__name__}; private object identifiers withheld", file=sys.stderr)
        raise SystemExit(1)
