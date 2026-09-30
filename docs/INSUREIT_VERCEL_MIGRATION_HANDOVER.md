# INSUREIT — Vercel Account Migration Handover

_Last updated: 2026-09-30_

## Purpose

This document records the full Vercel migration context for the INSUREIT project so another AI agent can continue safely if the current chat ends.

---

## 1. Source and Destination Vercel Accounts

### Source Vercel Team
- Team name: `Insureit`
- Team slug: `insureit`
- Team ID: `team_pXs22dfNPdQHKz1BqhZL5D2z`
- Source Vercel user seen in CLI: `insureit-solutions`
- Plan: Pro

### Source Project
- Original project name: `insureit`
- Temporarily renamed to: `insureit1`
- Project ID: `prj_bbUy0xbofYqSxwJA7gNMk0q2na0g`
- GitHub repo: `Frontier-Group-IT/insureit_new`
- Production branch: `main`
- Historical custom domain: `portal.insureit.in`
- Important: do not delete/detach the custom domain until the destination deployment is fully validated.

### Destination Vercel Team
- Team name: `antnish1's projects`
- Team slug: `antnish1s-projects`
- Team ID: `team_DsOUqnF8Pbd7YGNt8RCE8NgA`
- Plan: Pro

### Destination Project
- New project name: `insureit_new`
- Project ID: `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`
- Imported from GitHub repo: `Frontier-Group-IT/insureit_new`

---

## 2. Why a New Destination Project Was Created

The original plan was to transfer the existing source project back to the destination team.

Transfer repeatedly failed with:

`Existing project on team_DsOUqnF8Pbd7YGNt8RCE8NgA conflicts with transfer.`

This remained true even after renaming the source project from `insureit` to `insureit1`, which ruled out a simple project-name collision.

The project had previously lived in the destination team and was transferred out earlier, so the likely cause is stale/internal Vercel transfer/project ownership metadata.

A clean import into a new project was chosen instead of waiting for Vercel Support.

---

## 3. Source Deployment/Billing Context

The source project deployment was paused/disabled by Vercel due billing/payment state.

Observed error:
- `DEPLOYMENT_DISABLED`
- HTTP 402

This was not caused by the application code or Supabase.

---

## 4. Repository / Monorepo Build Context

Repo:
`Frontier-Group-IT/insureit_new`

Root `package.json` is a workspace monorepo.

Relevant workspaces include:
- `apps/web-portal`
- `apps/mobile-app`
- `apps/partner-app`
- `packages/*`

Root build command delegates to the web portal:

```bash
npm --workspace apps/web-portal run build
```

The web portal build is:

```bash
next build
```

Next.js version observed during Vercel build:
- `15.5.21`

Node engine:
- `>=20`

The clean destination Vercel build correctly built from the repository root and delegated into `apps/web-portal`.

---

## 5. Current `vercel.json` / Auto Deployment Policy

The repository initially had:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "github": {
    "autoJobCancelation": false
  },
  "git": {
    "deploymentEnabled": {
      "main": false,
      "work-*": false
    }
  }
}
```

This disables Git-triggered deployments only for:
- `main`
- `work-*`

All unspecified branches can still auto-deploy.

If the goal is to disable **all automatic Git-triggered Vercel deployments**, use:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "github": {
    "autoJobCancelation": false
  },
  "git": {
    "deploymentEnabled": false
  }
}
```

This keeps GitHub connected but stops automatic deployments from all pushes/branches/PRs.

Manual deployment can still be done through:
- Vercel dashboard
- Deploy Hooks
- explicit CLI/API/GitHub Action deployment

Important project policy:
- Do not create APKs unless explicitly requested.
- Automatic APK-on-main behavior had already been disabled separately in the repo workflow context.

---

## 6. Environment Variable Migration Attempt

The source project environment variables were queried via Vercel REST API.

Source project:
- `prj_bbUy0xbofYqSxwJA7gNMk0q2na0g`
- Team: `team_pXs22dfNPdQHKz1BqhZL5D2z`

A metadata backup was saved locally as:

`$HOME\Desktop\insureit-env-backup.json`

The source project returned **39 environment-variable records**.

### Production variables discovered

