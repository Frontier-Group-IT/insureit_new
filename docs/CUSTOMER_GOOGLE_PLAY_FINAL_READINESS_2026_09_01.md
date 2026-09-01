# INSUREIT Customer — Google Play Final Readiness

Date: 2026-09-01
Scope: Customer mobile app only

## Current release boundary

- Continue OTA-safe refinement and Play Console preparation.
- Do not build a new APK/AAB until the final native release pass is explicitly approved.
- Current customer app uses Expo SDK 54 / React Native 0.81.
- Expo SDK 54 targets Android API 36, which aligns with Google Play's August 31, 2026 requirement for new apps and updates to target Android 16 / API 36.
- Current Android package: `com.insureit.mobile`.
- Current Expo app version: `0.2.0`.
- Current Android versionCode in source: `7`.
- Current production EAS profile uses the `production` channel and auto-increments build version.
- Latest installed-device UAT batch for customer release-facing fixes is verified working.

## Play Console declarations to complete

### App content

- Privacy policy: use the public InsureIT privacy policy page.
  - `https://portal.insureit.in/privacy-policy`
- Account deletion web resource:
  - `https://portal.insureit.in/account-deletion`
- Ads declaration: declare no ads unless an advertising SDK or ad surface is intentionally added before release.
- App access: provide a dedicated Google Play reviewer account and exact sign-in instructions in Play Console. Never store reviewer credentials in the repository.
- Target audience: adult commercial-vehicle customers; do not include child age groups.
- Content rating: complete the IARC questionnaire accurately.
- Financial features: declare **Insurance**.
- Health apps declaration: declare that the app does not provide health features.
- News and Magazine declaration: not applicable.
- Data safety: complete using the data map below.
- Account deletion: confirm both the in-app path and public web path in the Data safety/account deletion section.

## Data safety working map

This is a preparation checklist, not a substitute for the final Play Console questionnaire. Reconfirm each item against the final AAB and production data flows.

### Data collected or processed by app features

- Personal information:
  - name
  - email address
  - phone number
  - postal/contact address
  - customer/account identifiers
- Location:
  - precise/current location when the customer explicitly uses incident-location capture
  - manual incident address when entered without GPS
- Photos and videos:
  - accident evidence and claim media selected or captured by the customer
- Files and documents:
  - policy copies
  - vehicle/RC documents
  - driving licence
  - KYC/supporting documents
  - claim documents
- Financial / insurance information:
  - insurance policy information
  - claim values
  - bill / delivery-order / settlement / payment references where present
- App activity / support content:
  - support tickets
  - support messages
  - claim workflow updates
  - notification state
- Authentication / account information:
  - login/session identifiers and account status
- Device / diagnostic information:
  - only declare categories actually collected by the final shipped SDK/runtime and any monitoring SDK added before release.

### Collection purposes

Use only purposes that are true for the final app, including:

- app functionality
- account management
- insurance policy and renewal servicing
- claims handling and customer-requested claim tracking
- fraud prevention / security
- customer support
- legal and regulatory compliance

### Sharing

The Privacy Policy states that information may be shared where necessary with insurers, authorized insurance partners, surveyors, garages/repairers, claim service providers, technology/cloud providers, payment/financial service providers, authorized staff, and authorities.

Before submitting Data safety, classify each recipient using Google Play's definition of "sharing" and applicable service-provider/legal exceptions rather than blindly marking every processor as third-party sharing.

### Security disclosures

Confirm before submission:

- data is encrypted in transit
- account deletion request is available
- production Supabase/RLS and private-storage rules are the intended security boundary
- no production secrets are bundled in the client
- only `EXPO_PUBLIC_*` browser-safe values are present in the mobile bundle

## Public privacy and deletion surfaces

Verified in source:

- In-app Privacy & Legal Center exists.
- In-app account deletion path exists:
  - Profile → Account & Privacy → Request account deletion
- Public account deletion route exists in the web portal.
- Public privacy-policy route exists in the web portal.
- Account-deletion copy explains that legally/regulatorily required records may be retained with restricted access.

Before Play submission, verify both public URLs load unauthenticated in production and keep working after any portal deployment.

## Native / final-AAB items — defer until final build pass

These items change native/app configuration and therefore must not be shipped as OTA-only changes.

### 1. Remove unnecessary microphone permission

Current `app.json` explicitly requests:

`android.permission.RECORD_AUDIO`

The current customer app package list does not include an audio-recording package, and the reviewed claim/location flows do not require microphone recording.

Final-build action:
- remove `RECORD_AUDIO` unless a verified customer feature still requires microphone access
- inspect the generated Android manifest from the release AAB/APK to confirm it is absent

Reason:
- minimize permissions
- avoid unnecessary user concern and Play review questions

### 2. Final app display name

Current Expo config name is lowercase `insureit`.

