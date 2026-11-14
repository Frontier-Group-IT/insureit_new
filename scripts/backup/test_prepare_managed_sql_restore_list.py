"""Synthetic-only managed SQL restore TOC guard tests; no network or database."""
from pathlib import Path
import tempfile
import unittest

from prepare_managed_sql_restore_list import (
    APP_SCHEMAS, build_list, chosen_entries, parse_entry,
)


def fixture():
    lines = ["; Synthetic v2 custom archive, no customer information\n",
             "10; 2615 1 SCHEMA - identity_maintenance postgres\n",
             "11; 2615 1 SCHEMA - insureit_recovery postgres\n",
             "12; 2615 1 SCHEMA - private postgres\n",
             "13; 1255 1 FUNCTION public rls_auto_enable() postgres\n",
             "14; 1255 1 FUNCTION public handle_new_user() postgres\n",
             "15; 2620 1 TRIGGER auth users on_auth_user_created postgres\n",
             "16; 3256 1 POLICY storage objects policy_access postgres\n",
             "17; 3256 1 POLICY storage buckets policy_bucket postgres\n",
             "18; 0 1 TABLE DATA storage objects supabase_storage_admin\n",
             "19; 0 1 TABLE DATA storage buckets supabase_storage_admin\n",
             "20; 2615 1 SCHEMA - supabase_migrations postgres\n",
             "21; 0 1 TABLE DATA supabase_migrations schema_migrations postgres\n",
             "22; 1259 1 TABLE identity_maintenance backup postgres\n",
             "23; 0 1 TABLE DATA identity_maintenance backup postgres\n",
             "24; 1259 1 TABLE insureit_recovery backup postgres\n",
             "25; 0 1 TABLE DATA insureit_recovery backup postgres\n",
             "26; 1259 1 TABLE public synthetic_150 postgres\n"]
    lines += [
        f"{1000+i}; 1259 1 TABLE public synthetic_{i} postgres\n"
        for i in range(150)
    ]
    lines += [
        f"{2000+i}; 0 1 TABLE DATA public synthetic_{i} postgres\n"
        for i in range(151)
    ]
    lines += [
        f"{3000+i}; 0 1 TABLE DATA auth table_{i} supabase_auth_admin\n"
        for i in range(22)
    ]
    lines += [
        "4000; 0 1 SEQUENCE OWNED BY public public_id_seq postgres\n",
        "4001; 0 1 SEQUENCE SET public public_id_seq postgres\n",
        "4002; 0 1 FK CONSTRAINT public synthetic_1 synthetic_fk postgres\n",
        "4003; 0 1 INDEX ATTACH public idx_syn postgres\n",
        "4004; 0 1 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres\n",
        "4005; 0 1 EVENT TRIGGER - untrusted_event postgres\n",
    ]
    return "".join(lines)


class PlanTests(unittest.TestCase):
    def test_select_only_safe_allowlisted_sql(self):
        entries, counts = chosen_entries(fixture())
        text = "".join(entries)
        self.assertEqual(counts[("public", "TABLE")], 151)
        self.assertEqual(counts[("public", "TABLE DATA")], 151)
        self.assertEqual(counts[("auth", "TABLE DATA")], 22)
        self.assertEqual(counts[("auth", "TRIGGER")], 0)
        self.assertEqual(counts[("storage", "POLICY")], 0)
        self.assertIn("SCHEMA - identity_maintenance", text)
        self.assertIn("SEQUENCE OWNED BY public", text)
        self.assertIn("INDEX ATTACH public", text)
        self.assertNotIn("TRIGGER auth users", text)
        self.assertNotIn("POLICY storage", text)
        self.assertNotIn("TABLE DATA storage objects", text)
        self.assertNotIn("TABLE DATA storage buckets", text)
        self.assertNotIn("SCHEMA - supabase_migrations", text)
        self.assertNotIn("rls_auto_enable()", text)
        self.assertNotIn("DEFAULT ACL", text)
        self.assertNotIn("EVENT TRIGGER", text)

    def test_fails_when_app_data_destination_not_defined(self):
        content = fixture().replace(
            "26; 1259 1 TABLE public synthetic_150 postgres\n", ""
        )
        with self.assertRaises(ValueError):
            chosen_entries(content)

    def test_fails_on_missing_auth(self):
        with self.assertRaises(ValueError):
            chosen_entries(fixture().replace(
                "3000; 0 1 TABLE DATA auth table_0 supabase_auth_admin\n", ""
            ).replace(
                "3001; 0 1 TABLE DATA auth table_1 supabase_auth_admin\n", ""
            ).replace(
                "3002; 0 1 TABLE DATA auth table_2 supabase_auth_admin\n", ""
            ))

    def test_owner_only_managed_policy_is_not_imported(self):
        selected, counts = chosen_entries(fixture())
        self.assertEqual(counts[("storage", "POLICY")], 0)
        self.assertEqual(counts[("auth", "TRIGGER")], 0)
        self.assertFalse(any("POLICY storage" in line for line in selected))
        self.assertFalse(any("TRIGGER auth" in line for line in selected))

    def test_fails_on_unrecognized_archive_entry(self):
        with self.assertRaises(ValueError):
            chosen_entries(fixture()+"5000; 1 1 SURPRISE public x postgres\n")

    def test_fails_on_unknown_schema(self):
        with self.assertRaises(ValueError):
            chosen_entries(fixture()+"5000; 1 1 TABLE other_project x postgres\n")

    def test_private_list_file_permissions_and_no_object_log(self):
        with tempfile.TemporaryDirectory() as folder:
            in_path = Path(folder) / "archive.private.txt"
            out_path = Path(folder) / "approved.restore.txt"
            in_path.write_text(fixture(), encoding="utf-8")
            build_list(in_path, out_path)
            self.assertTrue(out_path.is_file())
            self.assertEqual(out_path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(ValueError):
                build_list(in_path, out_path)

    def test_known_app_schemas(self):
        self.assertIn("public", APP_SCHEMAS)
        self.assertIn("identity_maintenance", APP_SCHEMAS)


if __name__ == "__main__":
    unittest.main()
