# INSUREIT Session Handoff

**Prepared:** 4 August 2026, 14:47 IST  
**Repository:** `Frontier-Group-IT/insureit_new`  
**Primary application:** `apps/web-portal`  
**Production platform:** Vercel  
**Backend:** Supabase

This file is intended to be given to a new ChatGPT/Codex session before continuing work. The next agent should also read the root-level [`AGENT.md`](./AGENT.md) before changing code.

---

## 1. Current production state

The latest requested production deployment completed successfully.

- Latest feature merged: **PR #166 — Allow expanded sidebar sections to collapse**
- PR #166 merge commit: `b3bf3f85fb897c00e9d47b2f6ee17c43e5ba4d53`
- Explicit production trigger commit: `ce86322301e0afd09bce51a35c418572c2730997`
- Vercel status: **Success**
- Vercel deployment: `https://vercel.com/antnish1s-projects/insureit/HDHArn61hAijpVYkPW9HSRfCeD3Z`

### Sidebar behavior now live

- All desktop left-sidebar entries have consistent hover feedback.
- Hover treatment is applied to Dashboard, top-level workspace sections, grouped submenu headers, nested links and Settings.
- Clicking an expanded top-level section such as **Intermediatory** now contracts it, even when that section contains the active page.
- Clicking it again expands it.
- The active route remains highlighted and navigation does not change when a section is contracted.
- Navigating to another page still opens the relevant section automatically.

The shared navigation implementation is in:

```text
apps/web-portal/components/claim-manager/app-navigation.tsx
```

---

## 2. Important production warning

The production release triggered after PR #166 also includes the previously merged **PR #163 — Harden IIB PAN checker queue and result reliability**.

PR #163 introduced a Supabase migration:

```text
supabase/migrations/20260804132000_harden_pan_verification_worker_leases.sql
```

It also changed:

```text
apps/web-portal/app/api/internal/pan-verification/claim/route.ts
apps/web-portal/app/api/internal/pan-verification/complete/route.ts
apps/web-portal/app/api/internal/pan-verification/heartbeat/route.ts
tools/pan-verification-extension/background.js
tools/pan-verification-extension/content.js
tools/pan-verification-extension/manifest.json
tools/pan-verification-extension/service-worker.js
```

and removed:

```text
tools/pan-verification-extension/queue-reconciler.js
```

### Required verification for the next session

Do not assume the PAN checker is fully operational merely because Vercel succeeded. Confirm all of the following before modifying or troubleshooting that workflow:

1. The migration `20260804132000_harden_pan_verification_worker_leases.sql` has been applied to the correct production Supabase project.
2. Browser extension version **1.2.0** is installed where the PAN checker is used.
3. One POSP and one MISP have been manually tested through:
   - pending
   - checking
   - matched or not-found result
4. Abandoned lease recovery has been tested.
5. The website and extension are using the same production environment.

A successful Vercel build does not prove that a Supabase migration was applied or that a locally installed browser extension was updated.

---

## 3. Project and stack

The repository is a monorepo.

```text
apps/web-portal      Next.js web portal
apps/mobile-app      Mobile application workspace
supabase             Database migrations and backend assets
tools                 Supporting tools, including PAN verification extension
```

Common web validation commands from the repository root:

```bash
npm ci
npm run lint:web
npm run typecheck:web
npm run build:web
```

The web portal uses shared components and server actions. UI changes should reuse existing loaders, submit buttons, form validation and routing helpers rather than introducing parallel systems.

---

## 4. Explicit production deployment process

Production deployment is deliberately triggered through:

```text
.deploy/production-trigger.json
```

Ordinary feature commits should not modify this file.

Only update it after the user explicitly says something equivalent to:

- merge and deploy
- deploy now
- finish and deploy

The normal release flow is:

1. Inspect existing implementation.
2. Create a focused branch.
3. Make a minimal change.
4. Run lint, TypeScript and production build.
5. Open a PR.
6. Do not merge until the user asks.
7. Merge with the validated PR head SHA.
8. Update `.deploy/production-trigger.json` with the merged source commit and accurate release scope.
9. Wait until the GitHub/Vercel commit status is **success**.
10. Only then report the deployment as successful.

Never claim production success while Vercel is still pending.

`vercel.json` currently allows normal `main` deployments and disables Git deployment for `work-*` branches.

---

## 5. Recent completed Intermediatory work

### PR #154 — Loading and interaction feedback

- Reused `FormSubmitButton` and `InsureItButtonLoader`.
- Added pending labels for creating POSP/MISP IDs, creating users and resending links.
- Avoided duplicate spinners where a full-screen or existing pending state already existed.
- Key shared file:

```text
apps/web-portal/components/form-submit-button.tsx
```

### PR #158 — Add MISP Designated Person layout

The Designated Person row was balanced so these fields remain on one desktop row:

```text
DP Email | DP PAN No | DP Date of Birth | DP Aadhaar Number
```

