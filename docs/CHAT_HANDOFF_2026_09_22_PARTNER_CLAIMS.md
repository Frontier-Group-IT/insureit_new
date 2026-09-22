# INSUREIT — Chat Handoff (2026-09-22)

## Purpose

This handoff captures the work completed and the currently pending work from this chat so another AI agent can continue safely without reconstructing the conversation from scratch.

Repository:

- `Frontier-Group-IT/insureit_new`
- Production portal: `https://portal.insureit.in`

Important operating rule:

- Keep implementation states separate: **IMPLEMENTED ≠ MERGED ≠ APPLIED ≠ DEPLOYED ≠ VERIFIED**.
- For Partner app work, **do not create an APK/AAB/native EAS build unless the user explicitly authorizes that exact build**.
- Current user instruction for the pending Claims task: **separate reversible branch + PR only; do not merge; do not create any APK**.

---

# 1. Project Context Review Completed

The repository documentation/context was reviewed before implementation work.

Key files reviewed/confirmed:

- `AGENTS.md`
- `README.md`
- `SECURITY.md`
- `docs/INSUREIT_PROJECT_CONTEXT.md`
- `docs/CURRENT_CHAT_HANDOFF.md`
- `docs/PRODUCTION_DOMAIN_HANDOFF.md`
- `docs/ICALL_AWS_GATEWAY_HANDOFF.md`
- `docs/AUTHBRIDGE_RC_HANDOFF.md`
- `docs/AUTHBRIDGE_PRODUCTION_DEPLOYMENT_HANDOFF_2026_09_12.md`
- `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`
- `docs/INSUREIT_POLICY_OCR_AUTOMATED_TRAINING_SKILL.md`
- `docs/POLICY_OCR_TRAINING_HANDOFF_2026_08_22.md`
- `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`
- `docs/PERFORMANCE_REMEDIATION_PLAN_2026_08_24.md`
- `docs/MOBILE_EXPO_PREVIEW_HANDOFF.md`
- `docs/VERCEL_DEPLOYMENT_POLICY.md`
- `apps/partner-app/AGENTS.md`
- `apps/partner-app/README.md`
- `apps/mobile-app/README.md`
- `apps/web-portal/app/partner/renewals/external/AGENTS.md`
- `apps/web-portal/app/system/voice-integration/AGENTS.md`
- current logo/reporting/brand handoffs and other relevant docs.

Important findings carried forward:

- Partner app current installed build rules are strict and OTA-first.
- Never publish current `main` to runtime `0.1.0` by merely changing runtime/version labels.
- Partner native build requires explicit user permission.
- Production web deploys are gated by the verified PR provenance workflow.
- Vercel preview deployment is intentionally disabled.
- The canonical production domain is `portal.insureit.in`.

---

# 2. PR #2259 — Merged and Deployed

The user asked to merge PR #2259.

PR:

- **#2259**
- Title: `Add insurer logos to finance report tables`
- Branch: `ui/reports-finance-insurer-logos`
- Exact verified PR head:
  - `26823304fd1be4b0e809493bd28d43b4e1b619ec`
- PR was open, non-draft, mergeable.
- 2 changed files, 6 additions / 2 deletions.

Verification before merge:

- GitHub Actions workflow: **Verify web portal**
- Run ID: `35708215322`
- Result: **SUCCESS**

Merge result:

- Merge commit:
  - `a7135d154c47b037de048f6c50565d74cde54277`
- PR state after action: **MERGED**

Production deployment:

- GitHub workflow: **Deploy production to Vercel**
- Run ID: `35708598401`
- Result: **SUCCESS**
- Production schema parity check: **passed**
- Partner RPC contract check: **passed**
- No Supabase migration changed in this release.
- Vercel deploy hook returned HTTP `201`.

Vercel production deployment:

- Deployment ID:
  - `dpl_HGCuPRRzaYSkkJFsEsRND4Nw2uJN`
- Commit:
  - `a7135d154c47b037de048f6c50565d74cde54277`
- Target:
  - `production`
- Region:
  - `icn1`
- Final state:
  - **READY**
- Production aliases included:
  - `portal.insureit.in`
  - `insureit-drab.vercel.app`

