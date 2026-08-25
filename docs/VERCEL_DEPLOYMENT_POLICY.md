# Vercel Deployment Policy

## Mandatory rule

This repository must **never automatically create Vercel Preview deployments** for feature branches, pull requests, temporary review branches, documentation branches, or any branch other than `main`.

The only Git-backed Vercel deployment that may auto-trigger is the **production deployment from `main`**.

Canonical enforcement in `apps/web-portal/vercel.json`:

```json
{
  "git": {
    "deploymentEnabled": {
      "*": false,
      "main": true
    }
  }
}
```

## Agent requirements

- Do not temporarily enable Vercel Preview deployments to inspect UI work.
- Do not add a branch name, pull-request branch, wildcard, or temporary exception that enables automatic preview deployment.
- Feature branches must rely on the canonical GitHub verification workflow for typecheck, lint, regressions and production build verification.
- `main` may automatically trigger the production deployment after a merge.
- If Vercel Preview deployment is ever required in the future, it needs explicit user approval and a deliberate repository-policy change; it must not be introduced as an implementation convenience.
- Any future change to `apps/web-portal/vercel.json` must preserve `"*": false` unless the user explicitly changes this policy.

## Current state

As of 2026-08-26, `apps/web-portal/vercel.json` already enforces this rule with `"*": false` and `"main": true`.
