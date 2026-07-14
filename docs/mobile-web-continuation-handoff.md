# InsureIT Mobile App and Web Portal Continuation Handoff

Last updated: 2026-07-14
Repo: `https://github.com/antnish1/insureit_new`
Current branch: `main`
Current HEAD: `1078b66 Expose mobile KYC applications in portal`

This handoff is written so another ChatGPT/Codex session can open the repo and continue building the mobile app and website directly. The latest work to preserve is the mobile customer KYC/onboarding flow and the web portal review surface for those mobile KYC applications.

## Current Project Shape

- Monorepo with npm workspaces:
  - `apps/mobile-app`: Expo Router React Native app.
  - `apps/web-portal`: Next.js 15 web portal.
  - `supabase/migrations`: database/RLS/storage/function changes.
- Root scripts:
  - Mobile dev: `npm run dev:mobile`
  - Mobile web: `npm run dev:mobile:web`
  - Mobile typecheck: `npm run typecheck:mobile`
  - Web dev: `npm run dev:web`
  - Web build: `npm run build:web`
  - Web typecheck: `npm run typecheck:web`

## Latest Work in Focus

### 1. Mobile Customer KYC Onboarding

The mobile app now supports an application-first customer onboarding model. Customer signup/login creates or loads a profile, but a canonical `customers` row is created only after KYC approval from the portal.

Important files:

- `apps/mobile-app/app/customer/home.tsx`
  - Shows a KYC pending / KYC under review / KYC changes requested state when no active customer record exists.
  - Opens the correct KYC route based on `customer_onboarding_applications.partner_type`.
  - Keeps the customer dashboard usable enough for exploration while prompting for KYC.
- `apps/mobile-app/app/customer/kyc/partner-type.tsx`
  - Lets a customer start/select a partner type.
  - Currently the functional full flow is for `individual_proprietor`.
- `apps/mobile-app/app/customer/kyc/individual.tsx`
  - Full Individual / Proprietor KYC form.
  - Captures full name, phone, email, PAN, Aadhaar, address, PIN-based location, fleet size, GST registration/trade name/GSTIN.
  - Uploads PAN, Aadhaar front, Aadhaar back, and GST certificate when GST is enabled.
  - Uses `expo-document-picker`; accepts PDF/JPG/PNG; max file size is 5 MB.
  - Calls `submitIndividualOnboarding`, which uses a Supabase RPC so raw Aadhaar is not retained in app-side draft data.
- `apps/mobile-app/lib/auth.ts`
  - Contains onboarding helpers:
    - `getOnboardingApplicationForUser`
    - `startCustomerOnboarding`
    - `getOnboardingDocuments`
    - `saveOnboardingDraft`
    - `submitIndividualOnboarding`
  - `routeSignedInUser` routes customers to `/customer/home`.
- `apps/mobile-app/lib/types.ts`
  - Includes the onboarding application/document/customer type definitions.

Database/Supabase support:

- `supabase/migrations/202607140001_application_first_customer_onboarding.sql`
  - Adds `customer_onboarding_applications`.
  - Adds `customer_onboarding_documents`.
  - Adds RLS for applicants and managers.
  - Changes new-auth-user handling so customers are not created immediately.
- `supabase/migrations/202607140003_mobile_individual_onboarding.sql`
  - Adds storage policies for onboarding document upload/read/delete.
  - Adds `submit_individual_onboarding_application(...)`.
  - Validates PAN, Aadhaar, email, GSTIN, PIN/location, fleet size, and required documents.
  - Stores Aadhaar only as last four digits and SHA-256 hash.
- `supabase/migrations/202607140004_validate_mobile_onboarding_location.sql`
  - Validates onboarding location data against `india_locations`.

### 2. Web Portal Review of Mobile KYC Applications

The website now exposes mobile and manager onboarding records under Master Data.

Important files:

- `apps/web-portal/app/customers/applications/page.tsx`
  - Lists KYC applications.
  - Shows applicant, partner type, location, document count, source, progress, status, updated date, and review/customer links.
- `apps/web-portal/app/customers/applications/[id]/page.tsx`
  - Review page for an application.
  - Shows applicant details and signed document links.
  - Provides approval and correction actions for submitted Individual / Proprietor applications.
