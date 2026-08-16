# Mobile App UI Refinement Continuation Handoff

**Date:** 2026-08-16  
**Scope:** Continuation guide for another AI agent refining the next customer mobile app pages after the individual customer dashboard polish.

This file is intended to be handed to a fresh AI agent. It is not a transcript. It records the current design direction, workflow constraints, verification rules, and next-page refinement priorities.

## 1. Required Reading Before Editing

Before making any mobile changes, read:

- `AGENTS.md`
- `docs/INSUREIT_PROJECT_CONTEXT.md`
- `docs/CURRENT_CHAT_HANDOFF.md`
- `docs/MOBILE_WORKFLOW_UI_REFINEMENT_HANDOFF.md`
- `docs/MOBILE_PREVIEW_UI_HANDOFF_2026-08-15.md`
- `docs/MOBILE_PREVIEW_RELEASE_STATE.md`
- `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`

If the work touches claims, vehicles, policies, external policies, KYC, or self-managed claim flow, inspect the current source before editing. Do not rely on old handoff summaries alone.

## 2. Current Mobile App Context

Primary app:

```text
apps/mobile-app
```

Stack:

- Expo SDK 54 / React Native / Expo Router
- Supabase backend
- Expo preview OTA on branch/channel `preview`
- Runtime version currently used by recent preview updates: `0.2.0`

Current polished customer dashboard file:

```text
apps/mobile-app/app/customer/home.tsx
```

The latest dashboard polish was published to Expo preview:

```text
Code commit: e6de727470b172fe33dbbe4dedca46fe20f76286
Handoff commit: 61b2c63d
Expo update group: d4697442-c16c-4d21-9f39-be36d14a7f6d
Android update: 01a00938-841b-7d99-aba4-c8fa24dd82a0
Message: Finalize customer dashboard polish 2026-08-16
```

No APK build was created for the dashboard refinements. They are JS/UI OTA changes.

## 3. Non-Negotiable Functional Constraints

Preserve the working business logic. The user has already experienced regressions from UI work overriding functional changes.

Do not break:

- Customer-added external policies from `external_policies`.
- Dashboard policy/renewal/protection counts including external policies.
- Start Claim routing for external policies using `externalPolicyId`.
- Self-managed claim creation through `create_self_managed_external_claim`.
- Add Policy flow from a vehicle card with locked/pre-filled vehicle number.
- Add Policy insurer search-first behavior.
- Add Policy policy type dropdown matching web Policy Onboarding types.
- Add Policy auto end-date calculation from start date.
- Optional premium and IDV fields.
- Bottom navigation consistency and keyboard-safe behavior.
- Existing universal customer header spacing/top spacing rules.
- Existing Supabase schemas, RLS expectations, claim statuses, and workflow transitions.

Do not change database schema, Supabase policies, backend RPCs, native dependencies, app config, package versions, or permissions as part of visual polish unless the user explicitly approves that specific change.

## 4. Current Dashboard Design Direction

The individual customer dashboard is now the visual baseline for the next customer pages.

Design qualities to preserve:

- Compact, app-like, not a static website copy.
- Light premium interface: white cards, pale blue surface, navy typography, restrained shadows.
- Dense but readable, with less explanatory text.
- More visual language: icons, compact tickers, status indicators, subtle motion.
- User-facing copy only; avoid explaining how the UI works inside the UI.
- Show real customer state, not decorative fake content.
- Use motion only for attention or live status. Do not animate everything.
- Keep cards compact; avoid oversized hero sections.
- Avoid nested cards and large marketing-style sections.

### Dashboard Components Now Established

Top greeting:

- Greeting line remains strong.
- Attention count is text-like, not a pill/button.
- Sync time is text-like with a small cloud-check icon, not a pill/button.

Fleet summary:

