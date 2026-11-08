#!/usr/bin/env python3
"""Manual-only, append-only INSUREIT v2 PostgreSQL backup.

The input database.dump is produced by ONE pg_dump -Fc transaction, so schema
and data describe one logical snapshot. The v1 R2 prefix is never modified.
No source DB access or R2 DELETE is implemented in this script.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import tarfile
import tempfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from postgres_to_r2 import (
    MAGIC, encrypt_file, required, s3_client, verify_file,
)

PREFIX = "postgresql/v2"
EXPECTED = ("roles.sql", "database.dump")
FORMAT = "pg_dump17-custom-single-snapshot-and-supabase-roles-v2"
AAD = b"postgres-v2-manifest"
PROJECT_REF = "ilzhsfqqjyppzzvfscmh"
MAX_MEMBER_BYTES = 768 * 1024 * 1024


def make_v2_archive(directory, destination):
    directory = Path(directory)
    with tarfile.open(destination, "w:gz") as archive:
        for name in EXPECTED:
            source = directory / name
            if not source.is_file() or not 0 < source.stat().st_size <= MAX_MEMBER_BYTES:
                raise RuntimeError("Missing, empty or oversized v2 archive component")
            archive.add(source, arcname=name, recursive=False)
    if Path(destination).stat().st_size == 0:
        raise RuntimeError("Empty compressed v2 archive")


def commit_v2(s3, bucket, ciphertext, checksum, snapshot, key):
    # v1 remains available and unchanged. Never call DELETE or overwrite an
    # existing immutable ciphertext or manifest key.
    archive_key = f"{PREFIX}/archives/{snapshot}-{secrets.token_hex(12)}.tar.gz.aes"
    with open(ciphertext, "rb") as source:
        s3.upload_fileobj(source, bucket, archive_key,
                          ExtraArgs={"ContentType": "application/octet-stream"})
    with tempfile.TemporaryDirectory(prefix="insureit-v2-readback-") as tmp:
        fetched = Path(tmp) / "readback.aes"
        s3.download_file(bucket, archive_key, str(fetched))
        verify_file(fetched, key, checksum)
    manifest = {
        "version": 2,
        "project_ref": PROJECT_REF,
        "created_at": snapshot,
        "format": FORMAT,
        "source_consistency": "one_pg_dump_transaction",
        "contents": list(EXPECTED),
        "archive_key": archive_key,
        "sha256": checksum["sha256"],
        "plaintext_bytes": checksum["bytes"],
    }
    manifest_key = f"{PREFIX}/manifests/{snapshot}-{secrets.token_hex(12)}.json.aes"
    nonce = secrets.token_bytes(12)
    payload = MAGIC + nonce + AESGCM(key).encrypt(
        nonce, json.dumps(manifest, sort_keys=True).encode("utf-8"), AAD
    )
    s3.put_object(Bucket=bucket, Key=manifest_key, Body=payload,
                  ContentType="application/octet-stream")
    # This mutable pointer is committed only after encrypted archive readback.
    s3.put_object(
        Bucket=bucket, Key=f"{PREFIX}/latest.json",
        Body=json.dumps({
            "version": 2, "created_at": snapshot, "manifest_key": manifest_key,
        }).encode("utf-8"),
        ContentType="application/json",
    )
    print(f"V2 CONSISTENT SNAPSHOT SAVED: encrypted_bytes={Path(ciphertext).stat().st_size}")
    print("V1 archive preserved. No retention or R2 deletion enabled.")


def main():
    import base64
    key = base64.b64decode(required("DB_BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(key) != 32:
        raise RuntimeError("Invalid backup encryption key")
    folder = Path(required("PG_DUMP_DIR"))
    bucket = required("R2_BUCKET")
    snapshot = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    with tempfile.TemporaryDirectory(prefix="insureit-v2-") as temp:
        tarfile_path = Path(temp) / "db-v2.tar.gz"
        encrypted = Path(temp) / "db-v2.tar.gz.aes"
        make_v2_archive(folder, tarfile_path)
        checksum = encrypt_file(tarfile_path, encrypted, key)
        verify_file(encrypted, key, checksum)
        commit_v2(s3_client(), bucket, encrypted, checksum, snapshot, key)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        import sys
        # Do not expose connection, file contents, SQL or object identifiers.
        print(f"INSUREIT V2 DATABASE BACKUP FAILED: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1)
