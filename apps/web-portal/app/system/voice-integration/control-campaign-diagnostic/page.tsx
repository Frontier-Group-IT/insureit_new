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

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function prettify(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function SarvamControlCampaignDiagnosticPage({ searchParams }: Props) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    redirect("/access-denied");
  }

  const query = await searchParams;
  const state = queryValue(query.control_diag);
  const status = queryValue(query.status) ?? null;
  const classification = queryValue(query.class) ?? null;
  const errorCode = queryValue(query.code) ?? null;
  const requestId = queryValue(query.request) ?? null;

  return (
    <AppShell title="Sarvam Control Campaign Diagnostic">
      <div className="mx-auto max-w-[900px] space-y-4 pb-8">
        <PageHeader title="Sarvam Fresh Campaign Control Probe" />
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#17203A]">Read-only fresh campaign comparison</h2>
              <p className="mt-1 max-w-2xl text-[10.5px] leading-5 text-[#64748B]">
                Tests only the new paused control campaign with X-API-Key. It performs a GET on the campaign webhook-list endpoint and cannot place calls, stream contacts, resume campaigns, or modify provider state.
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
            <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-[#24345A]">Fresh control campaign</p>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[8.5px] font-semibold text-amber-800">
                  {status && status !== "none" ? `HTTP ${status}` : "No HTTP response"}
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-[9.5px]">
                <div><dt className="text-[#94A3B8]">Classification</dt><dd className="mt-0.5 font-semibold text-[#475569]">{prettify(classification)}</dd></div>
                <div><dt className="text-[#94A3B8]">Provider error code</dt><dd className="mt-0.5 break-all font-mono text-[#475569]">{errorCode ?? "—"}</dd></div>
                <div><dt className="text-[#94A3B8]">Provider request ID</dt><dd className="mt-0.5 break-all font-mono text-[#475569]">{requestId ?? "—"}</dd></div>
              </dl>
              <p className="mt-4 text-[10px] leading-5 text-[#64748B]">
                Interpretation: HTTP 2xx strongly supports corruption or legacy backend state in the original campaign; HTTP 500 here means the failure is broader than the original campaign; HTTP 404 means the new campaign ID is not visible in this org/workspace binding yet.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
