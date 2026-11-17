#!/usr/bin/env python3
"""R6 protected isolated Supabase Storage API sample restore.

Manual-only protected GitHub Actions path. No production Supabase connection.
The R6 --plan has NO write credential. --upload requires separately approved
workflow input, explicit target-ref confirmation, and an isolated-target-only
Storage service key. Source R2 access is GET-only. Never log customer paths,
bucket identifiers, SQL statements, plaintext file contents or API keys.

R6 is a non-atomic Storage API exercise. On any failure, STOP and inspect the
partial target: NEVER automatically rerun or overwrite files.
"""
import base64
import hashlib
import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

import boto3
from botocore.config import Config

from plan_recovery_storage_sample import (
    MAX_FILE_BYTES, MAX_TOTAL_BYTES, select_recovery_sample,
)
from supabase_storage_to_r2 import decrypt, required
from verify_r2_restore import read_limited, validate_manifest, validate_bucket_coverage

TARGET_REF = "klnodxnmlqbofolxxrsr"
TARGET_API = f"https://{TARGET_REF}.supabase.co"
MAX_SELECTED_OBJECTS = 10000
SAMPLE_OBJECTS = 304
SAMPLE_BYTES = 499_999_884
SAMPLE_BUCKETS = 8


def safe_bucket(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}", value):
        raise ValueError("Archive contains unsupported Storage bucket identifier")
    return value


def safe_path(value):
    if not isinstance(value, str) or not value or len(value) > 1024 or (
        value.startswith("/") or "\\" in value or
        any(ord(ch) < 32 or ord(ch) == 127 for ch in value)
    ):
        raise ValueError("Archive contains unsupported Storage path")
    if any(part in ("", ".", "..") for part in value.split("/")):
        raise ValueError("Archive contains invalid Storage path segment")
    return value


def safe_object_identity(identifier):
    val = json.loads(identifier)
    if not isinstance(val, list) or len(val) != 2:
        raise ValueError("Malformed authenticated archive identity")
    return safe_bucket(val[0]), safe_path(val[1])


def validated_sample(manifest, grouped, expected):
    if not re.fullmatch(r"\d{8}T\d{6}Z", expected or ""):
        raise ValueError("Exact Storage snapshot is REQUIRED for R6")
    if manifest.get("created_at") != expected:
        raise RuntimeError("Authenticated latest Storage pointer changed")
    validate_bucket_coverage(manifest, grouped)
    chosen, metrics = select_recovery_sample(grouped)
    if (len(chosen) != SAMPLE_OBJECTS or
        metrics["sample_plain_bytes"] != SAMPLE_BYTES or
        metrics["sample_buckets"] != SAMPLE_BUCKETS or
        metrics["sample_objects"] != SAMPLE_OBJECTS or
        metrics["sample_plain_bytes"] > MAX_TOTAL_BYTES or
        any(entry["bytes"] > MAX_FILE_BYTES for _, entry in chosen)):
        raise RuntimeError("R6 expected reviewed Storage sample plan changed")
    if len(chosen) > MAX_SELECTED_OBJECTS:
        raise RuntimeError("Too many selected objects")
    if (sum(entry["bytes"] for _, entry in chosen) != metrics["sample_plain_bytes"] or
        len({safe_object_identity(identifier)[0] for identifier, _ in chosen}) !=
        metrics["sample_buckets"]):
        raise RuntimeError("Authenticated Storage sample selection mismatch")
    for identifier, entry in chosen:
        safe_object_identity(identifier)
        if not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]):
            raise ValueError("Invalid source file hash")
    return chosen, metrics


def r2_session():
    key = base64.b64decode(required("BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(key) != 32:
        raise ValueError("Invalid Storage backup decryption key")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=65,
                      retries={"mode": "standard", "max_attempts": 4}),
    )
    return s3, required("R2_BUCKET"), key


def target_call(method, path, key, data=None, content_type="application/json"):
    if not path.startswith("/storage/v1/"):
        raise ValueError("Disallowed target endpoint")
    request = urllib.request.Request(
        TARGET_API + path,
        data=data, method=method,
        headers={
            "apikey": key, "Authorization": "Bearer " + key,
            "Content-Type": content_type, "x-upsert": "false",
        },
    )
    # Do not leak HTTP response bodies, user paths or Authorization headers.
    try:
        with urllib.request.urlopen(request, timeout=100) as response:
            content = response.read(MAX_FILE_BYTES + 1)
            if len(content) > MAX_FILE_BYTES:
                raise RuntimeError("Target Storage response exceeded file cap")
            return content
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Isolated target Storage API failed status={error.code}") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Isolated target Storage API failed network validation") from None


