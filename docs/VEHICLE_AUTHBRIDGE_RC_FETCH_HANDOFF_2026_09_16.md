# Vehicle Onboarding AuthBridge RC Fetch Handoff — 2026-09-16

## State

**IMPLEMENTED on feature branch `feat/vehicle-authbridge-rc-fetch`; not merged and not deployed.**

This change adds an AuthBridge Detailed RC fetch/review workflow to the internal web portal Vehicle Onboarding page at `/vehicles/new`.

## User flow

1. User enters the RC / Registration number.
2. User clicks **Fetch**.
3. The browser obtains the current Supabase access token and calls the protected portal route `POST /api/vehicles/rc-lookup`.
4. The server verifies the authenticated profile is active and has edit-level `create_vehicles` or `view_vehicles` capability.
5. The server checks `vehicle_rc_lookup_cache` first.
6. A valid cached provider response is reused; otherwise the existing server-only AuthBridge gateway client calls Detailed RC service 372.
7. The server returns approved normalized vehicle fields plus sanitized provider RC detail sections. Provider credentials, relay secrets, tokens and encrypted technical fields are excluded.
8. The portal opens a scrollable **Vehicle RC Details** popup showing all sanitized RC detail fields returned by the provider sections.
9. Clicking **OK** applies supported fields to the existing Vehicle Onboarding form.

## Form mapping applied after OK

Where a safe destination exists, fetched values are applied to:

- RC / Registration number
- Registration date
- Manufacturer, only when the provider value safely matches an existing select option
- Manufacturing year
- Model
- Vehicle class
- Chassis number
- Engine number
- Fuel type
- Existing Capacity field using class-aware precedence: GVW for GCV, seating for PCV, engine CC for PCP/TWP
- Fitness expiry
- PUC expiry
- Road tax expiry
- National permit expiry
- Local permit expiry

Provider fields without a current Vehicle Onboarding destination remain visible in the review popup instead of creating new form/schema fields. This includes fields such as insurance, permit metadata, finance/hypothecation, RC status, RTO and other sanitized provider details.

## Cache and fallback

The workflow reuses the existing `vehicle_rc_lookup_cache` table and the established 30-day TTL. No migration is introduced.

If AuthBridge fails and a cached raw provider response exists, the route returns it as a stale controlled fallback and the popup explicitly labels it **Cached fallback** so the user reviews it before applying.

## Security boundaries

- AuthBridge credentials and gateway relay secret remain server-only.
- The browser never calls TruthScreen/AuthBridge directly.
- Decrypted provider payloads are not logged.
- Server logs redact RC values in provider/cache failure reasons.
- Popup data is derived from the provider RC payload only after filtering technical secret/token/encryption keys.
- The full raw provider JSON is not returned as an unrestricted blob to the client.
- Access is limited to authenticated active profiles with edit-level vehicle capability.

## Files

- `apps/web-portal/app/api/vehicles/rc-lookup/route.ts` — protected internal web RC lookup, cache reuse, AuthBridge call, mapping, sanitized popup sections and stale fallback.
- `apps/web-portal/components/vehicle-registration-fields.tsx` — Fetch button, request state, errors, RC review popup and OK/apply behavior.
- `apps/web-portal/components/vehicle-class-capacity-fields.tsx` — receives applied RC class/capacity values safely for controlled fields.

## Verification state

Repository implementation is committed on the feature branch. Canonical GitHub Actions verification must pass on the pull request before merge. No production deployment or database change is authorized by this implementation.
