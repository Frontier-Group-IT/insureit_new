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
from collections import deque

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
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()


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
    copied = 0
    reused = 0
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    source_buckets = list_buckets(supabase_key, base)
    if not source_buckets:
        raise RuntimeError("No Supabase buckets found; refusing empty backup")
    for source_bucket in source_buckets:
        for path, row in list_files(source_bucket, supabase_key, base):
            identifier = json.dumps([source_bucket, path], ensure_ascii=False, separators=(",", ":"))
            metadata = {"updated_at": row.get("updated_at"),
                        "size": (row.get("metadata") or {}).get("size")}
            prior = old_entries.get(identifier)
            if prior and metadata["updated_at"] and prior.get("source") == metadata:
                entries[identifier] = prior
                reused += 1
                continue

            url_path = ("/storage/v1/object/authenticated/" +
                        urllib.parse.quote(source_bucket, safe="") + "/" +
                        urllib.parse.quote(path, safe="/"))
            content = api("GET", url_path, supabase_key, base)
            if len(content) > MAX_BYTES:
                raise RuntimeError("Object exceeds runner's safe size ceiling")
            digest = hashlib.sha256(content).hexdigest()
            if prior and prior.get("sha256") == digest:
                entries[identifier] = {**prior, "source": metadata}
                reused += 1
                continue
            blob_key = (f"{PREFIX}/blobs/{today}/" +
                        hashlib.sha256(identifier.encode()).hexdigest() +
                        "-" + secrets.token_hex(8) + ".aes")
            s3.put_object(Bucket=bucket, Key=blob_key,
                          Body=encrypt(content, raw_key, identifier),
                          ContentType="application/octet-stream")
            # Verify an actual R2 roundtrip before committing manifest.
            roundtrip = s3.get_object(Bucket=bucket, Key=blob_key)["Body"].read()
            if hashlib.sha256(decrypt(roundtrip, raw_key, identifier)).hexdigest() != digest:
                raise RuntimeError("Encrypted blob round-trip mismatch")
            entries[identifier] = {"blob": blob_key, "sha256": digest,
                                   "bytes": len(content), "source": metadata}
            copied += 1

    if not entries:
        raise RuntimeError("No source files discovered; refusing empty manifest")
    document = {"version": 1, "created_at": today, "project_ref": SOURCE_REF,
                "buckets": source_buckets, "entries": entries}
    manifest_key = f"{PREFIX}/manifests/{today}-{secrets.token_hex(6)}.json.aes"
    manifest = json.dumps(document, separators=(",", ":"), sort_keys=True).encode()
    s3.put_object(Bucket=bucket, Key=manifest_key,
                  Body=encrypt(manifest, raw_key, "manifest"),
                  ContentType="application/octet-stream")
    # Pointer published last: interrupted uploads never become the latest backup.
    s3.put_object(Bucket=bucket, Key=pointer_key,
                  Body=json.dumps({"version": 1, "created_at": today,
                                   "manifest_key": manifest_key}).encode(),
                  ContentType="application/json")
    print(f"Backup committed: {len(entries)} objects, {copied} new versions, "
          f"{reused} reused; bucket count: {len(source_buckets)}")
    print("R2 retention pruning is intentionally disabled pending approved recovery tests.")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"Backup FAILED: {type(err).__name__}: {err}", file=sys.stderr)
        sys.exit(1)