- `LOGIN_CAPTCHA_SECRET`
- `SARVAM_RENEWAL_WEBHOOK_SECRET`
- `SARVAM_RENEWAL_CALLING_ENABLED`
- `SARVAM_RENEWAL_CAMPAIGN_ID`
- `SARVAM_API_KEY`
- `SARVAM_ORG_ID`
- `SARVAM_WORKSPACE_ID`
- `SARVAM_RENEWAL_APP_ID`
- `SARVAM_RENEWAL_APP_VERSION`
- `OPENAI_API_KEY`
- `POLICY_OCR_WORKER_SECRET`
- `POLICY_OCR_ORCHESTRATOR_ID`
- `POLICY_OCR_ORCHESTRATOR_ENABLED`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `INSUREIT_ASSISTANT_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_PROJECT_NUMBER`
- `GOOGLE_WORKLOAD_IDENTITY_POOL_ID`
- `GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_DOCUMENT_AI_LOCATION`
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`
- `NEXT_PUBLIC_ENABLE_LEGACY_INTERMEDIARY_IMPORT`
- `ICALL_GATEWAY_SECRET`
- `ICALL_GATEWAY_URL`
- `ICALL_UAT_BASE_URL`
- `ICALL_UAT_AUTH_TOKEN`
- `PAN_VERIFICATION_WORKER_KEY`
- `NEXT_PUBLIC_PORTAL_URL`

### Preview variables discovered

- `ASSISTANT_MODEL`
- `ASSISTANT_API_URL`
- `ASSISTANT_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

Total environment records: **39**

---

## 7. Important Discovery: Sensitive Vercel Values Are Non-Retrievable

A bulk copy initially created all 39 variable records in the destination project, but their values were empty because Vercel sensitive variables are write-only.

The destination correctly showed 39 names/scopes, but build still failed.

A value-length check showed every imported sensitive value length was `0`.

Then Vercel CLI was used from the correct source account.

CLI login flow:

```powershell
vercel logout
vercel login
vercel whoami
vercel teams ls
```

Correct authenticated state was:

- User: `insureit-solutions`
- Active team: `insureit`
- Teams visible:
  - `insureit`
  - `antnish1s-projects`

Temporary working directory used:

```powershell
cd "$HOME\Desktop\insureit-env-copy"
```

Source project was linked successfully:

`insureit/insureit1`

Commands used:

```powershell
vercel env pull .env.production.local --environment=production
vercel env pull .env.preview.local --environment=preview
```

Vercel CLI response:

Production:
- `33 Secret values cannot be pulled from the production Environment`
- placeholders `[SENSITIVE]` were written

Preview:
- `6 Secret values cannot be pulled from the preview Environment`
- placeholders `[SENSITIVE]` were written

This confirms the old Vercel project cannot be used to recover the actual secret values after they have been saved as Sensitive.

The placeholder string `[SENSITIVE]` has length 13, which matched the local check.

### Security note

Several Vercel tokens were accidentally pasted into chat while troubleshooting.

Treat every pasted token as compromised and revoke it.

Do not reuse old tokens.
Do not paste new Vercel tokens, API keys, service-role keys, or `.env` file contents into chat.

---

## 8. Destination Build Failure and Root Cause

The destination project successfully:
- cloned the repo
- installed dependencies
- detected Next.js
- compiled successfully
- completed lint/type checking with warnings only

The build then failed during prerendering of:
- `/reset-password`
- `/auth/callback`

Exact error:

`Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY`

Therefore:
- monorepo configuration is correct
- build command is correct
- compile succeeds
- current blocker was missing/blank Supabase environment values

---

## 9. Supabase Values Restored Manually

The destination project was edited in:

Vercel → `insureit_new` → Settings → Environments → Production

The correct Supabase project URL visible during recovery is:

```text
https://ilzhsfqqjyppzzvfscmh.supabase.co
```

Three important variables were manually updated in destination Vercel:

### `NEXT_PUBLIC_SUPABASE_URL`
- Value: actual Supabase project URL
- Environment: Production
- Type should be `Config` because it is public/browser-exposed

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Value: actual Supabase anon/publishable key
- Environment: Production
- Type should be `Config`

### `SUPABASE_SERVICE_ROLE_KEY`
- Value: actual service-role key
- Environment: Production
- Type must remain `Secret`
- Never expose this key client-side

