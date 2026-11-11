#!/usr/bin/env python3
"""Warn in GitHub Issues when the independent encrypted PostgreSQL archive is stale.

Read-only GitHub Actions metadata; never uses Supabase or R2 credentials.
Issue is deduplicated, auto-closes only after a newer successful backup.
"""
import datetime as dt
import os
import sys
import urllib.parse

from monitor_github_backup import api, iso

WORKFLOW = "insureit-postgres-r2-v2-manual.yml"
WORKFLOW_NAME = "INSUREIT PostgreSQL R2 v2 consistent backup (daily 3:15 AM IST + manual)"
MARKER = "<!-- INSUREIT_PG_R2_FRESHNESS_V1 -->"
TITLE = "INSUREIT: daily PostgreSQL R2 backup needs attention"
MAX_AGE = dt.timedelta(hours=30)
GRACE = dt.timedelta(hours=3)
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))


def status_from_runs(runs, now):
    successes = [
        item for item in runs if item.get("head_branch") == "main"
        and item.get("conclusion") == "success" and item.get("status") == "completed"
    ]
    if not successes:
        return "no_successful_archive", None
    latest = max(successes, key=lambda item: iso(item["created_at"]))
    if now - iso(latest["created_at"]) > MAX_AGE:
        return "stale", latest
    return "fresh", latest


def latest_target(now):
    """Nominal 03:15 IST backup; adjust for local/UTC date boundaries."""
    ist = now.astimezone(IST)
    target = ist.replace(hour=3, minute=15, second=0, microsecond=0)
    if ist < target:
        target -= dt.timedelta(days=1)
    return target.astimezone(dt.timezone.utc)


def scheduled_status(runs, now):
    """Track v2 scheduled runs, never use a manual one to mask their absence.

    Until the first scheduled run appears, honor existing 30h freshness
    monitoring; avoids falsely flagging a skipped target from before rollout.
    """
    scheduled = [r for r in runs if r.get("head_branch") == "main"
                 and r.get("event") == "schedule"]
    if not scheduled:
        return status_from_runs(runs, now)
    target = latest_target(now)
    if now < target + GRACE:
        return "within_grace", None
    candidates = [
        r for r in scheduled
        if target - dt.timedelta(minutes=10) <= iso(r["created_at"]) <= now
    ]
    candidates.sort(key=lambda r: iso(r["created_at"]), reverse=True)
    successes = [r for r in candidates
                 if r.get("status") == "completed" and r.get("conclusion") == "success"]
    if successes:
        best = successes[0]
        return ("late" if iso(best["created_at"]) > target + GRACE else "fresh"), best
    if any(r.get("status") in ("queued", "waiting", "pending", "in_progress",
                              "requested") for r in candidates):
        return "still_running", candidates[0]
    if candidates:
        return "failed", candidates[0]
    return "missing_scheduled", scheduled[0]


def find_issue(repo, token):
    issues = api("GET", f"/repos/{repo}/issues?state=open&per_page=100", token)
    return next((item for item in issues
                 if "pull_request" not in item and MARKER in item.get("body", "")), None)


def reconcile(repo, token, status, run):
    issue = find_issue(repo, token)
    if status == "fresh":
        if issue:
            api("PATCH", f"/repos/{repo}/issues/{issue['number']}", token,
                {"state": "closed", "state_reason": "completed"})
            print(f"Closed PostgreSQL R2 freshness alert #{issue['number']}")
        else:
            print("PostgreSQL R2 scheduled backup healthy; no issue open")
        return
    run_url = run.get("html_url") if run else None
    created_at = run.get("created_at") if run else None
    body = (
        f"{MARKER}\n\n"
        "**Status:** Encrypted scheduled PostgreSQL-to-R2 v2 backup needs attention.\n\n"
        f"**Reason:** {status}; latest successful run created at {created_at or 'not found'} UTC.\n\n"
        + (f"**Last successful run:** {run_url}\n\n" if run_url else "")
        + "**Impact:** Successful Supabase Storage backups and Supabase Pro's own database backups "
          "are separate. This alert concerns the additional encrypted PostgreSQL archive in R2 only.\n\n"
          "**Schedule:** Daily 03:15 IST (21:45 UTC previous day) with a 3-hour start grace. "
          "Independent Storage backup remains daily at 19:00 IST.\n\n"
          "**Caveat:** This checks successful archive creation, not full role/ownership, "
          "Auth services or Storage file recovery.\n\n"
          "**Action:** Review the failed/missed GitHub Actions run and protected environment "
          "approvals/secrets; preserve R2 archives and avoid production SQL changes.\n"
    )
    if issue:
        if issue.get("body") != body:
            api("PATCH", f"/repos/{repo}/issues/{issue['number']}", token, {"body": body})
            print(f"Updated stale PostgreSQL R2 alert #{issue['number']}")
        else:
            print(f"Existing stale PostgreSQL R2 alert #{issue['number']} unchanged")
    else:
        created = api("POST", f"/repos/{repo}/issues", token, {"title": TITLE, "body": body})
        print(f"Opened PostgreSQL R2 freshness alert #{created['number']}")


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    event = os.environ.get("GITHUB_EVENT_NAME", "schedule")
    if event == "workflow_run":
        import json
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as fp:
            run = json.load(fp)["workflow_run"]
        if run.get("name") != WORKFLOW_NAME:
            raise RuntimeError("Unexpected workflow_run source")
        if run.get("head_branch") != "main":
            print("Ignoring non-main PostgreSQL backup run")
            return
        # A failed cron triggers an alert immediately, even if yesterday's
        # successful archive remains within the usual 30-hour age window.
        if run.get("event") == "schedule":
            reconcile(repo, token,
                      "fresh" if run.get("conclusion") == "success" else "failed_scheduled_run",
                      run)
        else:
            print("Manual PostgreSQL backup completed; scheduled health unchanged")
        return
    if event not in ("schedule", "workflow_dispatch"):
        raise RuntimeError("Unsupported PostgreSQL monitor event")
    query = urllib.parse.urlencode({"branch": "main", "per_page": 100})
    response = api("GET", f"/repos/{repo}/actions/workflows/{WORKFLOW}/runs?{query}", token)
    status, latest = scheduled_status(
        response.get("workflow_runs", []), dt.datetime.now(dt.timezone.utc)
    )
    if status in ("within_grace", "still_running"):
        print(f"Daily PostgreSQL backup: {status}; will recheck")
        return
    reconcile(repo, token, status, latest)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"POSTGRES BACKUP MONITOR ERROR: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
