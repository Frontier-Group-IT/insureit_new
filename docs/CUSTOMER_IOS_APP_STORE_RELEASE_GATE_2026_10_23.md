# INSUREIT Customer — First iOS App Store Release Gate (2026-10-23)

## Release identity
- Android live reference: 0.3.0 (9), unchanged.
- iOS version: 0.3.0; first build: 1; bundle: com.insureit.mobile.
- EAS project: aadcb7a5-072b-4bf9-bc81-c52fabdd5caa; production channel.
- iOS supportsTablet=false. Use genuine iPhone screenshots from the final tested binary.

## Mandatory gates before EAS iOS production build
- [ ] Validate latest main/mobile dependencies and app.json using Expo config diagnostics, dependency consistency, typecheck and lint.
- [ ] Run production iOS build and on-device smoke test (real iPhone) without modifying Android binary.
- [ ] Preserve and test the SAME authentication methods that ship in the live Android 0.3.0 (9) build: customer registration, login, session persistence, logout/re-login, recovery, and denied-permission behavior. Do NOT add Firebase OTP or a new OTP flow to iOS.
- [ ] Verify the authentication code and dependencies of the final iOS binary against Android's current production flow; do not assume an earlier Firebase PR represents the shipped Android build.
- [ ] Test own-data authorization; vehicle add/view/edit, policy add/view/copy upload, claim without policy/expired policy, nine-stage claim editing, documents, microphone, and support/navigation.
- [ ] Confirm usable in-app account deletion initiation (not merely logout/deactivation) with legal retention explanation; conduct safe test only with dedicated test accounts.
- [ ] Audit microphone, location, camera/photos, files, notifications and any tracking/analytics declarations against real code.
- [ ] Confirm no broken URL, placeholder, test credentials or debug controls in released binary.
- [ ] Verify Sign in with Apple applicability based on all actual sign-in methods; don't claim a blanket exemption without review.
- [ ] Check accessibility, iPhone screen sizes, keyboard/safe-area, offline/error states.
- [ ] Verify app icon (1024px nontransparent), splash, version/build, bundle registration, signing credentials, correct Apple developer team.

## Required App Store Connect preparation
- [ ] Create distinct Customer app record, exact bundle identifier and SKU.
- [ ] Use organization legal identity; verify authority to offer insurance-related customer services and attach legal/authorization evidence where needed.
- [ ] Prepare accurate English (India) app name, subtitle, keywords, description, support URL, privacy policy URL, copyright and contact.
- [ ] Complete App Privacy according to SDKs, backend, collected identity/contact, user-provided documents, location, diagnostics and retention; declarations must be independently checked.
- [ ] Complete age rating, content rights, encryption/export compliance, territory/pricing, availability and account deletion disclosures.
- [ ] Capture final binary's actual non-misleading iPhone screenshots and check Apple's current screenshot dimensions; at least one required Dynamic Island iPhone set.
- [ ] Create reviewer demo account containing synthetic representative vehicle, policy and claim records; no real customer data.
- [ ] Make login possible throughout review without requiring any unavailable verification or manual intervention; provide test phone/credentials and explicit reviewer steps securely in App Store Connect, not GitHub.
- [ ] Reviewer notes must explain business model, customer self-registration, claim workflow, third-party services, insurance brokerage company and authorization evidence.
- [ ] Confirm all links and reviewer account work from an external network.

## iOS build command after audit passes
Run from repository root with approved Apple credentials and Expo account:
```bash
npm ci
npm run typecheck:mobile
npm run lint:mobile
cd apps/mobile-app
npx expo-doctor
npx eas-cli build --platform ios --profile production
```
The production EAS profile explicitly specifies store distribution, a real-device iOS binary, and keeps autoIncrement disabled so build 1 stays intentional. For subsequent uploads increment iOS buildNumber. Do not use an Android build command.

## Evidence and open verification
- [x] iOS display name changed to INSUREIT Customer (isolated release branch).
- [x] Initial iOS build number set to 1 (isolated release branch).
- [x] Expo production profile now explicitly targets iOS App Store real devices.
- [x] GitHub mobile CI passed on prior release-branch commit (run #1621); recheck latest commits after changes.
- [ ] Confirm real Android production authentication UI and logic matches proposed iOS exactly. Firebase OTP is **out of scope**, and must not be included.
- [ ] Inspect implementation of account deletion; add accessible deletion entry point and server-side flow if missing.
- [ ] Validate iOS native signing, successful compiled artifact and actual device testing; cannot infer from TypeScript checks.
- [ ] Validate App Store-facing assets, privacy disclosures and reviewer-access instructions with business owner.
- [ ] App Store Connect upload and submission are prohibited until verification is complete.

## Inspected source evidence (2026-10-24)
- `apps/mobile-app/app/login.tsx` and `signup.tsx` call `sendPhoneOtp`, `sendPhoneSignupOtp`, and `verifyPhoneOtp` from `lib/auth.ts`. These are Supabase authentication flows, NOT Firebase. Keep them unchanged. Apple reviewer demo must be able to receive valid Supabase SMS OTP or receive an approved alternative test sign-in flow before submission.
- `apps/mobile-app/app/customer/profile.tsx` Account & Privacy links to the Legal Center. No self-service account-deletion button was found in this inspected screen; `apps/mobile-app/app/customer/legal/index.tsx` only lists legal documents. Confirm whether account deletion is supported elsewhere and implement a secure deletion-initiation mechanism if absent. Do NOT assume sign-out or local session removal equals account deletion.
- Latest release branch CI successfully completed mobile run #1623 and web run #7071 at commit `0257fd77c5aa997662e9e99b064878f4594e3e27`.
- Passing JavaScript CI is not an iOS binary, Apple signing, privacy review, or a real iPhone smoke test.
- DO NOT falsely mark the above outstanding items as complete.

## No-submit policy
Never submit or upload solely because config passed. Block release until all gates above are checked with recorded evidence. The Partner app remains untouched. An Apple approval on first submission cannot be guaranteed.

## Release sequence
1. Review and merge preparation PR after code review.
2. Run release-blocking checks; fix identified gaps with separate scoped changes.
3. Build and upload only an approved release candidate to TestFlight; test on real devices.
4. Complete App Store Connect and submit once review access and regulated-service documents are verified.
