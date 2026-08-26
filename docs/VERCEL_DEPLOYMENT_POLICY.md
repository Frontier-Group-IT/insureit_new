# Vercel Deployment Policy

## Mandatory rule

This repository must **never automatically create Vercel Preview deployments** for feature branches, pull requests, temporary review branches, documentation branches, or any other non-production Git ref.

Automatic production deployment is allowed only after a verified pull request is merged into `main`.

## Canonical enforcement

Vercel's own Git integration is disabled for every branch in `apps/web-portal/vercel.json`:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

This is intentional. A branch-map entry such as `"*": false` is not a reliable deny-all fallback because Vercel treats unspecified branches as enabled; therefore it must not be used as the preview-suppression mechanism.

Production automation is owned by `.github/workflows/deploy-production.yml`:

- a merge/push to `main` starts the production workflow automatically;
- the workflow resolves the merged PR head commit;
- it requires a successful `Verify web portal` pull-request run for that exact feature commit;
- it confirms the verified commit belongs to a merged PR into the current `main` snapshot;
- only then does it invoke the Vercel production deploy hook;
- direct pushes to `main` without merged-PR verification provenance are rejected by the deployment workflow.

## Agent requirements

- Never temporarily enable Vercel Preview deployments to inspect UI work.
- Never change `git.deploymentEnabled` from `false` merely to obtain a branch preview.
- Feature branches must use the canonical GitHub verification workflow for regressions, typecheck, lint and the Next.js production build.
- Do not manually create a Vercel preview deployment as a substitute for the GitHub verification gate unless the user explicitly changes this policy.
- Do not weaken or bypass verified-PR provenance in the automatic production workflow.
- A successful deploy-hook request is not proof that production is live; verify the final Vercel deployment reaches `READY` before reporting deployment success.

## Current state

As of 2026-08-26, the intended architecture is:

```text
feature / PR branch
        |
        +--> GitHub Verify web portal only
        |
        X    no automatic Vercel Preview

verified PR merged to main
        |
        +--> GitHub production workflow
                |
                +--> validate exact green PR run
                +--> Vercel production deploy hook
```
