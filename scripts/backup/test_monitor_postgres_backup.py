import datetime as dt
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import monitor_postgres_backup as pg

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 8, 5, 0, tzinfo=UTC)


def run(date, conclusion="success", branch="main"):
    return {"head_branch":branch,"created_at":date,
            "conclusion":conclusion,"status":"completed","html_url":"https://github.com/example/run/5"}


class PostgresBackupMonitorTests(unittest.TestCase):
    def test_initial_manual_backup_is_now_stale(self):
        self.assertEqual(pg.status_from_runs([run("2026-11-03T06:12:39Z")],NOW)[0],"stale")

    def test_fresh_and_wrong_branch(self):
        runs=[run("2026-11-08T02:00:00Z"),run("2026-11-08T04:00:00Z",branch="other")]
        self.assertEqual(pg.status_from_runs(runs,NOW)[0],"fresh")

    def test_non_success_never_counts(self):
        self.assertEqual(pg.status_from_runs([run("2026-11-08T03:00:00Z","failure")],NOW)[0],
                         "no_successful_archive")

    def test_v2_archive_is_included_in_freshness_scan(self):
        import os
        # This tests pg.main(), which evaluates the actual current UTC time.
        # A fixed November 8 success becomes stale as the calendar advances.
        recent = (dt.datetime.now(UTC) - dt.timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
        paths = []
        def fake_api(method, path, token):
            paths.append(path)
            if "r2-v2-manual.yml" in path:
                return {"workflow_runs": [run(recent)]}
            return {"workflow_runs": [run("2026-11-03T06:12:39Z")]}
        with patch.dict(os.environ, {"GITHUB_REPOSITORY":"Frontier-Group-IT/insureit_new", "GH_TOKEN":"fake"}):
            with patch.object(pg, "api", side_effect=fake_api):
                with patch.object(pg, "reconcile") as reconcile:
                    pg.main()
                    self.assertEqual(len(paths), 2)
                    self.assertTrue(any("r2-v2-manual.yml" in p for p in paths))
                    self.assertEqual(reconcile.call_args.args[2], "fresh")

    def test_open_issue_once_and_close_on_recovery(self):
        with patch.object(pg,"find_issue",return_value=None):
            with patch.object(pg,"api",return_value={"number":123}) as spy:
                pg.reconcile("Frontier-Group-IT/insureit_new","fake","stale",run("2026-11-03T06:12:39Z"))
                self.assertEqual(spy.call_args.args[0],"POST")
        with patch.object(pg,"find_issue",return_value={"number":123,"body":"old"}):
            with patch.object(pg,"api",return_value={}) as spy:
                pg.reconcile("Frontier-Group-IT/insureit_new","fake","fresh",run("2026-11-08T03:00:00Z"))
                self.assertEqual(spy.call_args.args[0],"PATCH")
                self.assertEqual(spy.call_args.args[3]["state"],"closed")


if __name__ == "__main__":
    unittest.main()
