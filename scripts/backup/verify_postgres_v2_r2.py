#!/usr/bin/env python3
"""Read-only R2 v2 decrypt/extract; no SQL or customer data in output."""
import base64
import json
import re
import os
from pathlib import Path
import tarfile
import tempfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from postgres_to_r2 import MAGIC, s3_client
from postgres_v2_to_r2 import AAD, EXPECTED, FORMAT, PREFIX, PROJECT_REF
from verify_postgres_r2_restore import (
    MAX_CIPHERTEXT, MAX_UNPACKED, decrypt_archive, read_capped,
)


SNAPSHOT_STAMP = re.compile(r"^[0-9]{8}T[0-9]{6}Z$")


def require_snapshot_stamp(value):
    if not isinstance(value, str) or not SNAPSHOT_STAMP.fullmatch(value):
        raise ValueError("Invalid encrypted snapshot timestamp")
    return value


def require_expected_snapshot(manifest, expected):
    selected = require_snapshot_stamp(manifest["created_at"])
    if expected:
        if require_snapshot_stamp(expected) != selected:
            raise ValueError("Authenticated R2 latest snapshot differs from selected snapshot")
    return selected


def get_v2_manifest(s3, bucket, key):
    pointer = json.loads(read_capped(s3, bucket, f"{PREFIX}/latest.json", 4096))
    if pointer.get("version") != 2:
        raise RuntimeError("Incompatible R2 backup pointer version")
    require_snapshot_stamp(pointer.get("created_at"))
    path = pointer.get("manifest_key")
    if (not isinstance(path, str) or
            not path.startswith(f"{PREFIX}/manifests/") or
            not path.endswith(".json.aes")):
        raise RuntimeError("Invalid v2 manifest reference")
    raw = read_capped(s3, bucket, path, 128 * 1024)
    if len(raw) < len(MAGIC) + 12 + 16 or not raw.startswith(MAGIC):
        raise RuntimeError("Invalid encrypted v2 manifest")
    nonce = raw[len(MAGIC):len(MAGIC) + 12]
    manifest = json.loads(AESGCM(key).decrypt(
        nonce, raw[len(MAGIC) + 12:], AAD
    ))
    if (manifest.get("version") != 2 or
            manifest.get("project_ref") != PROJECT_REF or
            manifest.get("created_at") != pointer.get("created_at") or
            manifest.get("format") != FORMAT or
            manifest.get("source_consistency") != "one_pg_dump_transaction" or
            manifest.get("contents") != list(EXPECTED)):
        raise RuntimeError("Unexpected v2 snapshot or manifest format")
    path = manifest.get("archive_key")
    if (not isinstance(path, str) or
            not path.startswith(f"{PREFIX}/archives/") or
            not path.endswith(".tar.gz.aes")):
        raise RuntimeError("Invalid v2 archive reference")
    count = manifest.get("plaintext_bytes")
    digest = manifest.get("sha256")
    if (type(count) is not int or count < 1 or count > MAX_CIPHERTEXT or
            not isinstance(digest, str) or
            len(digest) != 64 or
            any(c not in "0123456789abcdef" for c in digest)):
        raise RuntimeError("Invalid v2 archive digest")
    return manifest


def extract_v2(archive_file, output_dir):
    output_dir = Path(output_dir)
    total = 0
    with tarfile.open(archive_file, "r:gz") as archive:
        members = archive.getmembers()
        if len(members) != len(EXPECTED):
            raise RuntimeError("Unexpected v2 member count")
        if {m.name for m in members} != set(EXPECTED):
            raise ValueError("Unexpected v2 members")
        for item in members:
            if not item.isfile() or not 0 < item.size <= MAX_UNPACKED:
                raise RuntimeError("Invalid v2 member")
            total += item.size
            if total > MAX_UNPACKED:
                raise RuntimeError("V2 archive expansion exceeds safety bound")
        for item in members:
            with archive.extractfile(item) as source:
                with (output_dir / item.name).open("xb") as target:
                    while chunk := source.read(1024 * 1024):
                        target.write(chunk)
    return total


def main():
    key = base64.b64decode(os.environ["DB_BACKUP_ENCRYPTION_KEY"], validate=True)
    if len(key) != 32:
        raise RuntimeError("Invalid PostgreSQL backup key")
    bucket = os.environ["R2_BUCKET"]
    s3 = s3_client()
    manifest = get_v2_manifest(s3, bucket, key)
    snapshot = require_expected_snapshot(
        manifest, os.environ.get("RECOVERY_EXPECTED_DB_SNAPSHOT", "").strip()
    )
    restore = Path(os.environ["RESTORE_DIR"])
    restore.mkdir(mode=0o700, parents=True, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix="insureit-v2-verify-") as temp:
        encrypted = Path(temp) / "v2.aes"
        s3.download_file(bucket, manifest["archive_key"], str(encrypted))
        if encrypted.stat().st_size > MAX_CIPHERTEXT:
            raise RuntimeError("V2 encrypted archive over size cap")
        tarball = Path(temp) / "archive.tar.gz"
        decrypt_archive(encrypted, tarball, key, manifest)
        size = extract_v2(tarball, restore)
    # Never print object identifiers, row data, SQL, paths or credentials.
    print(f"V2 R2 ARCHIVE VERIFIED: components={len(EXPECTED)} unpacked_bytes={size} snapshot={snapshot}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        import sys
        print(f"V2 R2 RECOVERY STAGING FAILED: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1)