PAN no longer consumes the default two-column span in this section.

### PR #159 — Save & Exit

Added **Save & Exit** beside **Save & return to documents** on:

- Add POSP
- Add MISP
- Add Existing POSP
- Add Existing MISP
- Edit Details

Both buttons enforce the same mandatory validation and persistence logic.

Redirect behavior after successful **Save & Exit**:

- Add and Add Existing pages → Onboarding Applications
- Edit Details → related Partner Review page

The edit route resolves the related parent Partner from database-owned linkage data rather than accepting an arbitrary client redirect.

### PR #160 and PR #162 — Application Review next step

- Removed the duplicate **Continue documents** button from the blue review header.
- Replaced the large Next Step card with a compact primary action bar.
- Kept one **Complete documents** action.
- Guidance mentions Aadhaar, PAN, bank proof, photograph and GST certificate when applicable.

### PR #164 — Remove Intermediatory Overview submenu

- Removed the visible **Overview** submenu from desktop and mobile shared navigation.
- The `/intermediaries` route itself remains available.

### PR #165 — Sidebar hover consistency

Applied consistent hover and focus treatment to:

- Dashboard
- Top-level workspace sections
- Group headers
- Nested submenu links
- Settings

The treatment includes subtle background highlight, slight horizontal movement, icon response, chevron movement, soft shadow, focus ring and reduced-motion support.

### PR #166 — Allow top-level section collapse

Changed the top-level section toggle from logic that prevented the active section from collapsing to a true open/close toggle.

Expected behavior:

```text
expanded + click → collapsed
collapsed + click → expanded
```

---

## 6. Key Intermediatory routes and behavior

Common route areas:

```text
/intermediaries
/intermediaries/partner
/intermediaries/posp
/intermediaries/misp
/intermediaries/applications/[id]
/customers/posp-misp
```

Intermediatory navigation is generated from the shared navigation configuration. Changing that file affects desktop and, depending on consuming components, may also affect mobile navigation. Always verify both.

The application review page is the central Partner review screen. The document action should exist only in the compact primary action section, not duplicated in the blue summary header.

---

## 7. Shared UI rules established during this session

- Reuse `FormSubmitButton` for form submissions that need pending feedback.
- Reuse `InsureItButtonLoader`; do not create a second spinner system.
- Do not stack a button spinner on top of an existing full-screen progress overlay.
- Pending state must disable repeated submissions.
- UI-only requests should not alter field names, validation, database mapping or server behavior unless explicitly required.
- Keep desktop layouts compact and professional while preserving responsive tablet/mobile behavior.
- Do not use vague or generic filler text in primary action sections. Use workflow-specific copy.
- Keep active navigation styling distinct from hover styling.
- Keyboard focus states and reduced-motion behavior should remain supported.

---

## 8. Useful files to inspect first

```text
apps/web-portal/components/claim-manager/app-navigation.tsx
apps/web-portal/components/form-submit-button.tsx
apps/web-portal/components/loading/insureit-loader.tsx
apps/web-portal/app/intermediaries/intermediary-register.tsx
apps/web-portal/app/intermediaries/applications/[id]/page.tsx
apps/web-portal/app/intermediaries/applications/[id]/id-success-modal.tsx
.deploy/production-trigger.json
vercel.json
```

For PAN verification work:

```text
apps/web-portal/app/api/internal/pan-verification/claim/route.ts
apps/web-portal/app/api/internal/pan-verification/complete/route.ts
apps/web-portal/app/api/internal/pan-verification/heartbeat/route.ts
supabase/migrations/20260804132000_harden_pan_verification_worker_leases.sql
tools/pan-verification-extension/
```

---

## 9. Working style expected by the user

The user is not a developer and prefers clear, direct status updates.

When implementing:

- Inspect first and explain the cause in plain English.
- Avoid asking questions when the repository can resolve the ambiguity.
- Ask before implementation only when a business rule or redirect target is genuinely unclear.
- Do not merge or deploy unless explicitly requested.
- After implementation, state exactly what changed, what was not changed, validation results and PR status.
- After deployment, provide PR, merge commit, production trigger, Vercel status and deployment link.

---

## 10. Recommended opening message for the next chat

The user can paste this into a new chat:

```text
@GitHub Please read HANDOFF.md and AGENT.md from the root of Frontier-Group-IT/insureit_new before doing anything. Confirm the current production state, note the Supabase migration warning for PR #163, and then wait for my next command.
```

---

## 11. Current unresolved checks

At the moment this handoff was prepared:

- Vercel deployment for trigger `ce86322301e0afd09bce51a35c418572c2730997` was confirmed successful.
- Application of the PR #163 production Supabase migration was **not independently confirmed in this chat**.
- Manual installation/testing of PAN verification extension version 1.2.0 was **not independently confirmed in this chat**.

The next agent must be transparent about these two unknowns rather than assuming completion.
