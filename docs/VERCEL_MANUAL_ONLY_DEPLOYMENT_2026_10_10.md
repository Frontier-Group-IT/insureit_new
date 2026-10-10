# Manual-only Vercel production deployment — 2026-10-10

## Evidence and boundary

- Vercel team: `team_DsOUqnF8Pbd7YGNt8RCE8NgA` (Hobby), project `insureit_new` (`prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`).
- Recent Git-source deployments for main (including commit `654b92f`) were `CANCELED`, had no build logs and referenced Vercel's Ignored Build Step help page. This indicates a skip before the build, **not** a Next.js build failure. The exact project-level ignored-build command was not available in the connector response.
- Root `vercel.json` already has `git.deploymentEnabled: false`. **Keep it false**; never enable automatic push deployments as part of this procedure.
- No DNS, environment variables, Supabase database, domain aliases, Git repository link, or application code were changed by this implementation.

## Manual-only workflow

File: `.github/workflows/deploy-vercel-manual.yml`.

- Only `workflow_dispatch` triggers the deployment job; no push, PR, schedule or chained run triggers.
- Start on `main` only. Type `DEPLOY` as the confirmation input; otherwise the deployment job is skipped.
- Read-only repository permission, serial deployment concurrency, 45-minute job timeout.
- Confirm all credentials are present and match the existing INSUREIT team/project IDs.
- Use `vercel pull --environment=production`, `vercel build --prod`, then `vercel deploy --prebuilt --prod`. This runs the build in GitHub Actions and uploads prebuilt output rather than requesting a Git-triggered Vercel build.
- No APK, AAB, Expo update, Supabase migration, or Vercel settings mutation.

## Required one-time GitHub Actions secrets

Configure in `Frontier-Group-IT/insureit_new` repository Settings > Secrets and variables > Actions:

- `VERCEL_TOKEN`: a Vercel access token authorized for the existing team/project. Never commit or print this token.
- `VERCEL_ORG_ID`: existing team ID listed above.
- `VERCEL_PROJECT_ID`: existing project ID listed above.

The workflow intentionally fails before attempting a deployment when any secret is missing or an ID points to the wrong project/team.

## Operation (after merge)

1. Go to GitHub > Actions > **Deploy INSUREIT to Vercel (Manual Only)** > **Run workflow**.
2. Select `main` and enter the exact text `DEPLOY`.
3. Inspect job logs, deployment URL and production status.
4. Confirm the deployed commit and test the working site. A successful job is not proof of application-level verification.

## Outstanding verification

- Workflow **implemented on branch**, not yet merged or executed.
- Existing Vercel project build settings and monorepo `Root Directory` were not fully exposed by the read-only project query. Verify the first manual CI build; adjust only if the CLI build cannot resolve the monorepo workspace.
- Check GitHub CI, merge only after approval, provision secrets, then trigger and validate one manual deployment. Never enable automatic deployment.
