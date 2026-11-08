import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from diagnose_pg_restore_data import diagnose


class DataImportErrorTests(unittest.TestCase):
    def test_copy_duplicate_key_first_error_without_sensitive_content(self):
        contents = (
            'psql:/tmp/data.sql:120: ERROR:  23505: duplicate key value violates unique constraint "secret_customer_idx"\n'
            'DETAIL: Key (email)=(private@example.com) already exists.\n'
            'psql:/tmp/data.sql:123: ERROR:  42601: syntax error at or near "secret_string"\n'
        )
        info = diagnose(contents)
        self.assertEqual(info, {"sqlstate": "23505", "category": "unique_violation", "line": 120})
        self.assertNotIn("secret_customer_idx", str(info))
        self.assertNotIn("private@example.com", str(info))

    def test_relation_missing_and_column_missing_codes(self):
        self.assertEqual(diagnose('psql:/tmp/data.sql:10: ERROR:  42P01: relation "secret" does not exist')["category"], "relation_missing")
        self.assertEqual(diagnose('psql:/tmp/data.sql:13: ERROR:  42703: column "private" does not exist')["category"], "column_missing")

    def test_unmapped_code_redacted(self):
        d = diagnose('psql:/tmp/data.sql:7: ERROR:  P0001: secret personal data')
        self.assertEqual(d, {"sqlstate": "P0001", "category": "unclassified_sqlstate", "line": 7})

    def test_non_error_and_unformatted_error(self):
        self.assertEqual(diagnose("COPY auth.users FROM stdin;")["category"], "no_postgres_error_detected")
        self.assertEqual(diagnose('psql:/tmp/data.sql:50: ERROR: private')["sqlstate"], "unavailable")


if __name__ == "__main__":
    unittest.main()
