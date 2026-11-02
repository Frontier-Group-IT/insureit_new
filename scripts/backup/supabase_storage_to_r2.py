#!/usr/bin/env python3
"""Append-only, encrypted incremental Supabase Storage -> Cloudflare R2 backup.

No source writes, no R2 deletes. Each successful run publishes a new encrypted
manifest and then a small latest pointer. Never rely on this as the sole backup
until a restore rehearsal and secret escrow are complete.
"""
import base64
import datetime as dt
import hashlib
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import deque, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from botocore.config import Config
from botocore.exceptions import ClientError

import boto3
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PREFIX = "supabase-storage/v1"
SOURCE_REF = "ilzhsfqqjyppzzvfscmh"
MAX_BYTES = 250 * 1024 * 1024


def required(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required secret {name}")
    return value


def api(method, path, key, base, payload=None):
    url = base + path
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": "Bearer " + key,
            "apikey": key,
            "Content-Type": "application/json",
        },
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise RuntimeError("Object exceeds 250 MiB")
                return data
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            status = getattr(exc, "code", None)
            if attempt == 3 or (status is not None and status not in (408, 429, 500, 502, 503, 504)):
                raise RuntimeError(f"Supabase request failed; status={status or 'network'}") from exc
            time.sleep(min(2 ** attempt, 8))


def list_buckets(key, base):
    data = json.loads(api("GET", "/storage/v1/bucket", key, base))
    if not isinstance(data, list):
        raise RuntimeError("Unexpected bucket listing response")
    return sorted(str(item["id"]) for item in data)


def list_files(bucket, key, base):
    # Supabase Storage's list API is per-prefix, not recursively flattened.
    queue = deque([""])
    seen_prefixes = set()
    while queue:
        prefix = queue.popleft()
        if prefix in seen_prefixes:
            raise RuntimeError("Unexpected repeated folder prefix")
        seen_prefixes.add(prefix)
        offset = 0
        while True:
            path = "/storage/v1/object/list/" + urllib.parse.quote(bucket, safe="")
            payload = {"prefix": prefix, "limit": 100, "offset": offset,
                       "sortBy": {"column": "name", "order": "asc"}}
            rows = json.loads(api("POST", path, key, base, payload))
            if not isinstance(rows, list):
                raise RuntimeError("Unexpected object listing response")
            for row in rows:
                name = row.get("name")
                if not name or name in (".emptyFolderPlaceholder",):
                    continue
                full = prefix + name
                if row.get("id") is None:
                    queue.append(full.rstrip("/") + "/")
                else:
                    yield full, row
            if len(rows) < 100:
                break
            offset += len(rows)


def encrypt(data, encryption_key, aad):
    nonce = secrets.token_bytes(12)
    return b"INSUREIT1" + nonce + AESGCM(encryption_key).encrypt(
        nonce, data, aad.encode("utf-8")
    )


def decrypt(data, encryption_key, aad):
    if not data.startswith(b"INSUREIT1"):
        raise RuntimeError("Unexpected backup encryption header")
    nonce = data[9:21]
    return AESGCM(encryption_key).decrypt(nonce, data[21:], aad.encode("utf-8"))



def optional_object(s3, bucket, key):
    try:
        return s3.get_object(Bucket=bucket, Key=key)["Body"].read()
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise


def existing_blob_index(s3, bucket):
    # Old cancelled run had no checkpoints, but its names contain SHA256(identifier).
    index = defaultdict(list)
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=PREFIX + "/blobs/"):
        for obj in page.get("Contents", []):
            name = obj["Key"].rsplit("/", 1)[-1]
            if len(name) > 65 and name[64] == "-" and name.endswith(".aes"):
                index[name[:64]].append(obj["Key"])
    return index


def checkpoint_key(identifier, metadata):
    identity_hash = hashlib.sha256(identifier.encode()).hexdigest()
    version_hash = hashlib.sha256(json.dumps(metadata, sort_keys=True).encode()).hexdigest()
    return f"{PREFIX}/checkpoints/{identity_hash}/{version_hash}.json.aes"


