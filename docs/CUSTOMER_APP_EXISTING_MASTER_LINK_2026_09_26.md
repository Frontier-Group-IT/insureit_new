# Customer App Existing-Master Identity Link — 2026-09-26

## Problem

Customer App phone signup could create a new zero-asset `customers` row even when Operations/Policy Onboarding already had the same real customer master with vehicles, policies and other dependencies. The app then correctly loaded only the newly-created customer ID from `customer_memberships`, so the customer's existing fleet was invisible.

## Verified production finding

The live audit found two currently repairable same-identity pairs. In both cases a Customer App `direct_customer_onboarding` row with a profile/membership had exactly one older active, unclaimed customer master with the same normalized phone and the same normalized account/customer name. One case was the reported large-fleet customer; the other also exposed a policy/vehicle customer mismatch split across the two duplicate masters.

No repair in this change is based on mobile number alone.

## Durable identity rule

Customer mobile is contact data and is intentionally not globally unique. Different insured/customer names may share one mobile number.

Customer App may automatically link a verified login to an existing customer master only when all of the following are true:

1. the phone comes from the authenticated Supabase user and exactly matches after normalization;
2. the submitted account/customer name exactly matches the existing contact/company/legal-trade name after conservative normalization;
3. the existing customer is active;
4. the existing customer is unclaimed by another profile/active membership; and
5. exactly one candidate matches.

If multiple exact candidates match, account linking must stop for manual review. Same-phone/different-name customers must remain separate.

Mobile fleet/policy/claim access remains customer-ID/membership based. Do not make mobile screens query business data by phone number as a workaround.

## Implementation

Branch: `fix/customer-app-existing-master-link`

Migration: `20260926130000_customer_app_existing_master_link.sql`

The migration:

- adds privacy-neutral phone/name normalization helpers;
- repairs only current unambiguous Customer-App-created duplicates matching the strict rule above;
- keeps the older business master as canonical;
- moves customer-scoped FK dependencies from the accidental direct-signup duplicate to the canonical master;
- moves the authenticated profile and primary membership to the canonical master;
- preserves/fills only missing customer/KYC attributes from the duplicate;
- records an audit event before removing the accidental duplicate;
- replaces `ensure_customer_signup_profile(...)` so future verified-phone signups claim exactly one matching unclaimed master before creating a new customer;
- blocks ambiguous exact matches instead of guessing.

Dedicated schema workflow: `apply-customer-app-existing-master-link.yml`.

Canonical web regression: `customer-app-master-link:regression`.

The production deployment gate is updated so this migration must apply successfully before Vercel deployment can continue.

## Safety boundaries

- Do not restore a global unique-mobile constraint.
- Do not merge same-phone/different-name customers.
- Do not auto-link ambiguous duplicate candidates.
- Do not expose customer fleet access through phone-based application queries.
- Do not delete or recreate vehicle/policy/claim business records; reassign their customer FK only when repairing a proven accidental duplicate.
- Preserve audit evidence for both future links and one-time repairs.

## Evidence state

**IMPLEMENTED on feature branch. PR/CI/merge/migration application/production verification pending.**

No APK/AAB or native-runtime change is required for this database identity fix. Existing Customer App sessions may need a fresh context load/sign-in after production repair before the corrected membership is reflected on-device.
