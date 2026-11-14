"""Secret-free managed recovery R0/R1 guard regression tests."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from managed_recovery_preflight import (
    SOURCE_REF, TARGET_REF, checked_target_connection,
    compare_archive, toc_inventory,
)


def make_toc(directory):
    toc = Path(directory) / "private.txt"
    toc.write_text(
        "100; 1259 5 TABLE public clients postgres\n"
        "101; 1259 5 TABLE auth users supabase_auth_admin\n"
        "102; 1259 5 TABLE storage objects supabase_storage_admin\n"
        "103; 0 5 TABLE DATA public clients postgres\n"
        "104; 0 5 TABLE DATA auth users supabase_auth_admin\n"
        "105; 0 5 TABLE DATA storage buckets supabase_storage_admin\n"
        "106; 0 5 TABLE DATA storage objects supabase_storage_admin\n"
        "107; 0 5 TABLE DATA supabase_migrations schema_migrations postgres\n",
        encoding="utf-8"
    )
    return toc


class TargetGuard(unittest.TestCase):
    def test_exact_direct(self):
        url = f"postgresql://postgres:synthetic@db.{TARGET_REF}.supabase.co:5432/postgres?sslmode=verify-full"
        parts = checked_target_connection(url)
        self.assertEqual(parts["host"], f"db.{TARGET_REF}.supabase.co")
        self.assertEqual(parts["user"], "postgres")

    def test_exact_session_pooler(self):
        url = (f"postgresql://postgres.{TARGET_REF}:p%40ss@"
               "aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
        parts = checked_target_connection(url)
        self.assertEqual(parts["password"], "p@ss")

    def test_unescaped_at_password(self):
        url = (f"postgresql://postgres.{TARGET_REF}:p@ss@"
               "aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
        self.assertEqual(checked_target_connection(url)["password"], "p@ss")

    def test_production_and_unknown_urls_rejected(self):
        examples = [
            f"postgresql://postgres:pw@db.{SOURCE_REF}.supabase.co:5432/postgres",
            f"postgresql://postgres.{SOURCE_REF}:pw@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
            "postgresql://postgres:pw@evil.supabase.co:5432/postgres",
            f"postgresql://postgres.{TARGET_REF}:pw@evil.pooler.supabase.com.evil.tld:5432/postgres",
            f"postgresql://postgres.{TARGET_REF}:pw@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
            f"postgresql://postgres:pw@db.{TARGET_REF}.supabase.co:5432/wrong",
            f"postgresql://postgres:pw@db.{TARGET_REF}.supabase.co:5432/postgres?sslmode=disable",
            f"postgresql://postgres:pw@db.{TARGET_REF}.supabase.co:5432/postgres?options=-c%20session_replication_role%3Dreplica",
            f"postgresql://postgres:pw@db.{TARGET_REF}.supabase.co:5432/postgres#fragment",
            f"postgresql://postgres:pw@db.{TARGET_REF}.supabase.co:5432/postgres?sslmode=require&sslmode=disable",
        ]
        for url in examples:
            with self.subTest(url=url[:30]):
                with self.assertRaises((ValueError, TypeError)):
                    checked_target_connection(url)

    def test_missing_password_rejected(self):
        with self.assertRaises(ValueError):
            checked_target_connection(f"postgresql://postgres@db.{TARGET_REF}.supabase.co/postgres")


class TocReview(unittest.TestCase):
    def test_authenticated_archive_markers_required(self):
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            counts, tables, data = toc_inventory(path)
            self.assertEqual(counts[("TABLE DATA", "managed")], 4)
            self.assertEqual(counts[("TABLE", "application")], 1)
            self.assertEqual(len(data), 5)
            self.assertIn(("auth", "users"), data)

    def test_missing_critical_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            path.write_text(path.read_text().replace(
                "107; 0 5 TABLE DATA supabase_migrations schema_migrations postgres\n", ""
            ))
            with self.assertRaises(ValueError):
                toc_inventory(path)

    def test_not_empty_target_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            target = dict(tables=set(), extensions={}, roles=set(),
                          memberships=0, auth_users=1, identities=0,
                          buckets=0, objects=0, security_definers=0)
            with patch("managed_recovery_preflight.query_target", return_value=target):
                with self.assertRaises(RuntimeError):
                    compare_archive(path, f"postgresql://postgres:pw@db.{TARGET_REF}.supabase.co/postgres")

    def test_no_database_calls_for_toc(self):
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            with patch("managed_recovery_preflight.query_target", side_effect=AssertionError("must not connect")):
                toc_inventory(path)


if __name__ == "__main__":
    unittest.main()
