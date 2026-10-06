# InsureIT Developer Workspace Handoff

> Created: 2026-10-06 (IST)
>
> This is the durable architecture handoff for the private engineering control plane hosted separately from the public `insureit.tech` site.

## Purpose

`insureit.tech` remains the public engineering identity.

`dev.insureit.tech` is reserved for the private InsureIT Developer Workspace: a protected control plane for observing and, in later phases, safely managing the InsureIT ecosystem without requiring routine direct access to GitHub, Vercel, Supabase, Expo or provider dashboards.

## Application boundary

- App path: `apps/dev-workspace`
- Framework: Next.js 15 App Router
- Vercel project: `insureit-developer`
- Vercel project ID: `prj_LuDgeH31z9zpSDwqx2B94HmV0bWO`
- Vercel team: `team_DsOUqnF8Pbd7YGNt8RCE8NgA`
- Production branch: `main`
- Deployment protection: Vercel Authentication enabled for all deployment targets
- Public engineering site remains: `apps/tech-site`
- Production portal remains: `apps/web-portal`

Do not merge the public tech site and the private developer workspace into one deployment project.

## Phase 0 / 1 operating contract

The initial workspace is deliberately read-only.

Current UI exposes:
- product surface inventory;
- infrastructure inventory;
- control-plane architecture;
- implementation roadmap;
- health endpoint at `/api/health`.

The health endpoint must report:
- `write_actions_enabled: false`;
- `apk_build_enabled: false`.

No infrastructure provider credential is stored in the browser or source tree.

## Mandatory action architecture

Future write capability must flow through:

```text
Developer / AI
      ↓
Developer Workspace
      ↓
InsureIT Action Gateway
      ↓
Policy + risk + permission checks
      ↓
GitHub / Vercel / Expo / Supabase / other providers
```

Never give the browser or AI unrestricted production credentials.

## Risk model

- Green: versioned content/configuration/feature-flag changes with audit and rollback.
- Blue: preview deployment or OTA publish with confirmation.
- Amber: PR merge or environment/configuration mutation after checks.
- Red: production migration or rollback with re-authentication and impact review.
- Black: destructive data/credential operations require explicit two-step approval.

## Release boundaries

- Existing GitHub checks remain authoritative.
- Merge is not deployment.
- Deployment is not runtime verification.
- Committed migration is not applied migration.
- Expo OTA is not native build.
- APK/AAB must not be created unless the user explicitly requests it.
- Developer Workspace must not add an automatic APK/AAB path.

## Planned phases

1. Read-only Developer Home and application inventory.
2. Read-only GitHub, Vercel and Supabase observability.
3. Versioned configuration/content/assets/feature flags with rollback.
4. Release Center using existing GitHub and Expo workflows.
5. Database schema/migration/advisor workspace with guarded writes.
6. Integration control centers for OCR, Voice, AuthBridge, iCall and gateways.
7. AI Developer operating only through typed Action Gateway actions.

## Security rules

- Keep developer workspace non-indexable.
- Keep Vercel Authentication enabled until app-level authentication and capability checks are implemented and verified.
- Do not expose service-role keys, provider secrets, management tokens or decrypted credentials client-side.
- Prefer scoped/OAuth/workload-identity credentials for provider integrations.
- All future write actions require an immutable audit event.
- Every write-capable feature must have an explicit rollback or remediation path before production enablement.

## Current evidence state

Branch: `feature/developer-workspace-foundation`

Implemented:
- standalone Next.js developer workspace app;
- developer home UI;
- product/infrastructure inventory;
- read-only mode declaration;
- health endpoint;
- dedicated Vercel project;
- Vercel Authentication protection.

Pending:
- preview verification;
- PR;
- CI;
- merge;
- production deployment;
- `dev.insureit.tech` custom-domain assignment.
