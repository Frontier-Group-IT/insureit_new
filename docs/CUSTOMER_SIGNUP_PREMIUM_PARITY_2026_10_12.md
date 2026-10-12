# Customer Signup premium Login layout parity — 2026-10-12

Branch: `ui/customer-signup-premium-parity-20261012`.

## Scope
Signup now uses the same outer responsive two-panel composition, dark navy geometric gradient, branded left hero/benefit cards, white form card, and trust footer as the current Customer Login. The existing Signup card remains wider/taller as needed for name/mobile/optional email and OTP state. The lower callout links back to `/customer/login`.

## Preserved behavior
No modifications to `customer-signup-form.tsx`, login form, phone field, signInWithOtp/verifyOtp contracts, account selection/linking RPCs, session creation, customer authorization, or signup master-data creation. UI-only; no DB/RLS/migration/OTA/native changes.

## Test and release
`customer-signup-premium-parity-regression.mjs` is wired to Verify web portal CI. Real authenticated browser QA for desktop/mobile, signup OTP, existing-account selection and Login navigation is still required. No automatic merge/deploy authorization. Rollback: revert this UI-only PR.

## Existing artwork limitation
The current premium Login uses CSS gradient rather than the previously approved truck image. Signup mirrors the **actual current Login design**; image asset upload is a separate outstanding task. Do not claim identical photographic backgrounds are live.