- Title style: uppercase section eyebrow, `YOUR FLEET SUMMARY`.
- Big vehicle count centered in its own left column.
- `Vehicles` label below the count.
- Large vehicle sketch in the top section.
- Coverage circle uses InsureIT blue for covered portion and red for uncovered portion.
- Coverage circle is continuous, not dotted.
- Coverage circle has subtle animated fill.
- Bottom strip shows:
  - If uncovered vehicles exist: animated alert icon plus `N vehicles without active policy`.
  - If all covered: check icon plus `All vehicles are protected`.
- Chevron sits at far right.

Quick Actions:

- Section title uses the same uppercase eyebrow style as Fleet Summary.
- Renewal badge animates subtly only when pending renewal count exists.
- Other badges should remain stable unless there is a strong attention reason.

Claims summary:

- Do not show a single live claim journey on the dashboard.
- The card opens all claims, not only one claim detail.
- Top KPI row: Total, Open, Settled.
- Each KPI uses a distinct background/tone.
- Amounts remain small secondary text.
- Bottom ticker shows pending claim action if needed, otherwise clear state.

Claims Desk:

- Compact.
- Tagline currently: `We are here when it matters`.
- Call, WhatsApp, Ticket actions are flatter, icon-first, without separate boxed backgrounds.

## 5. Next Page Refinement Priority

Proceed page by page. Do not redesign too many screens in one commit unless the user explicitly asks.

Suggested next customer pages:

1. `apps/mobile-app/app/customer/vehicles.tsx`
   - Align list/card styling with dashboard fleet summary.
   - Remove visual clutter and repeated long text.
   - Make vehicle policy/renewal status obvious.
   - Keep add vehicle/add policy actions discoverable.
   - Preserve external policy visibility.

2. `apps/mobile-app/app/customer/vehicle-detail.tsx`
   - Compact, app-like page.
   - Use the same header/top spacing and section styles.
   - Use clear vehicle summary, active policy, renewal, claim history, and document/status zones.
   - Do not hide important actions behind vague menus.

3. `apps/mobile-app/app/customer/policies.tsx`
   - Already redesigned to resemble Claims page; inspect before changing.
   - Refine only if it diverges from the dashboard style.
   - Ensure external policies are still shown.

4. `apps/mobile-app/app/customer/policy-detail.tsx`
   - Match current theme and compact app-page direction.
   - Make renewal, claim, document, insurer, premium/IDV, and vehicle linkage clear.

5. `apps/mobile-app/app/customer/claims.tsx`
   - This is a strong visual reference page according to user preference.
   - Preserve the useful structure.
   - Use it as a pattern for My Policies and related list pages.

6. `apps/mobile-app/app/customer/claim-detail.tsx`
   - Needs careful treatment because claim workflow logic is sensitive.
   - Do not change claim routing or self-managed milestones unless explicitly requested.
   - Make status, pending actions, document requests, and support escalation clear.

7. `apps/mobile-app/app/customer/support.tsx`
   - Align Claims Desk actions with the dashboard style.
   - Use compact contact/action rows.

8. Add Vehicle / Add Policy / KYC pages
   - These already have important working logic from earlier migration.
   - Refine visually only after re-reading the current implementation.
   - Do not reintroduce keyboard/bottom-tab layout bugs.

## 6. UI Implementation Rules

Use existing patterns first:

- `MaterialCommunityIcons` from `@expo/vector-icons`.
- `Animated` for simple, focused attention motion.
- `react-native-svg` is available and is already used in dashboard coverage ring.
- Existing brand assets under:

```text
apps/mobile-app/assets/auth
apps/mobile-app/assets/brand
apps/mobile-app/assets/vehicles
```

Prefer:

- Compact section headers.
- Short labels.
- Status tickers for one-line important status.
- Icon + value pair when it saves text.
- Pull-to-refresh when already present.
- Clear pressed states.
- Animated attention indicators only for actionable issues.

Avoid:

