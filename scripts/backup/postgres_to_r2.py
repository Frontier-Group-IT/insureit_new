#!/usr/bin/env python3
"""Append-only encrypted logical PostgreSQL backup to R2.

Requires roles.sql, schema.sql, data.sql produced by Supabase CLI. The dump
files are written to a GitHub-hosted ephemeral runner, NOT uploaded as artifacts.
Encryption happens locally before any R2 PUT. No source DB or R2 delete calls.
"""
import base64
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import sys
import tarfile
import tempfile

import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

PREFIX = "postgresql/v1"
MAGIC = b"INSUREITPG1"
PROJECT_REF = "ilzhsfqqjyppzzvfscmh"
EXPECTED = ("roles.sql", "schema.sql", "data.sql")
BLOCK = 1024 * 1024
MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024


def required(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required secret: {name}")
    return value


def encrypt_file(source, destination, key):
    nonce = secrets.token_bytes(12)
    enc = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    plain_hash = hashlib.sha256()
    size = 0
    with open(source, "rb") as src, open(destination, "wb") as dst:
        dst.write(MAGIC + nonce)
        while chunk := src.read(BLOCK):
            size += len(chunk)
            if size > MAX_ARCHIVE_BYTES:
                raise RuntimeError("Compressed backup exceeds 1 GiB safety limit")
            plain_hash.update(chunk)
            dst.write(enc.update(chunk))
        dst.write(enc.finalize())
        dst.write(enc.tag)
    return {"sha256": plain_hash.hexdigest(), "bytes": size}


def verify_file(encrypted, key, expected):
    with open(encrypted, "rb") as f:
        if f.read(len(MAGIC)) != MAGIC:
            raise RuntimeError("Invalid encrypted backup magic")
        nonce = f.read(12)
        f.seek(-16, os.SEEK_END)
        tag = f.read(16)
        length = f.tell() - len(MAGIC) - 12
        f.seek(len(MAGIC) + 12)
        dec = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        digest = hashlib.sha256()
        n = 0
        remaining = length
        while remaining:
            data = f.read(min(BLOCK, remaining))
            if not data:
                raise RuntimeError("Truncated ciphertext")
            remaining -= len(data)
            clear = dec.update(data)
            n += len(clear)
            digest.update(clear)
        dec.finalize()
    if n != expected["bytes"] or digest.hexdigest() != expected["sha256"]:
        raise RuntimeError("Postgres archive hash mismatch")
    return n


def make_archive(folder, archive_path):
    folder = Path(folder)
    for name in EXPECTED:
        path = folder / name
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError("Missing or empty logical dump component: " + name)
    with tarfile.open(archive_path, "w:gz") as archive:
        for name in EXPECTED:
            archive.add(folder / name, arcname=name, recursive=False)
    if Path(archive_path).stat().st_size == 0:
        raise RuntimeError("Compressed archive is empty")


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=90, retries={"mode": "standard", "max_attempts": 4}),
    )


def commit_backup(s3, bucket, ciphertext, expected, snapshot, key):
    object_key = f"{PREFIX}/archives/{snapshot}-{secrets.token_hex(8)}.tar.gz.aes"
    with open(ciphertext, "rb") as file:
        s3.upload_fileobj(file, bucket, object_key, ExtraArgs={"ContentType": "application/octet-stream"})
    # Do not publish manifest until the ciphertext has been fetched back,
    # authenticated and hash checked. Decrypted content is never persisted.
    with tempfile.TemporaryDirectory(prefix="insureit-r2-verify-") as temp:
        fetched = Path(temp) / "archive.aes"
        s3.download_file(bucket, object_key, str(fetched))
        verify_file(fetched, key, expected)
    manifest = {
        "version": 1, "project_ref": PROJECT_REF, "created_at": snapshot,
        "format": "supabase-cli-v2-roles-schema-data-targz-aes256gcm",
        "archive_key": object_key, "sha256": expected["sha256"],
        "plaintext_bytes": expected["bytes"], "contents": list(EXPECTED),
    }
    manifest_key = f"{PREFIX}/manifests/{snapshot}-{secrets.token_hex(8)}.json.aes"
    # The manifest also contains no credentials or customer filenames; encrypt it.
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = secrets.token_bytes(12)
    payload = MAGIC + nonce + AESGCM(key).encrypt(
        nonce, json.dumps(manifest, sort_keys=True).encode("utf-8"), b"postgres-manifest"
    )
    s3.put_object(Bucket=bucket, Key=manifest_key, Body=payload, ContentType="application/octet-stream")
    # Latest pointer is public metadata but bucket itself remains private.
    # Existing snapshots and prior manifests are never deleted.
    s3.put_object(
        Bucket=bucket, Key=f"{PREFIX}/latest.json",
        Body=json.dumps({"version": 1, "created_at": snapshot, "manifest_key": manifest_key}).encode(),
        ContentType="application/json",
    )
    print(f"Postgres backup committed and verified: snapshot={snapshot}, encrypted_bytes={Path(ciphertext).stat().st_size}")
    print("No deletion or automatic retention pruning is enabled.")


def main():
    root = Path(required("PG_DUMP_DIR"))
    raw_key = base64.b64decode(required("DB_BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(raw_key) != 32:
        raise RuntimeError("DB_BACKUP_ENCRYPTION_KEY must decode to 32 bytes")
    bucket = required("R2_BUCKET")
    snapshot = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    with tempfile.TemporaryDirectory(prefix="insureit-pg-archive-") as temp:
        tar_path = Path(temp) / "backup.tar.gz"
        cipher_path = Path(temp) / "backup.tar.gz.aes"
        make_archive(root, tar_path)
        expected = encrypt_file(tar_path, cipher_path, raw_key)
        verify_file(cipher_path, raw_key, expected)
        commit_backup(s3_client(), bucket, cipher_path, expected, snapshot, raw_key)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Avoid logging connection strings or SQL content.
        print(f"PostgreSQL backup FAILED: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
