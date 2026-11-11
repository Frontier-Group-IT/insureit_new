import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import Mock

import sys
sys.path.insert(0, str(Path(__file__).parent))
import verify_r2_restore as restore
from supabase_storage_to_r2 import encrypt


class RestoreVerificationTests(unittest.TestCase):
    def test_select_samples_across_buckets(self):
        grouped = {
            "policy-documents": [(str(i), {}) for i in range(5)],
            "claim-documents": [("claim", {})],
            "customer-documents": [("customer", {}), ("customer2", {})],
        }
        sample = restore.select_samples(grouped)
        self.assertEqual(len(sample), 5)
        self.assertIn(("claim", {}), sample)

    def test_complete_scope_covers_every_entry_without_sampling(self):
        grouped = {
            "policy-documents": [(str(i), {"bytes": i}) for i in range(5)],
            "claim-documents": [("claim", {"bytes": 6})],
        }
        samples = restore.planned_entries(grouped, "sample")
        complete = restore.planned_entries(grouped, "all")
        self.assertEqual(len(samples), 3)
        self.assertEqual(len(complete), 6)
        self.assertEqual({x[0] for x in complete},
                         {"0", "1", "2", "3", "4", "claim"})
        self.assertEqual(complete, restore.select_all_entries(grouped))
        with self.assertRaises(ValueError):
            restore.planned_entries(grouped, "invalid")
        with self.assertRaises(ValueError):
            restore.planned_entries(grouped, "")

    def test_complete_verification_validates_every_encrypted_blob(self):
        import hashlib
        key = bytes(range(32))
        manifest = {}
        for i in range(4):
            identity = json.dumps(["docs", f"{i}.pdf"], separators=(",", ":"))
            content = f"synthetic-{i}".encode()
            manifest[identity] = (
                "supabase-storage/v1/blobs/" + str(i) + ".aes", content
            )
        s3 = Mock()

        def get_object(*, Bucket, Key):
            for identity, (blob, payload) in manifest.items():
                if Key == blob:
                    return {"Body": Mock(read=Mock(
                        return_value=encrypt(payload, key, identity)
                    ))}
            raise RuntimeError("Unexpected synthetic blob")

        s3.get_object.side_effect = get_object
        grouped = {"docs": []}
        for identity, (blob, payload) in manifest.items():
            grouped["docs"].append((identity, {
                "blob": blob,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }))
        count, verified_bytes = restore.verify_selected(
            s3, "private-r2", key, restore.planned_entries(grouped, "all")
        )
        self.assertEqual(count, len(manifest))
        self.assertEqual(verified_bytes, sum(len(p) for _, p in manifest.values()))
        self.assertEqual(s3.get_object.call_count, len(manifest))
        # Corrupting even the last object must fail the all-file check.
        grouped["docs"][-1][1]["sha256"] = "0" * 64
        with self.assertRaises(RuntimeError):
            restore.verify_selected(
                s3, "private-r2", key, restore.planned_entries(grouped, "all")
            )

    def test_manifest_with_empty_bucket_can_be_verified(self):
        manifest = {"buckets": ["policy-documents", "support-ticket-files"]}
        grouped = {"policy-documents": [("sample-1", {})]}
        self.assertEqual(
            restore.validate_bucket_coverage(manifest, grouped),
            {"support-ticket-files"}
        )
        self.assertEqual(len(restore.select_samples(grouped)), 1)

    def test_bucket_coverage_rejects_missing_or_unknown_group(self):
        with self.assertRaises(RuntimeError):
            restore.validate_bucket_coverage(
                {"buckets": ["support-ticket-files"]}, {}
            )
        with self.assertRaises(RuntimeError):
            restore.validate_bucket_coverage(
                {"buckets": ["policy-documents"]},
                {"unknown-bucket": [("sample", {})]}
            )

    def test_restore_hash_and_length(self):
        identity = json.dumps(["policy-documents", "a.pdf"], separators=(",", ":"))
        plaintext = b"%PDF-1.7 test"
        import hashlib
        entry = {
            "blob": "supabase-storage/v1/blobs/sample.aes",
            "bytes": len(plaintext),
            "sha256": hashlib.sha256(plaintext).hexdigest()
        }
        key = bytes(range(32))
        s3 = Mock()
        s3.get_object.return_value = {
            "Body": Mock(read=Mock(return_value=encrypt(plaintext, key, identity)))}
        self.assertEqual(restore.verify_sample(s3, "bucket", key, identity, entry),
                         len(plaintext))
        entry["sha256"] = "0" * 64
        with self.assertRaises(RuntimeError):
            restore.verify_sample(s3, "bucket", key, identity, entry)

    def test_manifest_and_pointer_consistency(self):
        import hashlib
        key = bytes(range(32))
        identifier = json.dumps(["claim-documents", "a.pdf"], separators=(",", ":"))
        content = b"data"
        manifest = {
            "version": 1, "project_ref": restore.SOURCE_REF, "created_at": "20261102T000000Z",
            "buckets": ["claim-documents"],
            "entries": {identifier: {
                "blob": "supabase-storage/v1/blobs/test.aes",
                "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()
            }}
        }
        pointer = {"manifest_key": "supabase-storage/v1/manifests/test.json.aes",
                   "created_at": manifest["created_at"]}
        s3 = Mock()
        def get_object(*, Bucket, Key):
            if Key.endswith("latest.json"):
                body = json.dumps(pointer).encode()
            else:
                body = encrypt(json.dumps(manifest).encode(), key, "manifest")
            return {"Body": Mock(read=Mock(return_value=body))}
        s3.get_object.side_effect = get_object
        verified, grouped = restore.validate_manifest(s3, "dest", key)
        self.assertEqual(len(verified["entries"]), 1)
        self.assertEqual(len(grouped), 1)
        pointer["created_at"] = "wrong"
        with self.assertRaises(RuntimeError):
            restore.validate_manifest(s3, "dest", key)


if __name__ == "__main__":
    unittest.main()