- Large hero cards on operational screens.
- Long explanatory paragraphs on dashboard/list pages.
- Button-looking UI for passive metadata.
- RC numbers or sensitive identifiers on the dashboard when a summary will do.
- Decorative backgrounds that do not communicate state.
- Nested card-in-card layout.
- Excessive gradient/orb decoration.
- One-hue-only palettes.
- Text that can overflow small Android screens.

## 7. Navigation And Routing Rules

Keep tap behavior clear:

- Dashboard Fleet Summary opens vehicles list.
- Dashboard Claims Summary opens all claims list.
- Pending claim ticker can route to upload documents if a pending document task exists.
- Bottom tabs must remain universal and consistent.
- Avoid route changes that go to one specific item when the user expects a list.

Before changing navigation, search for the existing route usage:

```powershell
rg -n "customer/vehicles|customer/claims|claim-detail|externalPolicyId|external_policies|create_self_managed_external_claim" apps/mobile-app
```

## 8. Verification Rules

For every meaningful mobile UI change, run at least:

```powershell
npm --workspace apps/mobile-app run typecheck
npx eslint app/customer/<changed-file>.tsx --quiet
npx expo export --platform android --output-dir dist-android-<short-check-name>
```

If several files are touched, lint all touched files together.

Before claiming an OTA publish succeeded, capture:

- Expo branch
- Runtime version
- Update group ID
- Android update ID
- iOS update ID if published
- EAS dashboard URL if available
- Commit hash

After publishing OTA, tell tester:

- Fully close and reopen the preview app.
- A second close/reopen may be needed after the update downloads.

## 9. Expo / APK Rules

Do not build a new APK for ordinary JS/layout changes.

Use Expo OTA preview for:

- TSX layout changes
- copy changes
- animations
- style changes
- route-level JS behavior that does not require native changes

New APK is required only for:

- launcher icon/native splash assets
- app config that affects native build
- new native permissions
- native dependency/package changes
- runtime version incompatibility
- native startup crash that prevents OTA from loading

Known lesson:

- OTA cannot fix a binary that crashes before JS/OTA loads.
- The previous crash root cause involved native Expo dependency mismatch; do not treat repeated OTA publishing as a fix for native startup crashes.

## 10. Git / Repository Rules

- Work on current `main` unless the user asks for a branch.
- Fetch before pushing because `main` has moved frequently during this workstream.
- If push is rejected, fetch and rebase carefully.
- Do not revert unrelated user/agent changes.
- Ignore existing untracked logs/export folders unless directly relevant.
- Commit code changes separately from handoff/document updates when practical.
- Update this handoff or `docs/MOBILE_PREVIEW_UI_HANDOFF_2026-08-15.md` only for material verified state.

Useful commands:

```powershell
git status --short -uno
git fetch origin main
git rebase origin/main
git push origin main
```

## 11. Current Visual Baseline Checklist For Next Pages

When refining a page, compare it to the dashboard and ask:

- Is the page compact enough for repeated mobile use?
- Is the most important user action visible without reading paragraphs?
- Does the page show real state rather than static filler?
- Are action-required states animated subtly?
- Are passive metadata items styled as text, not buttons?
- Is each section title consistent with dashboard section style?
- Are important statuses in concise chips/tickers?
- Does text fit on small Android screens?
- Is the bottom tab stable when the keyboard opens?
- Did the change preserve external policies and claim workflow logic?

## 12. Good Next Prompt For Another Agent

```text
Read AGENTS.md and docs/MOBILE_APP_UI_REFINEMENT_CONTINUATION_HANDOFF.md first. Then continue customer mobile app UI refinement page by page, starting with the Vehicles list page. Use the current individual customer dashboard as the visual baseline. Preserve all existing business logic, external policy handling, self-managed claim flow, routes, and bottom tab behavior. Make compact, premium, app-like UI improvements only, verify with typecheck, focused ESLint, and Android Expo export, then publish JS-only changes to Expo preview OTA unless a native change is explicitly approved.
```