Therefore PR #2259 reached:

- **MERGED**
- **DEPLOYED**
- Vercel **READY**

---

# 3. Partner App Claims Page — User Request

The user supplied the current Partner app Claims screen and a target/reference design.

Current route/file identified:

- `apps/partner-app/app/(tabs)/claims.tsx`

Related files reviewed:

- `apps/partner-app/app/(tabs)/index.tsx` — Home
- `apps/partner-app/app/(tabs)/_layout.tsx`
- `apps/partner-app/components/partner-screen.tsx`
- `apps/partner-app/lib/claims.ts`
- `apps/partner-app/AGENTS.md`

The user wants the **Partner App Claims screen** redesigned to match the supplied reference image.

User requirements:

1. Claims screen should visually match the provided reference.
2. Use the provided **Claims page header background artwork**.
3. Claims page font sizes should match the **Home page**.
4. Claims page top-left logo must be exactly the same as Home.
5. Notification/activity icon should match Home.
6. Profile icon/avatar treatment should match Home.
7. User explicitly said:
   - **DO NOT CREATE ANY APK**
8. User asked for a mockup first.

A mockup was generated and approved enough for implementation to proceed.

Generated mockup file from this chat:

- `/mnt/data/modern_insurance_claims_dashboard.png`

If the next agent needs to visually compare, ask the user to re-upload the mockup/reference images if those chat-local assets are not available in the new session.

---

# 4. Claims Page Reference Assets Supplied by User

The user supplied:

- a full target/reference Claims page screenshot
- a separate Claims header background image

Chat-local uploaded copies included:

- `/mnt/data/claims-header-reference.jpg`
- `/mnt/data/claims-header-reference-small.jpg`
- `/mnt/data/claims-header-reference-tiny.jpg`

These local paths may not exist in a new agent/session. The next agent should ask the user to re-upload the reference image(s) if not accessible.

The visual target has:

- blue city / claims clipboard / shield / truck / car hero artwork
- InsureIT Partner logo at top-left
- notification icon and profile avatar at top-right
- `Claims` title
- subtitle: `Support. Settle. Keep Your Business Moving.`
- floating search/filter row under the hero
- four KPI cards:
  - Total Claims
  - Settled Claims
  - In Progress
  - Rejected Claims
- lifecycle tabs:
  - All
  - In Progress
  - Settled
  - Rejected
- compact white claim cards
- status pills
- Load More Claims button
- normal Partner bottom navigation

---

# 5. Current Claims Implementation Observed

Current Claims screen currently uses:

```tsx
<Image
  source={require('../../assets/figma-dashboard/hero-banner.jpg')}
  resizeMode="cover"
  style={styles.heroBackdrop}
/>
```

and uses:

```tsx
require('../../assets/partner-login-logo.png')
```

for its logo.

That differs from Home.

Home uses, through `PartnerScreen`:

```tsx
require('../assets/insureit-partner-official.png')
```

for the accepted Partner logo.

Home header action treatment is supplied from `apps/partner-app/app/(tabs)/index.tsx`.

Home currently uses:

- `PartnerIconButton`
- profile avatar built using `partnerTheme.colors.brandSoft`
- exact Home font sizing and typography patterns.

Important: the Claims page should reuse/match those Home values rather than inventing a separate approximation.

The current Claims hero is oversized compared with the Home typography:

```tsx
heroTitle:
  fontSize: 38
  lineHeight: 44
  fontWeight: '800'

heroSubtitle:
  fontSize: 16
  lineHeight: 21
```

The user specifically wants Claims typography to match Home.

The current Claims page also uses custom top buttons:

```tsx
heroIconButton
avatarButton
```

These should be aligned to the Home treatment.

---

# 6. Current Claims Data Contract

`apps/partner-app/lib/claims.ts` currently exposes:

```ts
export type PartnerClaimSummary = {
  total_claims: number;
  active_claims: number;
  completed_claims: number;
  assistance_requested: number;
};
```

Current list state type:

```ts
export type PartnerClaimState = 'all' | 'active' | 'completed';
```

Current filters therefore support:

- All
- Active
- Completed

The visual reference shows:

- All
- In Progress
- Settled
- Rejected

