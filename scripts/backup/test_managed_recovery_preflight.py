"""Secret-free managed recovery R0/R1 guard regression tests."""
from pathlib import Path
import contextlib
import io
import os
import tempfile
import unittest
from unittest.mock import patch

from managed_recovery_preflight import (
    SOURCE_REF, TARGET_REF, checked_target_connection,
    compare_archive, toc_inventory, classify_connection_error, main,
    isolated_ssl_root_cert,
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
        "107; 0 5 TABLE DATA supabase_migrations schema_migrations postgres\n"
        "108; 1255 5 FUNCTION public sample_fn() postgres\n"
        "109; 2620 5 TRIGGER auth users postgres\n"
        "110; 3256 5 POLICY storage objects postgres\n"
        "111; 1259 5 INDEX public policy_idx postgres\n"
        "112; 2606 5 FK CONSTRAINT public orders synthetic_fk postgres\n"
        "113; 826 5 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres\n",
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


class SafeTargetConnectionDiagnostics(unittest.TestCase):
    def test_error_classes_are_fixed_and_never_contain_raw_secrets(self):
        cases = [
            ("SSL error: certificate verify failed: unable to get local issuer certificate", "TLS_CA_UNTRUSTED"),
            ("SSL error: hostname mismatch", "TLS_HOSTNAME_MISMATCH"),
            ("FATAL: password authentication failed for user postgres.example", "DATABASE_PASSWORD_REJECTED"),
            ("FATAL: Tenant or user not found", "POOLER_TENANT_OR_USER"),
            ("unsupported startup parameter options", "POOLER_STARTUP_OPTIONS"),
            ("could not translate host name", "HOST_DNS_RESOLUTION"),
            ("connection timed out", "NETWORK_TIMEOUT"),
            ("Network is unreachable", "NETWORK_UNREACHABLE"),
            ("server closed the connection unexpectedly", "SERVER_CLOSED_CONNECTION"),
            ("SSL error: connection interrupted", "TLS_OTHER"),
            ("password=hidden-should-never-log", "CONNECTION_OTHER"),
        ]
        for error, expected in cases:
            with self.subTest(expected=expected):
                result = classify_connection_error(RuntimeError(error))
                self.assertEqual(result, expected)
                self.assertNotIn("hidden-should-never-log", result)
                self.assertNotIn("postgres.example", result)

    def test_probe_is_target_only_read_only_and_prints_no_credentials(self):
        target = dict(
            tables={("auth", "users"), ("storage", "objects")},
            auth_users=0, identities=0, buckets=0, objects=0,
        )
        url = (f"postgresql://postgres.{TARGET_REF}:secret%40encoded@"
               "aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres")
        output = io.StringIO()
        with patch.dict(os.environ, {"INSUREIT_RECOVERY_DATABASE_URL": url}), \
             patch("managed_recovery_preflight.query_target", return_value=target) as query, \
             contextlib.redirect_stdout(output):
            main(["preflight.py", "--probe-target"])
        self.assertEqual(query.call_count, 1)
        self.assertIn("empty_target=1", output.getvalue())
        self.assertNotIn("secret", output.getvalue())

    def test_probe_rejects_nonempty_target(self):
        target = dict(
            tables={("public", "customers")},
            auth_users=0, identities=0, buckets=0, objects=0,
        )
        url = f"postgresql://postgres:synthetic@db.{TARGET_REF}.supabase.co/postgres"
        with patch.dict(os.environ, {"INSUREIT_RECOVERY_DATABASE_URL": url}), \
             patch("managed_recovery_preflight.query_target", return_value=target):
            with self.assertRaises(RuntimeError):
                main(["preflight.py", "--probe-target"])


class IsolatedTLSCertificate(unittest.TestCase):
    def test_missing_and_invalid_cert_fail_closed(self):
        for value in ("", "not a PEM certificate",
                      "-----BEGIN PRIVATE KEY-----\\nsecret\\n-----END PRIVATE KEY-----",
                      "-----BEGIN CERTIFICATE-----\\ninvalid\\n-----END CERTIFICATE-----"):
            with self.subTest(input_length=len(value)):
                with patch.dict(os.environ, {"RECOVERY_DB_SSL_ROOT_CERT_PEM": value}):
                    with self.assertRaises((ValueError, RuntimeError)):
                        with isolated_ssl_root_cert():
                            pass

    def test_valid_pem_stays_private_and_is_deleted(self):
        # Mock OpenSSL parse only: synthetic placeholder is never trusted by
        # libpq. Real GitHub secret must contain a valid isolated-project CA.
        pem = ("-----BEGIN CERTIFICATE-----\\n"
               "synthetic-not-a-real-certificate\\n"
               "-----END CERTIFICATE-----\\n")
        with patch.dict(os.environ, {"RECOVERY_DB_SSL_ROOT_CERT_PEM": pem}):
            with patch("managed_recovery_preflight.ssl.SSLContext") as cert_context:
                with isolated_ssl_root_cert() as ca_path:
                    path = Path(ca_path)
                    self.assertTrue(path.exists())
                    self.assertEqual(path.read_text(), pem)
                    self.assertEqual(path.stat().st_mode & 0o777, 0o600)
                self.assertFalse(path.exists())
                cert_context.return_value.load_verify_locations.assert_called_once_with(
                    cadata=pem
                )

    def test_open_ssl_rejection_aborts_without_fallback(self):
        import ssl
        pem = ("-----BEGIN CERTIFICATE-----\\n"
               "bad-synthetic\\n-----END CERTIFICATE-----\\n")
        with patch.dict(os.environ, {"RECOVERY_DB_SSL_ROOT_CERT_PEM": pem}):
            with patch("managed_recovery_preflight.ssl.SSLContext") as ctx:
                ctx.return_value.load_verify_locations.side_effect = ssl.SSLError(
                    "certificate verify failed"
                )
                with self.assertRaises(ValueError):
                    with isolated_ssl_root_cert():
                        pass


class TocReview(unittest.TestCase):
    def test_authenticated_archive_markers_required(self):
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            counts, tables, data = toc_inventory(path)
            self.assertEqual(counts[("TABLE DATA", "managed")], 4)
            self.assertEqual(counts[("TABLE", "application")], 1)
            self.assertEqual(len(data), 5)
            self.assertIn(("auth", "users"), data)
            self.assertEqual(counts[("FUNCTION", "application")], 1)
            self.assertEqual(counts[("TRIGGER", "managed")], 1)
            self.assertEqual(counts[("POLICY", "managed")], 1)
            self.assertEqual(counts[("INDEX", "application")], 1)
            self.assertEqual(counts[("FK CONSTRAINT", "application")], 1)
            self.assertEqual(counts[("DEFAULT ACL", "application")], 1)


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

    def test_empty_target_reports_managed_security_counts_safely(self):
        import contextlib
        import io
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            target = dict(tables={("auth", "users"), ("storage", "objects")},
                          extensions={"pgcrypto": "1.3"},
                          roles={"postgres", "anon"}, memberships=2,
                          auth_users=0, identities=0, buckets=0, objects=0,
                          security_definers=1, exposed_public_definers=1,
                          managed_policies={"storage": 0},
                          managed_triggers={"auth": 0})
            with patch("managed_recovery_preflight.query_target", return_value=target):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    compare_archive(
                        path,
                        f"postgresql://postgres:synthetic@db.{TARGET_REF}.supabase.co/postgres",
                    )
                report = output.getvalue()
                self.assertIn("target_storage_rls_policies=0", report)
                self.assertIn("target_auth_user_triggers=0", report)
                self.assertIn("no_import=1", report)
                self.assertNotIn("synthetic", report)
                self.assertNotIn("auth.users", report)

    def test_no_database_calls_for_toc(self):
        with tempfile.TemporaryDirectory() as d:
            path = make_toc(d)
            with patch("managed_recovery_preflight.query_target", side_effect=AssertionError("must not connect")):
                toc_inventory(path)


if __name__ == "__main__":
    unittest.main()
