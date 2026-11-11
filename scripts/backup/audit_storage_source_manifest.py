#!/usr/bin/env python3
"""Read-only, timestamp-aware INSUREIT Storage-source to R2-manifest coverage audit.

Reads ONLY PostgreSQL Storage metadata SELECTs on the authorized source and
Cloudflare R2 GET for the encrypted manifest. Does NOT download Storage
content, write any source object, write R2 objects, or print object identifiers.
Each source inventory is a repeatable-read, read-only SQL transaction.
Two independent transactions detect interim changes but do not recreate a
historical source transaction. This is a coverage preflight, NOT complete DR.
"""
import base64
import datetime as dt
import json
import os
import sys
import time

import boto3
from botocore.config import Config

from supabase_storage_to_r2 import SOURCE_REF, required
from prepare_pg_dump_connection import checked_connection
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


def db_connect(database_url):
    """Checked source-only TLS connection, no raw URL handed to libpq.

    The production secret may have unescaped '@' in its password. Reuse the
    validated parser from the successful PostgreSQL backup workflow.
    """
    import psycopg

    host, port, db, user, password, tls = checked_connection(database_url)
    return psycopg.connect(
        host=host, port=port, dbname=db, user=user, password=password,
        sslmode=tls, connect_timeout=20,
        options="-c default_transaction_read_only=on -c statement_timeout=120000",
    )


def as_iso(value):
    return value.isoformat() if isinstance(value, dt.datetime) else value


def size_int(value):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Invalid Storage size")
    try:
        parsed = int(value)
    except (ValueError, TypeError) as exc:
        raise ValueError("Non-numeric Storage size") from exc
    if parsed < 0:
        raise ValueError("Negative Storage size")
    return parsed


def source_inventory(database_url):
    """One repeatable-read, read-only source inventory from Storage metadata.

    Unlike recursive HTTP per-prefix listing, this reads exactly two bounded
    indexed PostgreSQL catalog relations, no file bytes. Does not modify the
    managed 'storage' schema. All names remain only in process memory.
    """
    checked_connection(database_url)  # Validate source before any network.
    objects = {}
    with db_connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"
            )
            cursor.execute("SELECT id FROM storage.buckets ORDER BY id")
            buckets = [str(row[0]) for row in cursor.fetchall()]
            if not buckets or len(buckets) != len(set(buckets)):
                raise RuntimeError("Source bucket inventory invalid")
            cursor.execute(
                "SELECT bucket_id, name, created_at, updated_at, "
                "metadata->>'size' AS file_size "
                "FROM storage.objects "
                "WHERE archived_at IS NULL "
                "AND NOT COALESCE(is_delete_marker, false) "
                "ORDER BY bucket_id, name"
            )
            while True:
                batch = cursor.fetchmany(512)
                if not batch:
                    break
                for bucket, name, created, updated, size in batch:
                    if not isinstance(name, str) or not name:
                        raise RuntimeError("Storage object name absent")
                    # Match the existing Storage API backup collector's
                    # documented empty-directory sentinel handling.
                    if name.rsplit("/", 1)[-1] == ".emptyFolderPlaceholder":
                        continue
                    if str(bucket) not in buckets:
                        raise RuntimeError("Storage object bucket not in source catalog")
                    identifier = json.dumps(
                        [str(bucket), name], ensure_ascii=False, separators=(",", ":")
                    )
                    if identifier in objects:
                        raise RuntimeError("Duplicate current Storage source object")
                    if len(objects) >= MAX_SOURCE_ENTRIES:
                        raise RuntimeError("Storage source audit exceeds safe row limit")
                    objects[identifier] = {
                        "created_at": as_iso(created),
                        "updated_at": as_iso(updated),
                        "size": size_int(size),
                    }
    if not objects:
        raise RuntimeError("Source object inventory unexpectedly empty")
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
        # PostgreSQL timestamps usually format as "+00:00"; Storage API
        # timestamps may use "Z". Compare parsed instants, not formatting.
        if old_enough and modified and modified <= reference and (
            iso_time(meta.get("updated_at")) != modified
            or size_int(meta.get("size")) != value.get("size")
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
    # Authenticate the exact source PostgreSQL project, not an arbitrary URL.
    database_url = required("DATABASE_URL")
    checked_connection(database_url)
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
    print(
        f"STORAGE PARITY PHASE: authenticated R2 manifest; "
        f"archive_entries={len(manifest['entries'])}; "
        f"buckets={len(manifest['buckets'])}", flush=True
    )
    started = time.monotonic()
    buckets_before, before = source_inventory(database_url)
    print(
        f"STORAGE PARITY PHASE: first read-only SQL snapshot complete; "
        f"source_objects={len(before)}; buckets={len(buckets_before)}; "
        f"elapsed_seconds={int(time.monotonic()-started)}", flush=True
    )
    buckets_after, after = source_inventory(database_url)
    print(
        f"STORAGE PARITY PHASE: second read-only SQL snapshot complete; "
        f"source_objects={len(after)}; buckets={len(buckets_after)}; "
        f"elapsed_seconds={int(time.monotonic()-started)}", flush=True
    )
    result = compare(buckets_before, before, buckets_after, after, manifest)

    # Print aggregate metrics ONLY. Identifier strings, bucket names, paths,
    # source keys, credentials and manifest JSON never enter public logs.
    details = " ".join(f"{k}={v}" for k, v in result.items())
    print("STORAGE SOURCE MANIFEST COVERAGE AUDIT: " + details, flush=True)
    if result["status"] == "REVIEW":
        print("STORAGE SOURCE COVERAGE NEEDS REVIEW: source drift or pre-snapshot "
              "discrepancy; this is NOT evidence of corrupted R2 file bytes.",
              flush=True)
    else:
        print("STORAGE HISTORIC COVERAGE PRECHECK PASSED: repeatable-read SQL "
              "snapshots agree with source identities; no historic transaction "
              "snapshot can be reconstructed.", flush=True)
    print("CAVEAT: PostgreSQL Storage METADATA only; the successful independent "
          "R2 all-file checksum test is separate. Operational service and full "
          "historical Storage source completeness remain unverified.", flush=True)
    # Keep an inconclusive audit red rather than falsely green.
    if result["status"] == "REVIEW":
        raise SystemExit(2)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"STORAGE SOURCE PARITY AUDIT FAILED: {type(error).__name__}; "
              "private identifiers withheld", file=sys.stderr)
        raise SystemExit(1)
