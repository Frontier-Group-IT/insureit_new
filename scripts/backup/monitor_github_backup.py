#!/usr/bin/env python3
"""GitHub Issues monitor for INSUREIT R2 backups. No Supabase/R2 secrets.

Runs on backup workflow completion AND separately at 22:30 IST to detect
scheduled backups that never started. One deduplicated issue; closes on recovery.
"""
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

WORKFLOW = "insureit-supabase-storage-r2-backup.yml"
MARKER = "<!-- INSUREIT_R2_BACKUP_ALERT_V1 -->"
TITLE = "INSUREIT: automatic R2 document backup needs attention"
UTC = dt.timezone.utc


def iso(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def api(method, path, token, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        "https://api.github.com" + path, data=data, method=method,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "Content-Type": "application/json", "User-Agent": "insureit-backup-monitor"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        # No tokens or response bodies in logs.
        raise RuntimeError(f"GitHub API returned HTTP {exc.code} on {method}") from exc


def window_start(now):
    """Today's 19:00 IST (13:30 UTC), with 10-minute early tolerance."""
    ist = now.astimezone(dt.timezone(dt.timedelta(hours=5, minutes=30)))
    local = ist.replace(hour=19, minute=0, second=0, microsecond=0)
    return local.astimezone(UTC) - dt.timedelta(minutes=10)


def scheduled_status(runs, now):
    start = window_start(now)
    scheduled = [r for r in runs if r.get("event") == "schedule"
                 and r.get("head_branch") == "main"
                 and iso(r["created_at"]) >= start]
    scheduled.sort(key=lambda r: iso(r["created_at"]), reverse=True)
    if any(r.get("conclusion") == "success" and r.get("status") == "completed"
           for r in scheduled):
        return "success", scheduled[0] if scheduled else None
    if any(r.get("status") in ("queued", "waiting", "pending", "in_progress",
                              "requested") for r in scheduled):
        return "still_running", scheduled[0]
    if scheduled:
        return "failed", scheduled[0]
    return "missing", None


def find_open_issue(repo, token):
    path = f"/repos/{repo}/issues?state=open&per_page=100"
    for entry in api("GET", path, token):
        if "pull_request" not in entry and MARKER in entry.get("body", ""):
            return entry
    return None


def alert(repo, token, cause, run_url=None):
    existing = find_open_issue(repo, token)
    details = (
        f"{MARKER}\n\n"
        f"**Status:** Backup requires investigation.\n\n"
        f"**Cause:** {cause}\n\n"
        f"**Workflow:** \`{WORKFLOW}\` — daily 7 PM IST (13:30 UTC).\n\n"
        + (f"**Run:** {run_url}\n\n" if run_url else "")
        + "**Impact:** The most recent successful encrypted backup remains preserved, "
          "but today's scheduled backup has not been confirmed successful.\n\n"
          "**Action:** Check the backup job and its in-job sample restore verification. "
          "Do not delete or expire existing R2 data.\n\n"
          "This issue is automatically closed when a subsequent backup workflow succeeds. "
          "For email/mobile notifications, watch or subscribe to repository Issues.\n"
    )
    if existing:
        # Keep one alert issue and avoid a fresh issue on every monitor pass.
        if existing.get("body") != details:
            api("PATCH", f"/repos/{repo}/issues/{existing['number']}", token,
                {"body": details})
            print(f"Updated existing backup alert issue #{existing['number']}")
        else:
            print(f"Existing alert #{existing['number']} unchanged")
    else:
        created = api("POST", f"/repos/{repo}/issues", token,
                      {"title": TITLE, "body": details})
        print(f"Opened backup alert issue #{created['number']}")


def recover(repo, token):
    issue = find_open_issue(repo, token)
    if issue:
        api("PATCH", f"/repos/{repo}/issues/{issue['number']}", token,
            {"state": "closed", "state_reason": "completed"})
        print(f"Closed resolved backup alert issue #{issue['number']}")
    else:
        print("Backup healthy; no alert issue open")


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    event = os.environ["GITHUB_EVENT_NAME"]
    now = dt.datetime.now(UTC)
    if event == "workflow_run":
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as fp:
            run = json.load(fp)["workflow_run"]
        if run.get("name") != "INSUREIT Supabase Storage backup to R2 (daily 7 PM IST)":
            raise RuntimeError("Unexpected workflow_run source")
        if run.get("head_branch") != "main":
            raise RuntimeError("Non-main backup run not accepted")
        if run.get("conclusion") == "success":
            recover(repo, token)
        else:
            alert(repo, token, "Backup workflow completed with conclusion " +
                  str(run.get("conclusion")), run.get("html_url"))
        return
    if event not in ("schedule", "workflow_dispatch"):
        raise RuntimeError("Unsupported trigger")
    # Allow manual tests before evening without false alarms.
    if event == "schedule" and now < window_start(now) + dt.timedelta(hours=3):
        raise RuntimeError("Staleness monitor unexpectedly ran too early")
    # Query only today's runs; bounded API request with no production secrets.
    day = now.date().isoformat()
    query = urllib.parse.urlencode({"branch": "main", "created": day, "per_page": 100})
    runs = api("GET", f"/repos/{repo}/actions/workflows/{WORKFLOW}/runs?{query}",
               token).get("workflow_runs", [])
    status, run = scheduled_status(runs, now)
    if status == "success":
        recover(repo, token)
        print("Today's scheduled backup succeeded")
    else:
        url = run.get("html_url") if run else None
        alert(repo, token, f"19:00 IST scheduled run status at watchdog check: {status}",
              url)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"BACKUP MONITOR ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
