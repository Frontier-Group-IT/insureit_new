import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const repoRoot = path.resolve(root, "../..");

const migration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260913220500_external_renewal_voice_attempts.sql"), "utf8");
const projection = fs.readFileSync(path.join(repoRoot, "supabase/migrations/20260913221500_external_renewal_voice_result_projection.sql"), "utf8");
const deployWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/deploy-production.yml"), "utf8");
const schemaWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/apply-external-renewal-voice-attempts.yml"), "utf8");
const sarvamClient = fs.readFileSync(path.join(root, "lib/sarvam-renewal-call.ts"), "utf8");
const readinessModel = fs.readFileSync(path.join(root, "lib/sarvam-renewal-readiness.ts"), "utf8");
const diagnosticsModel = fs.readFileSync(path.join(root, "lib/sarvam-deep-diagnostics.ts"), "utf8");
const voiceAdapter = fs.readFileSync(path.join(root, "lib/partner-external-renewal-voice.ts"), "utf8");
const callRoute = fs.readFileSync(path.join(root, "app/api/partner/external-renewals/[id]/voice-call/route.ts"), "utf8");
const connectionTestRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/sarvam-connection-test/route.ts"), "utf8");
const diagnosticsRoute = fs.readFileSync(path.join(root, "app/api/system/voice-integration/sarvam-deep-diagnostics/route.ts"), "utf8");
const webhook = fs.readFileSync(path.join(root, "app/api/integrations/sarvam/voice-campaign-webhook/route.ts"), "utf8");
const detailPage = fs.readFileSync(path.join(root, "app/partner/renewals/external/[id]/page.tsx"), "utf8");
const worklistPage = fs.readFileSync(path.join(root, "app/partner/renewals/external/page.tsx"), "utf8");
const readinessPage = fs.readFileSync(path.join(root, "app/system/voice-integration/page.tsx"), "utf8");
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
assert(sarvamClient.includes('api-subscription-key'), "current live submission still uses the pre-diagnostic auth contract until a dedicated dispatch change is approved");
assert(sarvamClient.includes('user_identifier: context.attempt_id'), "local attempt UUID is the provider correlation key");
assert(sarvamClient.includes('SARVAM_RENEWAL_CALLING_ENABLED'), "IT-controlled kill switch gates outbound calling");
assert(sarvamClient.includes("SarvamRenewalSubmissionError"), "provider submission distinguishes definitive rejection from ambiguous delivery");
assert(sarvamClient.includes("Await reconciliation before retrying"), "timeouts and ambiguous provider responses prevent unsafe immediate retry");
assert(!sarvamClient.includes('NEXT_PUBLIC_SARVAM'), "no Sarvam credential/config is exposed as public browser environment");

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

assert(diagnosticsModel.includes('import "server-only"'), "deep diagnostics model is server-only");
assert(diagnosticsModel.includes('pronunciation-dictionary/insureit-diagnostic-do-not-create'), "core auth probe is a non-mutating nonexistent-resource lookup");
assert(diagnosticsModel.includes('/webhooks?limit=1'), "deep diagnostics retains the webhook-list provider defect evidence path");
assert(diagnosticsModel.includes('"api-subscription-key": apiKey'), "deep diagnostics tests subscription-key scheduling auth");
assert(diagnosticsModel.includes('authorization: `Bearer ${apiKey}`'), "deep diagnostics separately tests Bearer scheduling auth");
assert(!diagnosticsModel.includes("cohorts/stream"), "deep diagnostics cannot stream a cohort");
assert(!diagnosticsModel.includes('method: "POST"'), "deep diagnostics performs no provider mutation request");
assert(!/console\.(log|error|warn)\s*\(/.test(diagnosticsModel), "deep diagnostics does not log provider responses or secrets");

assert(voiceAdapter.includes('supabase.rpc("partner_app_external_renewal_voice_states"'), "Partner worklist loads voice state through scoped RPC");
assert(callRoute.includes("startPartnerExternalRenewalVoiceAttempt(id)"), "Partner call action starts through scoped RPC");
assert(callRoute.includes("providerRequestStarted"), "Partner route tracks whether the provider request may have been sent");
assert(callRoute.includes("providerDefinitelyRejected"), "only definitive provider rejection releases the local active-attempt guard");

assert(connectionTestRoute.includes('viewer.role !== "it_super_user"'), "Sarvam connection test requires exact IT Super User role");
assert(connectionTestRoute.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "Sarvam connection test requires critical system approval access");
assert(connectionTestRoute.includes("checkSarvamRenewalConnection()"), "Sarvam connection test invokes only the readiness probe");
assert(!connectionTestRoute.includes("streamExternalRenewalToSarvam"), "Sarvam connection test cannot queue a customer call");
assert(!connectionTestRoute.includes("SARVAM_API_KEY"), "Sarvam connection-test route never reads or renders the API key directly");

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

assert(detailPage.includes("Call with AI"), "Partner detail page exposes the single-opportunity AI action");
assert(!detailPage.includes("SARVAM_API_KEY"), "Partner detail page does not expose provider credentials");
assert(worklistPage.includes("AI renewal outreach"), "Partner worklist explains the controlled AI outreach layer");
assert(worklistPage.includes("getPartnerExternalRenewalVoiceStates"), "Partner worklist batches voice-state loading");

assert(readinessPage.includes('viewer.role !== "it_super_user"'), "voice integration readiness requires exact IT Super User role");
assert(readinessPage.includes('hasEffectiveCapability(viewer, "manage_system", "approve")'), "voice integration readiness also requires critical system access");
assert(readinessPage.includes("Test Sarvam connection"), "voice admin page exposes the explicit safe provider connectivity check");
assert(readinessPage.includes("No customer identity, phone number, transcript or raw provider payload"), "voice admin page explicitly preserves the minimal-data boundary");
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
