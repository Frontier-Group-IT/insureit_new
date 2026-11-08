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

WORKFLOWS = ("insureit-postgres-r2-manual.yml", "insureit-postgres-r2-v2-manual.yml")
MARKER = "<!-- INSUREIT_PG_R2_FRESHNESS_V1 -->"
TITLE = "INSUREIT: PostgreSQL R2 archive is stale (daily backup not yet enabled)"
MAX_AGE = dt.timedelta(hours=30)


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
            print("PostgreSQL R2 archive age meets 30h threshold; no issue open")
        return
    run_url = run.get("html_url") if run else None
    created_at = run.get("created_at") if run else None
    body = (
        f"{MARKER}\n\n"
        "**Status:** Independent PostgreSQL-to-R2 archive needs attention.\n\n"
        f"**Reason:** {status}; latest successful run created at {created_at or 'not found'} UTC.\n\n"
        + (f"**Last successful run:** {run_url}\n\n" if run_url else "")
        + "**Impact:** Successful Supabase Storage backups and Supabase Pro's own database backups "
          "are separate. This alert concerns the additional encrypted PostgreSQL archive in R2 only.\n\n"
          "**Release gate:** The database R2 workflow remains manual-only until isolated restore, "
          "Auth and Storage metadata coverage, and record-count comparisons are demonstrated. "
          "Do not call this daily database protection while it is manual-only.\n\n"
          "**Action:** Review backup/restore workflow results and the same INSUREIT backup handoff file. "
          "Do not delete R2 snapshots or modify the production database.\n"
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
    query = urllib.parse.urlencode({"branch": "main", "per_page": 100})
    runs = []
    # Track legacy and new v2 encrypted archive freshness independently of
    # restore certification. A successful export is NOT a recovery guarantee.
    for workflow in WORKFLOWS:
        response = api("GET", f"/repos/{repo}/actions/workflows/{workflow}/runs?{query}", token)
        runs.extend(response.get("workflow_runs", []))
    status, latest = status_from_runs(runs, dt.datetime.now(dt.timezone.utc))
    reconcile(repo, token, status, latest)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"POSTGRES BACKUP MONITOR ERROR: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