def verified_file_bytes(s3, r2_bucket, encryption_key, identifier, entry):
    value = decrypt(read_limited(s3, r2_bucket, entry["blob"]),
                    encryption_key, identifier)
    if (len(value) != entry["bytes"] or len(value) > MAX_FILE_BYTES or
        hashlib.sha256(value).hexdigest() != entry["sha256"]):
        raise RuntimeError("Authenticated encrypted Storage file failed SHA256 verification")
    return value


def upload_sample(s3, r2_bucket, encryption_key, chosen, metrics, key):
    if not isinstance(key, str) or len(key) < 30:
        raise ValueError("Dedicated isolated Storage service key required")
    bucket_ids = sorted({safe_object_identity(identifier)[0] for identifier, _ in chosen})
    if len(bucket_ids) != SAMPLE_BUCKETS:
        raise ValueError("Unexpected selected bucket count")
    initial = json.loads(target_call("GET", "/storage/v1/bucket", key))
    if not isinstance(initial, list) or initial:
        raise RuntimeError("Isolated target Storage must have ZERO existing buckets")

    # New buckets are ALWAYS PRIVATE irrespective of original public flags.
    # No source bucket policy/ACL is copied, and no anon grants are enabled.
    for name in bucket_ids:
        payload = json.dumps({
            "id": name, "name": name, "public": False,
            "file_size_limit": MAX_FILE_BYTES,
        }).encode("utf-8")
        target_call("POST", "/storage/v1/bucket", key, data=payload)
    uploaded = 0
    total_bytes = 0
    for identifier, entry in chosen:
        bucket, path = safe_object_identity(identifier)
        file_bytes = verified_file_bytes(s3, r2_bucket, encryption_key, identifier, entry)
        encoded = (urllib.parse.quote(bucket, safe="") + "/" +
                   urllib.parse.quote(path, safe="/"))
        content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        target_call("POST", "/storage/v1/object/" + encoded, key,
                    data=file_bytes, content_type=content_type)
        restored = target_call("GET", "/storage/v1/object/authenticated/" + encoded, key)
        if (len(restored) != entry["bytes"] or
            hashlib.sha256(restored).hexdigest() != entry["sha256"]):
            raise RuntimeError("Isolated Storage API upload/get SHA256 mismatch")
        uploaded += 1
        total_bytes += len(restored)
    after = json.loads(target_call("GET", "/storage/v1/bucket", key))
    if (not isinstance(after, list) or
        {str(x.get("id")) for x in after} != set(bucket_ids) or
        any(x.get("public") is not False for x in after)):
        raise RuntimeError("Recovered target bucket privacy/coverage mismatch")
    if uploaded != metrics["sample_objects"] or total_bytes != metrics["sample_plain_bytes"]:
        raise RuntimeError("R6 sample byte/count parity mismatch")
    return uploaded, total_bytes, len(bucket_ids)


def run(mode):
    if mode not in ("--plan", "--upload"):
        raise ValueError("R6 only supports an approved plan or protected upload")
    if os.environ.get("RECOVERY_CONFIRM_TARGET_REF") != TARGET_REF:
        raise RuntimeError("R6 isolated project ref confirmation failed")
    s3, r2_bucket, secret = r2_session()
    manifest, grouped = validate_manifest(s3, r2_bucket, secret)
    expected = required("RECOVERY_EXPECTED_STORAGE_SNAPSHOT")
    chosen, metrics = validated_sample(manifest, grouped, expected)
    if mode == "--plan":
        print("R6 STORAGE API PLAN ONLY:"
              f" sample_objects={metrics['sample_objects']}"
              f" sample_plain_bytes={metrics['sample_plain_bytes']}"
              f" sample_buckets={metrics['sample_buckets']}"
              f" storage_snapshot={expected}"
              " private_buckets_only=1 no_target_upload=1", flush=True)
        return
    if os.environ.get("RECOVERY_ENABLE_STORAGE_UPLOAD") != "true":
        raise RuntimeError("R6 upload requires protected affirmative GitHub workflow input")
    key = required("RECOVERY_TARGET_SUPABASE_SERVICE_ROLE_KEY")
    count, bytes_read, buckets = upload_sample(s3, r2_bucket, secret, chosen, metrics, key)
    print("R6 STORAGE API SAMPLE RESTORE VERIFIED:"
          f" verified_files={count} verified_plain_bytes={bytes_read}"
          f" private_buckets={buckets} storage_snapshot={expected}"
          " source_R2_GET_only=1 production_supabase_access=0"
          " full_Storage_DR_NOT_CERTIFIED=1", flush=True)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("R6 requires --plan or --upload")
        run(sys.argv[1])
    except Exception as error:
        print("R6 STORAGE STOPPED:"
              f" category={type(error).__name__};"
              " confidential filenames, content, HTTP bodies, tokens withheld;"
              " possible_partial_target=1; DO_NOT_AUTORETRY=1",
              file=sys.stderr)
        raise SystemExit(1) from None