### Vercel UI behavior discovered

If a variable was originally saved as `Secret`, Vercel does **not** allow converting it directly to `Config`.

For `NEXT_PUBLIC_*` variables that were incorrectly created as Secret:
1. delete the existing Production entry
2. recreate it
3. choose `Config`
4. paste the real value
5. save

Reason:
`NEXT_PUBLIC_*` values are bundled into browser-side code, so they are intentionally public.

---

## Milestone — Destination Production Deployment Opens Correctly

**Achieved on 2026-09-30.**

The destination Vercel project `insureit_new` reached a successful READY Production deployment after two migration blockers were resolved:

1. **Supabase build blocker resolved** — the real Production values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` were restored.
2. **Monorepo output-path blocker resolved** — Vercel Root Directory was set to `apps/web-portal`, allowing Vercel to find the correct `.next` output.
3. **Canonical-host redirect understood and migration testing unblocked** — `apps/web-portal/middleware.ts` intentionally redirects Production `*.vercel.app` requests to `portal.insureit.in`. During migration this caused every new Vercel alias to land on the old paused custom-domain deployment. The new destination deployment is now opening correctly for direct testing, so this is the current migration milestone.

At this checkpoint, the application **builds and opens correctly on the destination Vercel project**. The remaining work is primarily restoration/validation of runtime integration environment variables and the final custom-domain handoff.

Do not treat successful page load alone as completion: email, OCR/Document AI, voice/Sarvam, iCall, PAN verification, captcha, and assistant/OpenAI integrations still need their real values restored and tested.

---

## 10. Current State at Handover

Completed:
- destination Vercel project exists and is linked to the GitHub repo
- Vercel Root Directory is correctly set to `apps/web-portal`
- Next.js Production build succeeds end-to-end
- destination Production deployment is READY and the direct Vercel deployment URL opens correctly
- 39 environment-variable names/scopes were recreated
- old Vercel Sensitive values were confirmed non-retrievable
- the three critical Production Supabase variables have real values:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- the forced canonical-host redirect to `portal.insureit.in` was identified as application middleware behavior and is no longer blocking destination testing

Next immediate actions:
1. restore the highest-priority runtime environment variables needed for login, email, onboarding, OCR, and other core portal features
2. test those integrations on the destination Vercel deployment
3. restore lower-priority voice/assistant/iCall integrations after the core portal is healthy
4. finish `portal.insureit.in` ownership/routing handoff only after validation

---

## 11. Remaining Environment Variables That Still Need Real Values

Because Vercel cannot reveal saved sensitive values, the remaining values need to be recovered from their original providers or another secure source.

### Sarvam / Voice
- `SARVAM_RENEWAL_WEBHOOK_SECRET`
- `SARVAM_RENEWAL_CALLING_ENABLED`
- `SARVAM_RENEWAL_CAMPAIGN_ID`
- `SARVAM_API_KEY`
- `SARVAM_ORG_ID`
- `SARVAM_WORKSPACE_ID`
- `SARVAM_RENEWAL_APP_ID`
- `SARVAM_RENEWAL_APP_VERSION`

### OpenAI / Assistant
- `OPENAI_API_KEY`
- `INSUREIT_ASSISTANT_API_KEY`
- Preview:
  - `ASSISTANT_MODEL`
  - `ASSISTANT_API_URL`
  - `ASSISTANT_API_KEY`

For API keys, recreation/rotation is generally safer than trying to recover old secrets.

### OCR
- `POLICY_OCR_WORKER_SECRET`
- `POLICY_OCR_ORCHESTRATOR_ID`
- `POLICY_OCR_ORCHESTRATOR_ENABLED`

### Resend
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Google Cloud / Document AI
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_PROJECT_NUMBER`
- `GOOGLE_WORKLOAD_IDENTITY_POOL_ID`
- `GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_DOCUMENT_AI_LOCATION`
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`

### iCall
- `ICALL_GATEWAY_SECRET`
- `ICALL_GATEWAY_URL`
- `ICALL_UAT_BASE_URL`
- `ICALL_UAT_AUTH_TOKEN`

### Other
- `LOGIN_CAPTCHA_SECRET`
- `PAN_VERIFICATION_WORKER_KEY`
- `NEXT_PUBLIC_ENABLE_LEGACY_INTERMEDIARY_IMPORT`
- `NEXT_PUBLIC_PORTAL_URL`

### Preview Supabase
The Preview copies also need to be checked/restored with actual values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not assume Production values should automatically be reused for Preview without checking the intended environment design.

---

## 12. Recommended Recovery Strategy for Remaining Secrets

Recover only what becomes necessary, in a controlled sequence.

Suggested order:

1. Redeploy now that the three critical Production Supabase variables are fixed.
2. If the build passes, test the destination `.vercel.app` app.
3. Recover any runtime-only secrets feature by feature.
4. Prefer rotating/recreating API keys where possible.
5. Validate:
   - login/auth
   - password reset
   - policy intake
   - OCR
   - email
   - voice/Sarvam
   - iCall
   - PAN verification
6. Only after functional validation, move/attach `portal.insureit.in`.

---

## 13. Domain Migration Safety

Do not detach `portal.insureit.in` prematurely.

Safe sequence:

1. destination build succeeds
2. destination `.vercel.app` URL loads
3. auth/login works
4. core Supabase flows work
5. key server-side integrations are validated
6. attach `portal.insureit.in` to destination
7. verify DNS/domain ownership if Vercel asks
8. validate HTTPS and production traffic
9. only then retire old project/domain linkage

The user's explicit requirement is to preserve:
- environment configuration
- Git configuration
- custom domain
- application behavior

---

## 14. Git / Deployment Governance

Project preference:
- separate branch
- PR
- run checks before merge
- do not merge failed PRs
- use GitHub Actions deployment schema where applicable
- no automatic APK builds unless explicitly requested

For Vercel specifically, user wants automatic Git deployments disabled.

Preferred final `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "github": {
    "autoJobCancelation": false
  },
  "git": {
    "deploymentEnabled": false
  }
}
```

---

## 15. Useful IDs Summary

### Source
- Team ID: `team_pXs22dfNPdQHKz1BqhZL5D2z`
- Project ID: `prj_bbUy0xbofYqSxwJA7gNMk0q2na0g`
- Team slug: `insureit`
- Project current source name: `insureit1`

### Destination
- Team ID: `team_DsOUqnF8Pbd7YGNt8RCE8NgA`
- Team slug: `antnish1s-projects`
- Project ID: `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`
- Project name: `insureit_new`

### Supabase
- Project ref observed: `ilzhsfqqjyppzzvfscmh`
- Project URL:
  `https://ilzhsfqqjyppzzvfscmh.supabase.co`

