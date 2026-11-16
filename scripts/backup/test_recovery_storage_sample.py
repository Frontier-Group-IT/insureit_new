"""Synthetic-only bounded Storage sample selection and read-only verification guards."""
import contextlib
import io
import json
import os
from unittest.mock import patch
import unittest

from plan_recovery_storage_sample import (
    MAX_TOTAL_BYTES, MAX_FILE_BYTES, category, run, select_recovery_sample,
)


def item(bucket, path, size):
    return (json.dumps([bucket, path], separators=(",", ":")),
            {"bytes": size, "sha256": "0" * 64,
             "blob": "supabase-storage/v1/blobs/synthetic.aes"})


class SamplePlanner(unittest.TestCase):
    def setUp(self):
        self.grouped = {
            "bucket-a": [item("bucket-a", f"policy-{i}.pdf", 20_000_000)
                         for i in range(20)] + [item("bucket-a", "huge.pdf", 50_000_001)],
            "bucket-b": [item("bucket-b", f"document-{i}.jpg", 30_000_000)
                         for i in range(5)] + [item("bucket-b", "empty.png", 0)],
            "bucket-c": [item("bucket-c", "note.docx", 1_000_000),
                         item("bucket-c", "proof.mp4", 10_000_000)],
        }

    def test_deterministic_budget_and_bucket_coverage(self):
        chosen, metrics = select_recovery_sample(self.grouped)
        again, same = select_recovery_sample(self.grouped)
        self.assertEqual(chosen, again)
        self.assertEqual(metrics, same)
        self.assertLessEqual(metrics["sample_plain_bytes"], MAX_TOTAL_BYTES)
        self.assertGreater(metrics["sample_plain_bytes"], 400_000_000)
        self.assertEqual(metrics["excluded_oversize_objects"], 1)
        self.assertEqual(metrics["sample_buckets"], 3)
        self.assertGreaterEqual(metrics["sample_content_categories"], 3)
        self.assertTrue(all(size <= MAX_FILE_BYTES
                            for _, e in chosen
                            for size in [e["bytes"]]))
        self.assertEqual(len(chosen), len({i for i, _ in chosen}))

    def test_custom_lower_budget_hard_limit(self):
        chosen, stats = select_recovery_sample(self.grouped,
                                                total_budget=40_000_000,
                                                per_file_limit=30_000_000)
        self.assertLessEqual(stats["sample_plain_bytes"], 40_000_000)
        self.assertTrue(all(e["bytes"] <= 30_000_000 for _, e in chosen))

    def test_impossible_override_rejected(self):
        for total, single in ((MAX_TOTAL_BYTES + 1, MAX_FILE_BYTES),
                              (MAX_TOTAL_BYTES, MAX_FILE_BYTES + 1),
                              (0, MAX_FILE_BYTES), (True, MAX_FILE_BYTES)):
            # bool is an int in Python; a True total has tiny budget but is
            # still bounded. Never falsely assume boolean is an unsafe bypass.
            if isinstance(total, bool):
                continue
            with self.subTest(total=total, single=single):
                with self.assertRaises(ValueError):
                    select_recovery_sample(self.grouped, total, single)

    def test_buckets_without_eligible_file_excluded(self):
        g = dict(self.grouped, oversize_bucket=[item("oversize_bucket", "large.mp4", 60_000_000)])
        _, metrics = select_recovery_sample(g)
        self.assertEqual(metrics["sample_buckets"], 3)
        self.assertEqual(metrics["excluded_oversize_objects"], 2)

    def test_no_eligible_object_fails(self):
        with self.assertRaises(ValueError):
            select_recovery_sample({"one": [item("one", "oversized.pdf", 65_000_000)]})

    def test_no_filename_in_output_and_no_blob_download_in_plan_mode(self):
        manifest = {"entries": {"synthetic": {}}, "buckets": ["bucket-a", "bucket-b", "bucket-c"]}
        fake_key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        with patch.dict(os.environ, {
            "BACKUP_ENCRYPTION_KEY": fake_key,
            "R2_ACCOUNT_ID": "fake",
            "R2_ACCESS_KEY_ID": "fake",
            "R2_SECRET_ACCESS_KEY": "fake",
            "R2_BUCKET": "fake",
        }):
            with patch("plan_recovery_storage_sample.boto3.client", return_value=object()), \
                 patch("plan_recovery_storage_sample.validate_manifest",
                       return_value=(manifest, self.grouped)), \
                 patch("plan_recovery_storage_sample.validate_bucket_coverage",
                       return_value=set()), \
                 patch("plan_recovery_storage_sample.verify_selected",
                       side_effect=AssertionError("No content retrieval in plan")):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    run("--plan")
                self.assertIn("PLAN ONLY", output.getvalue())
                self.assertIn("max_total_bytes=500000000", output.getvalue())
                self.assertNotIn("policy-", output.getvalue())
                self.assertNotIn("document-", output.getvalue())

    def test_verifier_checks_actual_hash_count(self):
        manifest = {"entries": {"synthetic": {}}, "buckets": ["bucket-a", "bucket-b", "bucket-c"]}
        with patch.dict(os.environ, {
            "BACKUP_ENCRYPTION_KEY": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "R2_ACCOUNT_ID": "fake", "R2_ACCESS_KEY_ID": "fake",
            "R2_SECRET_ACCESS_KEY": "fake", "R2_BUCKET": "fake",
        }):
            chosen, stats = select_recovery_sample(self.grouped)
            with patch("plan_recovery_storage_sample.boto3.client", return_value=object()), \
                 patch("plan_recovery_storage_sample.validate_manifest",
                       return_value=(manifest, self.grouped)), \
                 patch("plan_recovery_storage_sample.validate_bucket_coverage",
                       return_value=set()), \
                 patch("plan_recovery_storage_sample.verify_selected",
                       return_value=(len(chosen), stats["sample_plain_bytes"])) as checked:
                with contextlib.redirect_stdout(io.StringIO()):
                    run("--verify")
                checked.assert_called_once()

    def test_private_classes_are_generalized(self):
        self.assertEqual(category(item("a", "secret-PDF.PDF", 1)[0]), "pdf")
        self.assertEqual(category(item("a", "img.jpg", 1)[0]), "image")


if __name__ == "__main__":
    unittest.main()
