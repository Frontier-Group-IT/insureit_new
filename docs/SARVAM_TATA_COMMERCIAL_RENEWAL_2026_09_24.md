# Tata Commercial Renewal Voice Campaign — 2026-09-24

## Scope

This slice adds Tata Commercial **non-breaking renewal** support to the existing IT Super User Voice Integration workflow.

Explicitly in scope:
- Tata workbook `Renewal` sheet only.
- Existing reusable Sarvam renewal execution campaign.
- IT Super User campaign upload/review/start controls.
- Phone-level grouping for multi-vehicle customers.
- Tata source insurer/policy/expiry/customer/vehicle context.
- Campaign-aware greeting and repeat-call memory.
- Cashless claim assistance as the primary Tata renewal service pitch.

Explicitly out of scope:
- `Breaking Case` sheet/import/calling logic.
- Guaranteed claim approval or guaranteed 100% cashless settlement.
- Partner-side call controls.
- Automatic call start on upload.
- Verified Customer/Vehicle/Policy master writes.

## Import contract

The campaign importer still accepts standard RC + mobile Excel/CSV campaigns.

When an Excel workbook contains a `Renewal` sheet with the Tata Commercial column family, INSUREIT treats it as `tata_commercial_renewal` and:
- reads only `Renewal`;
- ignores `Breaking Case` even when present in the same workbook;
- has no fixed customer/source-row ceiling; upload capacity is governed by file processing limits rather than a hard row-count cap;
- normalizes Registration Number, Contact Number and Second number;
- preserves customer name, manufacturer/model, current insurer, policy number and policy expiry;
- groups valid rows by usable mobile so one customer/mobile is called once even when multiple Tata vehicles are due;
- chooses the earliest-expiring vehicle as the primary call context;
- stores the other due vehicles in campaign-scoped context, not verified business masters;
- does not require AuthBridge enrichment when the Tata campaign source context is complete enough for calling.

For the approved source workbook used during implementation, the Renewal sheet has 406 source rows. Under the implemented validation/grouping rules it resolves to 264 callable mobile groups, with 45 additional vehicle rows grouped into those prospects. Invalid/incomplete source rows remain rejected/held and are never auto-called.

## Campaign context sent to Sarvam

INSUREIT now supports these additional dynamic cohort variables:
- `campaign_type`
- `calling_brand`
- `vehicle_brand_context`
- `primary_sales_pitch`
- `cashless_claim_pitch`
- `renewal_bucket`
- `days_to_expiry`
- `vehicle_count`
- `vehicle_context_summary`
- `current_policy_number`
- `repeat_call`
- `previous_connected_call_count`
- `last_call_disposition`
- `last_call_summary`
- `last_customer_interest`
- `last_customer_objection`
- `last_follow_up_time`

The existing variables such as `opening_line`, customer identity, vehicle, insurer and policy expiry remain supported.

Tata campaign defaults:
- `campaign_type=tata_commercial_renewal`
- `calling_brand` is optional. For Tata Commercial campaigns, if it is absent, INSUREIT now uses a brand-neutral Anjna introduction and does **not** fall back to Frontier JCB.
- `vehicle_brand_context=Tata Commercial`
- `primary_sales_pitch=cashless_claim_support`

## Cashless claim sales rule

Cashless claim **assistance/support** is the primary Tata renewal value proposition.

Approved meaning:
- Frontier assists the customer through the cashless claim process and coordination.
- The agent may present this as the main service benefit of renewing through Frontier.

Forbidden meaning:
- cashless settlement is guaranteed;
- every claim will be approved;
- the customer will pay nothing;
- insurer/survey/policy terms do not apply.

When asked for certainty, the agent must explain briefly that exact cashless approval remains subject to insurer and claim/policy terms.

## Multi-vehicle behavior

One usable mobile number maps to one campaign prospect for this Tata import. The cohort context includes the count and summarized due-vehicle list. The voice agent should not serially repeat a full renewal script for each vehicle.

If multiple vehicles are present, the agent should establish whether the customer wants renewal help for all due vehicles or a selected vehicle, using one question at a time.

## Repeat-call behavior

Before each IT dispatch, INSUREIT reads prior connected attempts for the same isolated opportunity. It supplies previous disposition/summary/interest/objection/follow-up context and produces a continuation-style opening instead of restarting from zero.

## Safety preserved

The Tata slice preserves:
- exact IT Super User authority;
- global calling kill switch;
- calling window;
- Sarvam campaign lifecycle precheck;
- active-attempt uniqueness;
- terminal/DNC holds;
- local attempt UUID correlation;
- webhook binding/idempotent result projection;
- no raw transcript persistence;
- no automatic retry;
- no automatic call on upload;
- no verified business-master writes.

## Schema change

Migration:
`supabase/migrations/20260924170000_expand_voice_campaign_capacity.sql`

The original capacity migration raised the old 100-row limit to 500. A follow-up migration,
`supabase/migrations/20260924173500_remove_voice_campaign_row_limit.sql`,
removes the fixed upper bound entirely while keeping all counters non-negative. Neither migration relaxes calling controls or enables automatic dispatch.

## Implementation state

Branch: `feat/tata-commercial-renewal-voice`

State at documentation time:
- portal implementation: **IMPLEMENTED on feature branch**
- migration: **COMMITTED, NOT APPLIED**
- PR: **#2343 OPEN**
- canonical CI: **PENDING / no PR workflow run observed yet**
- merge: **NOT DONE**
- production deployment: **NOT DONE**
- live customer calling: **NOT STARTED**
- Sarvam agent/dashboard configuration for the new variables/prompt: **REQUIRED BEFORE LIVE TATA CALLING**

## Deployment gating update

The dedicated `apply-voice-campaigns.yml` workflow now includes the 2026-09-24 capacity migration and verifies the 500-row constraint. `deploy-production.yml` recognizes the new migration and waits on that schema workflow before production deployment. The Partner web core voice regression now guards Tata Renewal-sheet detection, 500-row capacity, mobile grouping, cashless non-guarantee wording, repeat-call context, Sarvam variable delivery and production schema gating.


## v11 opening + campaign-size correction — 2026-09-24

The website no longer sends the legacy Tata opening sentence:
`policy renewal के बारे में call किया था—दो मिनट बात कर सकते हैं क्या?`

For a first Tata renewal call it now sends:
`Tata commercial vehicle की insurance renewal के लिए call किया है—अभी दो मिनट हैं?`

Repeat calls still use continuation-aware wording from prior connected-call memory.

The upload parser no longer rejects a campaign because it exceeds 100 or 500 rows, and the new schema migration removes the fixed upper bound from the voice campaign counters. File-size validation, DNC/terminal holds, IT-only authority, manual start, calling window, kill switch and active-attempt protections remain unchanged.


## Caller identity correction — 2026-09-24

Root cause confirmed after v11 testing: the Tata campaign importer does not populate `callingBrand`, while `sarvam-renewal-call.ts` previously applied `?? "Frontier JCB"` to every campaign. That caused INSUREIT to send a Frontier JCB opening even though Tata campaign context was otherwise correct.

The corrected contract is:
- Tata Commercial + explicit `calling_brand` -> speak that exact authorized brand.
- Tata Commercial + no `calling_brand` -> introduce only Anjna, with no company fallback.
- Non-Tata renewal flows keep the existing Frontier JCB fallback for backward compatibility.
- `vehicle_brand_context=Tata Commercial` remains vehicle context only and must never be treated as caller identity.
