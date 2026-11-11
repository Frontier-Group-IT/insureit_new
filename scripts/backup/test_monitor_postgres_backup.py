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
                    self.assertEqual(len(paths), 1)
                    self.assertTrue(any("r2-v2-manual.yml" in p for p in paths))
                    self.assertEqual(reconcile.call_args.args[2], "fresh")

    def test_backup_cron_is_0315_ist_across_utc_midnight(self):
        self.assertEqual(pg.latest_target(dt.datetime(2026,11,12,1,0,tzinfo=UTC)),
                         dt.datetime(2026,11,11,21,45,tzinfo=UTC))
        self.assertEqual(pg.latest_target(dt.datetime(2026,11,11,20,0,tzinfo=UTC)),
                         dt.datetime(2026,11,10,21,45,tzinfo=UTC))

    def test_scheduled_success_cannot_be_replaced_by_recent_manual_backup(self):
        now = dt.datetime(2026,11,12,1,15,tzinfo=UTC)
        older = {**run("2026-11-10T21:48:00Z"), "event": "schedule"}
        newer_manual = {**run("2026-11-11T23:15:00Z"), "event":"workflow_dispatch"}
        self.assertEqual(pg.scheduled_status([older,newer_manual],now)[0],"missing_scheduled")

    def test_scheduled_success_and_failure(self):
        now = dt.datetime(2026,11,12,2,0,tzinfo=UTC)
        good = {**run("2026-11-11T21:50:00Z"), "event":"schedule"}
        bad = {**run("2026-11-11T21:50:00Z", "failure"), "event":"schedule"}
        self.assertEqual(pg.scheduled_status([good],now)[0],"fresh")
        self.assertEqual(pg.scheduled_status([bad],now)[0],"failed")
        late = {**run("2026-11-12T01:15:00Z"), "event":"schedule"}
        self.assertEqual(pg.scheduled_status([late],now)[0],"late")

    def test_scheduled_run_has_three_hour_grace_and_pending_state(self):
        now = dt.datetime(2026,11,11,22,15,tzinfo=UTC)
        old = {**run("2026-11-10T21:50:00Z"), "event":"schedule"}
        self.assertEqual(pg.scheduled_status([old],now)[0],"within_grace")
        running = {**run("2026-11-11T21:55:00Z"), "event":"schedule",
                   "status":"in_progress","conclusion":None}
        later = dt.datetime(2026,11,12,1,0,tzinfo=UTC)
        self.assertEqual(pg.scheduled_status([old,running],later)[0],"still_running")

    def test_first_run_rollout_keeps_previous_30_hour_freshness_gate(self):
        now = dt.datetime(2026,11,11,22,0,tzinfo=UTC)
        self.assertEqual(pg.scheduled_status([
            {**run("2026-11-11T08:00:00Z"), "event":"workflow_dispatch"}], now)[0],"fresh")
        self.assertEqual(pg.scheduled_status([],now)[0],"no_successful_archive")

    def test_scheduled_workflow_completion_alerts_immediately(self):
        import json, os, tempfile
        event = {
            "workflow_run": {
                **run("2026-11-11T21:50:00Z", conclusion="failure"),
                "name":pg.WORKFLOW_NAME,"event":"schedule"
            }
        }
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp)/"event.json"
            file.write_text(json.dumps(event),encoding="utf-8")
            with patch.dict(os.environ, {"GITHUB_REPOSITORY":"Frontier-Group-IT/insureit_new",
                                         "GH_TOKEN":"synthetic", "GITHUB_EVENT_NAME":"workflow_run",
                                         "GITHUB_EVENT_PATH":str(file)}):
                with patch.object(pg,"reconcile") as mocked:
                    pg.main()
                    self.assertEqual(mocked.call_args.args[2],"failed_scheduled_run")
                    mocked.reset_mock()
                    event["workflow_run"]["conclusion"] = "success"
                    file.write_text(json.dumps(event),encoding="utf-8")
                    pg.main()
                    self.assertEqual(mocked.call_args.args[2],"fresh")

    def test_manual_workflow_completion_does_not_close_scheduled_alert(self):
        import json, os, tempfile
        event = {
            "workflow_run": {
                **run("2026-11-11T21:50:00Z"),
                "name":pg.WORKFLOW_NAME,"event":"workflow_dispatch"
            }
        }
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp)/"event.json"
            file.write_text(json.dumps(event),encoding="utf-8")
            with patch.dict(os.environ, {"GITHUB_REPOSITORY":"Frontier-Group-IT/insureit_new",
                                         "GH_TOKEN":"synthetic", "GITHUB_EVENT_NAME":"workflow_run",
                                         "GITHUB_EVENT_PATH":str(file)}):
                with patch.object(pg,"reconcile") as mocked:
                    pg.main()
                    mocked.assert_not_called()

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