def copy_one(task, s3, destination, base, source_key, encryption_key, previous, old_blobs, snapshot):
    source_bucket, path, row = task
    identifier = json.dumps([source_bucket, path], ensure_ascii=False, separators=(",", ":"))
    meta = {"updated_at": row.get("updated_at"),
            "size": (row.get("metadata") or {}).get("size")}
    prior = previous.get(identifier)
    if prior and meta["updated_at"] and prior.get("source") == meta:
        return identifier, prior, "manifest"
    ck = checkpoint_key(identifier, meta)
    encrypted_checkpoint = optional_object(s3, destination, ck)
    if encrypted_checkpoint is not None:
        saved = json.loads(decrypt(encrypted_checkpoint, encryption_key, "checkpoint:" + identifier))
        if saved.get("identifier") != identifier or saved.get("source") != meta:
            raise RuntimeError("Checkpoint integrity mismatch")
        entry = saved["entry"]
        s3.head_object(Bucket=destination, Key=entry["blob"])
        return identifier, entry, "checkpoint"

    url_path = ("/storage/v1/object/authenticated/" +
                urllib.parse.quote(source_bucket, safe="") + "/" +
                urllib.parse.quote(path, safe="/"))
    content = api("GET", url_path, source_key, base)
    digest = hashlib.sha256(content).hexdigest()
    if prior and prior.get("sha256") == digest:
        blob = prior["blob"]
        mode = "manifest"
    else:
        blob = None
        mode = "uploaded"
        key_hash = hashlib.sha256(identifier.encode()).hexdigest()
        # Recover orphaned ciphertext ONLY after decrypting with its exact identity
        # and comparing its hash against the current Supabase source.
        for candidate in old_blobs.get(key_hash, ()):
            old = decrypt(s3.get_object(Bucket=destination, Key=candidate)["Body"].read(),
                          encryption_key, identifier)
            if hashlib.sha256(old).hexdigest() == digest:
                blob = candidate
                mode = "recovered"
                break
        if blob is None:
            blob = (f"{PREFIX}/blobs/{snapshot}/" + key_hash + "-" +
                    secrets.token_hex(8) + ".aes")
            s3.put_object(Bucket=destination, Key=blob,
                          Body=encrypt(content, encryption_key, identifier),
                          ContentType="application/octet-stream")
            actual = s3.get_object(Bucket=destination, Key=blob)["Body"].read()
            if hashlib.sha256(decrypt(actual, encryption_key, identifier)).hexdigest() != digest:
                raise RuntimeError("R2 verification hash mismatch")
    entry = {"blob": blob, "sha256": digest, "bytes": len(content), "source": meta}
    checkpoint = {"identifier": identifier, "source": meta, "entry": entry}
    s3.put_object(Bucket=destination, Key=ck,
                  Body=encrypt(json.dumps(checkpoint, sort_keys=True).encode(),
                               encryption_key, "checkpoint:" + identifier),
                  ContentType="application/octet-stream")
    return identifier, entry, mode

