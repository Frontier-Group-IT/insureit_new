#!/usr/bin/env python3
"""Read-only R2 retrieval, authenticated decryption, and safe SQL archive staging.

Never calls Supabase, writes to R2, prints SQL, or publishes artifacts.
Only writes temporary plaintext inside the short-lived GitHub runner.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from postgres_to_r2 import MAGIC, PREFIX, EXPECTED, PROJECT_REF, s3_client, verify_file

MAX_CIPHERTEXT = 1024 * 1024 * 1024 + 4096
MAX_UNPACKED = 768 * 1024 * 1024


def read_capped(s3, bucket, key, limit=MAX_CIPHERTEXT):
    body = s3.get_object(Bucket=bucket, Key=key)["Body"].read(limit + 1)
    if len(body) > limit:
        raise RuntimeError("R2 object exceeds size cap")
    return body


def read_manifest(s3, bucket, key):
    pointer = json.loads(read_capped(s3, bucket, f"{PREFIX}/latest.json", 4096))
    path = pointer.get("manifest_key", "")
    if not isinstance(path, str) or not path.startswith(f"{PREFIX}/manifests/") or not path.endswith(".json.aes"):
        raise RuntimeError("Invalid manifest pointer")
    blob = read_capped(s3, bucket, path, 128 * 1024)
    if not blob.startswith(MAGIC) or len(blob) < len(MAGIC) + 12 + 16:
        raise RuntimeError("Invalid encrypted manifest")
    nonce = blob[len(MAGIC):len(MAGIC) + 12]
    manifest = json.loads(AESGCM(key).decrypt(nonce, blob[len(MAGIC) + 12:], b"postgres-manifest"))
    if (manifest.get("project_ref") != PROJECT_REF
            or manifest.get("version") != 1
            or manifest.get("created_at") != pointer.get("created_at")):
        raise RuntimeError("Backup origin or snapshot mismatch")
    archive_key = manifest.get("archive_key", "")
    if not isinstance(archive_key, str) or not archive_key.startswith(f"{PREFIX}/archives/") or not archive_key.endswith(".tar.gz.aes"):
        raise RuntimeError("Invalid archive reference")
    digest = manifest.get("sha256", "")
    count = manifest.get("plaintext_bytes")
    if not isinstance(digest, str) or len(digest) != 64 or not isinstance(count, int) or count < 0:
        raise RuntimeError("Invalid archive verification metadata")
    if manifest.get("contents") != list(EXPECTED):
        raise RuntimeError("Missing required SQL components")
    return manifest


def decrypt_archive(source, dest, key, manifest):
    """Authenticate GCM before staging SQL; keep ciphertext and plaintext capped."""
    # Archive verifier already checks both GCM and plaintext SHA256.
    verify_file(source, key, {"bytes": manifest["plaintext_bytes"], "sha256": manifest["sha256"]})
    with open(source, "rb") as f:
        if f.read(len(MAGIC)) != MAGIC:
            raise RuntimeError("Wrong ciphertext magic")
        nonce = f.read(12)
        ciphertext = f.read()
    content = AESGCM(key).decrypt(nonce, ciphertext, None)
    if len(content) != manifest["plaintext_bytes"] or hashlib.sha256(content).hexdigest() != manifest["sha256"]:
        raise RuntimeError("Restored archive checksum mismatch")
    Path(dest).write_bytes(content)


def extract_safe(archive_path, directory):
    names = set()
    total = 0
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        if len(members) != len(EXPECTED):
            raise RuntimeError("Unexpected tar member count")
        for item in members:
            if item.name not in EXPECTED or not item.isfile() or item.size <= 0:
                raise RuntimeError("Unexpected tar member")
            if item.name in names:
                raise RuntimeError("Duplicate SQL archive member")
            names.add(item.name)
            total += item.size
            if total > MAX_UNPACKED:
                raise RuntimeError("Uncompressed SQL exceeds safety limit")
        if names != set(EXPECTED):
            raise RuntimeError("Incomplete SQL backup")
        for item in members:
            with archive.extractfile(item) as source, open(Path(directory) / item.name, "wb") as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
    return total


def main():
    key = base64.b64decode(os.environ["DB_BACKUP_ENCRYPTION_KEY"], validate=True)
    if len(key) != 32:
        raise RuntimeError("Invalid backup encryption key")
    bucket = os.environ["R2_BUCKET"]
    s3 = s3_client()
    manifest = read_manifest(s3, bucket, key)
    output_dir = Path(os.environ["RESTORE_DIR"])
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="insureit-db-restore-") as scratch:
        enc = Path(scratch) / "archive.aes"
        s3.download_file(bucket, manifest["archive_key"], str(enc))
        if enc.stat().st_size > MAX_CIPHERTEXT:
            raise RuntimeError("Encrypted archive too large")
        plain = Path(scratch) / "sql.tar.gz"
        decrypt_archive(enc, plain, key, manifest)
        size = extract_safe(plain, output_dir)
    # Safe metrics only: no names of customer records, database content, or SQL.
    print(f"R2 DATABASE ARCHIVE VERIFIED: snapshot={manifest['created_at']}, sql_files={len(EXPECTED)}, unpacked_bytes={size}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"R2 ARCHIVE VERIFICATION FAILED: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
