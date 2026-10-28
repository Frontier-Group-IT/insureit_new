# INSUREIT Customer iOS OTA-parity release preparation — 2026-10-24

## Source of truth
Android live binary: production 0.3.0 (9), EAS build d937d9ff-a28e-422b-b926-1fc2c07bd73d, original commit ac806be.
User-confirmed latest Android production OTA: group 23672b89, 2026-10-23 13:09, runtime 0.3.0, commit 38608fe5009e4c5365a7a800e6efa64db0bc2edd.
The iOS release branch was created directly from CURRENT main, which is ahead of and contains the OTA commit, to avoid losing OTA fixes. Final binary must bundle latest verified app source, NOT the original September binary source. Inspect changes on main later than the OTA commit before release.

## Configuration
iOS app name INSUREIT Customer, version 0.3.0, build 1, bundle identifier com.insureit.mobile.
EAS production profile: store distribution, real iOS device (simulator false), production channel.
Android package, version code 9 and Android production release unchanged.

## Verified source details
Existing Customer login and registration use Supabase SMS OTP from apps/mobile-app/lib/auth.ts, not Firebase. Do not integrate Firebase phone OTP.
Account deletion exists: Profile -> Request account deletion -> /customer/account-deletion, creates a support_tickets request, provides confirmation and public fallback. Still test successful request processing against permissions and deletion fulfillment.

## Remaining release gates (NOT yet passed)
- [ ] Confirm OTA group 23672b89 is most recent at release time; freeze release candidate SHA.
- [ ] Inspect all Customer changes after OTA group and ensure they are compatible with the Android live experience and iOS native capabilities.
- [ ] npm ci; run mobile lint/typecheck and expo-doctor on release commit.
- [ ] Complete iOS signed production EAS build and inspect EAS native build logs.
- [ ] Test login, OTP, persisted sessions and account deletion on real iPhone with a synthetic test account.
- [ ] Test vehicle/policy/claims/documents uploads, voice note, photo picker, location and customer-specific data access.
- [ ] Verify iOS signing, icon, permissions, App Store privacy disclosures, screenshots, app age rating, reviewer test access and insurer/broker documentation.
- [ ] Test App Store/TestFlight binary before submission.

No APK/AAB or public release should be created as part of iOS preparation. Do not submit to Apple while native/testing gates remain incomplete.
