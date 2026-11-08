import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from summarize_pg_restore_errors import summarize


class OfflineDiagnosticSummaryTests(unittest.TestCase):
    def test_reports_categories_only(self):
        output = (
            'psql:/tmp/schema.sql:15: ERROR: function auth.secret_internal_fn() does not exist\n'
            'psql:/tmp/schema.sql:18: ERROR: type private.schema_secret does not exist\n'
            'psql:/tmp/schema.sql:20: ERROR: permission denied for table customer_private\n'
            'INSERT INTO public.customer_private VALUES (\'sensitive\');\n'
        )
        counts = summarize(output)
        self.assertEqual(counts["missing_function_or_type"], 2)
        self.assertEqual(counts["permission_denied"], 1)
        self.assertNotIn("secret_internal_fn", str(counts))
        self.assertNotIn("customer_private", str(counts))

    def test_untrusted_non_error_not_used(self):
        self.assertFalse(summarize("DROP TABLE private_customers;\nSELECT 1;"))

if __name__ == "__main__":
    unittest.main()
