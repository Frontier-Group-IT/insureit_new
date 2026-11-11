"""Offline-only, secret-free safeguards for source-role name restoration."""
import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

from classify_pg_restore_error import (
    SOURCE_ROLE_NAMES, classify, main as classify_main, missing_role_context,
)


class SourceRoleDiagnosticsTests(unittest.TestCase):
    def test_fixed_source_catalog_covers_exact_expected_roles(self):
        sql = (
            Path(__file__).parent / "fixtures" / "isolated_source_role_names.sql"
        ).read_text(encoding="utf-8")
        self.assertEqual(len(SOURCE_ROLE_NAMES), 15)
        for name in SOURCE_ROLE_NAMES:
            self.assertIn("'" + name + "'", sql)
        self.assertIn("NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS", sql)
        self.assertIn("NEVER run against Supabase platform", sql)

    def test_known_managed_role_error_reports_only_flags(self):
        raw = (
            'pg_restore: while PROCESSING TOC:\n'
            'pg_restore: from TOC entry 919; 0 0 ACL TABLE auth SYNTHETIC_PRIVATE_NAME postgres\n'
            'pg_restore: error: could not execute query: ERROR: role "supabase_read_only_user" does not exist\n'
            'Command was: GRANT SELECT ON TABLE auth.SYNTHETIC_PRIVATE_NAME TO supabase_read_only_user;'
        )
        self.assertEqual(classify(raw), "role_missing")
        self.assertEqual(missing_role_context(raw), {
            "source_catalog_match": 1, "managed_family": 1,
        })
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "private-restore.log"
            file.write_text(raw)
            output = io.StringIO()
            with mock.patch.object(sys, "argv", ["classify", "data", str(file)]):
                with contextlib.redirect_stdout(output):
                    classify_main()
            report = output.getvalue()
            self.assertIn("source_catalog_match=1 managed_family=1", report)
            self.assertIn("toc_entry=919 kind=acl schema=auth", report)
            self.assertNotIn("supabase_read_only_user", report)
            self.assertNotIn("SYNTHETIC_PRIVATE_NAME", report)
            self.assertNotIn("GRANT SELECT", report)

    def test_unknown_role_is_classified_but_never_printed(self):
        raw = 'pg_restore: error: ERROR: role "private_business_team" does not exist'
        self.assertEqual(missing_role_context(raw), {
            "source_catalog_match": 0, "managed_family": 0,
        })
        self.assertNotIn("private_business_team", str(missing_role_context(raw)))

    def test_validated_role_context_only_on_postgres_error_line(self):
        self.assertIsNone(missing_role_context(
            'Command was: role "supabase_read_only_user" does not exist'
        ))
        self.assertIsNone(missing_role_context(
            'pg_restore: error: could not execute query: ERROR: invalid text representation'
        ))


if __name__ == "__main__":
    unittest.main()