Before the final AAB, confirm the desired launcher/store-facing casing. Recommended:
- launcher/app display name: `INSUREIT` or `InsureIT`
- Google Play title: `INSUREIT`

Do not change until branding is explicitly finalized because it is a native-build change.

### 3. Versioning

Before final production build:
- choose the first Google Play production `versionName`
- ensure the production `versionCode` is greater than every APK/AAB ever uploaded to the same Play package
- keep EAS production auto-increment enabled
- record the exact AAB build ID, git commit, versionName and versionCode

### 4. Final manifest / permission inspection

After the final AAB is created, inspect the actual bundle manifest rather than relying only on `app.json`.

Expected functional permission areas:
- foreground location for optional incident-location capture
- camera/media/document access only as required by the final implementation
- internet/network access through normal Android app operation

Flag any unexpected permission before upload to Play.

### 5. Signing and Play App Signing

At final build/submission:
- confirm the package remains `com.insureit.mobile`
- confirm the production signing identity is stable
- enroll/use Google Play App Signing as appropriate
- preserve the upload key and recovery information securely
- never rotate package/signing identity casually after first production release

## Store listing draft

### App name

INSUREIT

### Short description

Commercial vehicle insurance, renewals, claims and support in one place.

### Full description

INSUREIT helps commercial-vehicle customers keep important insurance information and claim activity organized in one place.

Manage your vehicles and policies, check protection and renewal status, track claims, upload supporting documents, and connect with the INSUREIT support team when assistance is needed.

Key features include:

- View commercial vehicles and linked insurance policies
- See policy status, expiry dates and renewal attention
- Add customer-held policy information
- Start and track insurance claims
- Follow claim milestones and settlement progress
- Upload policy, KYC and claim-related documents
- Review claim values and completed settlement stages where available
- Receive in-app claim, policy, document, payment and support updates
- Raise support tickets and contact the support team
- Manage profile, privacy and account-deletion requests

INSUREIT is operated by Sankalp Insurance Brokers Private Limited. Features available to a customer depend on the customer's policy, vehicle, claim and service relationship.

INSUREIT does not promise claim approval, settlement, policy issuance or insurer decisions. Insurance and claim outcomes remain subject to the applicable insurer, policy terms, documentation, assessment and regulatory requirements.

Privacy Policy:
https://portal.insureit.in/privacy-policy

Account deletion:
https://portal.insureit.in/account-deletion

## Store asset shot list

Do not use the current Dummy Customer test identity or real customer PII in Play Store screenshots.

Prepare screenshots from a sanitized release-demo account showing:

1. Home
   - fleet summary
   - quick actions
   - claims summary
2. Policies
   - active and renewal/expiry states
3. Vehicles
   - protected and protection-needed states
4. Claim Tracker
   - clear milestone journey and financial progress
5. Support
   - support categories and ticket access
6. Notifications
   - category summary and recent updates
7. Profile / Privacy
   - account controls without exposing contact PII

Before capture:
- replace test names, phone numbers, emails, policy numbers, claim numbers and vehicle registration numbers with approved demo data
- clear notification noise unrelated to the listing story
- use the final native icon/display name before producing the final screenshot set if the launcher/header branding is changing

## Reviewer access preparation

Play reviewers must be able to reach restricted features.

Prepare in Play Console only:

- dedicated reviewer login
- password
- exact sign-in steps
- note that the account is a customer account
- any OTP or bypass instructions if the final release uses OTP
- steps to reach Vehicles, Policies, Claims, Support, Notifications, Privacy Policy and Account Deletion
- do not provide real customer credentials

## Release decision gates

### Gate A — OTA/product UAT
Status: substantially complete for the tested customer flows.

### Gate B — Play Console content
Ready to complete before AAB:
- privacy-policy URL
- account-deletion URL
- app category / Insurance financial declaration
- ads declaration
- target audience
- health declaration
- reviewer-access instructions
- Data safety draft
- store title/descriptions
- screenshot plan

### Gate C — native configuration
Hold for final AAB:
- remove unnecessary RECORD_AUDIO permission
- finalize launcher display name
- final versionName/versionCode
- inspect generated permissions/manifest
- signing / Play App Signing verification

### Gate D — final production AAB
Do only after explicit approval.

Required evidence before upload:
- exact clean git commit
- production EAS build success
- API 36 target confirmed from built artifact
- expected package name
- expected versionName/versionCode
- expected permissions only
- release signing confirmed
- installed release candidate smoke test
- no startup crash
- login/session restoration
- account deletion link/path works
- privacy-policy link works

### Gate E — Play internal/closed testing

Recommended before production:
- upload the final AAB to an internal or closed Play track
- install the Play-delivered build
- repeat cold-launch, login, claims, policy, vehicle, support, document-open/upload and account-deletion smoke checks
- resolve Play pre-launch report findings
- only then promote to production
