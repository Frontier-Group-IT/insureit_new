#!/usr/bin/env python3
"""Prepare private libpq files for the manual INSUREIT v2 pg_dump.

The existing DATABASE_URL can contain an unescaped @ in its password.
libpq interprets that URL differently from Python's urlsplit and tries to
resolve part of the password as a hostname. Avoid URI re-parsing altogether:
libpq gets separate PGHOST/PGPORT/PGDATABASE/PGUSER values and a locked-down
PGPASSFILE, without passing DATABASE_URL or PGPASSWORD to the Docker child.

Only write to the ephemeral GitHub runner directory. Never print a credential,
the source URL, a password file, or a connection string.
"""
import os
from pathlib import Path
import sys
from urllib.parse import parse_qsl, unquote, urlsplit

PROJECT_REF = "ilzhsfqqjyppzzvfscmh"
DIRECT_HOST = f"db.{PROJECT_REF}.supabase.co"
POOLER_SUFFIX = ".pooler.supabase.com"


def checked_connection(url):
    if not isinstance(url, str) or not url or any(ch in url for ch in "\r\n\x00"):
        raise ValueError("Invalid database URL")
    parsed = urlsplit(url)
    if parsed.scheme not in ("postgres", "postgresql") or parsed.fragment:
        raise ValueError("Unsupported database URL structure")
    host = parsed.hostname
    username = unquote(parsed.username or "", encoding="utf-8", errors="strict")
    password = unquote(parsed.password or "", encoding="utf-8", errors="strict")
    direct = host == DIRECT_HOST and username == "postgres"
    pooler = (
        isinstance(host, str) and host.endswith(POOLER_SUFFIX)
        and username == f"postgres.{PROJECT_REF}"
        and host != POOLER_SUFFIX
    )
    if not (direct or pooler) or parsed.path != "/postgres" or not password:
        raise ValueError("Connection is not authorized INSUREIT PostgreSQL")
    port = parsed.port or 5432
    if not 1 <= port <= 65535:
        raise ValueError("Invalid PostgreSQL port")
    if any(ch in username + password for ch in "\r\n\x00"):
        raise ValueError("Invalid PostgreSQL credential characters")
    # Keep only explicitly understood TLS options. Silent omission of
    # connection-string flags would be unsafe for disaster-recovery exports.
    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    if any(name != "sslmode" for name, _ in query) or len(query) > 1:
        raise ValueError("Unsupported database URL connection options")
    sslmode = query[0][1] if query else "require"
    if sslmode not in ("require", "verify-ca", "verify-full"):
        raise ValueError("Unsafe or unsupported PostgreSQL TLS setting")
    return host, port, "postgres", username, password, sslmode


def escape_pgpass(value):
    # libpq password-file format escapes both ':' and backslash with backslash.
    return value.replace("\\", "\\\\").replace(":", "\\:")


def write_connection_files(url, destination):
    host, port, database, username, password, sslmode = checked_connection(url)
    base = Path(destination)
    old_umask = os.umask(0o077)
    try:
        base.mkdir(mode=0o700, parents=False, exist_ok=False)
        # This file has NO password. The Docker env-file parser cannot
        # mishandle @ because credentials are no longer in a connection URI.
        env = "\n".join((
            f"PGHOST={host}",
            f"PGPORT={port}",
            f"PGDATABASE={database}",
            f"PGUSER={username}",
            f"PGSSLMODE={sslmode}",
            "PGCONNECT_TIMEOUT=20",
            "",
        ))
        (base / "libpq.env").write_text(env, encoding="utf-8")
        # This file stays on the ephemeral GitHub runner and is mounted
        # read-only for pg_dump as a nonroot UID; libpq requires 0600.
        pgpass = ":".join(escape_pgpass(str(v)) for v in
                          (host, port, database, username, password)) + "\n"
        (base / ".pgpass").write_text(pgpass, encoding="utf-8")
        os.chmod(base / ".pgpass", 0o600)
        os.chmod(base / "libpq.env", 0o600)
    finally:
        os.umask(old_umask)


def main():
    if len(sys.argv) != 2:
        raise ValueError("Usage: prepare_pg_dump_connection.py EPHEMERAL_DIRECTORY")
    write_connection_files(os.environ["DATABASE_URL"], sys.argv[1])
    print("Encrypted v2 export connection prepared with private libpq password file")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"V2 CONNECTION PREPARATION FAILED: {type(error).__name__}; credentials withheld", file=sys.stderr)
        raise SystemExit(1)
