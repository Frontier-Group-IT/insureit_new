"""Synthetic tests for R6: no real GitHub secrets, R2 or Supabase calls."""
import hashlib
import json
import unittest
from unittest.mock import patch

from restore_isolated_r6_storage_sample import (
    MAX_FILE_BYTES, SAMPLE_BUCKETS, SAMPLE_BYTES, SAMPLE_OBJECTS,
    TARGET_API, TARGET_REF, safe_bucket, safe_object_identity, safe_path,
    validated_sample, upload_sample, run,
)


def item(bucket, name, content):
    return (json.dumps([bucket, name], separators=(",", ":")),
            {"blob": "supabase-storage/v1/blobs/test.aes",
             "sha256": hashlib.sha256(content).hexdigest(),
             "bytes": len(content)})


class IsolatedStorageR6Tests(unittest.TestCase):
    def test_strict_target_not_production(self):
        self.assertEqual(TARGET_API, "https://klnodxnmlqbofolxxrsr.supabase.co")
        self.assertEqual(TARGET_REF, "klnodxnmlqbofolxxrsr")

    def test_archive_names_sanitized(self):
        self.assertEqual(safe_object_identity('["policy-files","docs/one.pdf"]'),
                         ("policy-files", "docs/one.pdf"))
        for bucket in ("", "../escape", "bucket/slash", " leading", "spaces ok?"):
            with self.subTest(bucket=bucket), self.assertRaises(ValueError):
                safe_bucket(bucket)
        for path in ("", "/absolute", "../escape", "docs/../secrets",
                     "docs//bad", "docs/./bad", "docs\\bad", "docs\u0000bad"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                safe_path(path)

    def test_locked_snapshot_and_verified_500mb_sample_bound(self):
        self.assertEqual(SAMPLE_OBJECTS, 304)
        self.assertEqual(SAMPLE_BYTES, 499_999_884)
        self.assertEqual(SAMPLE_BUCKETS, 8)
        chunks = [b"x" * 10 for _ in range(SAMPLE_OBJECTS)]
        # Synthetic fixture uses 304 files across 8 buckets, not R2 data.
        chosen = [item(f"bucket-{i%8}", f"doc-{i}.pdf", chunks[i])
                  for i in range(SAMPLE_OBJECTS)]
        # Patch planner's return and check that its aggregate must also match
        # independently enumerated selection, even with a valid timestamp.
        meta = {"sample_objects": SAMPLE_OBJECTS,
                "sample_plain_bytes": SAMPLE_BYTES,
                "sample_buckets": SAMPLE_BUCKETS}
        with patch("restore_isolated_r6_storage_sample.select_recovery_sample",
                   return_value=(chosen, meta)):
            with self.assertRaisesRegex(RuntimeError, "selection mismatch"):
                validated_sample({"created_at": "20261116T225734Z", "buckets":
                                  [f"bucket-{i}" for i in range(8)]},
                                 {f"bucket-{i}": chosen[i::8] for i in range(8)},
                                 "20261116T225734Z")
        with self.assertRaisesRegex(RuntimeError, "pointer changed"):
            validated_sample({"created_at": "20261116T225734Z"},
                             {}, "20261116T225735Z")
        with self.assertRaisesRegex(ValueError, "REQUIRED"):
            validated_sample({}, {}, "")

    def test_private_bucket_api_only_and_post_get_sha256(self):
        content = b"short-private-blob"
        chosen = [item("bucket-a", "private/path.pdf", content)]
        meta = {"sample_objects": 1,
                "sample_plain_bytes": len(content), "sample_buckets": 1}
        requests = []

        def fake_api(method, path, key, data=None, content_type="application/json"):
            requests.append((method, path, data, content_type))
            if method == "GET" and path == "/storage/v1/bucket":
                if not any(x[0]=="POST" and x[1]=="/storage/v1/bucket"
                           for x in requests):
                    return b"[]"
                return json.dumps([{"id": "bucket-a", "public": False}]).encode()
            if method == "GET" and path.startswith("/storage/v1/object/authenticated"):
                return content
            return b"{}"

        with patch("restore_isolated_r6_storage_sample.SAMPLE_BUCKETS", 1), \
             patch("restore_isolated_r6_storage_sample.target_call",
                   side_effect=fake_api), \
             patch("restore_isolated_r6_storage_sample.verified_file_bytes",
                   return_value=content):
            count, nbytes, buckets = upload_sample(None, "", b"", chosen, meta,
                                                   "x" * 35)
        self.assertEqual((count, nbytes, buckets), (1, len(content), 1))
        bucket_post = next((x for x in requests if x[1]=="/storage/v1/bucket"
                            and x[0]=="POST"), None)
        self.assertIsNotNone(bucket_post)
        obj = json.loads(bucket_post[2])
        self.assertIs(obj["public"], False)
        self.assertEqual(obj["file_size_limit"], MAX_FILE_BYTES)
        self.assertEqual(sum(x[0] == "POST" and "/storage/v1/object/" in x[1]
                             for x in requests), 1)
        self.assertEqual(sum(x[0] == "GET" and "/storage/v1/object/authenticated/"
                             in x[1] for x in requests), 1)
        self.assertTrue(all(x[1].startswith("/storage/v1/") for x in requests))

    def test_partial_target_forbids_upload(self):
        chosen = [item("bucket-a", "x.pdf", b"ok")]
        meta = {"sample_objects": 1, "sample_plain_bytes": 2,
                "sample_buckets": 1}
        with patch("restore_isolated_r6_storage_sample.SAMPLE_BUCKETS", 1), \
             patch("restore_isolated_r6_storage_sample.target_call",
                   return_value=b'[{"id":"existing"}]') as target:
            with self.assertRaisesRegex(RuntimeError, "ZERO existing"):
                upload_sample(None, "", b"", chosen, meta, "z" * 35)
        self.assertEqual(target.call_count, 1)

    def test_sensitive_upload_requires_two_independent_guards(self):
        with patch.dict("os.environ", {
            "RECOVERY_CONFIRM_TARGET_REF": TARGET_REF,
            "RECOVERY_EXPECTED_STORAGE_SNAPSHOT": "20261116T225734Z",
        }, clear=True), \
             patch("restore_isolated_r6_storage_sample.r2_session",
                   return_value=(object(), "fake_bucket", b"key")), \
             patch("restore_isolated_r6_storage_sample.validate_manifest",
                   return_value=({"created_at":"20261116T225734Z",
                                  "buckets":["bucket-a"]}, {})), \
             patch("restore_isolated_r6_storage_sample.validated_sample",
                   return_value=([item("bucket-a","x.pdf",b"ok")],
                                 {"sample_objects": 1, "sample_plain_bytes": 2,
                                  "sample_buckets": 1})), \
             patch("restore_isolated_r6_storage_sample.upload_sample",
                   side_effect=AssertionError("must not upload")):
            with self.assertRaisesRegex(RuntimeError, "affirmative"):
                run("--upload")


if __name__ == "__main__":
    unittest.main()
