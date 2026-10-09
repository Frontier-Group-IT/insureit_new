# Customer Firebase Phone OTP — production-app implementation staging
Date: 2026-10-08
Status: **PARTIAL / NOT ENABLED** (separate branch; no production changes)

## Why this is not yet a live provider switch
- Browser `/firebase-otp-test` verified Indian SMS delivery. It does not verify native Android.
- The customer mobile app `apps/mobile-app/app/login.tsx` and `signup.tsx` use `sendPhoneOtp` / `verifyPhoneOtp` from `lib/auth.ts`, which currently obtain Supabase Auth user IDs, sessions and refresh tokens. `lib/customer-account-vault.ts`, `lib/startup-routing.ts`, and `lib/supabase.ts` depend on those sessions.
- Supabase official Firebase third-party Auth passes Firebase ID tokens through a Supabase client `accessToken` callback. It does **not** mint the pre-existing user's Supabase Auth session. `auth.uid()` in RLS currently assumes pre-existing Supabase UUID identity; Firebase UID generally is a different format.
- Directly enabling Firebase without revising profile/customer authorization could deny legitimate data or create cross-account exposure.

## Changes introduced in this branch
- `apps/mobile-app/lib/firebase-otp-readiness.ts`: an explicit fail-closed configuration gate for required native, Firebase project, third-party Auth, identity mapping and RLS readiness.
- `apps/mobile-app/lib/firebase-otp-readiness.test.cjs`: negative tests for every missing prerequisite and positive readiness case.
- No login flow switched yet; existing users can still log in as before. No native dependencies, config files or migrations are applied by this staging commit.

## Next exact implementation order (requires config and release decisions)
1. Register Firebase Android app package `com.insureit.mobile`; configure SHA-1/SHA-256 from authorized app-signing keys, phone authentication and Firebase Android config. Do not commit secrets; use approved EAS environment for files.
2. Add compatible `@react-native-firebase/app` and `@react-native-firebase/auth` via Expo installer and lockfile; set required Expo config plugins and `android.googleServicesFile`. The installed binary must eventually be rebuilt (do not trigger APK/AAB until separately authorized).
3. Add Firebase-specific OTP methods under an adapter, preserving current login UI. Avoid importing native libraries into an existing binary before native rollout; gate the cutover.
4. Introduce an additive server-admin-approved mapping from authenticated Firebase UID (issued by the **expected Firebase project**) to existing Supabase profile UUID; deny ambiguous phone matches, duplicate mappings and inactive profiles. Do not trust a mobile-supplied profile ID.
5. Build hybrid authorization functions/RLS in a reviewed migration. Keep current Supabase-authenticated web, partner, staff and customers intact. Audit all direct `auth.uid()` usages, SECURITY DEFINER RPCs, Storage policies and Realtime authorization; a single mapping table is not enough.
6. Use Firebase ID token as the access-token source for Firebase-mode Supabase Data APIs, with separate Firebase auth lifecycle and persisted account switching; never pass Firebase token to `supabase.auth.setSession`.
7. Create isolated/customer opt-in flag; run customer and cross-customer RLS tests, fresh signup, multiple customer accounts, existing account matching, claims/documents and session refresh tests.
8. Run GitHub checks and hold PR unmerged. Later seek explicit approval for migration application, Firebase/Supabase project configuration, native Android build and deployment.

References:
- https://supabase.com/docs/guides/auth/third-party/firebase-auth
- https://docs.expo.dev/guides/using-firebase/
- https://rnfirebase.io/auth/phone-auth

**NEVER state that Firebase OTP integration is live or ready for OTA until all above prerequisites and CI/device checks pass.**