- `apps/web-portal/app/customers/applications/actions.ts`
  - `approveMobileIndividualApplication`
    - Validates submitted app.
    - Checks required documents.
    - Prevents duplicates by profile, phone, PAN, or Aadhaar hash.
    - Creates `customers` row.
    - Copies uploaded onboarding documents into permanent customer document records.
    - Marks onboarding app approved.
  - `requestMobileApplicationChanges`
    - Moves app to `changes_requested`.
    - Saves reviewer reason in `draft_data.review_notes`.
    - Mobile home/form reads this reason so the customer can update and resubmit.
- `apps/web-portal/app/customers/onboarding-applications.ts`
  - Shared helper for creating/updating/approving portal onboarding records.
- `supabase/migrations/202607140005_portal_onboarding_review_access.sql`
  - Lets authenticated KYC manager roles manage `customer-documents` storage objects without using a service-role key in the portal.

Navigation exposure:

- `apps/web-portal/components/claim-manager/app-navigation.tsx`
  - Adds `KYC Applications` under `Master Data`.
  - Accepts `customerCount` and `kycApplicationCount`.
- `apps/web-portal/components/claim-manager/claim-manager-shell.tsx`
  - Supplies counts and renders the updated app navigation.
- `apps/web-portal/components/shell.tsx`
  - Treats titles containing customer/KYC/vehicle/policy as `master-data` active navigation.

### 3. Latest Website Branding and Navigation Work

The website header/navigation was updated to match the mobile app brand direction.

Important files:

- `apps/web-portal/components/brand-lockup.tsx`
  - Uses the mobile clean InsureIT logo from the repo raw URL.
  - Supports compact/default/hero sizing.
  - Matches the mobile brand lockup text/tagline.
- `apps/web-portal/components/claim-manager/claim-manager-shell.tsx`
  - Uses the brand lockup in the unified portal shell.
  - Recent work replaced the older split rail navigation with a single interactive sidebar.
- `apps/web-portal/components/claim-manager/app-navigation.tsx`
  - The unified sidebar groups Claims, Master Data, Tasks, and Reports.
  - Caveat: some sidebar icon glyphs currently display as mojibake in source/output. Replace them with lucide icons or clean ASCII/Unicode once touching this file.

Related recent commits:

- `1078b66 Expose mobile KYC applications in portal`
- `9aae67c Add mobile individual KYC onboarding`
- `2a3a631 Repair missing customer signup profiles`
- `4947d35 Add application-first customer onboarding`
- `f4cc5ed Improve first launch update loading`
- `8fbc89f Apply mobile branding to login page`
- `ba90a39 Apply mobile brand lockup to website header`
- `c8992a2 Use mobile app branding in website navigation`
- `574a407 Add mobile-matched InsureIT brand lockup`
- `523c743 Replace split rail navigation with interactive unified sidebar`
- `fe4004d Add interactive unified application navigation`

## Older Mobile App Work Already Present

The mobile app already has broad customer/staff/admin surface area:

- Customer routes:
  - `apps/mobile-app/app/customer/home.tsx`
  - `claims.tsx`, `claim-detail.tsx`, `report-accident.tsx`, `upload-documents.tsx`
  - `vehicles.tsx`, `vehicle-detail.tsx`, `add-vehicle.tsx`
  - `policies.tsx`, `add-policy.tsx`
  - `support.tsx`, `raise-support-ticket.tsx`, `support-ticket-detail.tsx`
  - `insurance-quote.tsx`, `e-challan.tsx`, `notifications.tsx`, `profile.tsx`
  - legal pages under `apps/mobile-app/app/customer/legal`
- Customer dashboard components:
  - `apps/mobile-app/components/customer-dashboard/index.tsx`
  - Includes header, active claim cards, progress steps, report accident card, quick actions, summary cards, support card, and bottom navigation.
- Shared mobile UI/theme:
  - `apps/mobile-app/components/design-system/index.tsx`
  - `apps/mobile-app/components/ui.tsx`
  - `apps/mobile-app/lib/theme.ts`
- Auth experience and brand:
  - `apps/mobile-app/components/auth-experience.tsx`
  - `apps/mobile-app/components/first-look.tsx`
  - brand assets under `apps/mobile-app/assets/brand`
- Staff routes:
  - `apps/mobile-app/app/staff/*`
- Admin/agent/hierarchy routes:
  - `apps/mobile-app/app/admin/dashboard.tsx`
  - `apps/mobile-app/app/agent/dashboard.tsx`
  - `apps/mobile-app/app/hierarchy/dashboard.tsx`

## Older Web Portal Work Already Present

The web portal already contains the claim management and master-data foundation:

- Claim queue and workflow:
  - `apps/web-portal/app/claims/page.tsx`
  - `apps/web-portal/app/claims/[id]/page.tsx`
  - `apps/web-portal/components/claim-manager/*`
  - `apps/web-portal/components/spot-survey/*`
  - `apps/web-portal/components/final-documents/*`
- Dashboard:
  - `apps/web-portal/app/dashboard/page.tsx`
- Customers:
  - `apps/web-portal/app/customers/customer-workspace.tsx`
  - `apps/web-portal/app/customers/customer-onboarding-form.tsx`
  - `apps/web-portal/app/customers/dealership-onboarding-form.tsx`
  - `apps/web-portal/app/customers/group-onboarding-form.tsx`
- Vehicles:
  - `apps/web-portal/app/vehicles/page.tsx`
  - `apps/web-portal/app/vehicles/new/page.tsx`
  - `apps/web-portal/app/vehicles/[id]/edit/page.tsx`
- Shared web infrastructure:
  - `apps/web-portal/lib/auth-server.ts`
  - `apps/web-portal/lib/master-data-server.ts`
  - `apps/web-portal/lib/supabase.ts`
  - `apps/web-portal/lib/supabase-admin.ts`

## Current Functional Flow

1. Customer signs up/logs in on mobile.
2. A profile is available, but no canonical `customers` row may exist yet.
3. Customer home detects no customer record and prompts for KYC.
4. Customer selects partner type.
5. For Individual / Proprietor, customer completes the KYC form and uploads documents.
6. Mobile submits through `submit_individual_onboarding_application`.
7. Portal users with master-data permissions open `Master Data -> KYC Applications`.
8. Portal reviewer opens an application, reviews details/documents, then:
   - approves, which creates the permanent customer and document records, or
   - requests changes, which sends notes back into the mobile app.
9. After approval, mobile customer home should load the active customer dashboard data normally.

## Important Caveats / Known Gaps

- Only Individual / Proprietor KYC has a full mobile form and portal approval path. Dealership, Corporate, and Group still need mobile forms and/or final review flows.
- The mobile KYC screen stores Aadhaar only transiently in component state and submits it to the RPC; do not persist raw Aadhaar in AsyncStorage, draft data, logs, or customer-visible files.
- `app-navigation.tsx` has garbled icon characters in source. Prefer replacing those with lucide-react icons or clean text symbols during the next UI pass.
- The portal review page uses signed URLs for documents. Confirm expiry/permissions in production-like Supabase settings.
- The approval action copies documents into `customer_documents`; if this schema changes, update `approveMobileIndividualApplication`.
- Root/local environment variables are required for Supabase and Next/Expo. Check `.env.example` and app-specific setup before running.

## Recommended Next Work

1. Run verification before changing behavior:
   - `npm run typecheck:mobile`
   - `npm run typecheck:web`
   - `npm run build:web`
2. Polish the portal KYC applications UI:
   - Replace mojibake sidebar icons.
   - Add filters by status/source/partner type.
   - Add empty/loading/error states that match the new portal shell.
3. Complete mobile KYC partner types:
   - Dealership KYC.
   - Corporate KYC.
   - Group/fleet KYC.
   - Reuse the application/document model instead of creating customer rows directly.
4. Improve mobile KYC draft resilience:
   - Add explicit save-and-continue behavior.
   - Preserve local form state safely for non-sensitive fields only.
   - Keep Aadhaar out of persisted storage.
5. Add reviewer quality checks:
   - Document verification statuses per document.
   - Reject individual documents instead of only requesting application-level changes.
   - Add audit trail for review actions.
6. Connect notifications:
   - Notify mobile customer when KYC is approved, changes requested, or rejected.
   - Surface these in `NotificationBell` / notifications inbox.
7. Add regression coverage:
   - Unit or integration tests for `submit_individual_onboarding_application`.
   - Server action tests or route-level checks for approval/change request.
   - Mobile form validation tests if the test harness is added.

## Suggested Prompt for the Next ChatGPT/Codex Session

Use this prompt after opening the repo:

```text
You are continuing work on the InsureIT repo. Read docs/mobile-web-continuation-handoff.md first, then inspect the latest files it references. The latest focus is the mobile customer KYC onboarding flow and the web portal KYC application review surface.

Please continue from the current implementation without replacing the existing architecture. Preserve the application-first onboarding model:
- mobile creates/submits customer_onboarding_applications
- portal reviews and promotes approved applications into customers
- raw Aadhaar must never be persisted

Start by running typechecks/builds, then fix any current breakages. After that, continue with the next highest-value task: polish portal KYC Applications UI, clean sidebar icons, and improve the review workflow.
```
