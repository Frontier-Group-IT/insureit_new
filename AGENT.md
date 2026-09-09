# AGENT.md

This file contains repository-level instructions for coding agents working in `Frontier-Group-IT/insureit_new`.

Read this file and `HANDOFF.md` before modifying the repository.

---

## 1. Scope and priorities

These instructions apply to the entire repository unless a more specific `AGENT.md` exists in a subdirectory.

Priority order:

1. Preserve production data and existing business rules.
2. Understand the current implementation before editing.
3. Make the smallest correct change.
4. Validate before opening or merging a PR.
5. Never claim a deployment succeeded until Vercel reports success.
6. Be explicit about unknowns, especially database migrations and locally installed browser extensions.

---

## 2. Repository structure

```text
apps/web-portal      Next.js web portal
apps/mobile-app      Mobile app workspace
supabase             Database migrations and backend assets
tools                 Supporting tools and browser extension
.deploy               Explicit production deployment trigger
```

The primary active product area is:

```text
apps/web-portal
```

The main repository is:

```text
Frontier-Group-IT/insureit_new
```

---

## 3. Required workflow

### Before editing

- Read the relevant files completely enough to understand shared components, server actions and routes.
- Search for existing loaders, buttons, validation helpers and navigation definitions before creating anything new.
- Check whether `main` advanced while a branch was being worked on.
- Rebase or recreate a focused branch from current `main` when necessary.

### Branch and PR discipline

- Use a focused branch for application changes.
- Keep diffs narrow and avoid unrelated formatting.
- Open a PR after validation.
- Do not merge unless the user explicitly asks to merge.
- Do not deploy unless the user explicitly asks to deploy.
- Use the validated PR head SHA when merging so a moved branch cannot be merged accidentally.

### Validation

From the repository root, normally run:

```bash
npm ci
npm run lint:web
npm run typecheck:web
npm run build:web
```

For a tiny UI change, still run lint, TypeScript and the production build unless the repository is unable to do so. Report failures honestly.

Temporary validation workflows or scripts must remove themselves before the final PR. The final PR should contain only intended product or documentation files.

---

## 4. Production deployment rules

Production is explicitly triggered by updating:

```text
.deploy/production-trigger.json
```

Do not touch this file for ordinary code changes.

Only update it when the user explicitly requests deployment, for example:

- `merge and deploy`
- `deploy now`
- `finish and deploy`

When updating the trigger:

- Use the actual merged source commit.
- Describe the complete release scope accurately.
- Include validation evidence.
- Check what else was merged into `main` since the previous deployed source.
- Do not accidentally deploy a migration-dependent feature without calling out the dependency.
- Wait for the Vercel commit status to become `success`.

A `pending` status is not a successful deployment.

The response after a successful deployment should include:

- PR link
- merge commit
- production-trigger commit
- Vercel status
- deployment link

`vercel.json` currently disables Git deployment for `work-*` branches. Do not assume this blocks deployment from every feature branch or from `main`.

---

## 5. Supabase migration safety

A successful web build does not apply a Supabase migration.

Before deploying code that depends on a new migration:

1. Identify the migration file.
2. Confirm which Supabase project/environment must receive it.
3. Confirm the migration was applied.
4. Confirm backward compatibility if the web application deploys before the migration.
5. Do not state that the feature is operational until the database dependency is confirmed.

### Current high-priority migration warning

PR #163 introduced:

```text
supabase/migrations/20260804132000_harden_pan_verification_worker_leases.sql
```

Its production application was not independently confirmed in the session that created this file. Check it before troubleshooting or extending PAN verification.

---

## 6. Browser extension safety

The PAN verification workflow also depends on a locally installed browser extension under:

```text
tools/pan-verification-extension
```

Vercel cannot update a user's installed extension.

For extension changes:

- Check the manifest version.
- Explain whether users must reload or reinstall the extension.
- Verify the website URL permissions.
- Test one POSP and one MISP.
- Test pending → checking → result.
- Test abandoned lease recovery where applicable.
- Do not confuse a successful web deployment with a successful extension rollout.

Current expected extension version after PR #163 is **1.2.0**.

---

## 7. Shared UI conventions

### Form submissions

Use the existing shared components:

```text
apps/web-portal/components/form-submit-button.tsx
apps/web-portal/components/loading/insureit-loader.tsx
```

Rules:

- Reuse `FormSubmitButton` for server-action form pending states.
- Reuse `InsureItButtonLoader`.
- Disable repeated submission while pending.
- Do not introduce a separate spinner system.
- Do not show a button spinner if an existing full-screen progress overlay already communicates the same pending state.
- Preserve existing validation and persistence behavior unless the task explicitly changes it.

