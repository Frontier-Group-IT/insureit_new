# Two-Customer Firebase test canary — owner approval 2026-10-16

Owner explicitly confirmed both Customer accounts associated with mobile endings **1014** and **1634** are disposable, including Customer-side policies, vehicles, claims and credentials. This does NOT authorize altering staff accounts sharing their numbers, bulk production migration, deployment, enabling the Firebase bridge globally, or retiring 2Factor.

## Read-only baseline
- 1014: active, confirmed Customer Auth phone, **no approved Firebase UID**, 1 Customer row, 7 vehicles, 1 policy, 2 claims. Same number also belongs to an IT Super User — separate UUID, strictly excluded.
- 1634: active Customer Auth profile, phone unconfirmed in Auth, **one approved Firebase UID**, no linked Customer row/policy/vehicle/claim. Same number also belongs to an Accounts user — separate UUID, strictly excluded.
- Both Customer Auth identities currently have no Auth email and would require same-UUID session-provisioning strategy if using existing bridge.
- Do not delete any linked business data or change customer profile IDs to execute tests.

## Sequence
1. Require actual signed Firebase ID token from the Android test device (revocation-checked, recent phone sign-in) and independent owner-approved link to the *specific Customer UUID*; do not auto-link either shared phone. Run 1634 first due pre-existing link.
2. Verify the approved UID for 1634 exactly matches the signed token. For 1014, obtain independent approval and use service-role atomic enrollment RPC after SQL has been reviewed and explicitly authorized for application.
3. Check customer data access and staff denial (A/B token and UUID isolation), ensure the Customer UUID remains unchanged. Make sure 1634's unconfirmed Auth phone is handled without blindly confirming it.
4. For any password rotation or alias provisioning, use Admin API only with scoped authorization and a defined acceptance that **these two Customer credentials are disposable**. Do not mutate password hashes via SQL; the restoration of original *unknown* credentials is not guaranteed without backup.
5. Verify real refreshable Supabase Auth sessions, Storage/RLS, link concurrency and sign-out/returning-user behavior; record sanitized status and rollback.
6. Halt at the first unexpected UUID, role, phone, permission or token result.

## Tooling limitation and safety
The connected Supabase tools available to this agent do NOT expose Supabase Admin Auth user mutation or Firebase Admin token verification. Read-only SQL cannot substitute for them. Consequently **no Customer Auth identities, Firebase links or service flags were modified** during this handoff. Do not claim real-device Firebase session or canary success without those capabilities. PR remains draft.
