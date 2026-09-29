# Life / Health Policy Onboarding architecture handoff — 2026-09-29

## Scope

This note records the structural correction for the Life and Health workflow on `/policies/new`.

- Branch: `fix/life-health-native-onboarding-architecture`
- Pull request: #2586
- Evidence state at this note: **IMPLEMENTED**; final PR verification, merge, deployment and authenticated production visual verification remain separate states.
- No database, migration, RLS, policy-booking RPC, OCR parser, claims, payout, mobile, APK or AAB change is part of this work.

## Verified root cause

The Life/Health UI was not actually part of the normal `PolicyUnifiedForm` render tree. `PolicyUnifiedForm` rendered a development placeholder for Life and Health; `PolicyOnboardingProductGuard` then searched the DOM for that placeholder, hid it, created a new mount node, and `createPortal()` mounted `LifeHealthPolicyForm` into the new node. Additional MutationObserver and CSS width-rescue layers attempted to stretch that injected subtree.

That architecture allowed the Life/Health content to shrink independently from the shared Policy Onboarding workspace, which is why repeated width-only fixes could still leave a large unused area on desktop.

## Implemented correction

1. `PolicyUnifiedForm` now has an explicit Life/Health render branch and imports/renders `LifeHealthPolicyForm` directly.
2. The shared Policy source & ownership section remains owned by `PolicyUnifiedForm`, so Motor, Non-Motor, Life and Health share the same top source state and layout.
3. `LifeHealthPolicyForm` receives a typed source snapshot through React props. It no longer reconstructs Policy Issuance Date, Intermediary Type or Lead Source with `document.querySelector()`.
4. The selected RM employee ID is rendered natively in the shared source section; the Life/Health DOM enhancement observer is no longer required.
5. `PolicyOnboardingProductGuard` no longer creates/removes Life/Health mount nodes and no longer portal-mounts Life/Health. Its existing Motor SAOD / Third Party protections remain.
6. The shared onboarding root is explicitly `w-full max-w-[1480px]`.
7. Life/Health keeps its intended responsive layout: flexible form content plus a fixed 336px onboarding-summary rail on desktop.
8. Life/Health card IDs now match the navigation targets (`policy-section-1` through `policy-section-4`).
9. The obsolete `policy-summary-width.css`, Life/Health portal rescue selectors in `policy-summary-stability.css`, and `policy-life-health-onboarding-enhancements.tsx` have been removed.

## Regression protection

`apps/web-portal/scripts/life-health-native-onboarding-regression.mjs` is part of the canonical `Verify web portal` workflow. It guards the architecture, including:

- direct Life/Health render from `PolicyUnifiedForm`;
- explicit full-width shared workspace;
- source state passed as props rather than recovered from the DOM;
- no Life/Health `createPortal()` mount in the product guard;
- no legacy Life/Health mount helpers / rescue selectors / MutationObserver bridge;
- correct section navigation IDs.

## Verification / release discipline

Do not call this live merely because PR #2586 is green or merged.

- **IMPLEMENTED** = feature-branch code committed.
- **MERGED** = PR #2586 merged to `main` after the canonical verification gate.
- **DEPLOYED** = the explicit production deployment workflow/Vercel reports Ready for the exact merged commit.
- **VERIFIED** = authenticated `/policies/new` production UI is directly checked at desktop width with both Life and Health selected and the form visibly consumes the normal workspace width without portal/rescue behavior.

No production deployment is authorized by this handoff alone; follow the repository deployment protocol and user instruction.
