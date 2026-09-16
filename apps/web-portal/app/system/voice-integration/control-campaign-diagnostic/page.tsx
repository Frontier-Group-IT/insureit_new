import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, Card, PageHeader } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProbeView = {
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

function tone(classification: string | null) {
  if (classification === "authenticated_validation_reached" || classification === "campaign_reachable") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default async function SarvamControlCampaignDiagnosticPage({ searchParams }: Props) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const query = await searchParams;
  const state = queryValue(query.control_diag);
  const probes: ProbeView[] = [
    {
      label: "Fresh control campaign · webhook delivery list",
      status: queryValue(query.webhook_status) ?? null,
      classification: queryValue(query.webhook_class) ?? null,
      errorCode: queryValue(query.webhook_code) ?? null,
      requestId: queryValue(query.webhook_request) ?? null,
    },
    {
      label: "Fresh control campaign · stream endpoint validation-only",
      status: queryValue(query.stream_validation_status) ?? null,
      classification: queryValue(query.stream_validation_class) ?? null,
      errorCode: queryValue(query.stream_validation_code) ?? null,
      requestId: queryValue(query.stream_validation_request) ?? null,
    },
  ];

  return (
    <AppShell title="Sarvam Control Campaign Diagnostic">
      <div className="mx-auto max-w-[900px] space-y-4 pb-8">
        <PageHeader title="Sarvam Fresh Campaign Control Probe" />
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#17203A]">Fresh campaign comparison</h2>
              <p className="mt-1 max-w-2xl text-[10.5px] leading-5 text-[#64748B]">
                Runs two server-side X-API-Key probes against the new paused control campaign. The first reads webhook deliveries. The second submits a deliberately invalid cohort body so Sarvam can only reject it at validation; it contains no phone number and cannot create a callable contact.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/system/voice-integration/diagnostics" className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#C8D7EA] bg-white px-3 text-[9.5px] font-semibold text-[#24345A] hover:bg-[#F7FAFE]">
                Back to Deep Diagnostics
              </Link>
              <form action="/api/system/voice-integration/sarvam-control-campaign-diagnostic" method="post">
                <button type="submit" className="inline-flex min-h-8 items-center justify-center rounded-lg bg-[#102A56] px-3 text-[9.5px] font-semibold text-white hover:bg-[#0C2248]">
                  Run Fresh Campaign Probe
                </button>
              </form>
            </div>
          </div>

          {state === "config_error" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[10px] text-amber-900">
              Required Sarvam server configuration is incomplete. No provider request was sent.
            </div>
          ) : null}

          {state === "done" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {probes.map((probe) => (
                <div key={probe.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold text-[#24345A]">{probe.label}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[8.5px] font-semibold ${tone(probe.classification)}`}>
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
          ) : null}

          {state === "done" ? (
            <div className="mt-4 rounded-xl border border-[#D9E5F3] bg-[#F7FAFE] p-3.5 text-[10px] leading-5 text-[#475569]">
              <strong>Interpretation:</strong> if webhook listing remains HTTP 500 but stream validation returns HTTP 400/422, then X-API-Key, workspace routing, campaign lookup, and the CRM stream endpoint are all working; the defect is isolated to Sarvam&apos;s webhook-delivery listing path. If both return HTTP 500, the provider failure is broader inside scheduling. HTTP 401/403 on stream validation would put authorization back in scope.
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
