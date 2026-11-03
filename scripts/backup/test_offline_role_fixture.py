from pathlib import Path
import unittest


class OfflineRoleFixtureTests(unittest.TestCase):
    def setUp(self):
        self.sql = (Path(__file__).parent / "fixtures" /
                    "isolated_supabase_roles.sql").read_text()

    def test_is_explicit_nonprivileged_role_allowlist(self):
        for role in ("anon", "authenticated", "authenticator", "service_role",
                     "supabase_admin", "supabase_auth_admin", "supabase_storage_admin"):
            self.assertIn("'" + role + "'", self.sql)
        self.assertIn("NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS", self.sql)
        self.assertNotIn("PASSWORD '", self.sql.upper())
        self.assertNotIn("CREATE EXTENSION", self.sql.upper())

    def test_idempotent_and_offline_only(self):
        self.assertIn("IF NOT EXISTS", self.sql)
        self.assertIn("NEVER apply to the managed INSUREIT database", self.sql)
        self.assertNotIn("GRANT ALL", self.sql.upper())


if __name__ == "__main__":
    unittest.main()
