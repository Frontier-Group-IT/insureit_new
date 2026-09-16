import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, Card, PageHeader } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DiagnosticsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProbeView = {
  key: "core" | "scheduling_x_api_key" | "scheduling_subscription" | "scheduling_bearer";
  label: string;
  status: string | null;
  classification: string | null;
  errorCode: string | null;
  requestId: string | null;
};

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function prettify(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(classification: string | null) {
  if (!classification) return "border-slate-200 bg-slate-50 text-slate-600";
  if (classification === "api_key_accepted" || classification === "api_key_accepted_rate_limited" || classification === "campaign_reachable") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function conclusion(probes: ProbeView[]) {
  const core = probes.find((probe) => probe.key === "core");
  const xApiKey = probes.find((probe) => probe.key === "scheduling_x_api_key");
  const subscription = probes.find((probe) => probe.key === "scheduling_subscription");
  const bearer = probes.find((probe) => probe.key === "scheduling_bearer");

  if (xApiKey?.classification === "campaign_reachable") {
    return "Voice Agents scheduling accepts the configured credential with X-API-Key. This confirms the earlier HTTP 401 blocker was the scheduling header contract, not the campaign binding. The core API 403 does not block the Voice Agents scheduling integration.";
  }

  const coreAccepted = core?.classification?.startsWith("api_key_accepted") ?? false;
  if (!coreAccepted) {
    return "The core Sarvam API did not accept the configured credential and the X-API-Key scheduling probe did not reach the campaign. Keep the campaign paused and use the four probe results below to isolate the credential contract.";
  }
  if (subscription?.classification === "campaign_reachable" || bearer?.classification === "campaign_reachable") {
    return "The API key is accepted and the configured Voice Agents campaign is reachable. The provider-authentication blocker is cleared.";
  }
  if (subscription?.status === "401" && bearer?.status === "401") {
    return "The core API accepts the key, while the legacy scheduling auth forms return HTTP 401. Inspect X-API-Key because Voice Agents scheduling uses a separate API-key header contract.";
  }
  if (xApiKey?.status === "403" || subscription?.status === "403" || bearer?.status === "403") {
    return "Voice Agents scheduling reports forbidden access. Check the Voice Agents workspace key, product access and campaign permissions.";
  }
  if (xApiKey?.status === "404" || subscription?.status === "404" || bearer?.status === "404") {
    return "A scheduling request reached Voice Agents but the configured campaign binding was not found. Recheck the organisation, workspace and campaign identifiers.";
  }
  return "The scheduling probes did not reach the configured campaign. Use the sanitized statuses and request identifiers below for provider escalation.";
}

export default async function SarvamDiagnosticsPage({ searchParams }: DiagnosticsPageProps) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const query = await searchParams;
  const diagState = queryValue(query.sarvam_diag);
  const probes: ProbeView[] = [
    {
      key: "core",
      label: "Core Sarvam API key",
      status: queryValue(query.diag_core_status) ?? null,
      classification: queryValue(query.diag_core_class) ?? null,
      errorCode: queryValue(query.diag_core_code) ?? null,
      requestId: queryValue(query.diag_core_request) ?? null,
    },
    {
      key: "scheduling_x_api_key",
      label: "Voice Agents scheduling · X-API-Key",
      status: queryValue(query.diag_scheduling_x_api_key_status) ?? null,
      classification: queryValue(query.diag_scheduling_x_api_key_class) ?? null,
      errorCode: queryValue(query.diag_scheduling_x_api_key_code) ?? null,
      requestId: queryValue(query.diag_scheduling_x_api_key_request) ?? null,
    },
    {
      key: "scheduling_subscription",
      label: "Voice Agents scheduling · subscription key",
      status: queryValue(query.diag_scheduling_subscription_status) ?? null,
      classification: queryValue(query.diag_scheduling_subscription_class) ?? null,
      errorCode: queryValue(query.diag_scheduling_subscription_code) ?? null,
      requestId: queryValue(query.diag_scheduling_subscription_request) ?? null,
    },
    {
      key: "scheduling_bearer",
      label: "Voice Agents scheduling · Bearer",
      status: queryValue(query.diag_scheduling_bearer_status) ?? null,
      classification: queryValue(query.diag_scheduling_bearer_class) ?? null,
      errorCode: queryValue(query.diag_scheduling_bearer_code) ?? null,
      requestId: queryValue(query.diag_scheduling_bearer_request) ?? null,
    },
  ];

  return (
    <AppShell title="Sarvam Diagnostics">
      <div className="mx-auto max-w-[1100px] space-y-4 pb-8">
        <PageHeader title="Sarvam Deep Diagnostics" />

        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#17203A]">Read-only provider diagnostics</h2>
              <p className="mt-1 max-w-2xl text-[10.5px] leading-5 text-[#64748B]">
                Runs four non-mutating server-side probes. It does not place calls, stream cohorts, modify campaigns, expose credentials, or render raw provider response bodies.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/system/voice-integration" className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#C8D7EA] bg-white px-3 text-[9.5px] font-semibold text-[#24345A] hover:bg-[#F7FAFE]">
                Back to Voice Integration
              </Link>
              <form action="/api/system/voice-integration/sarvam-deep-diagnostics" method="post">
                <button type="submit" className="inline-flex min-h-8 items-center justify-center rounded-lg bg-[#102A56] px-3 text-[9.5px] font-semibold text-white hover:bg-[#0C2248]">
                  Run Deep Diagnostics
                </button>
              </form>
            </div>
          </div>

          {diagState === "config_error" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[10px] text-amber-900">
              Required Sarvam server configuration is incomplete. No provider request was sent.
            </div>
          ) : null}

          {diagState === "done" ? (
            <>
              <div className="mt-4 rounded-xl border border-[#D9E5F3] bg-[#F7FAFE] p-3.5">
                <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#64748B]">Diagnostic conclusion</p>
                <p className="mt-2 text-[10.5px] leading-5 text-[#334155]">{conclusion(probes)}</p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {probes.map((probe) => (
                  <div key={probe.key} className="rounded-xl border border-[#E2E8F0] bg-white p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10.5px] font-semibold text-[#24345A]">{probe.label}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[8.5px] font-semibold ${statusTone(probe.classification)}`}>
                        {probe.status && probe.status !== "none" ? `HTTP ${probe.status}` : "No HTTP response"}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-2 text-[9.5px]">
                      <div><dt className="text-[#94A3B8]">Classification</dt><dd className="mt-0.5 font-semibold text-[#475569]">{prettify(probe.classification)}</dd></div>
                      <div><dt className="text-[#94A3B8]">Provider error code</dt><dd className="mt-0.5 break-all font-mono text-[#475569]">{probe.errorCode ?? "—"}</dd></div>
                      <div><dt className="text-[#94A3B8]">Provider request ID</dt><dd className="mt-0.5 break-all font-mono text-[#475569]">{probe.requestId ?? "—"}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-[15px] font-semibold text-[#17203A]">How to interpret the four probes</h2>
          <ul className="mt-3 space-y-2 text-[10px] leading-5 text-[#64748B]">
            <li><strong className="text-[#334155]">Core API key:</strong> tests the general `api.sarvam.ai` API with `api-subscription-key`.</li>
            <li><strong className="text-[#334155]">Scheduling · X-API-Key:</strong> tests the Voice Agents scheduling header shown in Sarvam Agent API examples for the same `apps.sarvam.ai/api/scheduling/v1/...` API family.</li>
            <li><strong className="text-[#334155]">Scheduling · subscription key:</strong> retains the previous `api-subscription-key` probe for comparison.</li>
            <li><strong className="text-[#334155]">Scheduling · Bearer:</strong> retains the previous Bearer probe for comparison.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
