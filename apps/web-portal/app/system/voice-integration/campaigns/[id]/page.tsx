import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/shell";
import { VoiceCampaignRetryRowButton } from "@/components/voice/voice-campaign-retry-row-button";
import { VoiceCampaignRunner } from "@/components/voice/voice-campaign-runner";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getVoiceCampaignDetail } from "@/lib/voice-campaigns";

function label(value: string | null) {
  return value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : "—";
}

export default async function VoiceCampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (
    !viewer?.id ||
    viewer.role !== "it_super_user" ||
    !(await hasEffectiveCapability(viewer, "manage_system", "approve"))
  ) {
    redirect("/access-denied");
  }

  const { id } = await params;
  const query = await searchParams;
  const detail = await getVoiceCampaignDetail(id);
  if (!detail) notFound();

  const autoEnrich =
    (Array.isArray(query.auto_enrich) ? query.auto_enrich[0] : query.auto_enrich) === "1";

  return (
    <AppShell title={detail.campaign.name}>
      <div className="mx-auto max-w-[1380px] space-y-3 pb-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/system/voice-integration"
            className="inline-flex items-center gap-1.5 text-[9px] font-bold text-[#536984]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voice Integration
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={"/api/system/voice-integration/campaigns/" + encodeURIComponent(id) + "/export"}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D4E3F6] bg-white px-3 text-[8.5px] font-black text-[#3156B8] hover:bg-[#F7FAFF]"
            >
              <Download className="h-3.5 w-3.5" />
              Download Detailed Report
            </a>
            <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[8px] font-black text-[#3156B8]">
              {label(detail.campaign.status)}
            </span>
          </div>
        </div>

        <section className="rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[.08em] text-[#6674CB]">
                Voice campaign
              </p>
              <h1 className="mt-1 text-[20px] font-black text-[#142B50]">
                {detail.campaign.name}
              </h1>
              <p className="mt-1 max-w-2xl text-[9px] text-[#687B96]">
                {detail.campaign.description ||
                  "RC + mobile campaign with API-enriched renewal context."}
              </p>
            </div>

            <VoiceCampaignRunner
              campaignId={id}
              status={detail.campaign.status}
              autoEnrich={autoEnrich}
              pendingDispatch={detail.counts.pendingDispatch}
              retryableFailures={detail.counts.retryable}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric icon={FileSpreadsheet} label="Uploaded" value={detail.campaign.total_rows} />
            <Metric icon={CheckCircle2} label="Accepted" value={detail.campaign.accepted_rows} />
            <Metric icon={ShieldCheck} label="API ready" value={detail.counts.ready} good />
            <Metric
              icon={CircleAlert}
              label="Held"
              value={detail.counts.held + detail.campaign.rejected_rows}
            />
            <Metric icon={PhoneCall} label="Queued" value={detail.counts.queued} good />
            <Metric
              icon={CalendarClock}
              label="Pending"
              value={detail.counts.pendingDispatch}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[#DDE6F0] bg-white p-3 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black text-[#1D3557]">Campaign customers</h2>
            <span className="text-[8px] font-bold text-[#8798AC]">
              {detail.members.length} rows
            </span>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-[8.5px]">
              <thead>
                <tr className="border-y border-[#E7EDF4] bg-[#F8FAFC] text-[7px] font-black uppercase tracking-[.05em] text-[#7890AC]">
                  <th className="px-2.5 py-2">Row</th>
                  <th className="px-2.5 py-2">RC No.</th>
                  <th className="px-2.5 py-2">Mobile</th>
                  <th className="px-2.5 py-2">Customer</th>
                  <th className="px-2.5 py-2">Vehicle</th>
                  <th className="px-2.5 py-2">Insurer</th>
                  <th className="px-2.5 py-2">Expiry</th>
                  <th className="px-2.5 py-2">API</th>
                  <th className="px-2.5 py-2">Call</th>
                  <th className="px-2.5 py-2">Outcome</th>
                  <th className="px-2.5 py-2 text-right">Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {detail.members.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2.5 py-2 text-[#8190A3]">{row.source_row_number}</td>
                    <td className="px-2.5 py-2 font-mono font-semibold text-[#29415F]">
                      <Link
                        href={"/system/voice-integration/prospects/" + row.opportunityId}
                        className="hover:underline"
                      >
                        {row.registrationNumber || "—"}
                      </Link>
                    </td>
                    <td className="px-2.5 py-2 text-[#61758F]">{row.mobile || "—"}</td>
                    <td className="px-2.5 py-2 text-[#334B6B]">
                      {row.customerName || "—"}
                    </td>
                    <td className="px-2.5 py-2 text-[#61758F]">{row.vehicle || "—"}</td>
                    <td className="px-2.5 py-2 text-[#61758F]">{row.insurer || "—"}</td>
                    <td className="px-2.5 py-2 text-[#61758F]">
                      {row.policyExpiryDate || "—"}
                    </td>
                    <td className="px-2.5 py-2">
                      <StateBadge
                        value={row.enrichment_status}
                        good={row.enrichment_status === "ready"}
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <StateBadge
                          value={row.latestConnectivityStatus || row.attemptStatus || row.dispatch_status}
                          good={row.latestConnectivityStatus === "connected"}
                        />
                        {row.attemptCount > 1 ? (
                          <span className="text-[7px] font-bold text-[#8798AC]">Attempt {row.attemptCount}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-[#61758F]">
                      {label(row.callDisposition)}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      {row.retryable ? (
                        <VoiceCampaignRetryRowButton
                          campaignId={id}
                          opportunityId={row.opportunityId}
                          campaignStatus={detail.campaign.status}
                        />
                      ) : (
                        <span className="text-[#B1BCC9]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label: metricLabel,
  value,
  good = false,
}: {
  icon: typeof FileSpreadsheet;
  label: string;
  value: number;
  good?: boolean;
}) {
  return (
    <div className="flex h-12 items-center gap-2 rounded-xl border border-[#E1E8F0] bg-[#FAFCFF] px-3">
      <Icon className={"h-3.5 w-3.5 " + (good ? "text-emerald-600" : "text-[#3156B8]")} />
      <div>
        <p className="text-[6.5px] font-black uppercase tracking-[.05em] text-[#8998AA]">
          {metricLabel}
        </p>
        <p className={"text-[11px] font-black " + (good ? "text-emerald-700" : "text-[#29415F]")}>
          {value}
        </p>
      </div>
    </div>
  );
}

function StateBadge({ value, good = false }: { value: string; good?: boolean }) {
  return (
    <span
      className={
        "inline-flex rounded-full px-2 py-0.5 text-[7px] font-bold " +
        (good ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")
      }
    >
      {label(value)}
    </span>
  );
}
