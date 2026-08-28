# INSUREIT Partner App — Identity and Commercial Scope Architecture

> Prepared: 2026-08-27 IST
>
> This document freezes the first implementation boundary for the separate **INSUREIT Partner** mobile app. It is based on the current production schema and the verified Intermediary Group rollout. Do not create a second mobile-only hierarchy or intermediary identity model.

## 1. Product boundary

INSUREIT Partner is a separate Expo application for permanent Partners, linked POSP/MISP accounts, Relationship Managers, Sales Managers / ASM / Zonal Head / Sales Head, and other explicitly authorized commercial employees.

It is not the existing customer app under `apps/mobile-app` and it is not the future Operations app.

Recommended repository shape:

~~~text
apps/
  web-portal/
  mobile-app/       # existing customer app
  partner-app/      # new INSUREIT Partner app
~~~

The Partner app should have its own Expo project, native package/bundle identifiers, runtime/channel, navigation shell, release lifecycle and visual system.

## 2. Canonical commercial hierarchy

The authoritative hierarchy remains:

~~~text
Sales Employee
  -> optional Intermediary Group
      -> permanent Partner family
          -> linked POSP/MISP
~~~

Ungrouped is valid:

~~~text
Sales Employee
  -> permanent Partner family
      -> linked POSP/MISP
~~~

Grouping is always attached to `partners.id`. POSP/MISP is never an independent Group member.

## 3. Intermediary login bridge

Production already contains `public.intermediary_portal_accounts`.

It is the authoritative authentication bridge for Partner/POSP/MISP app identities.

Relevant columns include `intermediary_id`, `application_id`, `auth_user_id`, `email`, `status`, and invite/activation/disable audit timestamps.

Verified production constraints:

- one portal account per `intermediary_id`;
- one portal account per `auth_user_id`;
- `auth_user_id` references `auth.users(id)`;
- status is one of `invited`, `active`, `disabled`;
- RLS is enabled;
- authenticated self-read policy is `auth_user_id = auth.uid()`.

As of 2026-08-27, production has **0 intermediary portal accounts**. Therefore Partner/POSP/MISP login activation has not yet been rolled out.

Do not overload `profiles.employee_id`, `intermediaries.associate_profile_id`, or auth metadata as a substitute for this bridge.

## 4. Employee login identity

Commercial employees continue to authenticate through the existing Supabase Auth + `profiles` model.

The production `app_role` enum already includes `relationship_manager`, `sales_manager`, `asm`, `zonal_head`, `sales_head`, `sales_operations_head`, `intermediary`, plus existing admin/operations roles.

The current customer mobile app TypeScript `AppRole` is behind production and must not be copied as the Partner app source of truth.

Partner-app employee access should resolve from:

~~~text
auth.uid()
  -> profiles.id
  -> profiles.employee_id
  -> employees.id
  -> effective permission / hierarchy scope
~~~

Do not infer commercial authority only from a role string.

## 5. Partner-family resolution

Every intermediary app identity must resolve to one permanent Partner family before business data is returned.

For a permanent Partner intermediary, resolve the canonical `partners.id` through the existing Partner/application relationship.

For POSP/MISP, resolve through the onboarding/registration linkage to `partner_record_id`.

If an intermediary cannot resolve to exactly one permanent Partner family, the Partner app must fail closed and show an account-support state. Do not guess by name, phone, email or intermediary code.

A known legacy representation inconsistency exists in production where one intermediary row typed as `partner` is not a separate permanent Partner family. It must not be treated as a new family merely because of its register type.

## 6. Current commercial attribution

Verified production state on 2026-08-27:

- 593 customers total;
- 586 customers have `lead_source_intermediary_id`;
- 442 customer relationships currently point to Partner intermediary rows;
- 144 point to POSP intermediary rows;
- 7 customers are unresolved by this attribution field;
- 626 policies total;
- all 626 have an intermediary code;
- all 626 have `rm_employee_id`;
- existing historical policies have not been backfilled into Intermediary Group snapshot fields.

The Partner app should use existing commercial attribution and the canonical Partner-family resolver. It must not introduce a second customer-to-Partner attribution table unless a separately approved gap requires it.

## 7. Identity resolver contract

The first backend contract for the Partner app should return one authoritative actor context for the authenticated user.

Conceptual result:

~~~text
actor_kind:
  employee | intermediary

employee context:
  profile_id
  employee_id
  role
  effective capabilities
  allowed employee scope

intermediary context:
  portal_account_id
  intermediary_id
  intermediary_type
  partner_id
  account_status
~~~

Resolution order must be explicit and ambiguity must fail closed.

The mobile app must not perform broad table reads and reconstruct authorization locally.

## 8. Commercial scope contract

The second backend contract should return authorized commercial scope rather than raw hierarchy tables.

For an intermediary identity:

- Partner -> own permanent Partner family;
- POSP/MISP -> same permanent Partner family for business attribution;
- no peer intermediary private account data is exposed.

For an employee identity:

- Relationship Manager -> owned Groups plus owned ungrouped Partner families, constrained by effective permissions;
- Sales management -> authorized downline employee scope, then their Groups/Partner families;
- broader commercial roles -> only the scope granted by the existing access-control engine.

Intermediary Groups remain server-mediated. Partner/POSP/MISP must not receive direct Group mutation access.

## 9. Business-data visibility

Authorized Partner-app reads should be derived from the resolved Partner-family / employee scope and existing attribution:

- customers through commercial intermediary attribution;
- policies through canonical intermediary attribution and RM ownership;
- claims through authorized customer/policy scope;
- renewals through authorized policies/vehicles;
- Group hierarchy only for employee-management views where permitted.

