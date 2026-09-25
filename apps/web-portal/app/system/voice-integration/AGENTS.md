# Voice Integration Admin Area

Before changing this route or any related Sarvam renewal integration code, read:

- `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
- `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md`
- `docs/SARVAM_DIAGNOSTIC_EVIDENCE_2026_09_16.md`
- `docs/SARVAM_CONTROL_CAMPAIGN_DIAGNOSTIC_2026_09_16.md`
- `docs/SARVAM_PRODUCTION_READINESS_SUCCESS_2026_09_17.md`
- `docs/SARVAM_OPERATIONAL_HARDENING_2026_09_18.md`
- `docs/SARVAM_WEBHOOK_RECOVERY_2026_09_18.md`
- `docs/SARVAM_SUPPORT_EVIDENCE_2026_09_18.md`
- `docs/SARVAM_OPERATIONAL_CALLING_POLICY_2026_09_18.md`
- `docs/SARVAM_CAMPAIGN_LIFECYCLE_CONTROLS_2026_09_18.md`
- `docs/SARVAM_CAMPAIGN_DISPATCH_PRECHECK_2026_09_18.md`
- `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md`
- `docs/SARVAM_RENEWAL_AGENT_CONTRACT.md`
- `apps/web-portal/app/partner/renewals/external/AGENTS.md`

Treat `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md` as the current continuation record for agent version, controlled campaign binding, portal activation state, live-test evidence and the active Sarvam authentication blocker. Read `docs/SARVAM_DIAGNOSTIC_EVIDENCE_2026_09_16.md` for the repeated production provider-response evidence and original-campaign isolation results. Read `docs/SARVAM_CONTROL_CAMPAIGN_DIAGNOSTIC_2026_09_16.md` for the fresh control-campaign comparison and its safety state. Read `docs/SARVAM_PRODUCTION_READINESS_SUCCESS_2026_09_17.md` for the production proof that the configured campaign reaches normal `cohorts/stream` validation with `X-API-Key`, plus the remaining webhook-secret rotation gate. Keep these records current after any material provider-authentication, campaign, agent-version, webhook or portal-dispatch change. Treat `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md` as the durable evidence record for the first closed-loop production telephony tests, the missing-webhook failure, successful retry, and manual reconciliation lesson.

This area is IT Super User only. Preserve the exact `it_super_user` role check plus `manage_system` at `approve` access. Do not expose provider secrets, API keys, webhook secrets, raw provider payloads, customer phone numbers, or transcripts here.

The calling window is an IT Super User operational control. The Voice Integration Window card may edit start/end time through the protected system route; persisted values must remain server-only, must not be writable by authenticated clients directly, and IT dispatch must re-read the persisted setting immediately before creating an attempt.

The page may report whether required server-side configuration is present and may show non-secret provider identifiers in masked form. Read-only diagnostics may show sanitized HTTP status/error classification and provider request/correlation identifiers, but never raw response bodies or credentials. It must not turn Partner users into Sarvam administrators.

Do not add bulk calling or autonomous campaign controls until the single-opportunity production lifecycle is verified end to end. `won` remains a Policy Intake conversion state and must never be set by the voice agent.


## Mandatory Voice Agent trial logging protocol

Every material Voice Agent workflow trial must leave a repository-visible Markdown note before the trial is considered closed, whether the trial succeeds or fails.

For each new provider/API/campaign/telephony/webhook/CRM/reconciliation experiment:
- update the current voice handoff and the most relevant dated evidence note;
- record what was tried, what changed, exact evidence state, failure root cause when known, cleanup/reconciliation, and the next safe step;
- keep `AGENTS.md` as a short index/rule surface and put detailed chronology in `docs/`;
- never store phone numbers, secrets, raw transcripts, full webhook bodies, or unnecessary customer identity;
- do not overwrite a failed result with a later success; preserve the durable learning and clearly mark the later superseding state.

This protocol is mandatory because future agents must be able to reconstruct the Voice Agent production journey without relying on chat memory.


## Voice trial continuity

Every material provider/API/campaign/telephony/webhook/CRM/reconciliation trial must update the relevant dated Markdown evidence note and `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md` before closure, whether the trial succeeds or fails. Preserve durable failure lessons. Never store phone numbers, secrets, raw transcripts, or full webhook payloads.

- `docs/SARVAM_PARTNER_PRODUCTION_READINESS_2026_09_18.md`

- `docs/SARVAM_PRODUCTION_QUEUE_PREVIEW_2026_09_18.md`

- `docs/SARVAM_PRODUCTION_CONTROL_CENTER_2026_09_18.md`

## Current production authority model

AI voice calling actions are IT-Super-User-only. Partner users may view normalized AI status/results but must not receive a call-start action or an API path that can reach Sarvam. All future Partner self-service is deferred until separately approved. The production Voice Integration page should remain compact and operations-oriented; experimental diagnostics belong on dedicated diagnostic routes/docs. Normal readiness/safety state must not be rendered as large dashboard cards: keep provider/campaign/window/webhook/DND readiness in one compact production strip, expose only the currently valid Pause or Resume action prominently, and place rare controls such as connection test, refresh, calling-window edit and diagnostics behind a compact overflow control. Avoid duplicate campaign-summary/status sections when the same state is already visible in the health strip.


## External Renewal RC enrichment rule

Before an IT-controlled External Renewal AI call, require the isolated opportunity's `rc_enrichment_status` to be `ready`. Fetch details may use the existing server-only AuthBridge Detailed RC client and RC cache, but it must persist only privacy-minimized approved context into `external_renewal_opportunities`. Never copy owner identity/address/raw provider payloads into the opportunity, never write verified Customer/Vehicle/Policy masters, and never allow the enrichment route itself to reach Sarvam. See `docs/SARVAM_EXTERNAL_RENEWAL_AUTHBRIDGE_ENRICHMENT_2026_09_18.md`.


## IT voice prospect detail/edit boundary

The Voice Integration queue and recent attempts may open the IT-only prospect detail workspace. Keep imported source evidence and AuthBridge evidence immutable: operator corrections belong in the dedicated AI-profile override layer, not by overwriting source columns or raw provider cache data. Every new voice attempt must snapshot its effective cohort context before provider submission so later edits cannot rewrite call history. Responsive server-form actions must expose pending/disabled state. Never expose raw AuthBridge payloads, owner/address provider fields, raw Sarvam webhook payloads or transcripts. See `docs/SARVAM_VOICE_PROSPECT_DETAIL_CONTROLS_2026_09_19.md`.


## Quick Add RC boundary

IT Super User may add an ad-hoc calling prospect by RC + mobile only. The action must remain server-only, validate both values, reuse an existing active RC instead of duplicating it, auto-run the protected AuthBridge enrichment path, and never call Sarvam automatically. Quick Add source rows remain isolated External Renewal opportunities and must never create/update verified Customer, Vehicle or Policy masters. Terminal/DNC records must not be revived. See `docs/SARVAM_VOICE_QUICK_ADD_RC_2026_09_19.md`.


## IT Voice Campaign boundary — 2026-09-21
IT Super User may create a controlled campaign from Excel/CSV containing only RC No. + Mobile No., up to 100 rows. Upload/enrichment must never call Sarvam. Reuse isolated External Renewal data and protected AuthBridge/cache enrichment; DNC/terminal rows stay held and verified masters remain untouched. Campaign calling requires a separate Start action, small dispatch batches, and all existing kill-switch/calling-window/Sarvam-state/active-attempt safeguards. Pause stops future INSUREIT queueing only. See `docs/SARVAM_VOICE_CAMPAIGNS_2026_09_21.md`.


## RC owner fallback rule — 2026-09-21

For External Renewal / Voice Campaign RC enrichment, AuthBridge owner name may fill the isolated `customer_name` only when Customer/Insured Name is otherwise blank. Never overwrite an existing customer/contact/account name or explicit AI-profile customer-name override. This fallback applies to cache/live/stale-cache successful enrichment only and must not write verified Customer/Policy masters.


## Cohort greeting generation — 2026-09-21

INSUREIT, not the Sarvam static Variables defaults, is the production source of truth for the dynamic greeting. `apps/web-portal/lib/sarvam-renewal-call.ts` must send `opening_line` in each streamed cohort user's `app_variables`, together with derived `customer_first_name` and only an explicitly supported `customer_salutation`. Do not infer Sir/Madam from an unprefixed customer name. The approved opening ends with “दो मिनट बात कर सकते हैं क्या?” and does not add “जी” after the name. Keep the Sarvam Greeting template as `{{ opening_line }}`.

## Schema-readiness resilience — 2026-09-21

The Voice Integration control center must remain usable if the optional voice-campaign schema is temporarily unavailable. Campaign-list reads fail soft, Add Campaign remains disabled until the schema exists, and system-level controls continue rendering. The production campaign schema was successfully applied by workflow run 35587127672; this rule prevents a future schema timing/failure from taking down the control center.


## Detailed campaign report export — 2026-09-21

Campaign detail may export a server-generated XLSX operational report for IT Super User only. Preserve the exact approved 33 columns and the Voice Integration privacy boundary: mobile stays masked, raw transcripts remain excluded, and unsupported conversation facts such as Add-on Interest must be shown as not captured rather than inferred. Derived outcome/next-action/quality fields must come only from persisted normalized campaign, attempt, retry-event, and opportunity state. See `docs/SARVAM_VOICE_CAMPAIGNS_2026_09_21.md`.


## Tata Commercial Renewal campaign — 2026-09-24

The IT Voice Campaign workflow may accept the approved Tata Commercial workbook as a special source. Detect the `Renewal` worksheet and ignore `Breaking Case`; never silently mix the two cohorts. Tata source insurer/policy/expiry/customer/vehicle fields are campaign-scoped evidence and may satisfy pre-call context without AuthBridge spend. Group repeated usable mobiles to one callable prospect and pass multi-vehicle context to Sarvam. The Tata campaign's primary service pitch is **cashless claim assistance/support**, never guaranteed cashless settlement or guaranteed claim approval. Keep all existing IT-only authority, calling-window, kill-switch, DNC/terminal, active-attempt, provider-state, UUID-correlation, webhook/idempotency and no-master-write boundaries. See `docs/SARVAM_TATA_COMMERCIAL_RENEWAL_2026_09_24.md`.