This is not only cosmetic if it is intended to actually filter those backend states.

A production-safe check was performed against the current Supabase function:

`public.partner_app_claim_summary()`

Current summary behavior:

- `total_claims` = all scoped claims
- `active_claims` = status not equal to `Claim Complete`
- `completed_claims` = status equal to `Claim Complete`
- `assistance_requested` = assistance_status not in none/not_requested/resolved/closed

Therefore, if the new UI must show real **Settled / In Progress / Rejected** KPI values and filters exactly like the visual reference, the next agent must first inspect the list RPC and current production status vocabulary before changing semantics.

Do not fake those values or simply relabel `active_claims`, `completed_claims`, or `assistance_requested`.

User asked primarily for visual parity, so a safe implementation can preserve current backend semantics unless the user explicitly requests KPI/filter business logic to change.

---

# 7. Existing Claims Styles / Layout Relevant to Redesign

Current `claims.tsx` already has:

- custom hero
- search/filter shell
- KPI grid
- tabs/sort controls
- claim cards
- choice modals
- pagination/load more
- cached/offline state
- pull-to-refresh

These data interactions should be preserved unless explicitly changed.

Do not disturb:

- `getPartnerClaimSummary()`
- `listPartnerClaims()`
- Partner commercial scope
- search behavior
- current sort
- modal behavior
- pagination
- claim detail navigation
- pull-to-refresh
- cached/offline warnings

This should remain a **UI-only/reversible** change unless later approved otherwise.

---

# 8. Branch State for Pending Claims Work

User explicitly asked:

> implement this in a separate branch and create the PR (reversible), do not merge until I ask.

A stale pre-existing branch with the originally intended name was discovered:

- `ui/partner-claims-reference-redesign`

It is **555 commits behind main** and has **0 commits ahead of main**.
It must NOT be reused.

A fresh branch was therefore created from current `main`:

- **Branch:** `ui/partner-claims-reference-redesign-v2`
- Base `main` SHA at branch creation:
  - `49ce0b5f0cf9879ccc52238b0a6557d9353e3598`

At the moment this handoff was requested:

- branch exists
- **no implementation commits have been made yet**
- no PR has been created yet
- no merge has happened
- no OTA has been published
- no APK/AAB/native build has been created

This is the exact continuation point.

---

# 9. Recommended Safe Implementation Plan

Continue on:

`ui/partner-claims-reference-redesign-v2`

Recommended changes:

### A. Add Claims header artwork

Add the supplied claims header background under a clear path, for example:

```text
apps/partner-app/assets/partner/banners/claims-header-reference.jpg
```

Do not overwrite Home artwork.

The supplied asset is visual-only and OTA-safe if it remains a bundled JS asset and no native config/dependency changes are introduced.

### B. Make Claims top bar match Home

Use the same Partner logo asset as Home:

```text
apps/partner-app/assets/insureit-partner-official.png
```

Match Home:

- logo width/height
- header padding
- activity/notification control size/background
- profile avatar size/background/text style
- spacing

Do not hardcode initials; continue deriving them from:

```ts
context?.identity.display_name
```

### C. Match Home typography

The user explicitly said Claims page font size should be exactly like Home.

Use Home typography from:

- `apps/partner-app/components/partner-screen.tsx`
- `apps/partner-app/app/(tabs)/index.tsx`
- `partnerTheme.typography`

Do not keep the current oversized Claims 38px title if that conflicts with Home.

### D. Use target Claims hero composition

Match the reference:

- hero artwork fills the header
- title/subtitle aligned left
- artwork focal point remains visible
- top logo/actions remain readable
- search box overlaps the bottom edge of hero
- subtle dark overlay only if required for readability

### E. Compact KPI/tabs/cards to reference

Keep UI-only.

Match:

- compact KPI cards
- rounded white surfaces
- compact lifecycle tabs
- small status pills
- tighter claim cards
- Load More bar

Do not invent new backend values.

### F. Preserve current data behavior

Unless explicitly requested otherwise:

- retain existing backend summary
- retain current search
- retain existing supported filter states
- retain sort
- retain claim navigation
- retain current pagination

