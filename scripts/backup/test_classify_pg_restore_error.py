import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from classify_pg_restore_error import classify, dependency_details


class RestoreDiagnosticsTests(unittest.TestCase):
    def test_missing_supabase_role_does_not_leak_name(self):
        msg = 'psql:/tmp/roles.sql:17: ERROR: role "secret_role_name" does not exist'
        self.assertEqual(classify(msg), "role_missing")
        self.assertNotIn("secret_role_name", classify(msg))

    def test_unknown_sql_does_not_leak_details(self):
        self.assertEqual(classify("psql:/tmp/data.sql:12: ERROR: private customer value abc"), "unknown_sql_failure")

    def test_missing_extension_and_permissions(self):
        self.assertEqual(classify('psql: ERROR: extension "example" is not available'), "extension_missing")
        self.assertEqual(classify("psql: ERROR: permission denied for relation private"), "permission_denied")

    def test_fixture_ambiguity_and_role_privileges_redact_object_names(self):
        self.assertEqual(classify('psql:/tmp/a.sql:19: ERROR: column reference "secret_name" is ambiguous'), "ambiguous_column")
        self.assertEqual(classify('psql: ERROR: permission denied to create role "admin_secret"'), "role_creation_denied")
        self.assertNotIn("secret_name", classify('psql: ERROR: column reference "secret_name" is ambiguous'))

    def test_missing_function_metadata_redacts_name(self):
        msg = 'psql:/tmp/schema.sql:424: ERROR: function auth.internal_private_name(integer) does not exist'
        detail = dependency_details(msg)
        self.assertEqual(detail, {"kind": "function", "schema": "auth", "sql_line": 424})
        self.assertNotIn("internal_private_name", str(detail))

    def test_missing_type_metadata_does_not_infer_unqualified_schema(self):
        msg = 'psql:/tmp/schema.sql:7: ERROR: type private_business_data does not exist'
        self.assertEqual(dependency_details(msg), {
            "kind": "type", "schema": "unqualified_or_other", "sql_line": 7,
        })

    def test_unknown_schema_not_exposed(self):
        msg = 'psql:/tmp/schema.sql:99: ERROR: function customer_secret.hidden_fn() does not exist'
        detail = dependency_details(msg)
        self.assertEqual(detail["schema"], "unqualified_or_other")
        self.assertNotIn("customer_secret", str(detail))
        self.assertNotIn("hidden_fn", str(detail))

    def test_non_error_line_not_classified(self):
        self.assertIsNone(dependency_details('function auth.uid() does not exist'))

    def test_ignores_non_error_content(self):
        self.assertEqual(classify("INSERT INTO customers VALUES ('private');"), "unknown_sql_failure")


if __name__ == "__main__":
    unittest.main()
