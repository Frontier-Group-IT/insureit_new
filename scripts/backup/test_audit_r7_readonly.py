"""Secret-free synthetic contract tests: cannot access either Supabase project."""
import contextlib
import io
import tempfile
import unittest
from unittest.mock import patch

from audit_r7_readonly import (
    SQL_SNAPSHOT, STORAGE_SNAPSHOT, main, snapshot_lock, verify, read_catalog,
)


def sample_states():
    digest = 'a' * 64
    source = dict(public_tables=184, has_recent_queue=1, auth_users=87,
                  auth_identities=91, storage_buckets=9, storage_public=2,
                  storage_policies=35, public_policies=252, auth_user_triggers=1,
                  realtime_publications=5, public_security_definers=392,
                  migrations=568, storage_objects=4002,
                  schema_digest_without_queue=digest)
    target = dict(public_tables=183, has_recent_queue=0, auth_users=87,
                  auth_identities=91, storage_buckets=8, storage_public=0,
                  storage_objects=304, storage_policies=0, public_policies=252,
                  auth_user_triggers=0, realtime_publications=0,
                  public_security_definers=392, sample_size_rows=304,
                  sample_bytes=499999884, unowned_objects=304,
                  target_exposed_tables=0, target_write_tables=0, public_rls_tables=183,
                  schema_digest_without_queue=digest, migrations=2)
    return source, target


class GuardTests(unittest.TestCase):
    def test_historical_marker_lock(self):
        valid = {'R7_EXPECTED_SQL_SNAPSHOT': SQL_SNAPSHOT,
                 'R7_EXPECTED_STORAGE_SNAPSHOT': STORAGE_SNAPSHOT}
        snapshot_lock(valid)
        for key in valid:
            with self.subTest(key=key):
                bad = dict(valid)
                bad[key] = '20261118T000000Z'
                with self.assertRaises(ValueError):
                    snapshot_lock(bad)

    def test_expected_drift_allowed_other_drifts_rejected(self):
        source, target = sample_states()
        self.assertTrue(verify(source, target))
        for changed in (dict(source, storage_policies=34),
                        dict(source, public_tables=185),
                        dict(source, schema_digest_without_queue='b'*64)):
            with self.assertRaises(RuntimeError):
                verify(changed, target)
        for changed in (dict(target, storage_public=1),
                        dict(target, target_exposed_tables=1),
                        dict(target, target_write_tables=1),
                        dict(target, sample_bytes=499999883),
                        dict(target, auth_user_triggers=1),
                        dict(target, storage_objects=303)):
            with self.assertRaises(RuntimeError):
                verify(source, changed)

    def test_missing_credentials_and_production_url_are_rejected(self):
        with self.assertRaises((KeyError, ValueError)):
            read_catalog('--target', {'INSUREIT_RECOVERY_DATABASE_URL': 'postgresql://postgres:pass@db.ilzhsfqqjyppzzvfscmh.supabase.co/postgres'})
        with self.assertRaises((KeyError, ValueError)):
            read_catalog('--source', {'DATABASE_URL': 'postgresql://postgres:pass@db.unknown.supabase.co/postgres'})

    def test_safe_only_aggregate_in_github_output(self):
        source, target = sample_states()
        with tempfile.TemporaryDirectory() as folder:
            output = folder + '/outputs'
            env = {'R7_EXPECTED_SQL_SNAPSHOT': SQL_SNAPSHOT,
                   'R7_EXPECTED_STORAGE_SNAPSHOT': STORAGE_SNAPSHOT,
                   'GITHUB_OUTPUT': output}
            std = io.StringIO()
            with patch('audit_r7_readonly.read_catalog', return_value=source), contextlib.redirect_stdout(std):
                main(['audit', '--source'], env)
            with open(output, encoding='utf-8') as f:
                data = f.read()
            self.assertIn('summary=', data)
            self.assertNotIn('postgresql:', data)
            self.assertNotIn('customer', data)
            env['R7_SOURCE_SUMMARY'] = data.removeprefix('summary=').strip()
            with patch('audit_r7_readonly.read_catalog', return_value=target), contextlib.redirect_stdout(std):
                main(['audit', '--target'], env)
            self.assertIn('R7 READ-ONLY CATALOG PASS', std.getvalue())

    def test_query_contract_is_read_only(self):
        import inspect, audit_r7_readonly
        src = inspect.getsource(audit_r7_readonly)
        self.assertIn('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', src)
        self.assertIn('SET LOCAL statement_timeout', src)
        self.assertIn('ROLLBACK', src)
        self.assertNotIn('service_role', src)
        self.assertNotIn('EXECUTE ', src)


if __name__ == '__main__':
    unittest.main()
