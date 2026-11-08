from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock
import sys

sys.path.insert(0, str(Path(__file__).parent))
import verify_postgres_offline_row_counts as verify


class OfflineCopyRowsTests(unittest.TestCase):
    def test_counts_required_copy_rows_with_no_value_exposure(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / "data.sql"
            p.write_text(
                "COPY auth.users (id, email) FROM stdin;\n"
                "1\tprivate@example.invalid\n"
                "2\tprivate2@example.invalid\n"
                "\\.\n"
                "COPY storage.buckets (id) FROM stdin;\n"
                "bucket-a\n\\.\n"
                "COPY storage.objects (id) FROM stdin;\n"
                "3\n4\n5\n\\.\n"
                "COPY public.other (id) FROM stdin;\n"
                "irrelevant\n\\.\n")
            counts = verify.expected_copy_rows(p)
            self.assertEqual(counts[("auth", "users")], 2)
            self.assertEqual(counts[("storage", "buckets")], 1)
            self.assertEqual(counts[("storage", "objects")], 3)

    def test_quoted_identifiers_supported(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/"data.sql"
            p.write_text('COPY "auth"."users" (id) FROM stdin;\n123\n\\.\n')
            self.assertEqual(verify.expected_copy_rows(p)[("auth", "users")], 1)

    @patch.object(verify.subprocess, "run")
    def test_isolated_count_only_uses_fixed_container(self, run):
        run.return_value = Mock(returncode=0, stdout="7\n")
        self.assertEqual(verify.live_count("insureit-restore-check", "auth", "users"), 7)
        args=run.call_args.args[0]
        self.assertEqual(args[0:4], ["docker","exec","-u","postgres"])
        self.assertNotIn("DATABASE_URL", " ".join(args))

    def test_rejects_injected_identifier(self):
        with self.assertRaises(RuntimeError):
            verify.live_count("insureit-restore-check", 'auth";drop', "users")

if __name__ == "__main__":
    unittest.main()
