import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");

const migration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260913220500_external_renewal_voice_attempts.sql"), "utf8");
const projection = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260913221500_external_renewal_voice_result_projection.sql"), "utf8");
const operationalSettingsMigration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260918233000_sarvam_voice_operational_settings.sql"), "utf8");
const rcEnrichmentMigration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260918235000_external_renewal_rc_enrichment.sql"), "utf8");
const editableProfileMigration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260919110000_voice_prospect_editable_profile.sql"), "utf8");
const quickAddMigration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260919114500_voice_quick_add_queue_source.sql"), "utf8");
const deployWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/deploy-production.yml"), "utf8");
const schemaWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/apply-external-renewal-voice-attempts.yml"), "utf8");
const sarvamClient = fs.readFileSync(path.join(root, "lib/sarvam-renewal-call.ts"), "utf8");
const sarvamOperationalPolicy = fs.readFileSync(path.join(root, "lib/sarvam-renewal-operational-policy.ts"), "utf8");
const sarvamPartnerDispatchReadiness = fs.readFileSync(path.join(root, "lib/sarvam-partner-dispatch-readiness.ts"), "utf8");
const sarvamProductionQueue = fs.readFileSync(path.join(root, "lib/sarvam-production-queue.ts"), "utf8");
const sarvamCampaignLifecycle = fs.readFileSync(path.join(root, "lib/sarvam-campaign-lifecycle.ts"), "utf8");
const readinessModel = fs.readFileSync(path.join(root, "lib/sarvam-renewal-readiness.ts"), "utf8");
const sarvamWebhookRecovery = fs.readFileSync(path.join(root, "lib/sarvam-webhook-recovery.ts"), "utf8");
const diagnosticsModel = fs.readFileSync(path.join(root, "lib/sarvam-deep-diagnostics.ts"), "utf8");
const voiceAdapter = fs.readFileSync(path.join(root, "lib/partner-external-renewal-voice.ts"), "utf8");
const callRoute = fs.readFileSync(path.join(root, "app/api/partner/external-renewals/[id]/voice-call/route.ts"), "utf8");
const itDispatchModel = fs.readFileSync(path.join(root, "lib/sarvam-it-dispatch.ts"), "utf8");
const rcEnrichmentModel = fs.readFileSync(path.join(root, "lib/external-renewal-authbridge.ts"), "utf8");
const voiceProspectProfile = fs.readFileSync(path.join(root, "lib/voice-prospect-profile.ts"), "utf8");
const quickAddModel = fs.readFileSync(path.join(root, "lib/voice-quick-add.ts"), "utf8");
const itDispatchRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/dispatch/route.ts"), "utf8");
const callingWindowRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/calling-window/route.ts"), "utf8");
const rcEnrichmentRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/rc-enrichment/route.ts"), "utf8");
const prospectProfileRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/prospect-profile/route.ts"), "utf8");
const quickAddRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/quick-add/route.ts"), "utf8");
const quickAddCard = fs.readFileSync(path.join(root, "components/voice/voice-quick-add-card.tsx"), "utf8");
const connectionTestRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/sarvam-connection-test/route.ts"), "utf8");
const webhookRetryRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/sarvam-webhook-retry/route.ts"), "utf8");
const campaignStatusRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/sarvam-campaign-status/route.ts"), "utf8");
const diagnosticsRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/sarvam-deep-diagnostics/route.ts"), "utf8");
const webhook = fs.readFileSync(path.join(root, "app/api/integrations/sarvam/voice-campaign-webhook/route.ts"), "utf8");
const detailPage = fs.readFileSync(path.join(root, "app/partner/renewals/external/[id]/page.tsx"), "utf8");
const worklistPage = fs.readFileSync(path.join(root, "app/partner/renewals/external/page.tsx"), "utf8");
const readinessPage = fs.readFileSync(path.join(root, "app/system/voice-integration/page.tsx"), "utf8");
const prospectDetailPage = fs.readFileSync(path.join(root, "app/system/voice-integration/prospects/[id]/page.tsx"), "utf8");
const pendingButton = fs.readFileSync(path.join(root, "components/voice/pending-button.tsx"), "utf8");
const clickableRow = fs.readFileSync(path.join(root, "components/voice/clickable-table-row.tsx"), "utf8");
const diagnosticsPage = fs.readFileSync(path.join(root, "app/system/voice-integration/diagnostics/page.tsx"), "utf8");
const localAgents = fs.readFileSync(path.join(root, "app/partner/renewals/external/AGENTS.md"), "utf8");
const adminAgents = fs.readFileSync(path.join(root, "app/system/voice-integration/AGENTS.md"), "utf8");
const currentVoiceState = fs.readFileSync(path.join(repoRoot, "docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

assert(migration.includes("external_renewal_voice_attempts"), "voice attempts table is defined");
assert(migration.includes("references public.external_renewal_opportunities(id, partner_id)"), "attempt ownership remains tied to isolated external opportunity + Partner");
assert(migration.includes("partner_app_commercial_scope()"), "Partner call start derives commercial scope server-side");
assert(migration.includes("'do_not_contact'"), "call start blocks do-not-contact opportunities");
assert(migration.includes("external_renewal_voice_one_active_attempt_uidx"), "only one active AI call is allowed per opportunity");
assert(migration.includes("revoke all on public.external_renewal_voice_attempts from public, anon, authenticated"), "authenticated users have no direct attempt-table access");
assert(!/insert\s+into\s+public\.(customers|vehicles|policies)\b/i.test(migration + projection), "voice migrations never insert verified customer/vehicle/policy records");
assert(!/update\s+public\.(customers|vehicles|policies)\b/i.test(migration + projection), "voice migrations never update verified customer/vehicle/policy records");

assert(projection.includes("external_renewal_voice_attempt_events"), "provider retry attempts have a dedicated idempotency table");
assert(projection.includes("unique (provider_attempt_id)"), "provider attempt id is an idempotency key");
assert(projection.includes("when 'do_not_contact' then 'do_not_contact'"), "explicit opt-out maps to do-not-contact");
assert(projection.includes("when 'not_interested' then 'connected'"), "simple decline does not auto-close opportunity in first slice");
assert(projection.includes("when 'wrong_person' then 'connected'"), "wrong-person result is held for human review instead of auto-invalidating contact");
assert(!/when\s+'won'\s+then/i.test(projection) && !/v_outcome\s*:=\s*'won'/i.test(projection), "voice result cannot set won");
assert(projection.includes("p_connectivity_status='connected'"), "CRM outcomes require actual provider connectivity");
assert(projection.includes("p_follow_up_at > now()"), "AI follow-up requires a future timestamp");
assert(projection.includes("submission_status in ('completed','cancelled')"), "unexpected later provider attempts cannot reopen a completed parent call");
assert(projection.includes("partner_app_external_renewal_voice_states"), "worklist uses a Partner-scoped batched voice-state projection");
assert(projection.includes("partner_app_commercial_scope()"), "worklist voice states derive Partner scope server-side");
assert(projection.includes("human_needed"), "worklist can surface human-review outcomes without auto-closing the opportunity");

for (const filename of [
  "20260913220500_external_renewal_voice_attempts.sql",
  "20260913221500_external_renewal_voice_result_projection.sql",
]) {
  assert(schemaWorkflow.includes(filename), `schema workflow applies ${filename}`);
  assert(deployWorkflow.includes(filename), `production deploy gate recognizes ${filename}`);
}
assert(!schemaWorkflow.includes("20260913222500_external_renewal_voice_worklist_projection.sql"), "release does not depend on the removed third migration");
assert(deployWorkflow.includes("apply-external-renewal-voice-attempts.yml"), "production deploy waits for the dedicated voice schema workflow");

assert(sarvamClient.includes('requiredEnv("SARVAM_API_KEY")'), "Sarvam key comes from server environment");
assert(sarvamClient.includes('process.env[name]'), "Sarvam required environment values are resolved server-side");
assert(sarvamClient.includes('"X-API-Key": apiKey'), "live cohort submission uses the proven Voice Agents X-API-Key header");
assert(sarvamClient.includes('user_identifier: context.attempt_id'), "local attempt UUID is the provider correlation key");
assert(sarvamClient.includes('SARVAM_RENEWAL_CALLING_ENABLED'), "IT-controlled kill switch gates outbound calling");
assert(sarvamClient.includes("SarvamRenewalSubmissionError"), "provider submission distinguishes definitive rejection from ambiguous delivery");
assert(sarvamClient.includes("Await reconciliation before retrying"), "timeouts and ambiguous provider responses prevent unsafe immediate retry");
assert(!sarvamClient.includes('NEXT_PUBLIC_SARVAM'), "no Sarvam credential/config is exposed as public browser environment");
assert(sarvamOperationalPolicy.includes('const DEFAULT_START = "09:00"'), "renewal calling window defaults to the controlled 09:00-18:00 policy");
assert(sarvamOperationalPolicy.includes('const DEFAULT_END = "18:00"'), "renewal calling window has the controlled 18:00 close");
assert(sarvamOperationalPolicy.includes('const DEFAULT_TIME_ZONE = "Asia/Kolkata"'), "renewal calling window uses the India timezone by default");
assert(sarvamOperationalPolicy.includes("SARVAM_RENEWAL_CALL_WINDOW_START"), "calling-window start can be changed server-side without browser exposure");
assert(sarvamOperationalPolicy.includes("SARVAM_RENEWAL_CALL_WINDOW_END"), "calling-window end can be changed server-side without browser exposure");
assert(sarvamOperationalPolicy.includes("withinCallingWindow"), "operational policy explicitly calculates current calling-window eligibility");
assert(sarvamOperationalPolicy.includes("applicationAutoRetry: false"), "INSUREIT application-level automatic retries remain disabled");
assert(!sarvamOperationalPolicy.includes("NEXT_PUBLIC_"), "operational policy stays server-side");
assert(sarvamPartnerDispatchReadiness.includes('import "server-only"'), "Partner readiness is server-only");
assert(sarvamPartnerDispatchReadiness.includes("getSarvamRenewalCampaignState"), "Partner readiness includes live campaign lifecycle state");
assert(sarvamPartnerDispatchReadiness.includes("getSarvamRenewalOperationalPolicy"), "Partner readiness includes calling-window state");
assert(sarvamPartnerDispatchReadiness.includes("isSarvamRenewalCallingEnabled"), "Partner readiness includes the global kill switch");
assert(sarvamPartnerDispatchReadiness.includes('reason: "campaign_paused"'), "Partner readiness distinguishes administrative pause");
assert(sarvamPartnerDispatchReadiness.includes('reason: "outside_calling_window"'), "Partner readiness distinguishes calling-window closure");
assert(!sarvamPartnerDispatchReadiness.includes("NEXT_PUBLIC_"), "Partner readiness exposes no browser provider configuration");
assert(sarvamProductionQueue.includes('import "server-only"'), "production queue preview is server-only");
assert(sarvamProductionQueue.includes('INITIAL_OUTREACH_STATUSES = new Set(["new", "contact_attempted"])'), "initial production queue is intentionally narrow");
assert(sarvamProductionQueue.includes('ACTIVE_ATTEMPT_STATUSES'), "production queue excludes active AI attempts");
assert(sarvamProductionQueue.includes('next_follow_up_at'), "production queue respects scheduled follow-up state");
assert(sarvamProductionQueue.includes('.gte("policy_end_date", start)'), "production queue begins at current date");
assert(sarvamProductionQueue.includes('.lte("policy_end_date", endDate)'), "imported production queue is capped to the next 30 days");
assert(!sarvamProductionQueue.includes("streamExternalRenewalToSarvam"), "production queue preview cannot place calls");
assert(!sarvamProductionQueue.includes("SARVAM_API_KEY"), "production queue preview contains no provider credential logic");
assert(sarvamCampaignLifecycle.includes('import "server-only"'), "campaign lifecycle client is server-only");
assert(sarvamCampaignLifecycle.includes('"X-API-Key": apiKey'), "campaign lifecycle uses the proven X-API-Key contract");
assert(sarvamCampaignLifecycle.includes('/campaigns/'), "campaign lifecycle targets the configured campaign resource");
assert(sarvamCampaignLifecycle.includes('/status'), "campaign lifecycle mutation uses the documented campaign status endpoint");
assert(sarvamCampaignLifecycle.includes('JSON.stringify({ action })'), "campaign lifecycle mutation sends a single explicit action");
assert(sarvamCampaignLifecycle.includes('type SarvamCampaignAction = "pause" | "resume"'), "campaign lifecycle code excludes terminal cancel from the UI control contract");
assert(sarvamCampaignLifecycle.includes("assertSarvamRenewalCampaignDispatchable"), "campaign lifecycle exports a dispatchability precheck");
assert(sarvamCampaignLifecycle.includes('state.status === "paused"'), "campaign dispatch precheck blocks paused state");
assert(sarvamCampaignLifecycle.includes('state.status === "ended" || state.status === "cancelled"'), "campaign dispatch precheck blocks terminal states");
assert(sarvamCampaignLifecycle.includes('state.status !== "active" && state.status !== "scheduled"'), "campaign dispatch precheck permits only active or scheduled campaigns");
assert(!sarvamCampaignLifecycle.includes("NEXT_PUBLIC_"), "campaign lifecycle credentials remain server-side");

assert(readinessModel.includes('import "server-only"'), "readiness model is server-only");
assert(readinessModel.includes('SARVAM_RENEWAL_WEBHOOK_SECRET'), "readiness checks webhook-secret presence");
assert(readinessModel.includes('SARVAM_RENEWAL_CALLING_ENABLED'), "readiness reports the outbound kill switch");
assert(readinessModel.includes('checkSarvamRenewalConnection'), "readiness supports an explicit safe Sarvam connectivity check");
assert(readinessModel.includes('/cohorts/stream'), "connection check reaches the documented campaign stream endpoint");
assert(readinessModel.includes('"X-API-Key": apiKey'), "connection check uses the proven Voice Agents X-API-Key header");
assert(readinessModel.includes('users: []'), "connection check deliberately sends no contact records");
assert(readinessModel.includes('response.status === 422 || response.status === 400'), "validation rejection is treated as proof of authenticated reachability");
assert(!readinessModel.includes('user_phone_number'), "readiness cannot submit a callable contact");
assert(!readinessModel.includes('NEXT_PUBLIC_SARVAM'), "readiness does not depend on browser Sarvam configuration");

assert(sarvamWebhookRecovery.includes('import "server-only"'), "webhook recovery client is server-only");
assert(sarvamWebhookRecovery.includes('/webhooks/retry'), "webhook recovery uses Sarvam campaign redelivery endpoint");
assert(sarvamWebhookRecovery.includes('"X-API-Key": apiKey'), "webhook recovery uses the proven X-API-Key contract");
assert(sarvamWebhookRecovery.includes('attempt_ids: [normalizedAttemptId]'), "webhook recovery re-delivers exactly one explicit provider attempt");
assert(sarvamWebhookRecovery.includes('response.status === 202'), "webhook recovery requires provider acceptance before reporting success");
assert(!sarvamWebhookRecovery.includes('user_phone_number'), "webhook recovery does not correlate by phone number");
assert(!sarvamWebhookRecovery.includes('cohorts/stream'), "webhook recovery cannot create a callable cohort");
assert(!/console\.(log|error|warn)\s*\(/.test(sarvamWebhookRecovery), "webhook recovery does not log secrets or provider payloads");

assert(diagnosticsModel.includes('import "server-only"'), "deep diagnostics model is server-only");
assert(diagnosticsModel.includes('pronunciation-dictionary/insureit-diagnostic-do-not-create'), "core auth probe is a non-mutating nonexistent-resource lookup");
assert(diagnosticsModel.includes('/webhooks?limit=1'), "deep diagnostics retains the webhook-list provider defect evidence path");
assert(diagnosticsModel.includes('"api-subscription-key": apiKey'), "deep diagnostics tests subscription-key scheduling auth");
assert(diagnosticsModel.includes('authorization: `Bearer ${apiKey}`'), "deep diagnostics separately tests Bearer scheduling auth");
assert(!diagnosticsModel.includes("cohorts/stream"), "deep diagnostics cannot stream a cohort");
assert(!diagnosticsModel.includes('method: "POST"'), "deep diagnostics performs no provider mutation request");
assert(!/console\.(log|error|warn)\s*\(/.test(diagnosticsModel), "deep diagnostics does not log provider responses or secrets");

assert(voiceAdapter.includes('supabase.rpc("partner_app_external_renewal_voice_states"'), "Partner worklist can still read normalized AI result state");
assert(callRoute.includes("AI voice calling is controlled by INSUREIT IT Super User"), "Partner voice-call endpoint explicitly denies Partner-triggered AI calling");
assert(!callRoute.includes("streamExternalRenewalToSarvam"), "Partner voice-call endpoint cannot reach the provider");

assert(itDispatchModel.includes('import "server-only"'), "IT dispatch helper is server-only");
assert(itDispatchModel.includes("external_renewal_opportunities"), "IT dispatch starts only from isolated External Renewal opportunities");
assert(itDispatchModel.includes("external_renewal_voice_one_active_attempt_uidx") || itDispatchModel.includes("An AI call is already active"), "IT dispatch preserves one-active-attempt protection");
assert(itDispatchModel.includes("requested_by_auth_user_id"), "IT dispatch records the authenticated controller");
assert(!/from\(["'](customers|vehicles|policies)["']\)/i.test(itDispatchModel), "IT dispatch does not write verified Customer/Vehicle/Policy masters");

assert(itDispatchRoute.includes('viewer.role !== "it_super_user"'), "IT dispatch route requires exact IT Super User role");
assert(itDispatchRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "IT dispatch route requires critical system approval access");
assert(itDispatchRoute.includes("assertConfiguredSarvamRenewalCallingWindow()"), "IT dispatch enforces the persisted production calling window");
assert(itDispatchRoute.includes("assertSarvamRenewalCampaignDispatchable()"), "IT dispatch verifies the approved campaign state");
assert(itDispatchRoute.includes("startItSuperUserExternalRenewalVoiceAttempt"), "IT dispatch creates the local attempt through the IT-only helper");
assert(itDispatchRoute.includes("streamExternalRenewalToSarvam"), "IT dispatch is the production provider submission path");
assert(itDispatchRoute.includes("markExternalRenewalVoiceSubmitted"), "IT dispatch persists accepted campaign/cohort submission state");

assert(operationalSettingsMigration.includes("sarvam_voice_operational_settings"), "calling-window migration defines the server-only operational settings table");
assert(operationalSettingsMigration.includes("revoke all on table public.sarvam_voice_operational_settings from anon, authenticated"), "authenticated users cannot directly read or mutate calling-window settings");
assert(sarvamOperationalPolicy.includes("getConfiguredSarvamRenewalOperationalPolicy"), "operational policy can resolve the persisted IT-managed calling window");
assert(sarvamOperationalPolicy.includes("sarvam_voice_operational_settings"), "operational policy reads the persisted calling-window table");
assert(callingWindowRoute.includes('viewer.role !== "it_super_user"'), "calling-window update requires exact IT Super User role");
assert(callingWindowRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "calling-window update requires critical system approval access");
assert(callingWindowRoute.includes('from("sarvam_voice_operational_settings")'), "calling-window update writes only the voice operational settings table");
assert(!callingWindowRoute.includes("streamExternalRenewalToSarvam"), "calling-window update cannot place a call");
assert(readinessPage.includes('href="/system/voice-integration?edit_window=1"'), "Voice Integration Window card exposes an inline Edit action");
assert(readinessPage.includes('action="/api/system/voice-integration/calling-window"'), "Window editor posts to the protected system route");

assert(rcEnrichmentMigration.includes("rc_enrichment_status"), "External Renewal schema records RC enrichment readiness");
assert(rcEnrichmentMigration.includes("rc_enrichment_details jsonb"), "External Renewal schema stores only a normalized RC snapshot");
assert(!/insert\s+into\s+public\.(customers|vehicles|policies)\b/i.test(rcEnrichmentMigration), "RC enrichment migration never creates verified business masters");
assert(rcEnrichmentModel.includes('import "server-only"'), "External Renewal AuthBridge enrichment stays server-only");
assert(rcEnrichmentModel.includes("function exactProviderValue("), "AuthBridge RC mapper prefers exact provider sections before aliases");
assert(rcEnrichmentModel.includes('"Owners Details", "Owners Name"'), "AuthBridge RC mapper captures RC owner name");
assert(rcEnrichmentModel.includes('"Registration Details", "RTO"'), "AuthBridge RC mapper captures RTO");
assert(rcEnrichmentModel.includes('"Vehicle Details", "Engine Number"'), "AuthBridge RC mapper captures engine number");
assert(rcEnrichmentModel.includes('"Vehicle Details", "Norms Type"'), "AuthBridge RC mapper captures emission norm");
assert(rcEnrichmentModel.includes('"Insurance Details", "Policy Number"'), "AuthBridge RC mapper captures policy number");
assert(rcEnrichmentModel.includes('"Insurance Details", "Insurance To Date/Insurance Upto"'), "AuthBridge RC mapper captures policy expiry");
assert(prospectDetailPage.includes("RC owner name"), "voice prospect detail shows RC owner name distinctly from customer/insured name");
assert(prospectDetailPage.includes("Vehicle category"), "voice prospect detail shows expanded normalized RC fields");
assert(prospectDetailPage.includes("Engine number"), "voice prospect detail shows engine number");
assert(prospectDetailPage.includes("Financer name"), "voice prospect detail shows finance context");
assert(prospectDetailPage.includes("Normalized provider fields are shown with their real meaning"), "voice prospect detail explains owner-vs-insured naming boundary");
assert(rcEnrichmentModel.includes("function mergeDetails("), "External Renewal enrichment merges legacy normalized cache with raw provider fields");
assert(rcEnrichmentModel.includes("rawDetails = fromRaw(cached.raw_response"), "fresh/stale cache repair re-reads raw provider evidence");
assert(rcEnrichmentModel.includes("normalized_details: details"), "fresh cache repair persists upgraded normalized details for reuse");
assert(rcEnrichmentModel.includes('external-renewal-2026-09-19-v2'), "External Renewal AuthBridge mapper version records the insurance/policy repair");
assert(rcEnrichmentModel.includes("vehicle_rc_lookup_cache"), "External Renewal enrichment reuses the paid RC cache");
assert(rcEnrichmentModel.includes("lookupAuthbridgeRc"), "External Renewal enrichment can call the protected AuthBridge client");
assert(rcEnrichmentModel.includes("rc_enrichment_details"), "External Renewal enrichment persists only the safe normalized snapshot");
assert(!rcEnrichmentModel.includes('from("customers")') && !rcEnrichmentModel.includes('from("vehicles")') && !rcEnrichmentModel.includes('from("policies")'), "External Renewal enrichment never writes verified Customer/Vehicle/Policy masters");
assert(rcEnrichmentRoute.includes('viewer.role !== "it_super_user"'), "RC enrichment route requires exact IT Super User role");
assert(rcEnrichmentRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "RC enrichment route requires critical system approval access");
assert(!rcEnrichmentRoute.includes("streamExternalRenewalToSarvam"), "RC enrichment cannot place an AI call");
assert(sarvamProductionQueue.includes("needs_rc_enrichment"), "voice queue holds records until RC enrichment is ready");
assert(sarvamProductionQueue.includes("rc_enrichment_status"), "voice queue reads persisted enrichment readiness");
assert(itDispatchModel.includes('opportunity.rc_enrichment_status !== "ready"'), "IT dispatch rechecks RC enrichment before creating a call attempt");
assert(itDispatchModel.includes("rc_enrichment_details"), "IT dispatch uses the safe AuthBridge snapshot for agent context");
assert(readinessPage.includes('action="/api/system/voice-integration/rc-enrichment"'), "Voice Integration queue exposes Fetch details from the IT-only surface");
assert(readinessPage.includes("Fetch details"), "Voice Integration queue labels the RC enrichment action clearly");
assert(deployWorkflow.includes("20260918235000_external_renewal_rc_enrichment.sql"), "production deploy gate recognizes External Renewal RC enrichment schema");
assert(deployWorkflow.includes("apply-external-renewal-rc-enrichment.yml"), "production deploy waits for External Renewal RC enrichment schema workflow");

assert(editableProfileMigration.includes("ai_profile_overrides jsonb"), "editable profile migration preserves IT corrections separately from source evidence");
assert(editableProfileMigration.includes("cohort_context jsonb"), "voice attempts capture the cohort context used for each call");
assert(voiceProspectProfile.includes("baselineExternalRenewalAiProfile"), "editable AI profile keeps a provider/source baseline");
assert(voiceProspectProfile.includes("compactAiProfileOverrides"), "only differences from source/provider evidence are stored as overrides");
assert(voiceProspectProfile.includes('from("external_renewal_voice_attempt_events")'), "prospect detail loads normalized provider attempt history");
assert(prospectProfileRoute.includes('viewer.role !== "it_super_user"'), "prospect profile edits require exact IT Super User role");
assert(prospectProfileRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "prospect profile edits require critical system approval access");
assert(!prospectProfileRoute.includes("streamExternalRenewalToSarvam"), "editing prospect details cannot place a call");
assert(itDispatchModel.includes("ai_profile_overrides"), "IT dispatch uses approved operator corrections");
assert(itDispatchModel.includes("cohort_context: cohortContext"), "IT dispatch snapshots effective values before provider submission");
assert(itDispatchModel.includes('eq("connectivity_status", "connected")'), "repeat-call memory only treats connected attempts as prior conversations");
assert(itDispatchModel.includes("buildPreviousConversationContext"), "IT dispatch builds normalized cross-call conversation memory");
assert(itDispatchModel.includes("repeatCallOpening"), "IT dispatch generates separate first-call and repeat-call openings");
assert(itDispatchModel.includes("previous_connected_call_count"), "IT dispatch snapshots prior connected-call count into cohort context");
assert(itDispatchModel.includes("previous_conversation_context"), "IT dispatch snapshots normalized prior-call memory into cohort context");
assert(sarvamRenewalCall.includes("opening_line: context.opening_line"), "Sarvam cohort receives the server-generated opening line");
assert(sarvamRenewalCall.includes("repeat_call: context.repeat_call"), "Sarvam cohort receives repeat-call state");
assert(sarvamRenewalCall.includes("previous_conversation_context"), "Sarvam cohort receives normalized prior-conversation context");

assert(prospectDetailPage.includes("AI calling profile"), "prospect detail exposes the editable calling profile");
assert(prospectDetailPage.includes("AuthBridge normalized details"), "prospect detail exposes approved normalized AuthBridge fields");
assert(prospectDetailPage.includes("Sarvam call history"), "prospect detail exposes normalized call outcomes");
assert(prospectDetailPage.includes("Raw provider payloads"), "prospect detail states the raw-provider privacy boundary");
assert(pendingButton.includes("useFormStatus"), "voice action buttons react to server-form pending state");
assert(pendingButton.includes("aria-busy"), "voice action buttons expose processing state accessibly");
assert(clickableRow.includes("router.push"), "voice queue and recent-attempt rows navigate to prospect details");
assert(readinessPage.includes("ClickableTableRow"), "voice tables use clickable rows");
assert(readinessPage.includes('pendingLabel="Creating cohort…"'), "Call button shows cohort creation progress");
assert(readinessPage.includes('pendingLabel="Retrying…"'), "webhook recovery button shows retry progress");
assert(deployWorkflow.includes("20260919110000_voice_prospect_editable_profile.sql"), "production deploy gate recognizes editable voice prospect schema");
assert(deployWorkflow.includes("apply-voice-prospect-editable-profile.yml"), "production deploy waits for editable voice prospect schema workflow");
assert(!/from\(["'](customers|vehicles|policies)["']\)/i.test(voiceProspectProfile + prospectProfileRoute), "voice prospect editing never writes verified Customer/Vehicle/Policy masters");

assert(quickAddMigration.includes("voice_queue_source"), "Quick Add migration records explicit IT queue source");
assert(quickAddMigration.includes("it_quick_add"), "Quick Add migration defines the IT-only queue source");
assert(quickAddModel.includes('import "server-only"'), "Quick Add service stays server-only");
assert(quickAddModel.includes("normalizeVehicleRegistrationNumber"), "Quick Add normalizes RC before lookup");
assert(quickAddModel.includes("enrichExternalRenewalOpportunity"), "Quick Add automatically runs AuthBridge enrichment");
assert(quickAddModel.includes('source_name: QUICK_ADD_SOURCE_NAME'), "Quick Add uses a dedicated isolated source batch");
assert(quickAddModel.includes('status: "validated"'), "Quick Add source batch remains outside published Partner imports");
assert(quickAddRoute.includes('viewer.role !== "it_super_user"'), "Quick Add route requires exact IT Super User role");
assert(quickAddRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "Quick Add route requires critical system approval access");
assert(!quickAddRoute.includes("streamExternalRenewalToSarvam"), "Quick Add cannot place a phone call");
assert(quickAddCard.includes("Quick add to calling queue"), "Voice page exposes a clean Quick Add entry");
assert(quickAddCard.includes("Add & fetch"), "Quick Add combines creation and RC enrichment in one action");
assert(sarvamProductionQueue.includes('voice_queue_source === "it_quick_add"'), "Quick Add rows are included in the IT calling queue outside the 30-day import window");
assert(itDispatchModel.includes('opportunity.voice_queue_source === "it_quick_add"'), "IT dispatch recognizes the isolated Quick Add batch");
assert(itDispatchModel.includes('opportunity.voice_queue_source === "it_quick_add" ? null : opportunity.policy_end_date'), "Quick Add cannot leak the synthetic placeholder expiry into Sarvam context");
assert(deployWorkflow.includes("20260919114500_voice_quick_add_queue_source.sql"), "production deploy gate recognizes Quick Add schema");
assert(deployWorkflow.includes("apply-voice-quick-add-queue-source.yml"), "production deploy waits for Quick Add schema workflow");
assert(!/from\(["'](customers|vehicles|policies)["']\)/i.test(quickAddModel + quickAddRoute), "Quick Add never writes verified Customer/Vehicle/Policy masters");

assert(connectionTestRoute.includes('viewer.role !== "it_super_user"'), "Sarvam connection test requires exact IT Super User role");
assert(connectionTestRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "Sarvam connection test requires critical system approval access");
assert(connectionTestRoute.includes("checkSarvamRenewalConnection()"), "Sarvam connection test invokes only the readiness probe");
assert(!connectionTestRoute.includes("streamExternalRenewalToSarvam"), "Sarvam connection test cannot queue a customer call");
assert(!connectionTestRoute.includes("SARVAM_API_KEY"), "Sarvam connection-test route never reads or renders the API key directly");
assert(webhookRetryRoute.includes('viewer.role !== "it_super_user"'), "webhook retry requires exact IT Super User role");
assert(webhookRetryRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "webhook retry requires critical system approval access");
assert(webhookRetryRoute.includes("retrySarvamCampaignWebhookDelivery"), "webhook retry route delegates to the server-only recovery client");
assert(!webhookRetryRoute.includes("streamExternalRenewalToSarvam"), "webhook retry cannot queue another phone call");
assert(!webhookRetryRoute.includes("SARVAM_API_KEY"), "webhook retry route never reads or renders the API key directly");
assert(campaignStatusRoute.includes('viewer.role !== "it_super_user"'), "campaign status route requires exact IT Super User role");
assert(campaignStatusRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "campaign status route requires critical system approval access");
assert(campaignStatusRoute.includes('new Set<SarvamCampaignAction>(["pause", "resume"])'), "campaign status route permits only pause and resume");
assert(!campaignStatusRoute.includes('"cancel"'), "campaign status route does not expose terminal cancel");
assert(!campaignStatusRoute.includes("SARVAM_API_KEY"), "campaign status route delegates secrets to the server-only lifecycle client");

assert(diagnosticsRoute.includes('viewer.role !== "it_super_user"'), "Sarvam deep diagnostics requires exact IT Super User role");
assert(diagnosticsRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "Sarvam deep diagnostics requires critical system approval access");
assert(diagnosticsRoute.includes("runSarvamDeepDiagnostics()"), "diagnostics route invokes only the read-only diagnostic model");
assert(!diagnosticsRoute.includes("streamExternalRenewalToSarvam"), "diagnostics route cannot queue a customer call");
assert(!diagnosticsRoute.includes("SARVAM_API_KEY"), "diagnostics route never reads or renders the API key directly");

assert(webhook.includes("SARVAM_RENEWAL_WEBHOOK_SECRET"), "webhook requires INSUREIT-controlled secret");
assert(webhook.includes("SARVAM_RENEWAL_CAMPAIGN_ID"), "webhook rejects unexpected campaigns");
assert(webhook.includes("user_identifier"), "webhook correlates by INSUREIT local attempt id");
assert(webhook.includes('connected: "no_decision"'), "current Sarvam connected disposition normalizes to the durable connected/no-decision persistence value");
assert(webhook.includes('renewed_elsewhere: "already_renewed"'), "current Sarvam renewed-elsewhere disposition remains compatible with the durable CRM projection");
assert(webhook.includes('interested: "high"'), "current Sarvam interested label normalizes to the durable interest scale");
assert(webhook.includes('maybe: "medium"'), "current Sarvam maybe label normalizes to the durable interest scale");
assert(webhook.includes('not_interested: "low"'), "current Sarvam not-interested label normalizes to the durable interest scale");
assert(webhook.includes("payload.duration ?? payload.duration_in_seconds"), "webhook accepts both documented/legacy duration field shapes without weakening validation");
assert(!/interaction_transcript[^\n]*applyExternalRenewalVoiceResult/i.test(webhook), "raw transcript is not passed into persistence");
assert(!/console\.(log|error|warn)\s*\(/.test(webhook), "webhook does not log provider/customer payloads");

assert(!detailPage.includes("Call with AI"), "Partner detail page exposes no AI call action");
assert(detailPage.includes("IT controlled"), "Partner detail page labels AI calling as centrally controlled");
assert(!detailPage.includes("getSarvamPartnerDispatchReadiness"), "Partner detail no longer evaluates dispatch authority");
assert(!detailPage.includes("SARVAM_API_KEY"), "Partner detail page does not expose provider credentials");
assert(worklistPage.includes("AI outreach is managed by INSUREIT IT"), "Partner worklist states IT-only AI authority");
assert(worklistPage.includes("getPartnerExternalRenewalVoiceStates"), "Partner worklist still shows normalized AI outcomes");
assert(!worklistPage.includes("getSarvamPartnerDispatchReadiness"), "Partner worklist has no calling-authority readiness path");

assert(readinessPage.includes('viewer.role !== "it_super_user"'), "voice production control center requires exact IT Super User role");
assert(readinessPage.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "voice production control center requires critical system access");
assert(readinessPage.includes("Production control center for AI renewal calling"), "voice page is production-oriented rather than experimental");
assert(readinessPage.includes("Production control"), "voice page exposes compact production controls");
assert(readinessPage.includes("Access & policy"), "voice page exposes compact access and policy status");
assert(readinessPage.includes("Partner actions"), "voice page shows Partner action authority state");
assert(readinessPage.includes('value="Disabled"'), "Partner AI actions are visibly disabled in production control");
assert(readinessPage.includes("Calling queue"), "voice page exposes the IT-controlled production calling queue");
assert(readinessPage.includes('action="/api/system/voice-integration/dispatch"'), "eligible queue rows can be dispatched only from the IT system route");
assert(readinessPage.includes("Pause Campaign"), "voice admin page can pause an active configured campaign");
assert(readinessPage.includes("Resume Campaign"), "voice admin page can resume a paused configured campaign");
assert(readinessPage.includes("Recovery"), "voice admin page exposes compact recovery access");
assert(readinessPage.includes("STALE_ACTIVE_ATTEMPT_MS"), "voice admin page retains stale-attempt monitoring");
assert(readinessPage.includes('name="provider_attempt_id"'), "completed-attempt recovery posts the stored provider attempt identifier");
assert(readinessPage.includes('attempt.submission_status === "completed"'), "webhook retry remains limited to completed attempts");
assert(!readinessPage.includes("process.env.SARVAM_API_KEY"), "voice admin page does not render the API key directly");
assert(!readinessPage.includes("process.env.SARVAM_RENEWAL_WEBHOOK_SECRET"), "voice admin page does not render the webhook secret directly");

assert(diagnosticsPage.includes('viewer.role !== "it_super_user"'), "deep diagnostics page requires exact IT Super User role");
assert(diagnosticsPage.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "deep diagnostics page requires critical system access");
assert(diagnosticsPage.includes("Run Deep Diagnostics"), "deep diagnostics page exposes the explicit read-only diagnostic action");
assert(diagnosticsPage.includes("does not place calls"), "deep diagnostics page states its no-call safety boundary");
assert(!diagnosticsPage.includes("process.env.SARVAM_API_KEY"), "deep diagnostics page cannot render the API key");

assert(localAgents.includes("VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md"), "relevant future agents are instructed to read the durable voice handoff");
assert(localAgents.includes("won"), "local agent instructions preserve Policy Intake as the only win boundary");
assert(adminAgents.includes("VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md"), "IT voice admin future agents are instructed to read the durable voice handoff");
assert(adminAgents.includes("SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md"), "IT voice admin agents are instructed to read the current Sarvam workflow state");
assert(adminAgents.includes("it_super_user"), "IT voice admin instructions preserve exact role restriction");
assert(currentVoiceState.includes("INSUREIT-Re-e2468e47-50a8"), "current voice state records the approved controlled campaign binding");
assert(currentVoiceState.includes("PAUSED"), "current voice state records the campaign safety state");
assert(!/9329861634|7225842509/.test(currentVoiceState), "current voice state does not persist internal test phone numbers");

if (!process.exitCode) console.log("External renewal voice integration regression passed.");
