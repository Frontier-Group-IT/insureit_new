#!/usr/bin/env python3
"""Gate ONE restricted offline retry after a PostgreSQL permission failure.

Only the pg_restore --no-acl switch differs on retry. That option excludes
GRANT/REVOKE/default privilege restoration, not tables or table data. A
successful retry means schema/data verification, NOT restored ACL parity.
"""
import sys
from pathlib import Path

from classify_pg_restore_error import MAX_READ, classify


def allowed(contents):
    # Never retry errors such as a missing extension, malformed SQL, missing
    # function, or a failed foreign key. The first attempt must roll back in a
    # single transaction before a fresh retry is attempted.
    return classify(contents) == "permission_denied"


def main():
    if len(sys.argv) != 2:
        raise ValueError("Expected a private PostgreSQL restore diagnostic log")
    log = Path(sys.argv[1])
    if log.stat().st_size > MAX_READ:
        return 1
    raw = log.read_text(encoding="utf-8", errors="replace")
    if allowed(raw):
        print("V2 ACL-OMISSION TRIAL AUTHORIZED: previous strict transaction rolled back")
        return 0
    print("V2 ACL-OMISSION TRIAL BLOCKED: not a classified permission error")
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"V2 ACL-OMISSION TRIAL FAILED: {type(exc).__name__}; no private SQL shown", file=sys.stderr)
        raise SystemExit(1)
