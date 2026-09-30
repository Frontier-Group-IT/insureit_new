# Customer Life / Health Policy Card — 2026-09-30

## State

**MERGED in PR #2618 as `802ac93a5935c4fe83257800a9ec9f415d5fc523`; canonical mobile and web verification passed on feature head `84aae184241844faa0de099d374f40ba68bd3bd9`. Production web deployment is pending.**

## User-approved layout

Customer App → Policies keeps the existing Motor policy card layout unchanged. Life and Health policies use a dedicated vertical card layout:

- existing policy stage/status remains at the top left;
- compact `LIFE` / `HEALTH` badge appears at the far right of the same header row;
- existing insurer/policy/expiry summary remains on the left;
- upper-right Life/Health summary shows a default category icon plus Policy No. and PPT;
- the compact three-column row shows Product Name | Payment Frequency | PD (Policy Duration);
- a compact protection strip sits below the metrics row, using `Stay protected. Stay healthy.` for Health and `Protecting what matters most.` for Life;
- Life/Health cards do not render Motor vehicle details or `Vehicle unavailable`.

## Data contract

The list continues to read canonical `policies` records and, for Life/Health, joins `life_health_policy_details` by `policy_id` for:

- `premium_paying_term` → PPT
- `payment_frequency` → Payment Frequency
- `policy_duration` → PD

`policies.policy_product` supplies Product Name. Missing optional values render as `-`; no value is fabricated.

Life/Health recognition uses `policies.business_line` first-class values and retains a `policy_type` fallback for compatibility.

## Null-vehicle continuity fix

Life/Health policies legitimately have no vehicle. The visible-policy dedupe now groups vehicle-backed policies by vehicle as before, while a policy with no vehicle is keyed by its own source + policy id. This prevents multiple Life/Health policies from collapsing into a single null-vehicle entry.

## Safety / release boundary

- No Supabase schema or RLS change.
- No API/RPC or policy-write behavior change.
- No native dependency/config/runtime change.
- No APK/AAB created or authorized.
- Added a focused Customer Life/Health policy-card regression to the canonical mobile verification workflow.
- Production schema application is not required because PR #2618 contains no Supabase migration.
- OTA must only be published from exact current `main` after merge and explicit release instruction, followed by installed-device verification.
