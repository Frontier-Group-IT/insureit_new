# Customer App existing-master linking handoff — 2026-09-26

## Problem

A customer can already exist in the verified INSUREIT customer master (typically created by Policy Onboarding) before the same person first signs into the Customer App. The pre-fix `ensure_customer_signup_profile` flow resolved an existing customer only by `profile_id` or active `customer_memberships`. If the operational customer had neither, the mobile signup created a new `direct_customer_onboarding` customer row and attached the authenticated profile to that empty row. The Customer App then correctly loaded customer contexts from memberships, but the membership pointed at the new empty customer instead of the established master that owns the fleet/policies.

Production evidence on 2026-09-26 showed the concrete Shree Transport Company split: the operational master owns 91 vehicles but had no profile/membership; a later phone-auth signup created a same-name empty direct-signup customer and membership. No vehicle data was missing.

## Security/business rule

Phone is not the customer UUID and must never be used as a broad fleet-access key. The `customers` table explicitly permits the same mobile number on multiple customer masters when insured/customer identities differ.

Automatic linking is therefore allowed only when all of the following are true:

- the phone comes from the authenticated Supabase `auth.users.phone` identity;
- the submitted phone, when present, matches the verified auth phone after normalization;
- the candidate master is active and unowned (`profile_id is null`);
- the candidate is an individual/proprietor-style master, not a Group/Corporate/Dealership portfolio owner;
- normalized verified phone matches;
- normalized customer identity is an exact match against contact name, company name, or legal trade name;
- exactly one eligible candidate exists;
- no different active profile already owns the candidate through `customer_memberships`.

If more than one candidate matches, the flow fails closed and requires review. It must never select one arbitrarily.

## Implementation

Branch: `fix/customer-mobile-existing-master-link`

Migration: `supabase/migrations/20260926121500_customer_verified_mobile_existing_master_link.sql`

The migration adds private helper functions to normalize mobile/name values, conservatively verify that a fresh Customer App master has no operational dependencies, and claim a unique existing customer master. It replaces `ensure_customer_signup_profile` so a verified phone-auth signup attempts this unique claim before creating a new customer.

For an already-created empty direct-signup duplicate, the repair does **not** move vehicles, policies, claims, documents, commercial rows, activity, or other business records. Instead it:

1. removes the authenticated profile's membership from the empty duplicate;
2. clears the duplicate's `profile_id` and records its canonical customer in `origin_customer_id`;
3. assigns the authenticated profile to the established customer master;
4. creates/updates the owner membership on that established master;
5. records audit action `customer_mobile_signup_claimed_existing`.

The duplicate row is retained for audit rather than deleted.

A one-time migration repair applies the same strict criteria to existing empty mobile-signup duplicates. Ambiguous records are skipped rather than guessed.

## Production impact simulation before migration application

Read-only production analysis found:

- 3 empty direct-signup customer records eligible for evaluation;
- 1 has exactly one safe existing-master match;
- 2 have no eligible existing-master match and will remain unchanged;
- 0 are ambiguous under the strict matching rule;
- the one safe match is the reported Shree Transport Company case with its 91-vehicle canonical fleet.

This confirms the migration is deliberately narrow: it repairs the proven split without bulk-merging unrelated customers.

## Workflows

- Apply workflow: `.github/workflows/apply-customer-verified-mobile-existing-master-link.yml`
- PR safety workflow: `.github/workflows/verify-customer-verified-mobile-existing-master-link.yml`

The verification contract ensures verified-phone usage, exact normalized identity matching, fail-closed ambiguity handling, empty-duplicate protection, audit evidence, and that no phone-based vehicle query is introduced in the mobile app.

## Mobile/runtime boundary

No Customer App source/native dependency/runtime/APK/AAB change is required. The installed app already resolves accessible customer contexts from `customer_memberships` and loads vehicles by customer UUID. Once the canonical membership is repaired, a normal context/session refresh reads the established fleet.

## State

**IMPLEMENTED on branch only. PR/CI/merge/migration application/runtime verification pending. Production database has not been changed by this branch yet.**
