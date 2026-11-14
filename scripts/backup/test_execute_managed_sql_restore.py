"""Synthetic only: target-locked R4 SQL apply semantics without DB/network."""
from pathlib import Path
import os
import tempfile
import unittest
from unittest.mock import patch, Mock

from execute_managed_sql_restore import run_restore, validate_target
from managed_recovery_preflight import TARGET_REF, SOURCE_REF


def fake_target(**kwargs):
    state = dict(
        tables={("auth", "users"), ("storage", "objects")},
        auth_users=0, identities=0, buckets=0, objects=0,
        managed_policies={}, managed_triggers={},
    )
    state.update(kwargs)
    return state


class TargetRestoreSafety(unittest.TestCase):
    def setUp(self):
        self.url = f"postgresql://postgres:top-secret-synthetic@db.{TARGET_REF}.supabase.co/postgres?sslmode=verify-full"

    def test_production_destination_fails_before_catalog(self):
        with patch("execute_managed_sql_restore.query_target",
                   side_effect=AssertionError("wrong destination reached")):
            with self.assertRaises(ValueError):
                validate_target(f"postgresql://postgres:x@db.{SOURCE_REF}.supabase.co/postgres")

    def test_nonempty_target_fails_before_restore(self):
        with patch("execute_managed_sql_restore.query_target",
                   return_value=fake_target(auth_users=5)):
            with self.assertRaises(RuntimeError):
                validate_target(self.url)

    def test_existing_custom_policy_refuses_reimport(self):
        with patch("execute_managed_sql_restore.query_target",
                   return_value=fake_target(managed_policies={"storage": 35})):
            with self.assertRaises(RuntimeError):
                validate_target(self.url)

    def temp_archive(self, folder):
        (Path(folder) / "database.dump").write_bytes(b"PGDMP" + b"0" * 1200)
        (Path(folder) / "approved-restore-list.txt").write_text(
            "123; 1259 1 TABLE public synthetic postgres\n")

    def test_dry_run_never_replays(self):
        with tempfile.TemporaryDirectory() as folder:
            self.temp_archive(folder)
            with patch("execute_managed_sql_restore.query_target",
                       return_value=fake_target()):
                with patch("execute_managed_sql_restore.subprocess.run",
                           side_effect=AssertionError("execute called")):
                    run_restore(folder, self.url, dry_run=True)

    def test_apply_requires_project_ack_and_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            self.temp_archive(folder)
            with patch("execute_managed_sql_restore.query_target",
                       return_value=fake_target()):
                with patch.dict(os.environ, {}, clear=True):
                    with self.assertRaises(RuntimeError):
                        run_restore(folder, self.url)

    def test_apply_only_uses_target_env_and_atomic_pg_restore(self):
        with tempfile.TemporaryDirectory() as folder:
            self.temp_archive(folder)
            env = {
                "RECOVERY_APPROVED_TARGET_REF": TARGET_REF,
                "RECOVERY_OPERATOR_CONFIRMED": "ISOLATED_ONLY",
                "RECOVERY_EXPECTED_DB_SNAPSHOT": "20261114T023000Z",
            }
            with patch.dict(os.environ, env, clear=True), \
                 patch("execute_managed_sql_restore.query_target",
                       return_value=fake_target()), \
                 patch("execute_managed_sql_restore.ssl.get_default_verify_paths",
                       return_value=Mock(cafile="/etc/ssl/certs/ca-certificates.crt")), \
                 patch("execute_managed_sql_restore.Path.is_file", return_value=True), \
                 patch("execute_managed_sql_restore.subprocess.run",
                       return_value=Mock(returncode=0)) as exec_proc:
                run_restore(folder, self.url)
                args = exec_proc.call_args.args[0]
                kwargs = exec_proc.call_args.kwargs
                joined = " ".join(args)
                self.assertIn("postgres:17-bookworm", joined)
                self.assertIn("--single-transaction", joined)
                self.assertIn("--exit-on-error", joined)
                self.assertIn("--no-owner", joined)
                self.assertIn("--no-acl", joined)
                self.assertNotIn("--clean", joined)
                self.assertNotIn("top-secret-synthetic", joined)
                self.assertNotIn(SOURCE_REF, joined)
                self.assertEqual(kwargs["env"]["PGHOST"], f"db.{TARGET_REF}.supabase.co")
                self.assertEqual(kwargs["env"]["PGSSLMODE"], "verify-full")

    def test_restore_failure_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as folder:
            self.temp_archive(folder)
            env = {
                "RECOVERY_APPROVED_TARGET_REF": TARGET_REF,
                "RECOVERY_OPERATOR_CONFIRMED": "ISOLATED_ONLY",
                "RECOVERY_EXPECTED_DB_SNAPSHOT": "20261114T023000Z",
            }
            with patch.dict(os.environ, env, clear=True), \
                 patch("execute_managed_sql_restore.query_target",
                       return_value=fake_target()), \
                 patch("execute_managed_sql_restore.ssl.get_default_verify_paths",
                       return_value=Mock(cafile="/etc/ssl/certs/ca-certificates.crt")), \
                 patch("execute_managed_sql_restore.Path.is_file", return_value=True), \
                 patch("execute_managed_sql_restore.subprocess.run",
                       return_value=Mock(returncode=1)):
                with self.assertRaises(RuntimeError):
                    run_restore(folder, self.url)


if __name__ == "__main__":
    unittest.main()
