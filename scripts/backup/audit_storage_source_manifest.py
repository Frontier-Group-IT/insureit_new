#!/usr/bin/env python3
"""Read-only, timestamp-aware INSUREIT Storage-source to R2-manifest coverage audit.

Reads ONLY authenticated Supabase Storage bucket/object LIST endpoints and
Cloudflare R2 GET for the encrypted manifest. Does NOT download Storage
content, write any source object, write R2 objects, or print object identifiers.
Two source inventories give a bounded view of concurrent changes, not a
database-transaction snapshot. This is a coverage preflight, NOT complete DR.
"""
import base64
import datetime as dt
import json
import os
import sys

import boto3
from botocore.config import Config

from supabase_storage_to_r2 import SOURCE_REF, list_buckets, list_files, required
from verify_r2_restore import validate_manifest

MAX_SOURCE_ENTRIES = 100000


def iso_time(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(dt.timezone.utc)
    except ValueError:
        return None


def snapshot_time(value):
    return dt.datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(
        tzinfo=dt.timezone.utc
    )


def source_inventory(base, key):
    buckets = list_buckets(key, base)
    if not buckets:
        raise RuntimeError("Source bucket list is unexpectedly empty")
    objects = {}
    for bucket in buckets:
        for path, row in list_files(bucket, key, base):
            identifier = json.dumps(
                [bucket, path], ensure_ascii=False, separators=(",", ":")
            )
            if identifier in objects:
                raise RuntimeError("Duplicate Storage source identifier")
            if len(objects) >= MAX_SOURCE_ENTRIES:
                raise RuntimeError("Storage source inventory exceeds safe audit bound")
            metadata = row.get("metadata") or {}
            objects[identifier] = {
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "size": metadata.get("size"),
            }
    if not objects:
        raise RuntimeError("Source has no objects; refusing parity conclusion")
    return buckets, objects


def compare(buckets_a, before, buckets_b, after, manifest):
    expected_buckets = set(manifest["buckets"])
    source_buckets_stable = set(buckets_a) == set(buckets_b)
    buckets_equal_manifest = source_buckets_stable and set(buckets_b) == expected_buckets

    archive = manifest["entries"]
    reference = snapshot_time(manifest["created_at"])
    stable = {key: value for key, value in after.items()
              if before.get(key) == value}
    changed_between_scans = len(set(before) | set(after)) - len(stable)
    missing_prior = 0
    stale_prior = 0
    post_snapshot_added = 0
    unknown_metadata = 0
    stable_in_manifest = 0
    for identifier, value in stable.items():
        created = iso_time(value.get("created_at"))
        modified = iso_time(value.get("updated_at"))
        old_enough = bool(created and created <= reference)
        if created and created > reference:
            post_snapshot_added += 1
        if not created or not modified:
            unknown_metadata += 1
        entry = archive.get(identifier)
        if entry is None:
            if old_enough:
                missing_prior += 1
            continue
        stable_in_manifest += 1
        meta = entry.get("source", {})
        if old_enough and modified and modified <= reference and (
            meta.get("updated_at") != value.get("updated_at")
            or meta.get("size") != value.get("size")
        ):
            stale_prior += 1

    result = {
        "source_before": len(before),
        "source_after": len(after),
        "manifest_entries": len(archive),
        "source_buckets": len(buckets_b),
        "manifest_buckets": len(expected_buckets),
        "bucket_parity": int(buckets_equal_manifest),
        "stable_objects": len(stable),
        "changed_between_scans": changed_between_scans,
        "stable_in_manifest": stable_in_manifest,
        "post_snapshot_source_additions": post_snapshot_added,
        "stable_prior_source_not_in_manifest": missing_prior,
        "stable_prior_manifest_metadata_mismatches": stale_prior,
        "metadata_timestamp_unknown": unknown_metadata,
        "manifest_not_currently_listed": len(set(archive) - set(after)),
        "snapshot": manifest["created_at"],
    }
    # The source inventory is eventually-consistent across two API sweeps,
    # not a transactional historical query; use REVIEW instead of falsely
    # certifying same-snapshot source completeness on incomplete metadata.
    result["status"] = (
        "REVIEW" if (not buckets_equal_manifest or missing_prior or stale_prior
                     or unknown_metadata or changed_between_scans) else
        "PASS_HISTORIC_MANIFEST_COVERAGE"
    )
    return result


def main():
    base = required("SUPABASE_URL").rstrip("/")
    if base != f"https://{SOURCE_REF}.supabase.co":
        raise RuntimeError("Unexpected source project")
    source_key = required("SUPABASE_SERVICE_ROLE_KEY")
    key = base64.b64decode(required("BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(key) != 32:
        raise RuntimeError("Invalid encryption key length")
    account = required("R2_ACCOUNT_ID")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=45,
                      retries={"mode": "standard", "max_attempts": 4}),
    )
    manifest, _ = validate_manifest(s3, required("R2_BUCKET"), key)
    buckets_before, before = source_inventory(base, source_key)
    buckets_after, after = source_inventory(base, source_key)
    result = compare(buckets_before, before, buckets_after, after, manifest)

    # Print aggregate metrics ONLY. Identifier strings, bucket names, paths,
    # source keys, credentials and the manifest JSON never enter public logs.
    details = " ".join(f"{k}={v}" for k, v in result.items())
    print("STORAGE SOURCE MANIFEST COVERAGE AUDIT: " + details, flush=True)
    if result["status"] == "REVIEW":
        print("STORAGE SOURCE COVERAGE NEEDS REVIEW: change/drift or source discrepancy; "
              "NOT proof of missing/corrupt R2 files", flush=True)
    else:
        print("STORAGE HISTORIC COVERAGE PRECHECK PASSED: two current source listings "
              "agree with pre-snapshot manifest identities; not a time-travel DB snapshot",
              flush=True)
    print("CAVEAT: Metadata-level observation only; actual R2 file integrity was "
          "separately verified, service recovery and live source parity are not certified.",
          flush=True)
    # GitHub job must NOT show a green success when the result is REVIEW.
    # Live post-snapshot additions alone do NOT trigger REVIEW; source drift
    # during two scans or stable pre-snapshot discrepancies do.
    if result["status"] == "REVIEW":
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"STORAGE SOURCE PARITY AUDIT FAILED: {type(error).__name__}; "
              "private identifiers withheld", file=sys.stderr)
        raise SystemExit(1)