---

## 16. What the Next AI Agent Should Do First

At the start of a new chat:

1. Read this file completely.
2. Confirm the user has already restored the three Production Supabase variables.
3. Check the latest destination Vercel deployment for `insureit_new`.
4. If build succeeds, validate the destination app before moving the custom domain.
5. If build fails, identify the **next exact missing variable/integration** from build/runtime logs.
6. Recover that variable from the original service rather than trying to read it from old Vercel.
7. Never expose or repeat secrets in chat.
8. Do not build APKs unless explicitly requested.
9. Keep all migration changes reversible until `portal.insureit.in` is confirmed healthy on destination.

---

## 17. Security Rules for Continuation

- Revoke any token accidentally pasted into chat.
- Never paste:
  - Vercel tokens
  - Supabase service-role keys
  - OpenAI keys
  - Resend keys
  - Sarvam keys
  - Google credentials
  - `.env` file contents
- Screenshots should hide actual secret values.
- Public values such as `NEXT_PUBLIC_SUPABASE_URL` are safe to expose.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intended for client-side use, but should still be handled carefully.
- `SUPABASE_SERVICE_ROLE_KEY` is privileged and must remain server-side only.

---

## 18. Current Migration Status

**Migration status: IN PROGRESS**

Current checkpoint:

> Destination project `insureit_new` is created, correctly rooted at `apps/web-portal`, and has a successful READY Production deployment.  
> The direct destination Vercel deployment now opens correctly and can be used for migration testing.  
> The three critical Production Supabase values are restored.  
> Remaining work is to restore runtime integration variables in priority order, validate the portal, and then complete the `portal.insureit.in` domain handoff.
