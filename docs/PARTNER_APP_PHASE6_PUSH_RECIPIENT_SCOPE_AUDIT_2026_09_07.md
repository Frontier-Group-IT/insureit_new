# INSUREIT Partner — Phase 6 push recipient scope audit

> Date: 2026-09-07 IST
> Status: DESIGN/AUDIT ONLY — NO ACTIVE DELIVERY

## Purpose

Define the minimum safe recipient-resolution contract for future Partner push notifications without activating production delivery, querying device tokens from the mobile client, or widening Partner commercial scope.

## Existing security boundary to preserve

- Partner data visibility is already mediated by authenticated `partner_app_*` RPCs and the commercial-scope model.
- Claim mobile reads use `partner_app_claim_summary`, `partner_app_list_claims`, and `partner_app_claim_detail`; push must never create a broader claim audience than these server-authorized surfaces.
- Push-device registration is server-mediated through `/api/partner/push-devices`; the mobile app never reads `partner_push_devices` directly.
- `partner_push_devices` is designed for server-side service-role access only with RLS enabled and direct `anon` / `authenticated` privileges revoked.
- The current notification template layer is intentionally privacy-minimized and non-active.

## Recipient-resolution rule

A future sender must resolve recipients in two independent steps and intersect them:

1. Resolve the authorized Partner actors for the business event using the same canonical Partner identity/commercial-scope relationships that back the corresponding `partner_app_*` read contract.
2. Resolve only active push devices belonging to those already-authorized actor IDs.

No device row may create business authorization. Device ownership is a delivery endpoint only.

## Event-specific audience contract

### Renewal due

- Source event must identify the canonical policy/renewal record server-side.
- Candidate recipients are only Partner actors whose current commercial scope already includes that renewal/policy through the normal Partner renewal/policy contracts.
- No customer name, policy number, vehicle number or premium is required in the push payload.
- Destination remains the scope-checked `/renewals` list.

### Claim update

- Source event must identify the canonical claim server-side.
- Candidate recipients are only Partner actors whose current commercial scope already includes that claim through the normal Partner claim contracts.
- Claim assignment/relationship changes must affect recipient eligibility immediately; stale historical ownership must not be treated as continuing authorization.
- Destination remains `/(tabs)/claims`.

### Policy Intake attention / approved / rejected

- Source event must identify the canonical Policy Intake server-side.
- Candidate recipients are restricted to the Partner actor(s) who currently own or are explicitly authorized to see that intake under the existing Policy Intake server contract.
- Cross-actor intake metadata must not be exposed merely because another actor belongs to the same broader Partner organization.
- Destination remains `/policy-intakes`.

## Fail-closed requirements

A future sender must skip delivery when any of the following is true:

- event record no longer exists;
- current Partner scope cannot be resolved;
- recipient resolution returns an actor not currently authorized for the event;
- device is inactive;
- device actor does not match a currently authorized actor;
- device app version/project/platform fails the existing registration identity contract;
- template event type is unknown;
- the event would require embedding sensitive record identifiers in the lock-screen payload.

## Recipient data minimization

The sender should need only:

- event type;
- canonical server-side record ID for authorization resolution only;
- resolved Partner actor ID(s);
- active Expo token(s) for those actors;
- generic template key and approved list destination.

Do not copy customer, policy, claim, vehicle, phone, email or premium fields into a notification queue/payload unless a separately reviewed requirement explicitly authorizes it.

## Delivery architecture boundary

The following remain deliberately out of scope for this audit:

- querying production `partner_push_devices`;
- Expo/APNs/FCM calls;
- credentials;
- queue/cron/webhook/event trigger;
- retry/receipt processing;
- stale-token cleanup;
- production migration application;
- APK/AAB/OTA publication.

## Implementation gate for the next code slice

Before any sender code is allowed to call Expo/APNs/FCM, add a server-only recipient resolver with regression coverage proving:

- business authorization is derived before device lookup;
- active devices are filtered by resolved actor IDs only;
- event-specific scope uses the same authoritative Partner relationships as the existing read contracts;
- unknown/missing/out-of-scope events produce zero recipients;
- no PII/business identifiers are returned to the notification template layer;
- no authenticated/mobile code receives service-role access or raw device-table access.

That resolver may be implemented and tested without activating delivery, but production use still requires explicit migration/credential/delivery approval.
