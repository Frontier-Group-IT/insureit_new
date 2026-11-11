"""Offline tests for custom PostgreSQL v2 TOC completeness checks."""
import tempfile
from pathlib import Path
from unittest import TestCase

from audit_postgres_v2_toc import inspect_toc


class V2TocAuditTests(TestCase):
    TOC = """
; Archive created at 2026-11-08 00:00:00
101; 1259 101 TABLE auth users postgres
102; 0 0 TABLE DATA auth users postgres
103; 1259 103 TABLE storage buckets postgres
104; 0 0 TABLE DATA storage buckets postgres
105; 1259 105 TABLE storage objects postgres
106; 0 0 TABLE DATA storage objects postgres
107; 1259 107 TABLE supabase_migrations schema_migrations postgres
108; 0 0 TABLE DATA supabase_migrations schema_migrations postgres
109; 1259 109 TABLE public motor_policies postgres
110; 0 0 TABLE DATA public motor_policies postgres
111; 3256 120 POLICY public motor_policies postgres
112; 0 0 SEQUENCE SET public motor_policies_id_seq postgres
"""

    def run_check(self, content):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "private-toc"
            path.write_text(content, encoding="utf-8")
            return inspect_toc(path)

    def test_required_managed_and_business_coverage(self):
        data = self.run_check(self.TOC)
        self.assertEqual(data["copy_data_targets"], 5)
        self.assertEqual(data["table_definitions"], 5)
        self.assertEqual(data["policies"], 1)

    def test_missing_auth_data_blocks(self):
        with self.assertRaises(ValueError):
            self.run_check(self.TOC.replace("TABLE DATA auth users postgres", "COMMENT auth users postgres"))

    def test_missing_public_table_blocks(self):
        with self.assertRaises(ValueError):
            self.run_check(self.TOC.replace("TABLE public motor_policies postgres", "COMMENT public motor_policies postgres"))

    def test_does_not_include_private_identifiers_in_report(self):
        result = self.run_check(self.TOC)
        self.assertNotIn("motor_policies", str(result))
        self.assertNotIn("auth.users", str(result))
