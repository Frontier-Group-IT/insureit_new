# InsureIT Mobile Workflow & UI Refinement Handoff

> **Updated:** 2026-08-14 (IST)
>
> **Purpose:** This is the continuation handoff for the current mobile-app workstream. A new ChatGPT/Codex agent should read this file before making any mobile workflow, customer-app, claims, vehicle, Expo, or UI-refinement changes.
>
> Also read: `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, `docs/mobile-web-continuation-handoff.md`, `docs/mobile-app-production-review.md`, `docs/mobile-app-polish-roadmap.md`, `docs/claim-role-responsibility-model.md`, and `docs/claim-manager-web-handoff.md`.

---

## 1. Repository / deployment facts

Repository:

```text
https://github.com/Frontier-Group-IT/insureit_new
```

Main application areas:

```text
apps/web-portal     Next.js 15 web portal
apps/mobile-app     Expo / React Native / Expo Router mobile app
supabase            Supabase/Postgres migrations
```

Canonical production web origin:

```text
https://portal.insureit.in
```

Do **not** deploy the web portal merely because mobile work is requested. Web production is intentionally gated through `.deploy/production-trigger.json` and requires explicit production-web deployment intent.

The current user goal is continued **mobile workflow and mobile UI/UX refinement**. Unless explicitly asked otherwise, keep changes scoped to mobile/backend and Expo preview rather than the production website.

`AGENTS.md` permits approved changes to go directly to `main` unless the user asks for a branch/PR.

Routine verification should be done through GitHub Actions when possible; do not make the user run normal verification commands manually if CI can do it.

---

## 2. User working preferences for this project

The user wants changes implemented after approval without repetitive clarification. For UI work, make the experience polished and product-like rather than exposing raw database concepts.

Current InsureIT mobile visual language:

- navy/blue primary surfaces and actions
- amber/gold accent where useful
- white cards on soft cool-gray backgrounds
- compact, information-rich but not cluttered layouts
- rounded premium cards, subtle borders, restrained shadows
- customer-facing copy should use business language, not backend terminology
- avoid generic/default platform alerts when a branded custom sheet/modal is more appropriate

The user is specifically continuing **workflow refinement + UI refinement**, not merely bug fixing.

---

## 3. Current Expo project — authoritative configuration

`apps/mobile-app/app.json` currently uses:

```text
name: insureit
slug: insureit-mobile
version: 0.1.0
runtimeVersion.policy: appVersion
updates.url: https://u.expo.dev/aadcb7a5-072b-4bf9-bc81-c52fabdd5caa
updates.checkAutomatically: ON_LOAD
updates.fallbackToCacheTimeout: 10000
android.package: com.insureit.mobile
ios.bundleIdentifier: com.insureit.mobile
extra.eas.projectId: aadcb7a5-072b-4bf9-bc81-c52fabdd5caa
owner: antnish
```

**Do not use stale older project IDs/owners.** Earlier historical config mentioning `frontierit` or project ID `13a9819a...` is obsolete.

Current `apps/mobile-app/eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  }
}
```

The installed testing APK is a **preview-profile build** and follows the Expo `preview` channel.

Use GitHub Actions secret `EXPO_TOKEN` for authenticated EAS commands. Never ask the user to paste that token into chat.

Recommended one-time OTA command for preview:

```text
npx --yes eas-cli@18 update --channel preview --message "<message>" --non-interactive
```

Run it from:

```text
apps/mobile-app
```

Use a temporary GitHub Actions workflow, monitor it to success, then delete the temporary workflow from `main`.

Do not submit to the Play Store unless explicitly asked.

---

## 4. Important Expo update history / startup hotfix

A historical accidental **production-channel** EAS Update was published earlier in this workstream. Do not claim there has never been a production-channel update. It should not affect the current preview APK because the testing build follows `preview`.

The user later reported the app stuck on:

```text
Checking for app update
```

Root cause was the custom `AppUpdateManager` calling `Updates.checkForUpdateAsync()` with no timeout while showing a full-screen blocking overlay.

Hotfix behavior now expected:

- checking does **not** block startup
- manual update check timeout = 5 seconds
- download timeout = 15 seconds
- overlay is shown only while downloading/restarting
- native Expo `ON_LOAD` update behavior remains configured

Historical hotfix commit:

```text
efe75a1ad06ebbd69b2b53f5048c1acb44a581c2
Prevent update checks from blocking app startup
```

The startup hotfix was successfully published to Expo `preview` and its temporary workflow was removed.

If a future preview APK ever becomes unrecoverably stuck on old JS, prefer a fresh **preview APK** with current JS baked in rather than uninstalling the user’s existing app before a replacement is ready.

---

## 5. Claims responsibility model — do not regress

Claim ownership and assistance are separate concepts.

### Broker Managed

- Sankalp/SIBL policy or accepted assistance
- Sankalp Claims Desk / OPS owns the process
- appears in normal OPS action queues

### Self Managed

- external/non-Sankalp policy
- customer owns and tracks the record/process
- excluded from ordinary OPS queues unless assistance is accepted

Canonical fields:

```text
claim_service_mode: broker_managed | self_managed
assistance_status: not_requested | requested | accepted | declined | cancelled
```

Rules:

- assistance request does **not** mean responsibility is accepted
- requested => still self_managed + requested
- accepted => broker_managed + accepted, but preserve external source identity
- declined => self_managed + declined
- `current_status` is journey position, not responsibility

Customer-facing labels:

```text
Self Tracked
Assistance Requested
Sankalp Assisted
```

Do not replace these concepts with a single overloaded status.

### Boss 9-stage claim journey

1. Spot Intimation
2. Spot Status
3. Claim Intimation
4. Work Approval
5. Repair & RI
6. Billing
7. Delivery Order (DO)
8. Vehicle Delivery
9. Payment Encashment

Self-managed 9/9 completion now settles the claim:

```text
current_status = Settled
```

Terminal self-managed claims should not continue showing Assistance Requested or offer new assistance/re-request actions.

---

## 6. External policy / self-managed claim architecture

Historical external policies remain a separate domain table:

```text
public.external_policies
```

Customer access uses `can_access_customer`.

Relevant RPCs / compatibility concepts:

```text
create_customer_external_policy(...)
create_self_managed_external_claim(...)
```

Newer policy-backed self-managed claims can also use normal `policy_id` while preserving:

```text
policy_service_source = external
```

Both generations must remain supported:

- legacy `external_policy_id`
- newer `policy_id + external source`

`resolve_claim_assistance(...)` supports both generations.

Old `create_self_managed_claim(...)` remains only for historical compatibility and authenticated EXECUTE was revoked. Do not restore authenticated use of that obsolete RPC.

Do not mutate the known live test claim merely for testing:

```text
claim: EXT/1000
id: 0a1e73b0-741e-4402-99a1-3138f61163c5
```

It currently represents a real assistance-request state and should remain untouched unless the user explicitly asks to operate on it.

---

## 7. Current mobile claims UI state

Major completed mobile work in this session/workstream:

### My Claims

- redesigned counts for Sankalp Managed, Self Tracked, Assistance Requested
- ownership/service badge is separate from journey/status badge

### Self-managed tracker

- premium header/service strip
- progress/current-step presentation
- financials
- all 9 stages
- completed stages can be reopened
- future stages remain locked
- recent activity
- terminal state copy uses claim-history-complete language

### Notifications

- self-managed claim notifications deep-link to the correct claim

### Start Claim

Current intended flow:

```text
Account -> Vehicle -> Policy
```

The policy/source determines managed vs self-tracked behavior. There should be no manual service-mode switch exposed to the customer.

### Dashboard quick actions

Standard customer dashboard currently uses:

```text
Renewal Dues
Get Quote
E Challan
Start Claim
```

Exchange Vehicle was removed.

Do not undo these flows while refining adjacent UI.

---

## 8. Latest completed feature: functional Add Vehicle mobile workflow

This was the latest user request before this handoff.

### Original problem

On the individual customer My Vehicles page, tapping **Add Vehicle** opened an old static popup with roughly Vehicle No. / Policy No. / Chassis No. fields. Entering data did not perform a real save.

The group/fleet path already had a separate functional `app/customer/add-vehicle.tsx` screen with a real `create_customer_vehicle` RPC call.

### Current implemented behavior

The individual customer Add Vehicle action now routes to the same real mobile Add Vehicle workflow:

```text
apps/mobile-app/app/customer/vehicles.tsx
```

Current function:

```tsx
function openAddVehicle() {
  router.push('/customer/add-vehicle');
}
```

The route is presented by Expo Router as a modal with a bottom-up transition:

```text
apps/mobile-app/app/_layout.tsx
```

Current registration:

```tsx
<Stack.Screen
  name="customer/add-vehicle"
  options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
