import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil, Power, ShieldCheck } from "lucide-react";
import { setInsuranceCompanyActive } from "@/app/insurance-companies/actions";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type InsuranceCompany = {
  id: string;
  name: string;
  segment: "general" | "health" | "life" | null;
  sibpl_code: string | null;
  portal_url: string | null;
  portal_status: "configured" | "pending" | "not_provided";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AliasRow = { id: string; alias: string; source: string; is_active: boolean };

const segmentLabel: Record<string, string> = { general: "General Insurance", health: "Health Insurance", life: "Life Insurance" };
const successMessages: Record<string, string> = {
  created: "Insurance company added to the master.",
  updated: "Insurance company details updated.",
  activated: "Insurance company activated for new business.",
  deactivated: "Insurance company deactivated. Historical references are preserved.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InsuranceCompanyReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> }) {
  await requireMasterDataManager();
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();

  const [companyResult, aliasesResult, policiesResult, claimsResult, surveyorsResult] = await Promise.all([
    admin.from("insurance_companies").select("id,name,segment,sibpl_code,portal_url,portal_status,is_active,created_at,updated_at").eq("id", id).maybeSingle<InsuranceCompany>(),
    admin.from("insurance_company_aliases").select("id,alias,source,is_active").eq("insurance_company_id", id).order("alias").returns<AliasRow[]>(),
    admin.from("policies").select("id", { count: "exact", head: true }).eq("insurance_company_id", id),
    admin.from("claims").select("id", { count: "exact", head: true }).eq("insurance_company_id", id),
    admin.from("surveyors").select("id", { count: "exact", head: true }).eq("insurance_company_id", id),
  ]);

  if (companyResult.error) throw new Error(`Unable to load insurance company: ${companyResult.error.message}`);
  if (!companyResult.data) notFound();
  const company = companyResult.data;
  const aliases = aliasesResult.data ?? [];
  const successMessage = query.success ? successMessages[query.success] : null;

  return (
    <AppShell title="Insurance Company Review" backHref="/insurance-companies">
      <PageHeader
        title={company.name}
        description={`${company.segment ? segmentLabel[company.segment] : "Legacy / unclassified"} · SIBPL code ${company.sibpl_code || "not assigned"}`}
        action={<div className="flex flex-wrap gap-2"><Link href={`/insurance-companies/${id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-bold text-[#17365D] hover:bg-[#F8FAFC]"><Pencil className="h-3.5 w-3.5" />Edit</Link>{company.portal_status === "configured" && company.portal_url ? <a href={company.portal_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#17365D] px-4 text-[10px] font-bold text-white hover:bg-[#102A4C]">Open portal <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div>}
      />

      {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-medium text-emerald-700">{successMessage}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-4 border-b border-[#E7ECF3] pb-4">
              <div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#52749E]">Master profile</p><h2 className="mt-1 text-[15px] font-bold text-[#17203A]">Company overview</h2></div>
              <span className={`rounded-full px-3 py-1.5 text-[9px] font-bold ${company.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{company.is_active ? "Active" : "Inactive"}</span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Registered company name" value={company.name} />
              <Detail label="Insurance segment" value={company.segment ? segmentLabel[company.segment] : "Legacy / unclassified"} />
              <Detail label="SIBPL code" value={company.sibpl_code || "Not assigned"} />
              <Detail label="Portal status" value={company.portal_status === "configured" ? "Configured" : company.portal_status === "pending" ? "Pending" : "Not provided"} />
              <Detail label="Created" value={new Date(company.created_at).toLocaleString("en-IN")} />
              <Detail label="Last updated" value={new Date(company.updated_at).toLocaleString("en-IN")} />
            </dl>
          </Card>

          <Card>
            <div className="border-b border-[#E7ECF3] pb-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#52749E]">Name matching</p><h2 className="mt-1 text-[15px] font-bold text-[#17203A]">Recognized aliases</h2><p className="mt-1 text-[10px] leading-4 text-[#667085]">Former names, source-master labels and OCR wording resolve to this canonical insurer.</p></div>
            <div className="mt-4 divide-y divide-[#EDF1F6] rounded-xl border border-[#E1E7EF]">
              {aliases.map((alias) => <div key={alias.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-[10.5px] font-semibold text-[#17203A]">{alias.alias}</p><p className="mt-0.5 text-[8px] font-bold uppercase tracking-[.06em] text-[#98A2B3]">{alias.source.replaceAll("_", " ")}</p></div><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${alias.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{alias.is_active ? "Recognized" : "Inactive"}</span></div>)}
              {!aliases.length ? <div className="px-4 py-8 text-center text-[10px] text-[#7B8799]">No aliases are configured for this insurer yet.</div> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#52749E]">Usage</p>
            <div className="mt-3 space-y-2"><Metric label="Policies" value={policiesResult.count ?? 0} /><Metric label="Claims" value={claimsResult.count ?? 0} /><Metric label="Surveyors" value={surveyorsResult.count ?? 0} /></div>
            <p className="mt-3 text-[8.5px] leading-4 text-[#7B8799]">These references remain intact even if the insurer is deactivated.</p>
          </Card>

          <Card>
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FB] text-[#315B9A]"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-[11px] font-bold text-[#17203A]">Master status</p><p className="mt-1 text-[9px] leading-4 text-[#667085]">Use deactivation instead of deletion so historical policies and claims remain valid.</p></div></div>
            <form action={setInsuranceCompanyActive.bind(null, id, !company.is_active)} className="mt-4">
              <button type="submit" className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold ${company.is_active ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}><Power className="h-3.5 w-3.5" />{company.is_active ? "Deactivate insurer" : "Activate insurer"}</button>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#E1E7EF] bg-[#F8FAFD] px-3.5 py-3"><dt className="text-[8px] font-bold uppercase tracking-[.07em] text-[#7B8799]">{label}</dt><dd className="mt-1.5 break-words text-[10.5px] font-semibold leading-4 text-[#17203A]">{value}</dd></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between rounded-xl border border-[#E1E7EF] bg-[#F8FAFD] px-3.5 py-3"><span className="text-[9.5px] font-semibold text-[#52647D]">{label}</span><span className="text-[16px] font-bold text-[#17365D]">{value}</span></div>;
}
