# Customer Life / Health Policy Card — 2026-09-30

## State

**PR #2618 was MERGED as `802ac93a5935c4fe83257800a9ec9f415d5fc523` and its Customer production OTA completed successfully. Follow-up branch `ui/customer-policy-kpi-life-health-refine` refines the Policies filters and Life/Health presentation; IMPLEMENTED, PR/CI/merge/OTA pending.**

## User-approved layout

Customer App → Policies keeps the existing Motor policy card body unchanged. The page now adds a compact business-category KPI/filter rail above the search section:

- `All | Motor | Non-Motor | Health | Life`;
- `All` is selected by default;
- each card shows its current policy count;
- selecting a KPI card filters the visible policy list by that category while the existing status filters and search continue to apply.

Life and Health policies use the dedicated vertical card layout:

- existing policy stage/status remains at the top left;
- compact `LIFE` / `HEALTH` badge appears at the far right of the same header row with a navy background and white text;
- existing insurer/policy/expiry summary remains on the left;
- upper-right summary shows Policy No. and `PPT - Premium Payment Term` without the old default heart/shield category icon beside them;
- the compact three-column row shows Product Name | Payment Frequency | `PD - Policy Duration`;
- a compact protection strip sits below the metrics row, using `Stay protected. Stay healthy.` for Health and `Protecting what matters most.` for Life;
- the protection-strip heart artwork is red;
- Life/Health cards do not render Motor vehicle details or `Vehicle unavailable`.

## Data contract

The list continues to read canonical `policies` records and, for Life/Health, joins `life_health_policy_details` by `policy_id` for:

- `premium_paying_term` → Premium Payment Term
- `payment_frequency` → Payment Frequency
- `policy_duration` → Policy Duration

`policies.policy_product` supplies Product Name. Missing optional values render as `-`; no value is fabricated.

Life/Health recognition uses `policies.business_line` first-class values and retains a `policy_type` fallback for compatibility. Category filtering resolves Life/Health first, then Motor/Non-Motor from business line / policy type, with vehicle presence retained as the compatibility fallback for older policy rows that do not carry a normalized business-line value.

## Null-vehicle continuity fix

Life/Health policies legitimately have no vehicle. The visible-policy dedupe groups vehicle-backed policies by vehicle as before, while a policy with no vehicle is keyed by its own source + policy id. This prevents multiple Life/Health policies from collapsing into a single null-vehicle entry.

## Safety / release boundary

- No Supabase schema or RLS change.
- No API/RPC or policy-write behavior change.
- No native dependency/config/runtime change.
- No APK/AAB created or authorized.
- Focused Customer Life/Health regression coverage now also guards the five category KPI filters, expanded PPT/PD labels, navy type badge, removed upper-right category icon, and red protection-strip heart.
- Production schema application is not required because this follow-up contains no Supabase migration.
- OTA must only be published from exact current `main` after merge and explicit release instruction, followed by installed-device verification.
