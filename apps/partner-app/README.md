# INSUREIT Partner

Separate Expo application for Partner/POSP/MISP and authorized commercial employee users.

## Environment

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_PORTAL_URL` (optional; defaults to `https://portal.insureit.in` for the Policy Intake API)

The app never uses a service-role key.

## Current foundation

- separate Android/iOS package identity: `com.insureit.partner`
- persistent Supabase session
- secure native session storage through Expo SecureStore
- authenticated Partner identity bootstrap
- first-login intermediary activation contract
- server-authorized commercial scope bootstrap
- fail-closed access-denied state

## Release configuration

The repository now contains separate Partner EAS profiles:

- `preview`: internal Android APK on the `preview` channel
- `production`: production channel with independent native versioning
- runtime version policy: `appVersion`
- Android package: `com.insureit.partner`
- iOS bundle ID: `com.insureit.partner`

The Partner app is intentionally **not linked to an Expo/EAS project ID yet**. Linking requires authorization to the Expo owner account and must create a new project distinct from the Customer app.

After a dedicated Partner EAS project is created, run Expo's normal project/update configuration for `apps/partner-app`. The resulting `expo.extra.eas.projectId` and `expo.updates.url` must be committed. Both release workflows refuse to run if those values are missing or reuse the Customer app project/update identity.

GitHub workflows:

- `Build Partner preview APK`: workflow-dispatch only; current-main guard; internal APK
- `Publish Partner preview OTA`: workflow-dispatch only; current-main guard; preview OTA
- both require `EXPO_TOKEN`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- neither workflow can target the Customer EAS project


## Partner Policy Intake

The Partner app submits policy copies into the same controlled Operations workflow used by the web portal:

`Partner/POSP/MISP or commercial employee → signed policy-document upload → policy_intake_requests → Document AI/OCR → Operations review → Policy Onboarding → final policy`.

Partner/POSP/MISP submissions use `submitted_by_portal_account_id`; employee/web submissions continue using `submitted_by_profile_id`. The database enforces exactly one submitter identity per intake.

The mobile app does not call `onboard_motor_policy` and cannot directly book or alter policies through this feature.
