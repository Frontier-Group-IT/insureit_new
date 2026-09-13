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
const voiceAdapter = fs.readFileSync(path.join(root, "lib/partner-external-renewal-voice.ts"), "utf8");
const callRoute = fs.readFileSync(path.join(root, "app/api/partner/external-renewals/[id]/voice-call/route.ts"), "utf8");
const webhook = fs.readFileSync(path.join(root, "app/api/integrations/sarvam/voice-campaign-webhook/route.ts"), "utf8");
const detailPage = fs.readFileSync(path.join(root, "app/partner/renewals/external/[id]/page.tsx"), "utf8");
const worklistPage = fs.readFileSync(path.join(root, "app/partner/renewals/external/page.tsx"), "utf8");
const localAgents = fs.readFileSync(path.join(root, "app/partner/renewals/external/AGENTS.md"), "utf8");

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
assert(!/v_outcome\s*:=.*'won'/s.test(projection), "voice result cannot set won");
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

assert(sarvamClient.includes('process.env.SARVAM_API_KEY'), "Sarvam key comes from server environment");
assert(sarvamClient.includes('api-subscription-key'), "Sarvam API uses subscription-key authentication");
assert(sarvamClient.includes('user_identifier: context.attempt_id'), "local attempt UUID is the provider correlation key");
assert(sarvamClient.includes('SARVAM_RENEWAL_CALLING_ENABLED'), "IT-controlled kill switch gates outbound calling");
assert(sarvamClient.includes("SarvamRenewalSubmissionError"), "provider submission distinguishes definitive rejection from ambiguous delivery");
assert(sarvamClient.includes("Await reconciliation before retrying"), "timeouts and ambiguous provider responses prevent unsafe immediate retry");
assert(!sarvamClient.includes('NEXT_PUBLIC_SARVAM'), "no Sarvam credential/config is exposed as public browser environment");

assert(voiceAdapter.includes('supabase.rpc("partner_app_external_renewal_voice_states"'), "Partner worklist loads voice state through scoped RPC");
assert(callRoute.includes("startPartnerExternalRenewalVoiceAttempt(id)"), "Partner call action starts through scoped RPC");
assert(callRoute.includes("providerRequestStarted"), "Partner route tracks whether the provider request may have been sent");
assert(callRoute.includes("providerDefinitelyRejected"), "only definitive provider rejection releases the local active-attempt guard");

assert(webhook.includes("SARVAM_RENEWAL_WEBHOOK_SECRET"), "webhook requires INSUREIT-controlled secret");
assert(webhook.includes("SARVAM_RENEWAL_CAMPAIGN_ID"), "webhook rejects unexpected campaigns");
assert(webhook.includes("user_identifier"), "webhook correlates by INSUREIT local attempt id");
assert(!/interaction_transcript[^\n]*applyExternalRenewalVoiceResult/i.test(webhook), "raw transcript is not passed into persistence");
assert(!/console\.(log|error|warn)\s*\(/.test(webhook), "webhook does not log provider/customer payloads");

assert(detailPage.includes("Call with AI"), "Partner detail page exposes the single-opportunity AI action");
assert(!detailPage.includes("SARVAM_API_KEY"), "Partner detail page does not expose provider credentials");
assert(worklistPage.includes("AI renewal outreach"), "Partner worklist explains the controlled AI outreach layer");
assert(worklistPage.includes("getPartnerExternalRenewalVoiceStates"), "Partner worklist batches voice-state loading");

assert(localAgents.includes("VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md"), "relevant future agents are instructed to read the durable voice handoff");
assert(localAgents.includes("won"), "local agent instructions preserve Policy Intake as the only win boundary");

if (!process.exitCode) console.log("External renewal voice integration regression passed.");
