"""Synthetic only: target-locked atomic SQL+security restore semantics."""
from pathlib import Path
import os
import tempfile
import unittest
from unittest.mock import patch, Mock

from execute_managed_sql_restore import (
    SECURITY_GUARD, run_restore, validate_target,
)
from managed_recovery_preflight import TARGET_REF, SOURCE_REF


def fake_target(**kwargs):
    base = dict(
        tables={("auth", "users"), ("storage", "objects")},
        auth_users=0, identities=0, buckets=0, objects=0,
        managed_policies={}, managed_triggers={},
    )
    base.update(kwargs)
    return base


class TargetRestoreSafety(unittest.TestCase):
    def setUp(self):
        self.url = f"postgresql://postgres:top-secret-synthetic@db.{TARGET_REF}.supabase.co/postgres?sslmode=verify-full"
        self.approval = dict(
            RECOVERY_APPROVED_TARGET_REF=TARGET_REF,
            RECOVERY_OPERATOR_CONFIRMED="ISOLATED_ONLY",
            RECOVERY_EXPECTED_DB_SNAPSHOT="20261114T023000Z",
        )

    def test_forbidden_source_rejected_before_catalog(self):
        with patch("execute_managed_sql_restore.query_target",
                   side_effect=AssertionError("must never query production")):
            with self.assertRaises(ValueError):
                validate_target(f"postgresql://postgres:x@db.{SOURCE_REF}.supabase.co/postgres")

    def test_dirty_or_policy_mutated_target_fails_closed(self):
        for state in (
            fake_target(auth_users=1),
            fake_target(tables={("public", "customer")}),
            fake_target(managed_policies={"storage": 35}),
            fake_target(managed_triggers={"auth": 1}),
        ):
            with patch("execute_managed_sql_restore.query_target", return_value=state):
                with self.assertRaises(RuntimeError):
                    validate_target(self.url)

    def private_archive(self, folder):
        (Path(folder) / "database.dump").write_bytes(b"PGDMP" + b"0" * 1200)
        (Path(folder) / "approved-restore-list.txt").write_text(
            "123; 1259 1 TABLE public synthetic postgres\n")

    def test_dry_run_does_not_execute(self):
        with tempfile.TemporaryDirectory() as folder:
            self.private_archive(folder)
            with patch("execute_managed_sql_restore.query_target", return_value=fake_target()), \
                 patch("execute_managed_sql_restore.subprocess.run",
                       side_effect=AssertionError("no docker allowed")):
                run_restore(folder, self.url, dry_run=True)

    def test_requires_target_ref_and_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            self.private_archive(folder)
            with patch("execute_managed_sql_restore.query_target", return_value=fake_target()), \
                 patch.dict(os.environ, {}, clear=True):
                with self.assertRaises(RuntimeError):
                    run_restore(folder, self.url)

    def mock_docker(self, folder, apply_return=0):
        calls = []
        def invoke(argv, **kwargs):
            calls.append((argv, kwargs))
            if "--network" in argv:
                idx = argv.index("--network")
                if argv[idx + 1] == "none":
                    (Path(folder) / "private-restore.sql").write_bytes(b"SELECT 1;\n" * 200)
                    return Mock(returncode=0)
            return Mock(returncode=apply_return)
        return calls, invoke

    def test_enforced_private_sql_then_atomic_psql_with_security_revocation(self):
        with tempfile.TemporaryDirectory() as folder:
            self.private_archive(folder)
            calls, invoke = self.mock_docker(folder)
            with patch.dict(os.environ, self.approval, clear=True), \
                 patch("execute_managed_sql_restore.query_target",
                       return_value=fake_target()), \
                 patch("execute_managed_sql_restore.subprocess.run",
                       side_effect=invoke):
                run_restore(folder, self.url)
            self.assertEqual(len(calls), 2)
            first = " ".join(calls[0][0])
            second = " ".join(calls[1][0])
            self.assertIn("--network none", first)
            self.assertIn("--no-owner", first)
            self.assertIn("--no-acl", first)
            self.assertIn("--network host", second)
            self.assertIn("--single-transaction", second)
            self.assertIn("ON_ERROR_STOP=1", second)
            self.assertIn("private-security-guard.sql", second)
            self.assertNotIn("--clean", first + second)
            self.assertNotIn("top-secret-synthetic", first + second)
            self.assertNotIn(SOURCE_REF, first + second)
            self.assertEqual(calls[1][1]["env"]["PGHOST"], f"db.{TARGET_REF}.supabase.co")
            self.assertEqual(calls[1][1]["env"]["PGSSLMODE"], "verify-full")
            self.assertTrue((Path(folder) / "private-security-guard.sql").is_file())
            self.assertIn("REVOKE EXECUTE ON ALL FUNCTIONS", SECURITY_GUARD)
            self.assertIn("definer_exposure <> 0", SECURITY_GUARD)

    def test_failed_atomic_restore_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            self.private_archive(folder)
            calls, invoke = self.mock_docker(folder, apply_return=1)
            with patch.dict(os.environ, self.approval, clear=True), \
                 patch("execute_managed_sql_restore.query_target",
                       return_value=fake_target()), \
                 patch("execute_managed_sql_restore.subprocess.run",
                       side_effect=invoke):
                with self.assertRaises(RuntimeError):
                    run_restore(folder, self.url)
            self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()