### UI-only requests

For layout, spacing, hover or copy changes:

- Do not change field names.
- Do not change database mappings.
- Do not change validation.
- Do not change redirect behavior unless requested.
- Verify desktop, tablet and mobile behavior.
- Preserve keyboard focus states.
- Respect reduced-motion preferences for animation.

### Copy

- Use domain-specific, actionable copy.
- Avoid generic AI-style filler.
- Keep primary action sections concise.
- Do not invent missing document requirements or business rules.

---

## 8. Intermediatory workflow rules

### Save buttons

Add POSP, Add MISP, Add Existing POSP, Add Existing MISP and Edit Details use two save choices:

```text
Save & Exit | Save & return to documents
```

Both must use the same mandatory-field validation and persistence path.

Successful `Save & Exit` routing:

- Add/Add Existing pages → Onboarding Applications
- Edit Details → related Partner Review page

For linked POSP/MISP edits, resolve the parent Partner using database-owned linkage data. Do not trust a client-provided arbitrary redirect URL.

### Application Review page

- The blue summary header must not contain a duplicate document action.
- The document workflow action belongs in the compact primary action bar.
- Current action label: `Complete documents`.
- Document guidance must be accurate: Aadhaar, PAN, bank proof, photograph and GST certificate when applicable.

### Designated Person layout

On Add MISP, the desktop Designated Person row should keep these together:

```text
DP Email | DP PAN No | DP Date of Birth | DP Aadhaar Number
```

Do not restore the default two-column PAN span in this row.

---

## 9. Navigation rules

The shared left navigation is primarily defined in:

```text
apps/web-portal/components/claim-manager/app-navigation.tsx
```

Current expected behavior:

- The Intermediatory `Overview` submenu is not visible.
- `/intermediaries` remains a valid route.
- Hover feedback is consistent across Dashboard, top-level sections, group headers, nested links and Settings.
- Active styling remains distinct from hover styling.
- Clicking an expanded top-level section collapses it, including the active section.
- Clicking a collapsed section expands it.
- Route changes automatically open the relevant section.
- Nested groups continue to toggle independently.

Do not reintroduce this old guard:

```tsx
current === section.key && !active ? null : section.key
```

The top-level section must use a true toggle equivalent to:

```tsx
current === section.key ? null : section.key
```

Navigation changes may affect both desktop and mobile consumers of the shared configuration. Verify both.

---

## 10. Server and security conventions

- Prefer server-recognized intent values over arbitrary client redirect values.
- Validate submitted intent against a known set.
- Derive sensitive routing and relationships from database records.
- Preserve authorization/capability checks.
- Never expose service-role keys, passwords or private environment values in code, PR text or documentation.
- Do not weaken validation merely to make a UI flow pass.

---

## 11. Current PAN verification architecture notes

PR #163 changed the PAN verification worker model to use leases and persistent worker sessions.

Relevant web routes:

```text
apps/web-portal/app/api/internal/pan-verification/claim/route.ts
apps/web-portal/app/api/internal/pan-verification/complete/route.ts
apps/web-portal/app/api/internal/pan-verification/heartbeat/route.ts
```

Relevant extension files:

```text
tools/pan-verification-extension/background.js
tools/pan-verification-extension/content.js
tools/pan-verification-extension/manifest.json
tools/pan-verification-extension/service-worker.js
```

The old competing queue reconciler was removed:

```text
tools/pan-verification-extension/queue-reconciler.js
```

Do not restore multiple queue owners without a deliberate architecture decision.

---

## 12. Communicating with the user

The user prefers direct, beginner-friendly updates.

Good progress updates should state:

- what was inspected
- the actual cause
- what will change
- what will remain unchanged
- current validation/deployment state

Avoid unnecessary technical detail unless it affects safety or a decision.

Do not ask for confirmation when the repository can answer the question. Ask only when a business rule, target route or expected behavior is genuinely ambiguous.

After implementation, report:

- exact files changed
- behavior changed
- behavior intentionally unchanged
- validation results
- PR status

Never claim that an unverified migration, extension rollout or production deployment is complete.

---

## 13. Documentation maintenance

Update `HANDOFF.md` when a session introduces important new behavior, migrations, deployment changes, unresolved risks or major PRs.

Update this `AGENT.md` only for durable repository rules. Do not turn it into a chronological activity log.

Keep secrets and personal credentials out of both files.
