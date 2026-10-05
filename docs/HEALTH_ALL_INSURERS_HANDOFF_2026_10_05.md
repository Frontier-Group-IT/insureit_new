# Health — All Insurers Selection Handoff (2026-10-05)

## Request
When Policy Type is **Health**, the Insurance Company selector must show **all active insurance companies**, not only insurer records classified as Life/Health. Preserve the existing insurer restrictions for the other policy types.

## Root cause
The web Add Policy flow has a product guard that restricts insurer options by insurer segment. Health was grouped with Life and therefore only Life/Health-segment insurers remained selectable. The Life/Health form itself also starts with the Life/Health subset, while the Add Policy page already has the complete active insurer option list available.

## Implementation
Branch: `fix/health-all-insurers-web-app-2026-10-05`

`apps/web-portal/components/policy-onboarding-product-guard.tsx` now treats Health as the exception:
- Health: inject any missing active insurers from the complete page-level insurer list, then enable/show every insurer option.
- Life: retains the existing Life + Health insurer behavior.
- Motor / Non-Motor: retain the existing General-insurer behavior.

No policy creation payload, insurer master data, database schema, RLS, commercial calculation, OCR, or policy-type persistence logic is changed.

## Native app audit
Customer App `apps/mobile-app/app/customer/add-policy.tsx` already loads the full `insurance_companies` table and only applies text-search filtering; it does not restrict insurer options by Life/Health/general segment. Its current Add Policy flow is vehicle/Motor-oriented and has no Health business-line selector.

Partner App `apps/partner-app/app/policy-intake-new.tsx` currently has no Insurance Company selector, so there is no corresponding Health insurer segment restriction to remove there.

Therefore no native app code change is required for this defect. This avoids introducing artificial or unused mobile logic. If a native Health policy-creation selector is added later, its contract should follow the web rule: Health shows all active insurers.

## Evidence state
**IMPLEMENTED** on the feature branch. PR/CI/merge/deployment pending. No APK/AAB created.