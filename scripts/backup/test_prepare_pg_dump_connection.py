"""Secret-free regression checks for libpq connection in manual v2 backup."""
import contextlib
import io
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest import mock

from prepare_pg_dump_connection import (
    PROJECT_REF, checked_connection, escape_pgpass, main, write_connection_files,
)

POOLER = "aws-1-ap-northeast-2.pooler.supabase.com"


def conn(password="example@one@two", host=POOLER, username=None, query=""):
    username = username or f"postgres.{PROJECT_REF}"
    return f"postgresql://{username}:{password}@{host}:5432/postgres{query}"


class SafePgDumpConnectionTests(unittest.TestCase):
    def test_unescaped_at_in_password_does_not_pollute_dns_hostname(self):
        # This reproduces the failure class without production credentials.
        host, port, db, username, password, tls = checked_connection(
            conn("synthetic@008@008"))
        self.assertEqual(host, POOLER)
        self.assertNotIn("@", host)
        self.assertEqual(password, "synthetic@008@008")
        self.assertEqual((port, db, tls), (5432, "postgres", "require"))
        self.assertEqual(username, f"postgres.{PROJECT_REF}")

    def test_percent_encoded_at_colon_backslash_are_decoded_only_once(self):
        parsed = checked_connection(conn("synthetic%40a%3Ab%5Cc", query="?sslmode=require"))
        self.assertEqual(parsed[4], "synthetic@a:b\\c")
        self.assertEqual(parsed[5], "require")

    def test_private_pgpass_and_nonsecret_libpq_environment(self):
        pwd = "synthetic@008@008%3Aword%5Ctail"
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "private-connection"
            write_connection_files(conn(pwd), target)
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE((target / ".pgpass").stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE((target / "libpq.env").stat().st_mode), 0o600)
            raw_pass = (target / ".pgpass").read_text(encoding="utf-8")
            env = (target / "libpq.env").read_text(encoding="utf-8")
            self.assertIn("synthetic@008@008\\:word\\\\tail", raw_pass)
            self.assertIn("PGHOST=" + POOLER, env)
            self.assertIn("PGUSER=postgres." + PROJECT_REF, env)
            self.assertIn("PGSSLMODE=require", env)
            self.assertNotIn("PASSWORD", env)
            self.assertNotIn("synthetic", env)
            self.assertNotIn("DATABASE_URL", env)

    def test_rejects_wrong_database_and_untrusted_host(self):
        with self.assertRaises(ValueError):
            checked_connection(conn(host="attacker.example"))
        with self.assertRaises(ValueError):
            checked_connection(conn(host=POOLER + ".evil.example"))
        with self.assertRaises(ValueError):
            checked_connection(conn().replace("/postgres", "/other"))
        with self.assertRaises(ValueError):
            checked_connection(conn(username="postgres.invalid-ref"))
        with self.assertRaises(ValueError):
            checked_connection("postgresql://postgres:secret@db.other.supabase.co:5432/postgres")

    def test_direct_host_and_port(self):
        direct = f"postgresql://postgres:synthetic@{('db.' + PROJECT_REF + '.supabase.co')}:5432/postgres"
        self.assertEqual(checked_connection(direct)[0], "db." + PROJECT_REF + ".supabase.co")

    def test_rejects_unsafe_options_and_embedded_newline(self):
        for url in (
            conn(query="?sslmode=disable"),
            conn(query="?application_name=unknown"),
            conn(query="?sslmode=require&sslmode=disable"),
            conn("synth\npassword"),
        ):
            with self.subTest(candidate=url.split("@")[-1]):
                with self.assertRaises(ValueError):
                    checked_connection(url)

    def test_escape_pgpass_colon_and_backslash(self):
        self.assertEqual(escape_pgpass("a:b\\c"), "a\\:b\\\\c")

    def test_does_not_log_credentials_on_validation_failure(self):
        err = io.StringIO()
        secret = conn("TEST_SECRET_TOKEN", host="attacker.example")
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, {"DATABASE_URL": secret}):
                with mock.patch("sys.argv", ["prepare_pg_dump_connection.py", str(Path(tmp) / "protected")]):
                    with contextlib.redirect_stderr(err):
                        with self.assertRaises(SystemExit):
                            main()
        self.assertNotIn("TEST_SECRET_TOKEN", err.getvalue())
        self.assertIn("credentials withheld", err.getvalue())


if __name__ == "__main__":
    unittest.main()
