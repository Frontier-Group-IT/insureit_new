import datetime as dt
from pathlib import Path
import tempfile
import unittest
import sys
sys.path.insert(0, str(Path(__file__).parent))
import monitor_github_backup as mon
import audit_postgres_archive_coverage as audit

UTC = dt.timezone.utc
def when(day,hour,minute=0):
    return dt.datetime(2026,11,day,hour,minute,tzinfo=UTC)

class FreshnessAndCoverageTests(unittest.TestCase):
    def test_late_success_is_not_healthy(self):
        # 19:00 IST = 13:30 UTC; delayed schedule at 20:00 UTC.
        now=when(8,1)
        runs=[{"event":"schedule","head_branch":"main","created_at":"2026-11-07T20:00:00Z",
              "status":"completed","conclusion":"success"}]
        self.assertEqual(mon.scheduled_status(runs,now)[0], "late")
    def test_on_time_success_is_healthy(self):
        runs=[{"event":"schedule","head_branch":"main","created_at":"2026-11-07T13:50:00Z",
              "status":"completed","conclusion":"success"}]
        self.assertEqual(mon.scheduled_status(runs,when(7,18))[0], "success")
    def test_missing_stays_missing(self):
        self.assertEqual(mon.scheduled_status([],when(7,18))[0], "missing")
    def test_archive_markers(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp)
            (d/"roles.sql").write_text("CREATE ROLE dummy;")
            (d/"schema.sql").write_text("CREATE TABLE public.example (id bigint);")
            (d/"data.sql").write_text('COPY auth.users (id) FROM stdin;\n\\.\n'
                'COPY storage.buckets (id) FROM stdin;\n\\.\n'
                'COPY storage.objects (id) FROM stdin;\n\\.\n')
            self.assertTrue(audit.inspect(d/"roles.sql",d/"schema.sql",d/"data.sql")["coverage_gate"])
            (d/"data.sql").write_text("COPY public.example (id) FROM stdin;\n\\.\n")
            self.assertFalse(audit.inspect(d/"roles.sql",d/"schema.sql",d/"data.sql")["coverage_gate"])
    def test_quoted_archive_markers(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp)
            (d/"roles.sql").write_text("CREATE ROLE dummy;")
            (d/"schema.sql").write_text('CREATE TABLE "public"."example" (id bigint);')
            (d/"data.sql").write_text('COPY "auth"."users" (id) FROM stdin;\n\\.\n'
                'COPY "storage"."buckets" (id) FROM stdin;\n\\.\n'
                'COPY "storage"."objects" (id) FROM stdin;\n\\.\n')
            self.assertTrue(audit.inspect(d/"roles.sql",d/"schema.sql",d/"data.sql")["coverage_gate"])

if __name__ == "__main__":
    unittest.main()
