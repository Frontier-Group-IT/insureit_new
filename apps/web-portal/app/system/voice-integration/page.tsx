import { redirect } from "next/navigation";

import { AppShell, Card, PageHeader } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getSarvamRenewalReadiness } from "@/lib/sarvam-renewal-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STALE_ACTIVE_ATTEMPT_MS = 60 * 60 * 1000;
const ACTIVE_ATTEMPT_STATUSES = new Set(["created", "submitted", "queued", "calling"]);

type AttemptRow = {
  id: string;
  provider_attempt_id: string | null;
  submission_status: string;
  connectivity_status: string | null;
  call_disposition: string | null;
  created_at: string;
  updated_at: string;
};

type AttemptEventRow = {
  voice_attempt_id: string;
  connectivity_status: string | null;
  completion_status: string | null;
  created_at: string;
};

type VoiceIntegrationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function labelize(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(ready: boolean) {
  return ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("en-IN");
}

function isStaleActiveAttempt(attempt: AttemptRow, nowMs: number) {
  if (!ACTIVE_ATTEMPT_STATUSES.has(attempt.submission_status)) return false;
  const updatedMs = new Date(attempt.updated_at).getTime();
  return Number.isFinite(updatedMs) && nowMs - updatedMs > STALE_ACTIVE_ATTEMPT_MS;
}

export default async function VoiceIntegrationPage({ searchParams }: VoiceIntegrationPageProps) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const query = await searchParams;
  const sarvamTest = queryValue(query.sarvam_test);
  const sarvamStatus = queryValue(query.sarvam_status);
  const sarvamTestOk = sarvamTest === "ok";
  const sarvamTestFailed = sarvamTest === "failed";
  const webhookRetry = queryValue(query.webhook_retry);
  const webhookRetryStatus = queryValue(query.webhook_retry_status);
  const webhookRetryAccepted = webhookRetry === "accepted";
  const webhookRetryFailed = webhookRetry === "failed";

  const readiness = getSarvamRenewalReadiness();
  const connectionConfigReady = ["api_key", "org_id", "workspace_id", "campaign_id"].every(
    (key) => readiness.items.find((item) => item.key === key)?.configured,
  );
  const admin = createSupabaseAdminClient();
  const [{ data: attempts, error: attemptsError }, { data: attemptEvents, error: eventsError }] = await Promise.all([
    admin
      .from("external_renewal_voice_attempts")
      .select("id,provider_attempt_id,submission_status,connectivity_status,call_disposition,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<AttemptRow[]>(),
    admin
      .from("external_renewal_voice_attempt_events")
      .select("voice_attempt_id,connectivity_status,completion_status,created_at")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<AttemptEventRow[]>(),
  ]);

  const schemaReady = !attemptsError && !eventsError;
  const providerConfigReady = readiness.requiredConfigured;
  const operationalReady = schemaReady && providerConfigReady && readiness.callingEnabled;
  const nowMs = Date.now();
  const staleActiveAttempts = (attempts ?? []).filter((attempt) => isStaleActiveAttempt(attempt, nowMs));
  const latestWebhookEvent = attemptEvents?.[0] ?? null;
  const webhookObserved = Boolean(latestWebhookEvent);

  return (
    <AppShell title="Voice Integration">
      <div className="mx-auto max-w-[1320px] space-y-4 pb-8">
        <PageHeader title="Voice Integration" />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard label="INSUREIT schema" value={schemaReady ? "Ready" : "Unavailable"} ready={schemaReady} detail={schemaReady ? "Voice attempt and retry-safe event tables are reachable." : "Production voice schema could not be read."} />
          <StatusCard label="Sarvam configuration" value={providerConfigReady ? "Configured" : "Incomplete"} ready={providerConfigReady} detail="Only configuration presence is shown. Secret values are never rendered." />
          <StatusCard label="Partner AI calling" value={readiness.callingEnabled ? "Enabled" : "Disabled"} ready={readiness.callingEnabled} detail={readiness.callingEnabled ? "The server kill switch currently permits outbound submission." : "The server kill switch blocks outbound submission."} />
          <StatusCard
            label="Webhook callbacks"
            value={webhookObserved ? "Observed" : "Not observed"}
            ready={webhookObserved}
            detail={webhookObserved ? `Latest normalized provider event: ${formatDateTime(latestWebhookEvent?.created_at ?? null)}.` : "No normalized Sarvam callback event is visible yet."}
          />
        </section>

        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#17203A]">Production readiness</h2>
              <p className="mt-1 max-w-2xl text-[10.5px] leading-5 text-[#64748B]">
                This page is visible only to IT Super User. It reports configuration presence and workflow health without exposing Sarvam credentials.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action="/api/system/voice-integration/sarvam-connection-test" method="post">
                <button
                  type="submit"
                  disabled={!connectionConfigReady}
                  className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#C8D7EA] bg-white px-3 text-[9.5px] font-semibold text-[#24345A] transition hover:bg-[#F7FAFE] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Test Sarvam connection
                </button>
              </form>
              <span className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold ${tone(operationalReady)}`}>
                {operationalReady ? "Technically ready for controlled test" : "Controlled test not ready"}
              </span>
            </div>
          </div>

          {sarvamTestOk || sarvamTestFailed ? (
            <div className={`mt-4 rounded-xl border px-3.5 py-3 ${sarvamTestOk ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className={`text-[10px] font-semibold ${sarvamTestOk ? "text-emerald-800" : "text-amber-900"}`}>
                    {sarvamTestOk ? "Sarvam connection verified" : "Sarvam connection needs attention"}
                  </p>
                  <p className={`mt-1 text-[9.5px] leading-4 ${sarvamTestOk ? "text-emerald-700" : "text-amber-800"}`}>
                    {sarvamTestOk
                      ? "INSUREIT authenticated with Sarvam and reached the configured renewal campaign using the validation-only stream request."
                      : sarvamStatus === "401" || sarvamStatus === "403"
                        ? "Sarvam rejected the configured API credentials or workspace access."
                        : sarvamStatus === "404"
                          ? "Sarvam is reachable, but the configured organisation, workspace or campaign was not found."
                          : "The validation-only Sarvam connection check did not complete successfully. Review the server configuration and provider availability."}
                  </p>
                </div>
                {sarvamStatus ? <span className="rounded-full border border-current/15 px-2.5 py-1 text-[8.5px] font-semibold">HTTP {sarvamStatus}</span> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2 lg:grid-cols-2">
            {readiness.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] px-3.5 py-3">
                <div>
                  <p className="text-[10.5px] font-semibold text-[#24345A]">{item.label}</p>
                  <p className="mt-0.5 text-[9px] text-[#94A3B8]">{item.required ? "Required" : "Optional hardening"}{item.safeHint ? ` · ${item.safeHint}` : ""}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${tone(item.configured)}`}>
                  {item.configured ? "Configured" : "Missing"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[#DBE7F5] bg-[#F7FAFE] p-3.5">
            <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#64748B]">Sarvam campaign webhook</p>
            <p className="mt-1 break-all font-mono text-[10px] text-[#24345A]">{readiness.webhookUrl}</p>
            <p className="mt-2 text-[9.5px] leading-4 text-[#64748B]">
              Configure this endpoint on the approved Sarvam renewal campaign. Keep the webhook secret private and use the INSUREIT-controlled secret mechanism already implemented by the route.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-[15px] font-semibold text-[#17203A]">Activation gate</h2>
          <p className="mt-1 text-[10.5px] leading-5 text-[#64748B]">
            Technical readiness does not by itself authorize scaled customer outreach. The single-opportunity closed loop is proven; production expansion still requires approved calling hours, retry policy, DND/opt-out handling, monitoring and reconciliation controls.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Gate label="Schema applied" ready={schemaReady} />
            <Gate label="Provider config" ready={providerConfigReady} />
            <Gate label="Kill switch" ready={readiness.callingEnabled} />
            <Gate label="Webhook observed" ready={webhookObserved} detail={webhookObserved ? "At least one normalized callback event exists" : "No callback event visible"} />
            <Gate label="Operational policy" ready={false} detail="Calling hours / retry / DND approval pending" />
          </div>
        </Card>

        <Card>
          <div>
            <h2 className="text-[15px] font-semibold text-[#17203A]">Webhook recovery</h2>
            <p className="mt-1 max-w-3xl text-[10px] leading-5 text-[#64748B]">
              Re-deliver a completed Sarvam campaign result through the configured webhook. This does not place another phone call. Use the Retry webhook action beside a completed attempt below so INSUREIT sends the exact stored provider attempt ID instead of relying on a copied Sarvam hash or phone identifier.
            </p>
          </div>

          {webhookRetryAccepted || webhookRetryFailed ? (
            <div className={`mt-4 rounded-xl border px-3.5 py-3 ${webhookRetryAccepted ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <p className={`text-[10px] font-semibold ${webhookRetryAccepted ? "text-emerald-800" : "text-amber-900"}`}>
                {webhookRetryAccepted ? "Webhook re-delivery accepted" : "Webhook re-delivery needs attention"}
              </p>
              <p className={`mt-1 text-[9.5px] leading-4 ${webhookRetryAccepted ? "text-emerald-700" : "text-amber-800"}`}>
                {webhookRetryAccepted
                  ? "Sarvam accepted the stored provider attempt for asynchronous webhook re-delivery. No phone call is placed."
                  : webhookRetryStatus
                    ? "Sarvam did not accept the webhook re-delivery request. Review the provider status below before trying again."
                    : "INSUREIT rejected the submitted identifier before contacting Sarvam. Use the Retry webhook button beside a completed attempt below."}
              </p>
              {webhookRetryStatus ? <span className="mt-2 inline-flex rounded-full border border-current/15 px-2.5 py-1 text-[8.5px] font-semibold">HTTP {webhookRetryStatus}</span> : null}
            </div>
          ) : null}

          <p className="mt-3 text-[9px] leading-4 text-[#94A3B8]">
            Recovery is correlated only by the stored Sarvam provider attempt ID. Phone hashes, phone numbers and interaction IDs are not accepted as substitutes. Provider-attempt events remain idempotent.
          </p>
        </Card>

        {staleActiveAttempts.length ? (
          <Card>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="text-[10.5px] font-semibold text-amber-900">Reconciliation attention required</p>
              <p className="mt-1 text-[9.5px] leading-4 text-amber-800">
                {staleActiveAttempts.length} active voice attempt{staleActiveAttempts.length === 1 ? "" : "s"} shown below have not changed for more than 60 minutes. This is an observation only: INSUREIT does not auto-fail or retry them because provider delivery may be ambiguous.
              </p>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#17203A]">Recent voice attempts</h2>
              <p className="mt-1 text-[10px] text-[#64748B]">Provider/CRM state only. No customer identity, phone number, transcript or raw provider payload is shown.</p>
            </div>
            <span className="text-[10px] font-semibold text-[#64748B]">{attempts?.length ?? 0} shown</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-[10px]">
              <thead><tr className="border-y border-[#E2E8F0] bg-[#F8FAFC] text-[8.5px] uppercase tracking-[.05em] text-[#64748B]"><th className="px-3 py-2.5">Submitted</th><th className="px-3 py-2.5">Connectivity</th><th className="px-3 py-2.5">Disposition</th><th className="px-3 py-2.5">Health</th><th className="px-3 py-2.5">Created</th><th className="px-3 py-2.5">Updated</th><th className="px-3 py-2.5">Recovery</th></tr></thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {(attempts ?? []).map((attempt) => {
                  const stale = isStaleActiveAttempt(attempt, nowMs);
                  return (
                    <tr key={attempt.id}>
                      <td className="px-3 py-3 font-semibold text-[#24345A]">{labelize(attempt.submission_status)}</td>
                      <td className="px-3 py-3 text-[#475569]">{labelize(attempt.connectivity_status)}</td>
                      <td className="px-3 py-3 text-[#475569]">{labelize(attempt.call_disposition)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[8.5px] font-semibold ${stale ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {stale ? "Reconcile" : "Normal"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#64748B]">{formatDateTime(attempt.created_at)}</td>
                      <td className="px-3 py-3 text-[#64748B]">{formatDateTime(attempt.updated_at)}</td>
                      <td className="px-3 py-3">
                        {attempt.provider_attempt_id && attempt.submission_status === "completed" ? (
                          <form action="/api/system/voice-integration/sarvam-webhook-retry" method="post">
                            <input type="hidden" name="provider_attempt_id" value={attempt.provider_attempt_id} />
                            <button
                              type="submit"
                              className="inline-flex min-h-7 items-center justify-center rounded-lg border border-[#C8D7EA] bg-white px-2.5 text-[8.5px] font-semibold text-[#24345A] transition hover:bg-[#F7FAFE]"
                            >
                              Retry webhook
                            </button>
                          </form>
                        ) : (
                          <span className="text-[8.5px] text-[#94A3B8]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!attempts?.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-[10px] text-[#94A3B8]">No production voice attempts recorded yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function StatusCard({ label, value, ready, detail }: { label: string; value: string; ready: boolean; detail: string }) {
  return <div className="rounded-2xl border border-[#DFE7F1] bg-white p-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#94A3B8]">{label}</p><div className="mt-2 flex items-center justify-between gap-3"><p className="text-[17px] font-semibold text-[#17203A]">{value}</p><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${tone(ready)}`}>{ready ? "OK" : "Attention"}</span></div><p className="mt-2 text-[9.5px] leading-4 text-[#64748B]">{detail}</p></div>;
}

function Gate({ label, ready, detail }: { label: string; ready: boolean; detail?: string }) {
  return <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] p-3"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold text-[#334155]">{label}</p><span className={`rounded-full border px-2 py-0.5 text-[8.5px] font-semibold ${tone(ready)}`}>{ready ? "Ready" : "Pending"}</span></div>{detail ? <p className="mt-1.5 text-[8.5px] text-[#94A3B8]">{detail}</p> : null}</div>;
}
