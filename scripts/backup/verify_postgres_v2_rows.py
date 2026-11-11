#!/usr/bin/env python3
"""Full COPY row parity for a *restored*, offline pg_dump -Fc snapshot.

Reads only ephemeral pg_restore --data-only SQL, runs count(*) queries against
network-disabled Docker, and prints no table/column names, SQL or raw row data.
"""
from collections import Counter
from pathlib import Path
import re
import subprocess
import sys

from audit_postgres_copy_targets import (
    COPY, END, MAX_DATA_BYTES, MAX_HEADERS, split_identifiers,
)

CONTAINER = "insureit-v2-restore-check"
DATABASE = "insureit_verify"
REQUIRED = frozenset({
    ("auth", "users"),
    ("storage", "buckets"),
    ("storage", "objects"),
    ("supabase_migrations", "schema_migrations"),
})
INTEGER = re.compile(r"^[0-9]+$")


def archive_counts(path):
    path = Path(path)
    if path.stat().st_size > MAX_DATA_BYTES:
        raise ValueError("Data-only SQL exceeds permitted size")
    counts = Counter()
    active = None
    copies = 0
    with path.open(encoding="utf-8", errors="strict") as handle:
        for line in handle:
            if active is None:
                if not line.lstrip().upper().startswith("COPY "):
                    continue
                match = COPY.fullmatch(line.rstrip("\r\n"))
                if not match:
                    raise ValueError("Unsupported COPY statement")
                name = split_identifiers(match.group(1), ".")
                if len(name) != 2:
                    raise ValueError("Unqualified COPY destination")
                split_identifiers(match.group(2), ",")
                active = tuple(name)
                counts[active] += 0
                copies += 1
                if copies > MAX_HEADERS:
                    raise ValueError("Too many archive COPY destinations")
            elif END.fullmatch(line.rstrip("\r\n")):
                active = None
            else:
                counts[active] += 1
    if active is not None or not copies:
        raise ValueError("Missing COPY terminator or empty data archive")
    if not REQUIRED.issubset(counts):
        raise ValueError("Critical auth/storage/migration COPY coverage incomplete")
    return counts


def quote(name):
    # Quoting each PG identifier prevents executing SQL injected from a dump
    # header. No shell interpolation; only pg_restore-created local tables.
    if not name or "\x00" in name or len(name.encode("utf-8")) > 63:
        raise ValueError("Invalid archive SQL identifier")
    return '"' + name.replace('"', '""') + '"'


def restored_counts(counts):
    ordered = sorted(counts)
    # One local transaction/connection for all table COUNT queries avoids
    # hundreds of expensive docker exec and psql startups.
    query = " UNION ALL ".join(
        f"SELECT {i}::integer AS key, count(*)::bigint AS n FROM {quote(schema)}.{quote(table)}"
        for i, (schema, table) in enumerate(ordered)
    )
    # The single-transaction restore is owned by the *offline* local
    # supabase_admin superuser because raw functions may require untrusted
    # language privileges. Query with the same isolated role: the offline
    # 'postgres' role lacks rights over all newly restored admin-owned tables.
    # This password is a public, synthetic value used ONLY in a disposable
    # '--network none' container; it is never a Supabase production secret.
    proc = subprocess.run([
        "docker", "exec", "-u", "postgres",
        "--env", "PGPASSWORD=ephemeral-v2-recovery-only",
        CONTAINER, "psql", "-h", "127.0.0.1", "-U", "supabase_admin",
        "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
        "-d", DATABASE, "-c", query,
    ], capture_output=True, text=True, check=False, timeout=180)
    if proc.returncode:
        raise ValueError("Offline per-table row count query failed")
    seen = {}
    for line in proc.stdout.strip().splitlines():
        values = line.split("|")
        if len(values) != 2 or not all(INTEGER.fullmatch(x) for x in values):
            raise ValueError("Invalid offline count result")
        idx, n = map(int, values)
        if idx in seen or idx >= len(ordered):
            raise ValueError("Duplicate/out-of-range count result")
        seen[idx] = n
    if len(seen) != len(ordered):
        raise ValueError("Incomplete per-table row count output")
    return {ordered[i]: seen[i] for i in range(len(ordered))}


def verify(data_sql, count_fn=restored_counts):
    expected = archive_counts(data_sql)
    actual = count_fn(expected)
    if set(actual) != set(expected):
        raise ValueError("Incomplete restored table count coverage")
    mismatches = sum(actual[k] != expected[k] for k in expected)
    print(f"V2 OFFLINE ROW PARITY: archived_copy_tables={len(expected)} mismatched_tables={mismatches}")
    if mismatches:
        raise ValueError("Archived rows did not reconcile with restored tables")
    print("V2 COPY ROW PARITY PASSED: all archived COPY targets match; service recovery not certified")


def main():
    if len(sys.argv) != 2:
        raise ValueError("Usage: verify_postgres_v2_rows.py DATA_SQL")
    verify(sys.argv[1])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"V2 OFFLINE ROW PARITY FAILED: {type(error).__name__}; no private SQL printed", file=sys.stderr)
        raise SystemExit(1)