/>
```

Implementation commit:

```text
46520cf8
Make customer Add Vehicle workflow functional
```

### Current Add Vehicle sections

The mobile form now mirrors the website vehicle onboarding structure.

#### Vehicle Ownership

- RC Number
- Registration Date
- Manufacturer
- Model
- Manufacturing Year

#### Vehicle Specification

- Vehicle Class
- Chassis Number
- Engine Number
- Fuel Type
- Capacity / GVW

#### Compliance & Permit

- Fitness Expiry
- PUC Expiry
- Road Tax Expiry
- National Permit Expiry
- Local Permit Expiry

### Only these four fields are mandatory

```text
RC Number
Manufacturer
Model
Manufacturing Year
```

Everything else above is optional.

Do not accidentally reintroduce mandatory Vehicle Class, Chassis No., policy data, or permit/compliance data.

### Vehicle class values

To match the website master form:

```text
PCP  Private Car
TWP  Two Wheeler
GCV  Goods Carrying Vehicle
PCV  Passenger Carrying Vehicle
MISD Miscellaneous Vehicle
CPM  Contractor Plant & Machinery
```

Vehicle Class itself is optional in the customer mobile Add Vehicle flow.

### Fuel options

```text
Petrol
Diesel
CNG
Electric
Hybrid
Bi-Fuel
Other
```

### Manufacturer source

Mobile currently loads manufacturer names from active rows in:

```text
vehicle_manufacturer_brands.brand_name
```

This was intentionally aligned with the current website vehicle form, which derives manufacturer options from active manufacturer brands.

### Customer/account behavior

- for a normal individual context, customer is inferred from logged-in operational context
- when multiple eligible contexts exist, the Add Vehicle workflow can show account selection
- group parent context is excluded where appropriate so the vehicle attaches to an operational child account

### Policy data was removed from Add Vehicle

The previous functional screen contained an `Optional policy details` section and could create a policy after vehicle creation.

That section is now removed. Vehicle creation and policy creation should remain separate workflows.

Do not re-add Policy No. / insurer / IDV / premium to Add Vehicle unless explicitly requested.

---

## 9. Add Vehicle backend — live production state

Supabase project:

```text
name: insureit
project id: ilzhsfqqjyppzzvfscmh
region: ap-south-1
```

The customer vehicle creation RPC was extended to match the full vehicle form.

Repository migration:

```text
supabase/migrations/20260814163000_customer_vehicle_full_form_alignment.sql
```

Repository migration commit:

```text
398198c15aabad94a693091a8e844e31b50b8c3f
Align customer vehicle creation with full vehicle form
```

Live Supabase migration ledger entry:

```text
20260814105907 customer_vehicle_full_form_alignment
```

Do not confuse the repository migration filename timestamp with Supabase’s generated live migration version.

Current `create_customer_vehicle(...)` behavior:

- authenticated user required
- customer access enforced with `can_access_customer(p_customer_id)`
- RC number required
- manufacturer required
- model required
- manufacturing year required and validated
- vehicle class optional
- chassis optional
- engine optional
- capacity/GVW optional but must be positive if supplied
- fuel type optional
- registration date optional
- all compliance expiry dates optional
- returns inserted `vehicles` row
- EXECUTE granted to `authenticated`
- EXECUTE revoked from `anon` and `public`

Current mobile payload includes:

```text
p_customer_id
p_vehicle_no
p_vehicle_type
p_make
p_model
p_year
p_chassis_no
p_engine_no
p_permit_no = null
p_gvw_kg
p_fuel_type
p_registration_date
p_fitness_expiry_date
p_puc_expiry_date
p_road_tax_expiry_date
p_national_permit_expiry_date
p_local_permit_expiry_date
```

The website no longer presents a generic permit number field in its current three-section vehicle onboarding; therefore the mobile flow also does not expose Permit No. and sends it as null.

---

## 10. Add Vehicle UI state / refinement opportunities

Current file:

```text
apps/mobile-app/app/customer/add-vehicle.tsx
```

The route now has:

- `VEHICLE ONBOARDING` eyebrow
- `Add Vehicle` title
- helper text saying optional details can be completed later
- custom close icon
- sectioned branded cards
- custom manufacturer search/dropdown
- custom vehicle-class dropdown
- custom fuel dropdown
- custom date/calendar modal
- save loader / disabled state
- inline error Message component

The current visual implementation is functional and verified, but future agents may continue polishing it. Preserve the data contract while refining layout.

Good future UI refinements if requested:

- make the modal feel more like a dedicated mobile sheet with stronger top handle/header composition
- collapse optional Vehicle Specification / Compliance sections initially if user wants an even faster first-use flow
- convert Manufacturing Year from free numeric entry to a polished year selector matching the website’s current-year descending list
- dynamically label Capacity according to selected class (GVW / CC / seating / equipment capacity) to match the website behavior more closely
- improve manufacturer empty/loading state
- remove any dead legacy state/helpers left in `vehicles.tsx` after the old static popup was bypassed

Do not make these speculative changes without user intent if they would materially alter workflow.

---

## 11. Verification status for Add Vehicle

The implementation was gated through GitHub Actions before commit.

Successful workflow:

```text
Temporary functional mobile Add Vehicle patch v2
run id: 31794600686
result: SUCCESS
```

Passed:

```text
npm run typecheck:mobile
npm run lint:mobile
npm run build:mobile:web
```

Expo web export completed successfully.

Lint had **warnings but zero errors**. Relevant warnings included dead/unused legacy mobile helpers such as:

```text
apps/mobile-app/app/customer/add-vehicle.tsx
  vehicleData assigned but unused
  isMissingPolicyRpcSignature defined but unused