def main():
    base = required("SUPABASE_URL").rstrip("/")
    if base != f"https://{SOURCE_REF}.supabase.co":
        raise RuntimeError("Refusing backup of an unapproved Supabase project")
    supabase_key = required("SUPABASE_SERVICE_ROLE_KEY")
    account = required("R2_ACCOUNT_ID")
    bucket = required("R2_BUCKET")
    access_key = required("R2_ACCESS_KEY_ID")
    secret_key = required("R2_SECRET_ACCESS_KEY")
    raw_key = base64.b64decode(required("BACKUP_ENCRYPTION_KEY"), validate=True)
    if len(raw_key) != 32:
        raise RuntimeError("BACKUP_ENCRYPTION_KEY must be base64 of exactly 32 bytes")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=45, retries={"mode":"standard","max_attempts":4}, max_pool_connections=12),
    )
    # If the pointer exists but cannot decrypt, fail closed (no overwrite).
    pointer_key = f"{PREFIX}/latest.json"
    previous = {}
    try:
        pointer = json.loads(s3.get_object(Bucket=bucket, Key=pointer_key)["Body"].read())
        manifest_key = pointer["manifest_key"]
        encrypted_manifest = s3.get_object(Bucket=bucket, Key=manifest_key)["Body"].read()
        previous = json.loads(decrypt(encrypted_manifest, raw_key, "manifest"))
        if previous.get("version") != 1:
            raise RuntimeError("Unsupported old manifest")
    except s3.exceptions.NoSuchKey:
        pass
    except Exception as exc:
        if getattr(exc, "response", {}).get("Error", {}).get("Code") in ("404", "NoSuchKey"):
            pass
        else:
            raise

    old_entries = previous.get("entries", {})
    entries = {}
    counts = defaultdict(int)
    snapshot = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    print("Indexing prior R2 ciphertext for reuse...", flush=True)
    old_blobs = existing_blob_index(s3, bucket)
    print(f"Found {sum(len(v) for v in old_blobs.values())} existing encrypted blobs", flush=True)
    source_buckets = list_buckets(supabase_key, base)
    if not source_buckets:
        raise RuntimeError("No Supabase buckets found; refusing empty backup")
    tasks = [(source_bucket, path, row) for source_bucket in source_buckets
             for path, row in list_files(source_bucket, supabase_key, base)]
    if not tasks:
        raise RuntimeError("No files discovered; refusing empty backup")
    print(f"Discovered {len(tasks)} source files across {len(source_buckets)} buckets", flush=True)
    failures = []
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(copy_one, task, s3, bucket, base, supabase_key,
                               raw_key, old_entries, old_blobs, snapshot): task for task in tasks}
        for done, future in enumerate(as_completed(futures), 1):
            try:
                identifier, entry, mode = future.result()
                entries[identifier] = entry
                counts[mode] += 1
            except Exception as exc:
                failures.append((futures[future][0], type(exc).__name__))
            if done % 25 == 0 or done == len(tasks):
                print(f"Progress {done}/{len(tasks)} | uploaded={counts['uploaded']} "
                      f"recovered={counts['recovered']} reused={counts['checkpoint']+counts['manifest']} "
                      f"errors={len(failures)} elapsed={int(time.monotonic()-started)}s", flush=True)
    if failures:
        raise RuntimeError(f"{len(failures)} files failed in buckets " +
                           ",".join(sorted({item[0] for item, _ in failures})))
    if len(entries) != len(tasks):
        raise RuntimeError("Manifest cannot be published: object count mismatch")
    if not entries:
        raise RuntimeError("No source files discovered; refusing empty manifest")
    document = {"version": 1, "created_at": snapshot, "project_ref": SOURCE_REF,
                "buckets": source_buckets, "entries": entries}
    manifest_key = f"{PREFIX}/manifests/{snapshot}-{secrets.token_hex(6)}.json.aes"
    manifest = json.dumps(document, separators=(",", ":"), sort_keys=True).encode()
    s3.put_object(Bucket=bucket, Key=manifest_key,
                  Body=encrypt(manifest, raw_key, "manifest"),
                  ContentType="application/octet-stream")
    # Pointer published last: interrupted uploads never become the latest backup.
    s3.put_object(Bucket=bucket, Key=pointer_key,
                  Body=json.dumps({"version": 1, "created_at": today,
                                   "manifest_key": manifest_key}).encode(),
                  ContentType="application/json")
    print(f"Backup committed: {len(entries)} verified source objects across {len(source_buckets)} buckets", flush=True)
    print("R2 retention pruning is intentionally disabled pending approved recovery tests.")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"Backup FAILED: {type(err).__name__}: {err}", file=sys.stderr)
        sys.exit(1)
