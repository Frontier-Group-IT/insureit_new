import tempfile
import json
from unittest import mock
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from audit_postgres_copy_targets import (
    copy_destinations, split_identifiers, verify_targets, isolated_catalog,
)


class OfflineCopyCompatibilityTests(unittest.TestCase):
    def read_sample(self, content):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "data.sql"
            path.write_text(content, encoding="utf-8")
            return copy_destinations(path)

    def test_skips_private_copy_rows_that_resemble_sql_commands(self):
        targets = self.read_sample(
            "COPY auth.users (id, email) FROM stdin;\n"
            "COPY fake.secret (private) FROM stdin;\n"
            "private@example.invalid\n"
            "\\.\n"
            'COPY "storage"."objects" ("id", "bucket_id") FROM stdin;\n'
            "\\.\n"
        )
        self.assertEqual(targets, [
            ("auth", "users", ("id", "email"), 1),
            ("storage", "objects", ("id", "bucket_id"), 5),
        ])

    def test_missing_table_and_missing_columns_are_fail_closed(self):
        targets = [
            ("auth", "oauth_clients", ("id",), 11),
            ("auth", "flow_state", ("id", "oauth_client_state_id"), 42),
            ("public", "other_table", ("id",), 49),
        ]
        catalog = {
            ("auth", "flow_state"): {"id"},
            ("public", "other_table"): {"id"},
        }
        self.assertEqual(verify_targets(targets, catalog), [
            ("missing_table", "auth", 11),
            ("missing_columns", "auth", 42),
        ])

    def test_private_schema_name_is_redacted(self):
        failures = verify_targets(
            [("customer_secret_internal", "private_user", ("email",), 7)], {},
        )
        self.assertEqual(failures, [("missing_table", "other", 7)])
        self.assertNotIn("customer_secret_internal", str(failures))

    def test_quoted_identifiers(self):
        self.assertEqual(split_identifiers('"auth"."weird""name"', "."), ["auth", 'weird"name'])
        self.assertEqual(split_identifiers('"id", "user name"', ","), ["id", "user name"])

    def test_isolated_catalog_reads_only_local_pg_catalog(self):
        result = mock.Mock(returncode=0, stdout=json.dumps([
            {"schema": "auth", "table": "users", "columns": ["id", "email"]},
            {"schema": "storage", "table": "objects", "columns": ["id", "bucket_id"]},
        ]), stderr="")
        with mock.patch("audit_postgres_copy_targets.subprocess.run", return_value=result) as run:
            catalog = isolated_catalog("insureit-restore-check")
            self.assertEqual(catalog[("auth", "users")], {"id", "email"})
            args = run.call_args.args[0]
            self.assertEqual(args[:6], ["docker", "exec", "-u", "postgres", "insureit-restore-check", "psql"])
            self.assertNotIn("--network", args)

    def test_rejects_any_other_container(self):
        with self.assertRaises(ValueError):
            isolated_catalog("production-postgres")

    def test_invalid_copy_is_rejected(self):
        with self.assertRaises(ValueError):
            self.read_sample("COPY auth.users FROM stdin;\n\\.\n")
        with self.assertRaises(ValueError):
            self.read_sample("COPY auth.users (id) FROM stdin;\nprivate\n")


if __name__ == "__main__":
    unittest.main()