apps/mobile-app/app/customer/vehicles.tsx
  claims assigned but unused
  openRenewal unused
  openEndorsement unused
```

These are cleanup opportunities, not blockers. Do not claim global lint is warning-free.

Temporary patch workflows used to implement the feature were deleted after success.

---

## 12. Recent commits relevant to this mobile handoff

```text
46520cf8  Make customer Add Vehicle workflow functional
398198c1  Align customer vehicle creation with full vehicle form
2a29ef82  cleanup of temporary Add Vehicle workflow
6c6b6e06  cleanup of first temporary Add Vehicle workflow
```

There are many unrelated web commits on `main`. Always inspect current `main` before patching and avoid overwriting concurrent work.

---

## 13. Database safety / do-not-touch rules

- Use the existing original Supabase project `ilzhsfqqjyppzzvfscmh`.
- Do not create a speculative replacement Supabase project.
- Do not reapply already-live migrations merely to "make sure" they ran.
- Do not mutate `EXT/1000` just for smoke testing.
- Avoid broad destructive data tests on live customer/policy/claim records.
- Prefer schema/function inspection and transactional/non-mutating verification where possible.
- Existing expected SECURITY DEFINER advisor warnings are not a reason to do a broad advisor cleanup during unrelated UI work.

---

## 14. Web / domain guardrails while doing mobile work

Production web:

```text
portal.insureit.in
```

Historical domain work is already complete enough for current operations. Do not create speculative subdomains.

iCall embedded iframe is blocked by external CSP/cookie policy; opening in a new tab works. Do not introduce an insecure proxy/bypass simply to force iframe embedding.

Do not touch `.deploy/production-trigger.json` for routine mobile releases.

---

## 15. How to continue this work in a fresh agent session

At the beginning of the next session, tell the agent to:

1. Read `AGENTS.md`.
2. Read this file completely.
3. Read the project/context docs listed at the top.
4. Inspect current `main` before editing.
5. Treat mobile/backend as the active track unless the user explicitly changes scope.
6. Preserve the claim responsibility model and external-policy domain boundary.
7. Use the existing Expo project (`antnish / insureit-mobile / aadcb7a5-072b-4bf9-bc81-c52fabdd5caa`).
8. Publish customer-testing changes to Expo `preview`, not production, unless explicitly told otherwise.
9. Run mobile typecheck + lint + Expo web export before publishing.
10. Remove any temporary workflow after it completes.

Suggested continuation prompt:

```text
Continue the InsureIT mobile workflow and UI refinement work.
Before doing anything, read AGENTS.md and docs/MOBILE_WORKFLOW_UI_REFINEMENT_HANDOFF.md completely, then read the other mandatory project context docs referenced inside it. Inspect current main before changing code. Keep the work focused on the mobile app/backend unless I explicitly ask for website changes. Preserve the current claim responsibility model, current Expo preview setup, and the functional Add Vehicle workflow described in the handoff.
```

---

## 16. Immediate state at handoff creation

At the time this file was created:

- functional Add Vehicle code is merged to `main`
- live Supabase RPC supports the full vehicle form and exact four mandatory fields
- temporary Add Vehicle implementation workflows are removed
- the next action requested by the user is to **publish/deploy the current mobile changes to Expo preview**
- no production website deployment is required for this mobile release

If this file is being read after the Expo publish step, check GitHub Actions / Expo activity for the release record added immediately after this handoff commit rather than assuming it is still pending.
