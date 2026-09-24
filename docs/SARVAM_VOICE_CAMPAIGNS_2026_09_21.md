# Voice Campaign Excel Workflow — 2026-09-21

## Goal

IT Super User creates a controlled V5 voice campaign by uploading only:

- RC No.
- Mobile No.

The portal accepts at most 100 non-empty rows, validates and deduplicates them, holds DNC/terminal RCs, reuses or creates isolated External Renewal opportunities, and fetches approved RC/insurance context through the existing protected AuthBridge/cache path before any call can start.

## Workflow

Voice Integration -> Add Campaign -> Excel upload -> validate <=100 -> RC enrichment -> review -> explicit Start Campaign -> small-batch Sarvam submission -> existing webhook/result projection.

## Safety

- exact it_super_user + manage_system=approve;
- upload/enrichment never calls Sarvam;
- DNC/terminal rows are held;
- verified Customer/Vehicle/Policy masters are untouched;
- starting a campaign is a separate explicit action;
- queueing is intentionally done in batches of 3, so Pause can stop future queueing;
- global kill switch, calling window, Sarvam campaign-state check and one-active-attempt guard remain authoritative;
- automatic retries remain disabled;
- local attempt UUID remains the provider correlation key.

## Architecture

voice_campaigns is the Frontier JCB / INSUREIT operational campaign layer. It does not create a separate Sarvam campaign for every uploaded file. The approved Sarvam renewal campaign remains the telephony execution layer.

Migration: supabase/migrations/20260921145500_voice_campaigns.sql

New tables:

- voice_campaigns
- voice_campaign_members

Additional contract:

- external_renewal_opportunities.voice_queue_source permits it_campaign.
- external_renewal_voice_attempts.voice_campaign_id records campaign provenance.
- campaign tables remain service-role-only.

## Excel contract

Accepted: .xlsx, .xls and .csv.

Required logical fields:

- RC No.
- Mobile No.

Common header variants such as RC Number, Registration No and Mobile Number are normalized.

## Evidence state

- branch: feat/voice-campaign-excel-workflow
- implementation: IMPLEMENTED
- PR/CI: pending
- migration application: NOT APPLIED
- merge/deployment: NOT DONE
- real 100-customer campaign: NOT STARTED

Creating or uploading a campaign does not authorize or initiate customer calls.


## RC owner name fallback

AuthBridge Detailed RC already returns the RC owner name. For campaign/External Renewal enrichment, when **Customer / Insured Name is blank** after RC lookup, INSUREIT now copies the normalized RC owner name into the isolated External Renewal `customer_name`.

Rules:

- apply only after a usable RC enrichment result is available;
- apply for fresh cache, live AuthBridge, and controlled stale-cache success;
- never overwrite an existing customer name, contact name, account name, or explicit AI-profile customer-name override;
- the fallback stays inside the isolated External Renewal/voice workflow and does not create or modify verified Customer/Policy master records;
- the resulting name is then available to campaign review and the existing Sarvam `customer_name` cohort variable.


## Schema-readiness resilience

After the initial campaign release, the dedicated schema workflow was repaired and production migration workflow run 35587127672 completed successfully. The control-center hotfix additionally makes campaign-list loading fail soft: if campaign tables are unavailable in a future rollout or temporary schema mismatch, existing Voice Integration controls still render, Add Campaign is disabled, and a scoped readiness warning is shown instead of crashing the whole page.


## Detailed campaign report export

The IT Super User campaign detail page exposes **Download Detailed Report**. The export is an XLSX workbook generated server-side from normalized INSUREIT campaign, opportunity, call-attempt, and retry-event data.

The primary **Campaign Report** sheet contains the approved 33 operational/conversation columns: Campaign Name, Campaign Status, Customer Name, Mobile Number, RC / Registration No., Manufacturer, Current Insurer, Current Policy No., Policy Expiry Date, Call Attempt No., Customer Availability, Call Duration (Sec), Connectivity Status, Completion Status, Submission Status, Call Disposition, Customer Interest, Customer Objection, Follow-up Required, Follow-up Date & Time, Follow-up Time Confidence, Quote Requested, Human Assistance Required, Do Not Contact, Wrong Person, Already Renewed, Add-on Interest, Main Conversation Outcome, Call Summary, Next Recommended Action, Failure Reason, Last Updated At, and Conversation Quality Flag.

A secondary **Summary** sheet contains campaign-level counts and timestamps.

Privacy and evidence rules:
- the export remains restricted to exact `it_super_user` plus `manage_system=approve`;
- mobile remains masked, matching the Voice Integration privacy boundary;
- raw transcripts are not stored or exported;
- Add-on Interest is emitted as `Not captured` because the current normalized webhook contract does not persist a dedicated add-on field;
- conversation outcome, next action, availability, follow-up confidence, and quality flags are deterministic projections of persisted normalized fields, not transcript inference.


## Tata Commercial Renewal extension — 2026-09-24

Branch `feat/tata-commercial-renewal-voice` extends the campaign importer without changing the Sarvam execution-layer model. Standard RC + Mobile campaigns continue to work. An approved Tata workbook is detected by its `Renewal` sheet and Tata column family; `Breaking Case` is excluded. The source-row ceiling is raised to 500 by a dedicated migration, repeated callable mobiles are grouped to one prospect with multi-vehicle context, and Tata-provided customer/vehicle/insurer/policy/expiry values remain campaign-scoped evidence. Tata source context can satisfy the campaign enrichment gate without an AuthBridge lookup. Upload still never initiates calls. See `docs/SARVAM_TATA_COMMERCIAL_RENEWAL_2026_09_24.md`.
