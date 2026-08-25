# Vercel Deployment Policy

This file is a durable repository rule for the InsureIT web portal.

## Mandatory deployment behavior

1. **Preview deployments must never be triggered automatically.**
   - Feature branches, pull requests, temporary UI branches, documentation branches, and any branch other than `main` must not create an automatic Vercel deployment.
   - Do not temporarily enable preview deployments for visual review, debugging, dashboards, policy onboarding, or any other branch-level work.
   - If a preview is exceptionally required, it must be an explicit, one-off user-approved action and must not change the repository configuration to re-enable automatic previews.

2. **Only production deployment from `main` may auto-trigger.**
   - The Vercel project must remain configured so that Git pushes/merges to `main` can create the production deployment automatically.
   - No other branch may be enabled for automatic Vercel deployment.

3. The canonical configuration is `apps/web-portal/vercel.json`:

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

4. Any change that weakens this rule is a release-process change and requires explicit user approval.

5. A GitHub CI success and a Vercel deployment are separate evidence states. Do not claim production is deployed until Vercel reports the exact `main` commit as `READY` and the production aliases are attached.

## Reason

InsureIT uses feature branches and pull requests heavily. Automatic branch previews create unnecessary deployments, make production/preview state harder to reason about, and have previously caused confusion during active development. The stable rule is therefore: **no automatic previews; automatic production from `main` only.**
