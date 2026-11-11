"""Synthetic, read-only tests for the full source-vs-R2 Storage manifest audit."""
import copy
import json
import unittest
from unittest.mock import patch

import audit_storage_source_manifest as audit

SNAPSHOT = "20261110T203147Z"
BEFORE = "2026-11-10T18:00:00Z"
AFTER = "2026-11-11T09:00:00Z"


def identifier(path):
    return json.dumps(["docs", path], separators=(",", ":"))


def source(created=BEFORE, updated=BEFORE, size=12):
    return {"created_at": created, "updated_at": updated, "size": size}


def manifest(*paths):
    return {
        "created_at": SNAPSHOT,
        "buckets": ["docs", "empty"],
        "entries": {identifier(path): {
            "blob": "supabase-storage/v1/blobs/hidden", "bytes": 12,
            "sha256": "0" * 64,
            "source": {"updated_at": BEFORE, "size": 12},
        } for path in paths},
    }


class ReadOnlyParityTests(unittest.TestCase):
    def test_same_source_identities_pass_across_empty_bucket(self):
        data = {identifier("p1.pdf"): source(), identifier("p2.pdf"): source()}
        status = audit.compare(["docs", "empty"], data,
                               ["docs", "empty"], data, manifest("p1.pdf", "p2.pdf"))
        self.assertEqual(status["status"], "PASS_HISTORIC_MANIFEST_COVERAGE")
        self.assertEqual(status["stable_prior_source_not_in_manifest"], 0)
        self.assertEqual(status["stable_in_manifest"], 2)
        self.assertEqual(status["bucket_parity"], 1)

    def test_new_live_files_after_old_snapshot_are_not_missing_backup(self):
        initial = {identifier("old.pdf"): source()}
        current = {**initial, identifier("new.pdf"): source(AFTER, AFTER)}
        status = audit.compare(["docs", "empty"], current,
                               ["docs", "empty"], current, manifest("old.pdf"))
        self.assertEqual(status["post_snapshot_source_additions"], 1)
        self.assertEqual(status["stable_prior_source_not_in_manifest"], 0)
        self.assertEqual(status["status"], "PASS_HISTORIC_MANIFEST_COVERAGE")

    def test_prior_stable_source_absent_from_archive_requires_review(self):
        old = {identifier("p1.pdf"): source(), identifier("SECRET_PRIVATE.pdf"): source()}
        status = audit.compare(["docs", "empty"], old,
                               ["docs", "empty"], old, manifest("p1.pdf"))
        self.assertEqual(status["stable_prior_source_not_in_manifest"], 1)
        self.assertEqual(status["status"], "REVIEW")
        self.assertNotIn("SECRET_PRIVATE", str(status))

    def test_stable_old_metadata_mismatch_requires_review(self):
        prior = {identifier("private.pdf"): source(size=15)}
        status = audit.compare(["docs", "empty"], prior,
                               ["docs", "empty"], prior, manifest("private.pdf"))
        self.assertEqual(status["stable_prior_manifest_metadata_mismatches"], 1)
        self.assertEqual(status["status"], "REVIEW")
        self.assertNotIn("private.pdf", str(status))

    def test_content_updated_after_snapshot_is_not_called_corrupt(self):
        updated = {identifier("p1.pdf"): source(BEFORE, AFTER, 19)}
        status = audit.compare(["docs", "empty"], updated,
                               ["docs", "empty"], updated, manifest("p1.pdf"))
        self.assertEqual(status["stable_prior_manifest_metadata_mismatches"], 0)

    def test_unstable_listing_and_unknown_timestamp_are_inconclusive(self):
        first = {identifier("p1.pdf"): source()}
        second = {identifier("p1.pdf"): source(updated=AFTER)}
        status = audit.compare(["docs","empty"], first,
                               ["docs","empty"], second, manifest("p1.pdf"))
        self.assertEqual(status["changed_between_scans"], 1)
        self.assertEqual(status["status"], "REVIEW")
        data = {identifier("p1.pdf"): source(created=None)}
        status = audit.compare(["docs","empty"], data,
                               ["docs","empty"], data, manifest("p1.pdf"))
        self.assertEqual(status["metadata_timestamp_unknown"], 1)
        self.assertEqual(status["status"], "REVIEW")

    def test_buckets_changed_between_passes_requires_review(self):
        data = {identifier("p1.pdf"): source()}
        status = audit.compare(["docs","empty"], data,
                               ["docs"], data, manifest("p1.pdf"))
        self.assertEqual(status["bucket_parity"], 0)
        self.assertEqual(status["status"], "REVIEW")

    def test_deleted_from_live_does_not_mean_corrupt_archive(self):
        current = {identifier("p1.pdf"): source()}
        status = audit.compare(["docs","empty"], current,
                               ["docs","empty"], current, manifest("p1.pdf","deleted.pdf"))
        self.assertEqual(status["manifest_not_currently_listed"], 1)
        self.assertEqual(status["stable_prior_source_not_in_manifest"], 0)

    def test_inventory_uses_listing_only_and_keeps_identifiers_private(self):
        rows = [("SECRET PRIVATE CUSTOMER.pdf", {
            "id":"synthetic", "created_at":BEFORE,"updated_at":BEFORE,
            "metadata":{"size":12}
        })]
        with patch.object(audit,"list_buckets",return_value=["docs"]):
            with patch.object(audit,"list_files",return_value=iter(rows)):
                buckets, data = audit.source_inventory("https://example.invalid","test")
        self.assertEqual(buckets, ["docs"])
        self.assertEqual(len(data),1)
        self.assertIn(identifier("SECRET PRIVATE CUSTOMER.pdf"), data)
        self.assertEqual(data[identifier("SECRET PRIVATE CUSTOMER.pdf")]["size"],12)

    def test_iso_parse_rejects_timezone_naive_values(self):
        self.assertIsNone(audit.iso_time("2026-11-11T12:30:00"))
        self.assertIsNone(audit.iso_time("not-a-date"))
        self.assertIsNotNone(audit.iso_time("2026-11-11T12:30:00Z"))


if __name__ == "__main__":
    unittest.main()