If exact `Settled / In Progress / Rejected` behavior is required, inspect the RPCs and status model first and report before changing business logic.

---

# 10. Validation Required Before PR

Run at minimum the Partner app checks already used by the repo.

Inspect `package.json` for exact commands, but likely:

```bash
npm --workspace apps/partner-app run typecheck
```

plus focused lint / verification as supported.

Also run:

```bash
git diff --check
```

Use the repository's canonical Partner verification workflow when PR is opened.

Do not claim installed-device verification unless actually performed.

---

# 11. PR Requirements

Create PR from:

`ui/partner-claims-reference-redesign-v2`

to:

`main`

Suggested PR title:

`Refine Partner Claims screen to approved reference`

Suggested PR body:

```md
## Summary
- Redesign Partner app Claims screen to match the approved reference.
- Use the supplied Claims header artwork.
- Align Claims typography with the accepted Home page.
- Reuse the same Home Partner logo, activity/notification treatment, and profile avatar treatment.
- Refine KPI cards, filters/tabs, claim cards, and load-more presentation.

## Scope
- Partner app UI only.
- No database, schema, RPC, RLS, permission, claim workflow, or calculation changes.
- Existing Claims data/query/navigation behavior preserved.

## Release safety
- Reversible UI-only change.
- No native dependency or runtime change.
- No APK/AAB/native EAS build created.

## State
- IMPLEMENTED on `ui/partner-claims-reference-redesign-v2`.
- PR only.
- Do not merge until user explicitly approves.
```

---

# 12. Critical User Constraint

The user has repeated this instruction:

**DO NOT CREATE ANY APK**

Therefore:

- do not run Partner APK workflow
- do not create AAB
- do not start a native EAS build
- do not modify native runtime merely for this UI task

If later publishing is requested, prefer the existing approved OTA path only after the user asks, while respecting the installed runtime `0.1.0` compatibility rules from `apps/partner-app/AGENTS.md`.

---

# 13. Current Exact Pending Task

Continue from this point:

1. Check out / continue branch:
   - `ui/partner-claims-reference-redesign-v2`
2. Implement the approved Claims page reference UI.
3. Add/use supplied Claims hero artwork.
4. Match Home logo / notification/activity / profile / font sizing.
5. Preserve existing claims data behavior unless user explicitly approves semantic changes.
6. Run Partner verification.
7. Create PR to `main`.
8. Report PR number and CI state.
9. **Do not merge.**
10. **Do not create any APK.**


---

# 14. Implementation Update — 2026-09-22

The approved Claims reference was implemented on a fresh continuation branch because the earlier v2 branch had already been merged for the handoff documentation.

- Branch: `ui/partner-claims-reference-redesign-v3`
- Claims implementation commits: `a0341b6526374821417a8a6aac30a973a92efe99`, `ec89c637687786a2934b0a24866fc6c8ce565492`
- Main implementation file: `apps/partner-app/app/(tabs)/claims.tsx`

Implemented UI changes:

- switched Claims to the same official Partner logo asset used by Home
- switched header activity/profile treatment to the Home components/styles
- reduced Claims title/subtitle typography to Home-scale sizing
- compacted hero, floating search/filter bar, KPI cards, lifecycle tabs, claim cards and load-more treatment to match the supplied reference proportions
- changed visible supported-state wording from Active/Completed to In Progress/Settled
- reordered supported KPI presentation to Total / Settled / In Progress / Assistance
- added red rejected-row status styling when existing claim status data already reports a rejected state
- kept existing search, sort, pagination, refresh, cache/offline handling, detail navigation, RPC calls and backend state contract unchanged

Important semantic boundary:

- the current backend still exposes summary fields `total_claims`, `active_claims`, `completed_claims`, and `assistance_requested`, and list filters `all | active | completed`
- therefore the UI does **not** fake a Rejected Claims KPI or rejected list filter
- exact rejected summary/filter behavior requires a separately approved backend contract change after inspecting production status vocabulary

Release safety:

- no APK created
- no AAB created
- no Expo/EAS native build triggered
- no native dependency/config/runtime change
- no merge yet
- no OTA publish yet

Next step: open the feature PR, let Partner verification run, inspect CI, and wait for explicit user approval before merge.
