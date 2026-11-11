#!/usr/bin/env python3
"""Read-only restore rehearsal of encrypted R2 backup; NEVER writes plaintext to disk.

R2 GET only. Selects deterministic samples from each nonempty source bucket,
decrypts in memory and validates SHA256 and byte count against the committed
manifest. Does not access Supabase production or modify R2.
"""
import base64
import hashlib
import json
import os
import sys
from collections import defaultdict

import boto3
from botocore.config import Config
from supabase_storage_to_r2 import PREFIX, SOURCE_REF, decrypt, required

DEFAULT_SAMPLES_PER_BUCKET = 2
MAX_CIPHERTEXT_BYTES = 260 * 1024 * 1024
MAX_ENTRIES = 100000


def read_limited(s3, bucket, key):
    data = s3.get_object(Bucket=bucket, Key=key)["Body"].read(MAX_CIPHERTEXT_BYTES + 1)
    if len(data) > MAX_CIPHERTEXT_BYTES:
        raise RuntimeError("Refusing oversized encrypted object")
    return data


def validate_manifest(s3, bucket, encryption_key):
    pointer = json.loads(read_limited(s3, bucket, f"{PREFIX}/latest.json"))
    manifest_key = pointer.get("manifest_key", "")
    if not isinstance(manifest_key, str) or not manifest_key.startswith(f"{PREFIX}/manifests/") or not manifest_key.endswith(".json.aes"):
        raise RuntimeError("Unsafe or invalid manifest key")
    manifest = json.loads(decrypt(read_limited(s3, bucket, manifest_key),
                                  encryption_key, "manifest"))
    if manifest.get("project_ref") != SOURCE_REF or manifest.get("version") != 1:
        raise RuntimeError("Manifest origin/version mismatch")
    if manifest.get("created_at") != pointer.get("created_at"):
        raise RuntimeError("Manifest/pointer snapshot mismatch")
    entries = manifest.get("entries")
    expected_buckets = manifest.get("buckets")
    if not isinstance(entries, dict) or not entries or len(entries) > MAX_ENTRIES:
        raise RuntimeError("Unexpected manifest entry count")
    if not isinstance(expected_buckets, list) or len(expected_buckets) != len(set(expected_buckets)):
        raise RuntimeError("Invalid bucket list")
    grouped = defaultdict(list)
    for identifier, entry in entries.items():
        name = json.loads(identifier)
        if not isinstance(name, list) or len(name) != 2 or not all(isinstance(v, str) for v in name):
            raise RuntimeError("Invalid object identity in manifest")
        source_bucket, path = name
        if source_bucket not in expected_buckets or not path:
            raise RuntimeError("Invalid source bucket or object path")
        if not isinstance(entry, dict) or not entry.get("blob", "").startswith(f"{PREFIX}/blobs/"):
            raise RuntimeError("Invalid backup blob path")
        if not isinstance(entry.get("bytes"), int) or entry["bytes"] < 0:
            raise RuntimeError("Invalid object byte count")
        if not isinstance(entry.get("sha256"), str) or len(entry["sha256"]) != 64:
            raise RuntimeError("Invalid file checksum")
        grouped[source_bucket].append((identifier, entry))
    return manifest, grouped


def select_samples(grouped, per_bucket=DEFAULT_SAMPLES_PER_BUCKET):
    chosen = []
    for bucket in sorted(grouped):
        # Deterministic across retries. Spread samples across sorted paths.
        entries = sorted(grouped[bucket], key=lambda x: x[0])
        indices = sorted({int(i * (len(entries) - 1) / max(per_bucket - 1, 1))
                          for i in range(min(per_bucket, len(entries)))})
        chosen.extend(entries[i] for i in indices)
    return chosen


def select_all_entries(grouped):
    """Every referenced object, deterministic order, no source/R2 writes."""
    return [
        entry
        for bucket in sorted(grouped)
        for entry in sorted(grouped[bucket], key=lambda item: item[0])
    ]


def planned_entries(grouped, scope):
    if scope == "sample":
        return select_samples(grouped)
    if scope == "all":
        return select_all_entries(grouped)
    raise ValueError("Unsupported Storage R2 verification scope")


def verify_selected(s3, bucket, key, entries):
    """Stream one encrypted blob at a time into memory, never persist plaintext."""
    verified_count = 0
    verified_bytes = 0
    for identifier, entry in entries:
        verified_bytes += verify_sample(s3, bucket, key, identifier, entry)
        verified_count += 1
    return verified_count, verified_bytes


def validate_bucket_coverage(manifest, grouped):
    recorded = set(manifest["buckets"])
    populated = set(grouped)
    if not populated or not populated.issubset(recorded):
        raise RuntimeError("Unexpected populated bucket coverage")
    if any(not grouped[bucket] for bucket in populated):
        raise RuntimeError("Empty sample grouping for a populated bucket")
    return recorded - populated


def verify_sample(s3, bucket, key, identifier, entry):
    restored = decrypt(read_limited(s3, bucket, entry["blob"]), key, identifier)
    if len(restored) != entry["bytes"]:
        raise RuntimeError("Restore size mismatch")
    if hashlib.sha256(restored).hexdigest() != entry["sha256"]:
        raise RuntimeError("Restore SHA256 mismatch")
    return len(restored)


def main():
    account_id = required("R2_ACCOUNT_ID")
    bucket = required("R2_BUCKET")
    key_raw = base64.b64decode(required("BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(key_raw) != 32:
        raise RuntimeError("Invalid encryption-key size")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=45,
                      retries={"mode": "standard", "max_attempts": 4}),
    )
    # Existing scheduled Storage backup keeps its fast per-bucket sample
    # verification. The new protected MANUAL workflow explicitly requests
    # every encrypted object, with no changes to the daily backup cadence.
    scope = os.environ.get("VERIFY_STORAGE_SCOPE", "sample").strip()
    manifest, grouped = validate_manifest(s3, bucket, key_raw)
    empty_buckets = validate_bucket_coverage(manifest, grouped)
    chosen = planned_entries(grouped, scope)
    if not chosen:
        raise RuntimeError("No backup objects available to restore")
    if scope == "all" and len(chosen) != len(manifest["entries"]):
        raise RuntimeError("Complete Storage manifest coverage mismatch")
    count, bytes_checked = verify_selected(s3, bucket, key_raw, chosen)
    if scope == "all":
        if count != len(manifest["entries"]):
            raise RuntimeError("Complete Storage object count mismatch")
        print(
            f"STORAGE FULL R2 OBJECT VERIFICATION PASSED: objects={count} "
            f"buckets_with_objects={len(grouped)} empty_buckets={len(empty_buckets)} "
            f"validated_bytes={bytes_checked} manifest_entries={len(manifest['entries'])} "
            f"snapshot={manifest['created_at']}", flush=True
        )
        print(
            "CAVEAT: All archived Storage file bytes verified in R2; "
            "live source parity, upload to a recovery Storage endpoint, "
            "and application access were NOT verified.", flush=True
        )
    else:
        # Keep the existing success marker for the scheduled backup watchdog.
        print(f"RESTORE VERIFIED: {count} file samples across {len(grouped)} buckets; "
              f"{bytes_checked} decrypted bytes validated; "
              f"manifest entries={len(manifest['entries'])}; empty buckets={len(empty_buckets)}; "
              f"snapshot={manifest['created_at']}", flush=True)
    print("No Supabase access; R2 operations read-only; no plaintext persisted.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"RESTORE FAILED: {type(exc).__name__}; private object identifiers withheld", file=sys.stderr)
        sys.exit(1)
