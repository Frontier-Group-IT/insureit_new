import datetime as dt
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).parent))
import monitor_github_backup as monitor

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 2, 17, 17, tzinfo=UTC)

def run(created, conclusion=None, status="completed", event="schedule", branch="main"):
    return {
        "created_at": created, "conclusion": conclusion, "status": status,
        "event": event, "head_branch": branch, "html_url": "https://github.com/example/run/1",
    }


class MonitorTests(unittest.TestCase):
    def test_expected_schedule_window(self):
        self.assertEqual(monitor.window_start(NOW),
                         dt.datetime(2026, 11, 2, 13, 20, tzinfo=UTC))

    def test_cross_midnight_watchdog_targets_previous_evening(self):
        # Observed on 3 Nov 2026 05:24 IST: GitHub cron began late,
        # at 3 Nov 03:53 IST, from the 2 Nov 19:00 IST schedule.
        delayed_watchdog = dt.datetime(2026, 11, 2, 23, 54, tzinfo=UTC)
        self.assertEqual(monitor.latest_target(delayed_watchdog),
                         dt.datetime(2026, 11, 2, 13, 30, tzinfo=UTC))
        self.assertEqual(monitor.window_start(delayed_watchdog),
                         dt.datetime(2026, 11, 2, 13, 20, tzinfo=UTC))
        delayed_run = run("2026-11-02T22:23:29Z", "success")
        self.assertEqual(monitor.scheduled_status([delayed_run], delayed_watchdog)[0],
                         "success")

    def test_new_evening_switches_nominal_target(self):
        next_evening = dt.datetime(2026, 11, 3, 17, 17, tzinfo=UTC)
        self.assertEqual(monitor.latest_target(next_evening),
                         dt.datetime(2026, 11, 3, 13, 30, tzinfo=UTC))
        prior_run = run("2026-11-02T22:23:29Z", "success")
        self.assertEqual(monitor.scheduled_status([prior_run], next_evening)[0],
                         "missing")

    def test_delayed_run_after_utc_midnight_is_in_window(self):
        next_morning = dt.datetime(2026, 11, 3, 2, 0, tzinfo=UTC)
        delayed_run = run("2026-11-03T00:30:00Z", "success")
        self.assertEqual(monitor.scheduled_status([delayed_run], next_morning)[0],
                         "success")

    def test_missing_scheduled_run(self):
        self.assertEqual(monitor.scheduled_status([], NOW)[0], "missing")

    def test_successful_scheduled_run(self):
        runs = [run("2026-11-02T13:35:00Z", "success")]
        self.assertEqual(monitor.scheduled_status(runs, NOW)[0], "success")

    def test_failed_scheduled_run(self):
        runs = [run("2026-11-02T13:35:00Z", "failure")]
        self.assertEqual(monitor.scheduled_status(runs, NOW)[0], "failed")

    def test_running_scheduled_run(self):
        runs = [run("2026-11-02T13:35:00Z", status="in_progress")]
        self.assertEqual(monitor.scheduled_status(runs, NOW)[0], "still_running")

    def test_manual_run_does_not_mask_missed_scheduled_run(self):
        runs = [run("2026-11-02T13:35:00Z", "success", event="workflow_dispatch")]
        self.assertEqual(monitor.scheduled_status(runs, NOW)[0], "missing")

    def test_prior_day_run_does_not_satisfy_today(self):
        runs = [run("2026-11-01T13:35:00Z", "success")]
        self.assertEqual(monitor.scheduled_status(runs, NOW)[0], "missing")

    def test_failures_open_one_issue_and_updates_existing(self):
        with patch.object(monitor, "find_open_issue", return_value=None):
            with patch.object(monitor, "api", return_value={"number": 101}) as called:
                monitor.alert("Frontier-Group-IT/insureit_new", "fake", "no run")
                self.assertEqual(called.call_args.args[0], "POST")
        with patch.object(monitor, "find_open_issue",
                          return_value={"number": 101, "body": "old"}):
            with patch.object(monitor, "api", return_value={}) as called:
                monitor.alert("Frontier-Group-IT/insureit_new", "fake", "no run")
                self.assertEqual(called.call_args.args[0], "PATCH")

    def test_recovery_closes_existing_issue(self):
        with patch.object(monitor, "find_open_issue",
                          return_value={"number": 101}):
            with patch.object(monitor, "api", return_value={}) as called:
                monitor.recover("Frontier-Group-IT/insureit_new", "fake")
                self.assertEqual(called.call_args.args[3]["state"], "closed")


if __name__ == "__main__":
    unittest.main()
