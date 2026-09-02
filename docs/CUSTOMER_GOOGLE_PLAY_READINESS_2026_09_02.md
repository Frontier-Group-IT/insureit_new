# INSUREIT Customer — Google Play Readiness

Date: 2026-09-02
Scope: Customer Android app

## Readiness status

Play Store readiness is UNLOCKED and active again after Quote / Challan UAT work.

Current product state:
- Customer app runtime: 0.2.0
- Expo SDK: 54
- React Native: 0.81
- Android package: com.insureit.mobile
- Android source versionCode: 7
- EAS production profile: production channel with autoIncrement
- Customer preview OTA flow is working
- Quote and Challan guest/customer enquiry flow is live
- Guest OTP verification is live
- Signed-in Quote / Challan enquiries appear in Customer Support
- Operations Service Enquiries queue is live
- Consent audit fields are live for Quote / Challan requests
- No final Play AAB has been built yet

## Google Play policy baseline checked on 2026-09-02

### Target API

Google Play requires new apps and app updates submitted from 2026-08-31 to target Android 16 / API 36 or higher.

Expo SDK 54 uses:
- compileSdkVersion 36
- targetSdkVersion 36

Therefore the framework baseline is aligned. The final AAB must still be inspected to confirm the generated manifest actually targets API 36.

### Developer account

INSUREIT provides insurance-related financial services.

Google Play's current Play Console requirements state that developers providing financial products/services must use an Organization developer account.

Before submission confirm:
- developer account type = Organization
- legal organization name is correct
- D-U-N-S number is present and verified
- payments profile is linked and verified
- developer contact email/phone are current
- public developer contact shown on Play is intentional

### Financial features declaration

Complete:
- Financial features: Insurance

Do not declare personal loans, wallets, money transfer or other financial features unless the final app genuinely provides them.

### Privacy policy

Required public URL:
https://portal.insureit.in/privacy-policy

The app also contains an in-app Privacy & Legal Center.

Before submission:
- verify the public page loads without authentication
- verify it accurately covers customer profile data, insurance/policy data, claim data, uploaded documents/media, location used for incident capture, support communications, Quote / Challan enquiries, guest contact data, OTP verification, and consent records
- once the final audio-recording feature is enabled, add explicit microphone / customer audio-recording disclosure before Play submission; the current web and in-app Privacy Policy source does not yet mention audio, voice recordings or microphone access
- keep the URL stable after release

### Account deletion

Required public deletion resource:
https://portal.insureit.in/account-deletion

In-app path:
Profile -> Account & Privacy -> Request account deletion

Before submission:
- verify the web page loads without authentication
- verify the deletion request flow is functional
- ensure retained records are limited to legally/regulatorily required records and are access-restricted as described in the Privacy Policy

### App access

The core customer experience is authenticated, so Google Play review needs a working reviewer account.

Prepare in Play Console only:
- dedicated reviewer email/login
- password
- exact sign-in instructions
- OTP/bypass instructions if applicable
- no real customer credentials

Reviewer route checklist:
- Home
- Vehicles
- Policies
- Claims
- Support
- Notifications
- Profile
- Privacy Policy
- Account Deletion
- Get Quote
- Pay Challan

## Data Safety working map

Reconfirm this against the final AAB and production SDK list before submitting the form.

Likely collected / processed categories:

### Personal info
- name
- email
- phone number
- postal/contact address
- customer/account identifiers

### Financial / insurance data
- insurance policy information
- premium / IDV where provided
- claim values
- claim settlement / payment references
- Quote enquiry details

### Location
- precise/current location only when the user chooses incident-location capture
- manually entered incident location/address

### Photos and videos
- accident/claim evidence selected or captured by the user

### Files and documents
- policy documents
- RC / vehicle documents
- driving licence
- KYC documents
- claim/supporting documents

### App activity / communications
- support tickets
- support messages
- Quote enquiries
- Challan assistance enquiries
- claim workflow updates
- notification state

### Audio
- customer-created voice/audio recordings when the planned audio-record feature is activated in the final native release
- declare only if recordings are actually collected, stored or transmitted by the final AAB

### Authentication / security
- login/session identifiers
- account status
- guest OTP verification challenge data
- Quote / Challan consent timestamp/version
- WhatsApp opt-in state

Purposes may include:
- app functionality
- account management
- insurance servicing
- claims handling
- customer support
- fraud/security
- legal/regulatory compliance

Do not mark third-party sharing mechanically. Review each processor/recipient under Google Play's definition and service-provider/legal exceptions.

## Quote / Challan release disclosures

### Get Quote
The final app:
- accepts Quote requests from guests and signed-in customers
- verifies guest mobile by OTP
- stores consent acceptance/version/timestamp
- stores optional WhatsApp opt-in separately
- routes the request to Operations

Store/listing wording must not promise a guaranteed premium, policy issuance, insurer acceptance or claim outcome.

### Pay Challan
The final app provides assisted Challan support.

Do not describe INSUREIT as:
- government challan authority
- direct government challan database
- guaranteed payment gateway

Customer-facing disclosure should continue to state that challan records, penalties and payment status are governed by the relevant traffic/government authority and INSUREIT provides assistance/coordination.

## Store listing draft

### App name
INSUREIT

### Short description
Commercial vehicle insurance, renewals, claims and support in one place.