A POSP/MISP may contribute business to the parent Partner family without gaining visibility into peer intermediary account data.

## 10. Required backend foundation before feature screens

Before building Home, My Business, Customers or Policies, implement and verify server-side contracts equivalent to:

1. current Partner-app identity;
2. current commercial scope;
3. authorized Partner-family list for employee users;
4. authorized customer/policy scope;
5. business summary derived from those authorized records.

Exact RPC/view names should follow repository conventions after implementation review.

## 11. Portal-account activation workflow

A separate controlled workflow is required to activate Partner/POSP/MISP logins.

It must:

- select one valid intermediary record;
- create/invite one Supabase Auth user;
- bind it to one `intermediary_portal_accounts` row;
- activate only after required verification;
- support disable/revoke;
- preserve audit history;
- never auto-create accounts for unresolved/ambiguous legacy intermediary rows.

No production intermediary account should be created merely to test architecture. Use a dedicated approved test intermediary when rollout reaches UAT.

## 12. App foundation order

Implementation sequence:

1. backend identity resolver;
2. backend commercial-scope resolver;
3. portal-account invite/activation workflow;
4. create `apps/partner-app`;
5. Partner-specific auth/session layer;
6. role-aware navigation shell;
7. Home summary;
8. My Business hierarchy;
9. Customers;
10. Policies / policy intake;
11. Renewals;
12. Claims;
13. activity/notifications;
14. profile/registration;
15. release hardening and separate Expo preview channel/build.

## 13. Visual boundary

The Partner app should reuse INSUREIT brand fundamentals but not the customer-app experience.

Customer app emphasis: policyholder, fleet, protection, claims.

Partner app emphasis: business production, portfolio, hierarchy, renewals, pipeline and action.

Do not directly copy the customer dashboard, customer bottom navigation, customer onboarding flow or customer role-routing implementation.


## 14. Implementation status — 2026-08-28

The foundation sequence in Section 12 is now implemented through the repository and production backend:

- identity resolver: live;
- commercial scope resolver: live;
- portal-account invite / activation / disable lifecycle: live;
- separate `apps/partner-app`: merged;
- Partner-specific auth/session layer: merged;
- role-aware navigation shell: merged;
- Home and My Business: merged;
- Customers: merged with authenticated scoped RPCs;
- Policies: merged with authenticated scoped RPCs;
- Renewals: derived from the scoped policy contract;
- Claims: merged with authenticated scoped RPCs;
- Activity: merged from scoped Policy + Claim data;
- Profile / registration identity surface: merged;
- release hardening: EAS profiles and guarded preview build/OTA workflows prepared;
- Partner-originated Policy Intake: live through the existing Operations Policy Intake queue, signed `policy-documents` upload, shared Document AI/OCR service, Operations review, replacement-document response and final Policy Onboarding handoff.

Production intermediary portal accounts intentionally remain at zero until an approved UAT Partner/POSP/MISP identity is selected.

### Outstanding external setup

The repository cannot create the Expo/EAS project without Expo account authorization. The Partner app must be linked to a **new** EAS project under the approved Expo owner. It must never reuse the Customer app project ID or update URL.

After linking, commit the generated Partner-only:

- `expo.extra.eas.projectId`;
- `expo.updates.url`.

The guarded Partner build/OTA workflows will then become executable.

### Known data gaps kept fail-closed

- the known legacy intermediary row that does not resolve to one active permanent Partner family;
- 21 customers attributed to that unresolved legacy Partner representation;
- 7 customers with no lead-source intermediary;
- 4 claims whose customers have no commercial intermediary attribution.

These records are not silently reassigned by the Partner app.


## 15. Partner Policy Intake implementation — production baseline

Merged PR: **#757 — Complete Partner Policy Intake workflow**.

Production merge commit: `ade210a3c2da111230eacf70acfa9bee8d301dfb`.

Production schema now supports two explicit submitter identities on `policy_intake_requests`:

~~~text
submitted_by_profile_id
submitted_by_portal_account_id
~~~

The database constraint requires **exactly one** to be present. Existing employee/web intakes remain profile submissions; Partner/POSP/MISP submissions use the portal-account identity.

The mobile workflow is:

~~~text
INSUREIT Partner
  -> authorized lead source
  -> customer mobile
  -> PDF/JPG/PNG/WebP policy copy (max 15 MB)
  -> signed upload into policy-documents
  -> existing policy_intake_requests queue
  -> shared Document AI/OCR parser stack
  -> Operations review
  -> needs-attention replacement response when required
  -> existing Policy Onboarding
  -> final policy link and intake completion
~~~

Security rules:

- intermediary users cannot choose another intermediary as the lead source;
- employee users can choose only an intermediary returned by their existing commercial-scope contract;
- mobile users can list/respond only to their own submitted intakes;
- Partner mobile receives no direct policy-booking RPC;
- no service-role credential is present in the Partner app;
- Operations review/finalization remains web-portal controlled;
- no peer Partner/POSP/MISP intake data is exposed.

Production verification after migration:

- 42 existing intakes preserved;
- 42 employee/profile submissions;
- 0 portal submissions before UAT;
- 0 rows violate the exactly-one-submitter invariant;
- intermediary portal accounts remain 0 until an approved UAT account is intentionally activated.

The web/API deployment for the merge is READY on `portal.insureit.in`.

### Remaining external release prerequisite

The app foundation itself is complete. The only external release prerequisite is linking `apps/partner-app` to a **new, dedicated Expo/EAS project** under the approved Expo account and committing its generated Partner-only `projectId` and `updates.url`. The guarded workflows refuse to build/publish if these values are absent or reuse the Customer app identity.
