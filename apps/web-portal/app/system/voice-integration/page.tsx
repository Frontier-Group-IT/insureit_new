import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Clock3,
  Database,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  FileSpreadsheet,
  Pause,
  PhoneCall,
  Play,
  RefreshCw,
  RotateCcw,
  ServerCog,
  Wifi,
} from "lucide-react";

import { AppShell } from "@/components/shell";
import { ClickableTableRow } from "@/components/voice/clickable-table-row";
import { PendingButton } from "@/components/voice/pending-button";
import { VoiceQuickAddCard } from "@/components/voice/voice-quick-add-card";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getSarvamRenewalCampaignState } from "@/lib/sarvam-campaign-lifecycle";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getConfiguredSarvamRenewalOperationalPolicy } from "@/lib/sarvam-renewal-operational-policy";
import { getSarvamRenewalReadiness } from "@/lib/sarvam-renewal-readiness";
import { getSarvamProductionQueuePreview } from "@/lib/sarvam-production-queue";
import { getVoiceCampaignListState } from "@/lib/voice-campaigns";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STALE_ACTIVE_ATTEMPT_MS = 60 * 60 * 1000;
const ACTIVE_ATTEMPT_STATUSES = new Set(["created", "submitted", "queued", "calling"]);

type AttemptRow = {
  id: string;
  opportunity_id: string;
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

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

function isStaleActiveAttempt(attempt: AttemptRow, nowMs: number) {
  if (!ACTIVE_ATTEMPT_STATUSES.has(attempt.submission_status)) return false;
  const updatedMs = new Date(attempt.updated_at).getTime();
  return Number.isFinite(updatedMs) && nowMs - updatedMs > STALE_ACTIVE_ATTEMPT_MS;
}

function queueReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    eligible: "Ready",
    missing_mobile: "Mobile missing",
    terminal: "Closed / DNC",
    future_follow_up: "Follow-up scheduled",
    active_attempt: "Call active",
    crm_stage: "CRM stage held",
    missing_registration: "RC missing",
    needs_rc_enrichment: "Fetch RC details",
    rc_enrichment_failed: "RC details unavailable",
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}

