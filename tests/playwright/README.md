# Insureit read-only Playwright smoke tests

## Scope
Public portal login only, tested in desktop Chromium and mobile Chromium emulation.
Tests use GET navigation and reload; no credentials, submissions, database writes, API mutation, OAuth, RC lookups, uploads, payments, calls, or emails.
**These tests do not cover the installed Customer or Partner native Android applications**, authenticated business workflows, penetration testing, RLS, or uptime.

## Local usage (Node 22)
```bash
cd tests/playwright
npm install
npx playwright install chromium
npm test
npm run report
```

Default approved target: `https://portal.insureit.in`. Optionally set `SMOKE_BASE_URL=https://staging.portal.insureit.in` only when that hostname is an authorized, working staging origin.
Never pass real customer credentials; no secrets are required.

## GitHub Actions
Run **Insureit Read-only Playwright Smoke** through workflow_dispatch on the feature branch or via its pull request.
The job is separated from all production deployments and native build/OTA jobs; permissions are read-only.
A test failure uploads HTML/JUnit reports and failure traces/screenshots (7-day retention).
Avoid uploading screenshots if a future authenticated suite is added until PII redaction is in place.
The GitHub Action uses a strict allowlist for permitted public hosts, one worker and no mutations.
This is an initial browser smoke baseline, not a full functional/security audit.
