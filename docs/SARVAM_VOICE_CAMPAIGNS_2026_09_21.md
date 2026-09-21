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