export default async function VoiceIntegrationPage({ searchParams }: VoiceIntegrationPageProps) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const query = await searchParams;
  const sarvamTest = queryValue(query.sarvam_test);
  const sarvamStatus = queryValue(query.sarvam_status);
  const webhookRetry = queryValue(query.webhook_retry);
  const webhookRetryStatus = queryValue(query.webhook_retry_status);
  const campaignActionResult = queryValue(query.campaign_action);
  const campaignActionName = queryValue(query.campaign_action_name);
  const campaignActionState = queryValue(query.campaign_state);
  const campaignActionHttpStatus = queryValue(query.campaign_status);
  const dispatch = queryValue(query.dispatch);
  const dispatchError = queryValue(query.dispatch_error);
  const windowUpdate = queryValue(query.window_update);
  const windowError = queryValue(query.window_error);
  const editWindow = queryValue(query.edit_window) === "1";
  const rcEnrichment = queryValue(query.rc_enrichment);
  const rcEnrichmentError = queryValue(query.rc_enrichment_error);
  const quickAdd = queryValue(query.quick_add);
  const quickAddError = queryValue(query.quick_add_error);

  const readiness = getSarvamRenewalReadiness();
  const [operationalPolicy, campaignLifecycle, queuePreview, voiceCampaignState] = await Promise.all([
    getConfiguredSarvamRenewalOperationalPolicy(),
    getSarvamRenewalCampaignState(),
    getSarvamProductionQueuePreview(),
    getVoiceCampaignListState(),
  ]);
  const voiceCampaigns = voiceCampaignState.campaigns;

  const connectionConfigReady = ["api_key", "org_id", "workspace_id", "campaign_id"].every(
    (key) => readiness.items.find((item) => item.key === key)?.configured,
  );

  const admin = createSupabaseAdminClient();
  const [{ data: attempts, error: attemptsError }, { data: attemptEvents, error: eventsError }] = await Promise.all([
    admin
      .from("external_renewal_voice_attempts")
      .select("id,opportunity_id,provider_attempt_id,submission_status,connectivity_status,call_disposition,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<AttemptRow[]>(),
    admin
      .from("external_renewal_voice_attempt_events")
      .select("voice_attempt_id,connectivity_status,completion_status,created_at")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<AttemptEventRow[]>(),
  ]);

  const schemaReady = !attemptsError && !eventsError;
  const providerReady = readiness.requiredConfigured && campaignLifecycle.ok;
  const webhookObserved = Boolean(attemptEvents?.[0]);
  const campaignDispatchable = campaignLifecycle.status === "active" || campaignLifecycle.status === "scheduled";
  const dispatchReady =
    schemaReady &&
    providerReady &&
    readiness.callingEnabled &&
    operationalPolicy.withinCallingWindow &&
    campaignDispatchable;
  const staleActiveAttempts = (attempts ?? []).filter((attempt) => isStaleActiveAttempt(attempt, Date.now()));
  const latestWebhookEvent = attemptEvents?.[0] ?? null;

  const actionNotice =
    quickAdd === "failed"
      ? {
          ok: false,
          text: quickAddError || "Could not add this RC to the calling queue.",
        }
      : rcEnrichment
      ? {
          ok: rcEnrichment === "ready",
          text:
            rcEnrichment === "ready"
              ? "RC details fetched. This opportunity is now AI-ready."
              : rcEnrichment === "no_data"
                ? "AuthBridge responded, but no usable AI context was available."
                : rcEnrichmentError || "RC details could not be fetched.",
        }
      : windowUpdate
      ? {
          ok: windowUpdate === "saved",
          text: windowUpdate === "saved" ? "Calling window updated." : windowError || "Calling window could not be saved.",
        }
      : dispatch === "queued"
      ? { ok: true, text: "AI call queued." }
      : dispatch === "failed"
        ? { ok: false, text: dispatchError || "AI call could not be queued." }
        : campaignActionResult
          ? {
              ok: campaignActionResult === "ok",
              text:
                campaignActionResult === "ok"
                  ? `Campaign ${campaignActionName === "pause" ? "paused" : "resumed"} · ${labelize(campaignActionState ?? null)}`
                  : "Campaign action failed.",
            }
          : webhookRetry
            ? {
                ok: webhookRetry === "accepted",
                text:
                  webhookRetry === "accepted"
                    ? "Webhook retry queued by Sarvam."
                    : "Webhook retry failed.",
              }
            : sarvamTest
              ? {
                  ok: sarvamTest === "ok",
                  text: sarvamTest === "ok" ? "Sarvam connection verified." : "Sarvam connection check failed.",
                }
              : null;

  return (
    <AppShell title="Voice Integration">
      <div className="mx-auto max-w-[1380px] space-y-2 pb-6">
        <header className="flex min-h-9 items-center justify-between gap-3 px-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[17px] font-black tracking-[-0.025em] text-[#142B50]">Voice Integration</h1>
            <span className="inline-flex items-center gap-1 text-[7.5px] font-bold text-[#8192A7]" title="IT Super User only">
              <LockKeyhole className="h-3 w-3" />
              Production
            </span>
          </div>
        </header>

        {actionNotice ? (
          <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-[9.5px] font-semibold ${actionNotice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <span>{actionNotice.text}</span>
            {[sarvamStatus, campaignActionHttpStatus, webhookRetryStatus].filter(Boolean)[0] ? (
              <span className="rounded-full border border-current/15 px-2 py-0.5 text-[8px]">
                HTTP {[sarvamStatus, campaignActionHttpStatus, webhookRetryStatus].filter(Boolean)[0]}
              </span>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-xl border border-[#DDE6F0] bg-white p-2.5 shadow-[0_3px_12px_rgba(31,55,86,0.035)]">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={FileSpreadsheet} title="Voice campaigns" />
            {voiceCampaignState.schemaReady ? (
              <Link
                href="/system/voice-integration/campaigns/new"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8.5px] font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add Campaign
              </Link>
            ) : (
              <span
                className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-200 px-3 text-[8.5px] font-bold text-slate-500"
                title="Voice campaign schema is not ready yet."
              >
                <Plus className="h-3.5 w-3.5" /> Add Campaign
              </span>
            )}
          </div>
          {!voiceCampaignState.schemaReady ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[8.5px] font-semibold text-amber-800">
              Campaign setup is temporarily unavailable while the database schema is being prepared. Existing Voice Integration controls remain available.
            </div>
          ) : null}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[8.5px]">
              <thead>
                <tr className="border-y border-[#E7EDF4] bg-[#F8FAFC] text-[7px] font-black uppercase tracking-[.05em] text-[#7890AC]">
                  <th className="px-2.5 py-2">Campaign</th>
                  <th className="px-2.5 py-2">Customers</th>
                  <th className="px-2.5 py-2">API ready</th>
                  <th className="px-2.5 py-2">Exceptions</th>
                  <th className="px-2.5 py-2">Status</th>
                  <th className="px-2.5 py-2 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {voiceCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-[#FAFCFF]">
                    <td className="px-2.5 py-2">
                      <Link
                        href={"/system/voice-integration/campaigns/" + campaign.id}
                        className="font-bold text-[#29415F] hover:underline"
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-2.5 py-2 text-[#61758F]">
                      {campaign.accepted_rows}/{campaign.total_rows}
                    </td>
                    <td className="px-2.5 py-2 font-bold text-emerald-700">
                      {campaign.enriched_rows}
                    </td>
                    <td className="px-2.5 py-2 text-[#61758F]">
                      {campaign.rejected_rows + campaign.duplicate_rows}
                    </td>
                    <td className="px-2.5 py-2">
                      <span className="inline-flex rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[7px] font-bold text-[#3156B8]">
                        {labelize(campaign.status)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right text-[#71839A]">
                      {formatDateTime(campaign.created_at)}
                    </td>
                  </tr>
                ))}
                {!voiceCampaigns.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[9px] text-[#94A3B8]">
                      No voice campaign yet. Add a campaign to start a batch test.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#DDE6F0] bg-white px-2.5 py-2 shadow-[0_3px_12px_rgba(31,55,86,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <CompactHealthStatus
                label={dispatchReady ? "Ready" : "Attention"}
                ok={dispatchReady}
                strong
              />
              <CompactHealthStatus label={`Provider · ${providerReady ? "Ready" : "Attention"}`} ok={providerReady} />
              <CompactHealthStatus
                label={`Campaign · ${labelize(campaignLifecycle.status)}`}
                ok={campaignLifecycle.ok && campaignLifecycle.status !== "ended" && campaignLifecycle.status !== "cancelled"}
              />
              <CompactHealthStatus
                label={`Window · ${operationalPolicy.start}–${operationalPolicy.end}`}
                ok={operationalPolicy.withinCallingWindow}
              />
              <CompactHealthStatus label={`Webhook · ${webhookObserved ? "Healthy" : "No callback"}`} ok={webhookObserved} />
              <CompactHealthStatus label="DND protected" ok />
              {!readiness.callingEnabled ? <CompactHealthStatus label="Calling disabled" ok={false} /> : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {campaignLifecycle.status === "active" ? (
                <form action="/api/system/voice-integration/sarvam-campaign-status" method="post">
                  <input type="hidden" name="action" value="pause" />
                  <ControlButton icon={Pause} label="Pause Campaign" />
                </form>
              ) : campaignLifecycle.status === "paused" ? (
                <form action="/api/system/voice-integration/sarvam-campaign-status" method="post">
                  <input type="hidden" name="action" value="resume" />
                  <ControlButton icon={Play} label="Resume Campaign" primary />
                </form>
              ) : null}

              <details className="relative">
                <summary
                  className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-lg border border-[#D6E0EC] bg-white text-[#61758F] transition hover:bg-[#F8FAFC] [&::-webkit-details-marker]:hidden"
                  aria-label="More voice controls"
                  title="More controls"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#DCE5EF] bg-white p-1 shadow-[0_12px_30px_rgba(31,55,86,0.16)]">
                  <form action="/api/system/voice-integration/sarvam-connection-test" method="post">
                    <PendingButton
                      disabled={!connectionConfigReady}
                      pendingLabel="Testing…"
                      className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[8.5px] font-bold text-[#405774] transition hover:bg-[#F6F8FB] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Wifi className="h-3.5 w-3.5 text-[#3156B8]" />
                      Test connection
                    </PendingButton>
                  </form>
                  <Link
                    href="/system/voice-integration"
                    className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-[8.5px] font-bold text-[#405774] transition hover:bg-[#F6F8FB]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#3156B8]" />
                    Refresh status
                  </Link>
                  <Link
                    href="/system/voice-integration?edit_window=1"
                    className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-[8.5px] font-bold text-[#405774] transition hover:bg-[#F6F8FB]"
                  >
                    <Clock3 className="h-3.5 w-3.5 text-[#3156B8]" />
                    Edit calling window
                  </Link>
                  <Link
                    href="/system/voice-integration/diagnostics"
                    className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-[8.5px] font-bold text-[#405774] transition hover:bg-[#F6F8FB]"
                  >
                    <ServerCog className="h-3.5 w-3.5 text-[#3156B8]" />
                    Diagnostics
                  </Link>
                </div>
              </details>
            </div>
          </div>

          {editWindow ? (
            <div className="mt-2 border-t border-[#E9EEF4] pt-2">
              <CompactCallingWindowEditor start={operationalPolicy.start} end={operationalPolicy.end} />
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.55fr_.75fr]">
          <div id="voice-queue" className="rounded-xl border border-[#DDE6F0] bg-white p-2.5 shadow-[0_3px_12px_rgba(31,55,86,0.035)]">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={PhoneCall} title="Calling queue" />
              <div className="flex items-center gap-1 text-[8px] font-bold">
                <MetricPill label="Queue" value={queuePreview.totalDueWindow} />
                <MetricPill label="Ready" value={queuePreview.eligibleCount} good />
                <MetricPill label="Held" value={queuePreview.heldCount} />
                <VoiceQuickAddCard compact />
              </div>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-[9px]">
                <thead>
                  <tr className="border-y border-[#E7EDF4] bg-[#F8FAFC] text-[7.5px] font-black uppercase tracking-[.05em] text-[#7890AC]">
                    <th className="px-2.5 py-2">Ref</th>
                    <th className="px-2.5 py-2">Expiry</th>
                    <th className="px-2.5 py-2">CRM</th>
                    <th className="px-2.5 py-2">State</th>
                    <th className="px-2.5 py-2">RC data</th>
                    <th className="px-2.5 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {queuePreview.rows.slice(0, 12).map((row) => {
                    const callable = row.reason === "eligible" && dispatchReady;
                    return (
                      <ClickableTableRow key={row.opportunityId} href={`/system/voice-integration/prospects/${row.opportunityId}`}>
                        <td className="px-2.5 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[8px] text-[#536984]">{row.opportunityId.slice(0, 8)}</span>
                            {row.voiceQueueSource === "it_quick_add" ? (
                              <span className="rounded-full bg-[#EEF3FF] px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-[.04em] text-[#3156B8]">Quick</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 font-semibold text-[#334B6B]">{row.policyEndDate ?? "—"}</td>
                        <td className="px-2.5 py-2 text-[#61758F]">{labelize(row.opportunityStatus)}</td>
                        <td className="px-2.5 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[7.5px] font-bold ${row.reason === "eligible" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {queueReasonLabel(row.reason)}
                          </span>
                        </td>
                        <td className="px-2.5 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[7.5px] font-bold ${row.rcEnrichmentStatus === "ready" ? "bg-[#EEF8F2] text-emerald-700" : row.rcEnrichmentStatus === "failed" || row.rcEnrichmentStatus === "no_data" ? "bg-amber-50 text-amber-700" : "bg-[#F1F4F8] text-[#6B7E98]"}`}>
                            {row.rcEnrichmentStatus === "ready" ? (row.rcEnrichmentSource === "local_cache" ? "Ready · cache" : row.rcEnrichmentSource === "stale_cache" ? "Ready · cached" : "Ready · AuthBridge") : row.rcEnrichmentStatus === "failed" ? "Fetch failed" : row.rcEnrichmentStatus === "no_data" ? "No usable data" : "Not fetched"}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {row.canFetchDetails ? (
                              <form action="/api/system/voice-integration/rc-enrichment" method="post">
                                <input type="hidden" name="opportunity_id" value={row.opportunityId} />
                                <PendingButton
                                  pendingLabel={row.rcEnrichmentStatus === "ready" ? "Refreshing…" : "Fetching…"}
                                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#D6E0EC] bg-white px-2.5 text-[8px] font-bold text-[#3156B8] hover:bg-[#F8FAFC] disabled:cursor-wait disabled:opacity-60"
                                  title="Fetch vehicle and insurer context from AuthBridge"
                                >
                                  <Database className="h-3 w-3" /> {row.rcEnrichmentStatus === "ready" ? "Refresh details" : "Fetch details"}
                                </PendingButton>
                              </form>
                            ) : null}
                            {row.reason === "eligible" ? (
                              <form action="/api/system/voice-integration/dispatch" method="post">
                                <input type="hidden" name="opportunity_id" value={row.opportunityId} />
                                <PendingButton
                                  pendingLabel="Creating cohort…"
                                  disabled={!callable}
                                  className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#102A56] px-2.5 text-[8px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#D9E1EC]"
                                  title={callable ? "Queue AI call" : "Calling controls are not currently ready"}
                                >
                                  <PhoneCall className="h-3 w-3" /> Call
                                </PendingButton>
                              </form>
                            ) : null}
                            {!row.canFetchDetails && row.reason !== "eligible" ? <span className="text-[8px] text-[#A0ADBC]">—</span> : null}
                          </div>
                        </td>
                      </ClickableTableRow>
                    );
                  })}
                  {!queuePreview.rows.length ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-[9px] text-[#94A3B8]">No opportunities in the calling queue.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDE6F0] bg-white p-2.5 shadow-[0_3px_12px_rgba(31,55,86,0.035)]">
            <SectionTitle icon={Activity} title="Campaign" />
            <div className="mt-2 divide-y divide-[#EDF2F7] rounded-xl border border-[#E4EBF3]">
              <InfoRow label="State" value={labelize(campaignLifecycle.status)} />
              <InfoRow label="Verified" value={campaignLifecycle.ok ? "Yes" : "No"} />
              <InfoRow label="Window" value={`${operationalPolicy.start}–${operationalPolicy.end}`} />
              <InfoRow label="Webhook" value={webhookObserved ? "Healthy" : "Not seen"} />
              <InfoRow label="Last callback" value={formatDateTime(latestWebhookEvent?.created_at ?? null)} />
              <InfoRow label="Partner control" value="Disabled" />
            </div>
            <div className="mt-2 rounded-lg bg-[#F4F7FB] px-3 py-2 text-[8.5px] text-[#64748B]">
              Calling is centrally controlled by IT.
            </div>
          </div>
        </section>

        {staleActiveAttempts.length ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] font-semibold text-amber-800">
            <Clock3 className="h-3.5 w-3.5" />
            {staleActiveAttempts.length} stale active attempt{staleActiveAttempts.length === 1 ? "" : "s"} needs reconciliation.
          </div>
        ) : null}

        <section id="recent-attempts" className="rounded-xl border border-[#DDE6F0] bg-white p-2.5 shadow-[0_3px_12px_rgba(31,55,86,0.035)]">
          <div className="flex items-center justify-between">
            <SectionTitle icon={Activity} title="Recent voice attempts" />
            <span className="text-[8px] font-bold text-[#8798AC]">{attempts?.length ?? 0} shown</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-[9px]">
              <thead>
                <tr className="border-y border-[#E7EDF4] bg-[#F8FAFC] text-[7.5px] font-black uppercase tracking-[.05em] text-[#7890AC]">
                  <th className="px-2.5 py-2">Submitted</th>
                  <th className="px-2.5 py-2">Connection</th>
                  <th className="px-2.5 py-2">Disposition</th>
                  <th className="px-2.5 py-2">Health</th>
                  <th className="px-2.5 py-2">Updated</th>
                  <th className="px-2.5 py-2 text-right">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {(attempts ?? []).map((attempt) => {
                  const stale = isStaleActiveAttempt(attempt, Date.now());
                  return (
                    <ClickableTableRow key={attempt.id} href={`/system/voice-integration/prospects/${attempt.opportunity_id}#attempt-${attempt.id}`}>
                      <td className="px-2.5 py-2 font-semibold text-[#334B6B]">{labelize(attempt.submission_status)}</td>
                      <td className="px-2.5 py-2 text-[#61758F]">{labelize(attempt.connectivity_status)}</td>
                      <td className="px-2.5 py-2 text-[#61758F]">{labelize(attempt.call_disposition)}</td>
                      <td className="px-2.5 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[7.5px] font-bold ${stale ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {stale ? "Review" : "Normal"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[#71839A]">{formatDateTime(attempt.updated_at)}</td>
                      <td className="px-2.5 py-2 text-right">
                        {attempt.provider_attempt_id && attempt.submission_status === "completed" ? (
                          <form action="/api/system/voice-integration/sarvam-webhook-retry" method="post">
                            <input type="hidden" name="provider_attempt_id" value={attempt.provider_attempt_id} />
                            <PendingButton pendingLabel="Retrying…" className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#D6E0EC] px-2.5 text-[8px] font-bold text-[#3156B8] hover:bg-[#F8FAFC] disabled:cursor-wait disabled:opacity-60">
                              <RotateCcw className="h-3 w-3" /> Retry
                            </PendingButton>
                          </form>
                        ) : (
                          <span className="text-[#A0ADBC]">—</span>
                        )}
                      </td>
                    </ClickableTableRow>
                  );
                })}
                {!attempts?.length ? <tr><td colSpan={6} className="px-3 py-6 text-center text-[9px] text-[#94A3B8]">No voice attempts yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SectionTitle({ icon: Icon, title, children }: { icon: typeof ServerCog; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-3.5 w-3.5" /></span>
        <h2 className="text-[11px] font-black text-[#1D3557]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ControlButton({ icon: Icon, label, disabled = false, primary = false }: { icon: typeof Wifi; label: string; disabled?: boolean; primary?: boolean }) {
  return (
    <PendingButton
      disabled={disabled}
      pendingLabel={`${label}…`}
      className={`inline-flex h-7 min-w-[112px] items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[8px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${primary ? "border-[#102A56] bg-[#102A56] text-white" : "border-[#D6E0EC] bg-white text-[#263D5E] hover:bg-[#F8FAFC]"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </PendingButton>
  );
}

function CompactHealthStatus({
  label,
  ok,
  strong = false,
}: {
  label: string;
  ok: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[7.5px] font-bold ${ok ? "border-emerald-100 bg-emerald-50/70 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"} ${strong ? "pr-2.5" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label}
    </span>
  );
}

function CompactCallingWindowEditor({ start, end }: { start: string; end: string }) {
  return (
    <form action="/api/system/voice-integration/calling-window" method="post" className="flex flex-wrap items-center gap-1.5">
      <Clock3 className="h-3.5 w-3.5 text-[#3156B8]" />
      <span className="text-[7.5px] font-black uppercase tracking-[.05em] text-[#8192A7]">Calling window</span>
      <input
        type="time"
        name="window_start"
        defaultValue={start}
        required
        className="h-7 w-[92px] rounded-md border border-[#D6E0EC] bg-white px-1.5 text-[8.5px] font-bold text-[#29415F]"
        aria-label="Calling window start"
      />
      <span className="text-[8px] font-bold text-[#94A3B8]">to</span>
      <input
        type="time"
        name="window_end"
        defaultValue={end}
        required
        className="h-7 w-[92px] rounded-md border border-[#D6E0EC] bg-white px-1.5 text-[8.5px] font-bold text-[#29415F]"
        aria-label="Calling window end"
      />
      <PendingButton pendingLabel="Saving…" className="inline-flex h-7 items-center rounded-md bg-[#102A56] px-2.5 text-[7.5px] font-bold text-white">
        Save
      </PendingButton>
      <Link href="/system/voice-integration" className="inline-flex h-7 items-center rounded-md px-2 text-[7.5px] font-bold text-[#6B7E98]">
        Cancel
      </Link>
    </form>
  );
}


function MetricPill({ label, value, good = false }: { label: string; value: number; good?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${good ? "bg-emerald-50 text-emerald-700" : "bg-[#F1F4F8] text-[#64748B]"}`}>
      {label} <strong>{value}</strong>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-[8.5px]">
      <span className="font-semibold text-[#7A8AA0]">{label}</span>
      <span className="text-right font-bold text-[#29415F]">{value}</span>
    </div>
  );
}