### Full description
INSUREIT helps commercial-vehicle customers manage insurance information and service requests in one place.

Use INSUREIT to:
- View vehicles and linked insurance policies
- Check policy protection and renewal status
- Add customer-held policy information
- Start and track claims
- Follow claim milestones and settlement progress
- Upload policy, KYC and claim documents
- Receive claim, policy, payment and support updates
- Request an insurance quote
- Request challan assistance
- Raise and track support requests
- Manage profile, privacy and account-deletion requests

INSUREIT is operated by Sankalp Insurance Brokers Private Limited.

Insurance quotations, premiums, policy issuance, claim approval and settlement remain subject to the applicable insurer, underwriting, policy terms, submitted information, documentation and regulatory requirements.

Challan records, penalties and payment status remain subject to the relevant traffic or government authority. INSUREIT provides assistance and coordination only.

Privacy Policy:
https://portal.insureit.in/privacy-policy

Account deletion:
https://portal.insureit.in/account-deletion

## Store graphics plan

Google Play current requirements:
- Play app icon: 512 x 512 PNG, max 1024 KB
- Feature graphic: 1024 x 500 JPEG or 24-bit PNG
- Minimum 2 screenshots to publish
- Recommended: at least 4 phone screenshots at minimum 1080 px, using 9:16 portrait for recommendation surfaces
- Phone screenshots: JPEG or 24-bit PNG, no alpha

Recommended final phone screenshot set:
1. Home — fleet protection + quick actions
2. Policies — active / renewal / expired states
3. Claim Tracker — milestone journey
4. Get Quote — polished quote request screen
5. Vehicles — protection overview
6. Support — Requests & Tickets
7. Notifications — recent updates
8. Profile / Privacy — account controls

Do not use:
- Dummy Customer
- real customer phone/email
- real policy numbers
- real claim numbers
- real vehicle registration numbers
- notification-bar clutter

Use a sanitized release-demo account.

## Final native-build blockers

These must be resolved only in the final native build pass.

### 1. Activate the planned audio-recording feature

Status: permission retained intentionally; feature implementation and privacy disclosure are still required before the final Play AAB.
Current app.json explicitly requests:
android.permission.RECORD_AUDIO

This permission is intentional and must be retained because the final native release will activate the currently inactive customer audio-record feature.

Final action:
- keep RECORD_AUDIO
- identify and activate the intended audio-record control in the final native feature pass
- request microphone access only when the customer taps Record / Microphone, not at app launch
- show clear denied / permanently-denied handling
- provide stop, playback, delete/re-record and submit controls
- upload audio only after explicit customer action
- verify recordings are associated only with the intended claim/support workflow
- inspect the generated Android manifest and Play permissions after the final AAB

Privacy / Play implications:
- add audio recordings to the Privacy Policy if the feature stores or transmits them
- include Audio files / Voice or sound recordings in Data Safety when applicable
- disclose the purpose as app functionality / customer support / claims handling as actually implemented
- do not describe microphone access as background recording
- confirm the app does not record without an obvious foreground user action

### 2. Final launcher display name
Current Expo name:
insureit

Confirm final launcher casing before build:
Recommended: INSUREIT or InsureIT

### 3. Version alignment
Current:
- Expo app version: 0.2.0
- package.json version: 0.3.0
- Android versionCode: 7

Before final build:
- choose final versionName
- make version metadata intentionally consistent
- ensure versionCode exceeds every artifact previously uploaded to the same Play package
- preserve EAS autoIncrement for production

### 4. Final generated manifest review
Confirm:
- targetSdkVersion = 36
- expected package = com.insureit.mobile
- no unexpected dangerous permissions
- only required camera/media/location capabilities are present
- microphone permission is present only for the intentional customer audio-recording feature
- microphone runtime request occurs only at the point of use

### 5. Signing / Play App Signing
Before upload:
- confirm stable production signing identity
- confirm Play App Signing configuration
- protect upload key/recovery data
- never change package ID after first Play production release

## Play Console completion checklist

Before final AAB:
- Organization developer account verified
- D-U-N-S verified
- developer contacts verified
- Privacy Policy URL ready
- Account Deletion URL ready
- Ads declaration completed
- Financial Features = Insurance
- Target audience completed
- Content rating questionnaire completed
- Health apps declaration completed
- App access / reviewer account prepared
- Data Safety draft completed
- Store listing text prepared
- Feature graphic prepared
- 512px Play icon prepared
- sanitized screenshots prepared

After final AAB:
- verify API 36
- verify package/version
- verify permissions
- upload to Internal or Closed testing first
- install Play-delivered build
- run release smoke test
- review Play pre-launch report
- resolve blockers
- then promote toward production

## Final release smoke test

From Play-delivered build:
- first launch
- second cold launch
- login
- session restore
- Home
- Vehicles
- Policies
- Claims
- Quote
- Challan
- Support
- notifications
- policy/document upload
- audio record -> stop -> playback -> re-record/delete -> submit
- microphone denial and recovery behavior
- privacy links
- account deletion path
- logout
- reinstall / update behavior

## Current next step

Do NOT build AAB yet.

Next:
1. finalize Play Console content/declarations
2. prepare sanitized screenshot/demo account
3. finalize store graphics
4. confirm Organization developer-account readiness
5. only then perform the final native config pass and build the production AAB
