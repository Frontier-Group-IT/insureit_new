"""Synthetic, read-only tests for the full source-vs-R2 Storage manifest audit."""
import datetime as dt
import sys
import types
import json
import unittest
from unittest.mock import MagicMock, patch

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

    def test_inventory_uses_only_repeatable_read_postgres_sql(self):
        cursor = MagicMock()
        cursor.fetchall.return_value = [("docs",), ("empty",)]
        created = dt.datetime(2026, 11, 10, 18, 0, tzinfo=dt.timezone.utc)
        cursor.fetchmany.side_effect = [
            [("docs", "SECRET PRIVATE CUSTOMER.pdf", created, created, "12"),
             ("docs", "directory/.emptyFolderPlaceholder", created, created, "0")],
            [],
        ]
        db = MagicMock()
        db.cursor.return_value.__enter__.return_value = cursor
        db.__enter__.return_value = db
        with patch.object(audit, "checked_connection") as checked:
            with patch.object(audit, "db_connect", return_value=db) as connect:
                buckets, data = audit.source_inventory("source-secret-URL")
        checked.assert_called_once_with("source-secret-URL")
        connect.assert_called_once_with("source-secret-URL")
        self.assertEqual(buckets, ["docs", "empty"])
        self.assertEqual(len(data), 1)
        self.assertIn(identifier("SECRET PRIVATE CUSTOMER.pdf"), data)
        self.assertEqual(data[identifier("SECRET PRIVATE CUSTOMER.pdf")]["size"], 12)
        self.assertEqual(data[identifier("SECRET PRIVATE CUSTOMER.pdf")]["created_at"],
                         created.isoformat())
        sql = [args[0][0] for args in cursor.execute.call_args_list]
        self.assertTrue(sql[0].startswith("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        self.assertTrue(sql[1].startswith("SET LOCAL statement_timeout"))
        self.assertTrue(sql[2].startswith("SELECT id FROM storage.buckets"))
        self.assertIn("FROM storage.objects", sql[3])
        self.assertIn("archived_at IS NULL", sql[3])
        self.assertIn("is_delete_marker", sql[3])
        self.assertFalse(any("INSERT " in stmt or "DELETE " in stmt or "UPDATE " in stmt
                             for stmt in sql))

    def test_rejects_duplicate_current_objects_and_invalid_source_data(self):
        cursor = MagicMock()
        cursor.fetchall.return_value = [("docs",)]
        created = dt.datetime(2026, 11, 10, 18, 0, tzinfo=dt.timezone.utc)
        record = ("docs", "private.pdf", created, created, "12")
        cursor.fetchmany.side_effect = [[record, record], []]
        db = MagicMock()
        db.cursor.return_value.__enter__.return_value = cursor
        db.__enter__.return_value = db
        with patch.object(audit, "checked_connection"):
            with patch.object(audit, "db_connect", return_value=db):
                with self.assertRaisesRegex(RuntimeError, "Duplicate current"):
                    audit.source_inventory("example-source")

    def test_connection_is_exact_source_and_does_not_pass_raw_uri_to_libpq(self):
        synthetic = ("db.ilzhsfqqjyppzzvfscmh.supabase.co", 5432,
                     "postgres", "postgres", "synthetic@123@123", "require")
        mock_connect = MagicMock()
        with patch.object(audit, "checked_connection", return_value=synthetic):
            with patch.dict(sys.modules, {"psycopg": types.SimpleNamespace(connect=mock_connect)}):
                audit.db_connect("synthetic-url-with-raw-@-password")
        kwargs = mock_connect.call_args.kwargs
        self.assertEqual(kwargs["host"], synthetic[0])
        self.assertEqual(kwargs["password"], synthetic[4])
        self.assertEqual(kwargs["sslmode"], "require")
        self.assertNotIn("synthetic-url-with-raw-@-password", str(kwargs))
        self.assertNotIn("options", kwargs)
        self.assertEqual(kwargs["connect_timeout"], 20)

    def test_postgres_and_api_timestamp_encodings_compare_equal(self):
        records = {identifier("p1.pdf"): source(
            created="2026-11-10T18:00:00+00:00",
            updated="2026-11-10T18:00:00+00:00")}
        result = audit.compare(["docs","empty"], records,
                               ["docs","empty"], records, manifest("p1.pdf"))
        self.assertEqual(result["stable_prior_manifest_metadata_mismatches"], 0)
        self.assertEqual(result["status"], "PASS_HISTORIC_MANIFEST_COVERAGE")

    def test_read_only_source_size_parser_rejects_invalid_values(self):
        self.assertEqual(audit.size_int("12"), 12)
        self.assertIsNone(audit.size_int(None))
        for item in ("not-an-integer", -1, True):
            with self.assertRaises(ValueError):
                audit.size_int(item)

    def test_iso_parse_rejects_timezone_naive_values(self):
        self.assertIsNone(audit.iso_time("2026-11-11T12:30:00"))
        self.assertIsNone(audit.iso_time("not-a-date"))
        self.assertIsNotNone(audit.iso_time("2026-11-11T12:30:00Z"))


if __name__ == "__main__":
    unittest.main()
