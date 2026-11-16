#!/usr/bin/env python3
"""Private, deterministic <=500MB recovery-Storage sample plan and R2 verification.

Read-only R2 operations only. NEVER uploads to Supabase or rewrites storage.objects.
Identities, paths, filenames and document bytes must remain off all public logs.
"""
import base64
import hashlib
import json
import os
import sys
from collections import Counter

import boto3
from botocore.config import Config

from supabase_storage_to_r2 import decrypt, required
from verify_r2_restore import (
    validate_manifest, validate_bucket_coverage, verify_selected,
)

# Decimal MB, matching plan limits; do not round to MiB and exceed user cap.
MAX_TOTAL_BYTES = 500_000_000
MAX_FILE_BYTES = 50_000_000
SUPPORTED_MODES = ("--plan", "--verify")


def stable_key(identifier):
    return hashlib.sha256(identifier.encode("utf-8")).hexdigest()


def category(identifier):
    """Generalized content class; never print a real filename."""
    _, path = json.loads(identifier)
    lower = path.lower().split("?")[0]
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".bmp")):
        return "image"
    if lower.endswith((".mp4", ".mov", ".webm", ".avi", ".mkv")):
        return "video"
    if lower.endswith((".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv")):
        return "office"
    return "other"


def size_band(size):
    if size < 1_000_000:
        return "small"
    if size < 10_000_000:
        return "medium"
    return "large"


def select_recovery_sample(grouped, total_budget=MAX_TOTAL_BYTES,
                           per_file_limit=MAX_FILE_BYTES):
    """Spread across buckets, classes and size bands, then fill toward budget.

    Selection is deterministic for a given authenticated manifest. No selected
    object may exceed the Free-plan cap or the user-approved total. No object
    data is read by this function. Caller must not log returned identifiers.
    """
    if not (isinstance(total_budget, int) and
            1 <= total_budget <= MAX_TOTAL_BYTES and
            isinstance(per_file_limit, int) and
            1 <= per_file_limit <= MAX_FILE_BYTES):
        raise ValueError("Out-of-scope recovery Storage budget")
    eligible = {}
    too_large = 0
    for bucket in sorted(grouped):
        accepted = []
        for identifier, entry in grouped[bucket]:
            n = entry["bytes"]
            if n > per_file_limit:
                too_large += 1
                continue
            if n < 0:
                raise ValueError("Invalid archived byte count")
            accepted.append((identifier, entry))
        eligible[bucket] = sorted(accepted, key=lambda item: stable_key(item[0]))

    selected = []
    selected_ids = set()
    used = 0
    categories = set()
    bands = set()

    def add(item):
        nonlocal used
        ident, entry = item
        if ident in selected_ids or used + entry["bytes"] > total_budget:
            return False
        selected_ids.add(ident)
        selected.append(item)
        used += entry["bytes"]
        categories.add(category(ident))
        bands.add(size_band(entry["bytes"]))
        return True

    # First choose a representative within every populated bucket: preferably
    # a PDF or image (core insurance files), roughly middle of size distribution.
    for bucket in sorted(eligible):
        items = sorted(eligible[bucket], key=lambda item: (
            0 if category(item[0]) == "pdf" else
            1 if category(item[0]) == "image" else 2,
            item[1]["bytes"],
            stable_key(item[0]),
        ))
        # Avoid zero-byte placeholder if there are non-empty candidates.
        items = sorted(items, key=lambda item: item[1]["bytes"] == 0)
        for item in items:
            if add(item):
                break

    # Then include distinct file classes and size bands where available.
    candidates = [item for bucket in sorted(eligible) for item in eligible[bucket]]
    for cls in ("pdf", "image", "office", "video", "other"):
        options = sorted((i for i in candidates if category(i[0]) == cls),
                         key=lambda item: (item[1]["bytes"], stable_key(item[0])))
        if cls not in categories:
            for item in options:
                if add(item):
                    break
    for band in ("small", "medium", "large"):
        options = sorted((i for i in candidates if size_band(i[1]["bytes"]) == band),
                         key=lambda item: (item[1]["bytes"], stable_key(item[0])))
        if band not in bands:
            for item in options:
                if add(item):
                    break

    # Fill toward 500 MB with eligible archived files, largest first. This is
    # a greedy bounded sample, NOT an assertion all documents were recovered.
    for item in sorted(candidates,
                       key=lambda item: (-item[1]["bytes"], stable_key(item[0]))):
        add(item)

    if not selected:
        raise ValueError("No eligible recovery Storage sample")
    if used > total_budget or any(e["bytes"] > per_file_limit for _, e in selected):
        raise AssertionError("Storage sample budget violated")
    return selected, {
        "sample_objects": len(selected),
        "sample_plain_bytes": used,
        "excluded_oversize_objects": too_large,
        "sample_buckets": len({
            json.loads(identifier)[0] for identifier, _ in selected
        }),
        "sample_content_categories": len(categories),
        "sample_size_bands": len(bands),
    }


def run(mode):
    if mode not in SUPPORTED_MODES:
        raise ValueError("Unsupported mode")
    key = base64.b64decode(required("BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(key) != 32:
        raise ValueError("Invalid recovery Storage encryption key")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=60,
                      retries={"mode": "standard", "max_attempts": 4}),
    )
    manifest, grouped = validate_manifest(s3, required("R2_BUCKET"), key)
    empty_buckets = validate_bucket_coverage(manifest, grouped)
    chosen, metrics = select_recovery_sample(grouped)
    if mode == "--verify":
        verified_count, verified_bytes = verify_selected(
            s3, required("R2_BUCKET"), key, chosen
        )
        if verified_count != metrics["sample_objects"] or verified_bytes != metrics["sample_plain_bytes"]:
            raise RuntimeError("Storage sample private verification mismatch")
    public_metrics = dict(metrics)
    public_metrics.update({
        "manifest_objects": len(manifest["entries"]),
        "manifest_nonempty_buckets": len(grouped),
        "manifest_empty_buckets": len(empty_buckets),
        "max_total_bytes": MAX_TOTAL_BYTES,
        "max_file_bytes": MAX_FILE_BYTES,
    })
    # Exclude any private object identifiers and decrypted metadata/filenames.
    print("RECOVERY STORAGE SAMPLE "
          + ("R2 VERIFIED" if mode == "--verify" else "PLAN ONLY")
          + ": " + " ".join(f"{k}={value}" for k, value in public_metrics.items()),
          flush=True)
    print("STORAGE SCOPE: max_500MB_only; full_document_DR=NOT_CERTIFIED;"
          " Supabase_target_upload=NOT_PERFORMED; metadata_parity=NOT_PROVEN",
          flush=True)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: plan_recovery_storage_sample.py --plan | --verify")
        run(sys.argv[1])
    except Exception as error:
        print(f"RECOVERY STORAGE SAMPLE FAILED: category={type(error).__name__};"
              " customer filenames, SQL, secrets and R2 keys withheld",
              file=sys.stderr)
        raise SystemExit(1)
