# External Renewal AuthBridge Enrichment + AI Readiness Gate — 2026-09-18

## Purpose

External Renewal Opportunities may enter INSUREIT with only a customer/contact name, mobile number, vehicle registration number and policy expiry context. Sarvam must not invent missing vehicle or insurer facts.

This phase adds an IT-Super-User-controlled RC enrichment step before production AI dispatch.

## Flow

```text
External Renewal Opportunity
  -> IT Voice Integration queue
  -> Fetch details
  -> existing server-only AuthBridge Detailed RC client
  -> reuse fresh vehicle_rc_lookup_cache when available
  -> otherwise protected AuthBridge service 372 lookup
  -> store privacy-minimized External Renewal enrichment snapshot
  -> AI-ready
  -> IT Call
  -> Sarvam cohort
```

## AI context

The existing Sarvam agent contract remains unchanged. The enriched snapshot is used only to improve approved existing variables:

- `vehicle_make_model`
- `vehicle_number`
- `current_insurer`
- `policy_expiry_date`

`customer_name` and mobile continue to come from the External Renewal Opportunity.

`previous_idv` and `previous_premium` remain null because AuthBridge service 372 does not provide verified values for them.

Policy number may be retained in the privacy-minimized enrichment snapshot for workflow continuity, but it is not added to the Sarvam app-variable contract in this phase.

## Safety boundaries

- exact `it_super_user` + `manage_system=approve` is required for Fetch details;
- Partner users receive no AuthBridge action;
- AuthBridge and gateway secrets remain server-only;
- raw AuthBridge payloads remain only in the existing server-only 30-day RC cache;
- the External Renewal row stores only approved normalized fields;
- owner identity, address and unrelated provider fields are not copied into the opportunity;
- Customer, Vehicle and Policy masters are not read/written as conversion targets;
- no AI call can be created until `rc_enrichment_status = ready`;
- Fetch details cannot call Sarvam;
- Call still rechecks kill switch, calling window, campaign state, DNC/terminal state and duplicate active attempts.

## Schema

Migration:

`supabase/migrations/20260918235000_external_renewal_rc_enrichment.sql`

Adds to the isolated `external_renewal_opportunities` layer:

- `rc_enrichment_status`
- `rc_enrichment_source`
- `rc_enrichment_details`
- `rc_enriched_at`
- `rc_enrichment_error_code`

Allowed states:

- `not_fetched`
- `ready`
- `no_data`
- `failed`

Sources:

- `local_cache`
- `authbridge`
- `stale_cache`

## UI

The production Calling Queue adds an **RC data** column.

For otherwise callable records that are not enriched, IT sees **Fetch details** instead of Call.

After successful enrichment the row becomes **Ready** and the existing Call action becomes available, subject to the normal production dispatch gates.

## Cache behavior

The existing `vehicle_rc_lookup_cache` is checked first.

- fresh cache: reuse without provider spend;
- no fresh usable cache: call the protected AuthBridge client;
- successful live response: cache it under the existing 30-day policy;
- live provider failure with usable historical cache: controlled stale-cache fallback;
- no usable provider/cache context: mark the opportunity failed/no-data and keep AI calling blocked.

## Explicitly not implemented

Bulk automatic enrichment is intentionally deferred. AuthBridge calls can be slow/billable, and the normal Vercel request path should not hold an unbounded batch. This phase establishes safe single-record enrichment first; a bounded async worker can be added later after production evidence.

## Evidence state

- branch: `feat/external-renewal-authbridge-enrichment`
- implementation: **IMPLEMENTED**
- migration: **COMMITTED, NOT APPLIED**
- CI: **PENDING**
- merge: **PENDING**
- deployment: **PENDING**
- live AuthBridge enrichment test: **PENDING**
- live Sarvam call using enriched context: **PENDING**
