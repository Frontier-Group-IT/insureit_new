# INSUREIT Partner App Foundation Handoff

Date: 2026-08-28 IST

## Status

The INSUREIT Partner mobile-app foundation is now implemented and production-backed.

Production backend / web merge baseline:
- Partner Policy Intake merge: `ade210a3c2da111230eacf70acfa9bee8d301dfb`
- production web deployment for that merge: READY on `portal.insureit.in`
- production Supabase project: `ilzhsfqqjyppzzvfscmh`

## Completed capability set

- Partner/POSP/MISP + authorized commercial employee identity resolution
- commercial scope resolver
- portal-account invite / activate / disable lifecycle
- separate Expo app under `apps/partner-app`
- Partner-specific session/navigation/visual system
- Home
- My Business hierarchy
- scoped Customers
- scoped Policies
- Renewals
- scoped Claims
- Activity
- Profile & registration
- Partner Policy Intake submission / tracking / replacement-document workflow
- separate EAS profiles and guarded preview APK / OTA workflows

## Policy Intake architecture

Partner mobile does not book policies directly.

~~~text
Partner app
 -> authorized lead source
 -> customer mobile
 -> policy copy
 -> signed policy-documents upload
 -> policy_intake_requests
 -> shared Document AI/OCR
 -> Operations review
 -> Policy Onboarding
 -> completed intake + final policy
~~~

`policy_intake_requests` now carries exactly one submitter:

- `submitted_by_profile_id` for employee/web submissions; or
- `submitted_by_portal_account_id` for Partner/POSP/MISP submissions.

The database enforces the exactly-one rule.

## Production verification

- 42 pre-existing Policy Intakes preserved
- 42 employee/profile submissions
- 0 portal submissions before UAT
- 0 invalid submitter rows
- 0 intermediary portal accounts remain in production
- no UAT account was silently created

## Fail-closed data gaps

The Partner app continues to hide:
- unresolved legacy Partner-family representations;
- 21 customers tied to the unresolved legacy Partner representation;
- 7 customers without intermediary attribution;
- 4 claims without commercial intermediary attribution.

No automatic repair/reassignment was performed.

## Remaining external prerequisite

A dedicated Expo/EAS project for `apps/partner-app` still needs to be created/linked under the approved Expo account.

Do not reuse the Customer app Expo project.

After linking, commit Partner-only:
- `expo.extra.eas.projectId`
- `expo.updates.url`

The repository already contains guards that refuse Partner preview build / OTA publication until this dedicated project identity exists.

## Next recommended step

Select one approved UAT Partner/POSP/MISP identity, activate its portal account through the controlled lifecycle, then perform end-to-end UAT on:
1. login;
2. Home/My Business scope;
3. Customers/Policies/Renewals/Claims;
4. Policy Intake submission;
5. Operations review;
6. needs-attention replacement;
7. final policy onboarding;
8. account disable/revoke.

Do not create a production intermediary account merely for convenience; use an explicitly approved UAT identity.
