import Link from "next/link";
import { LifeHealthLineFilter } from "@/components/life-health-line-filter";
import { AppShell } from "@/components/shell";
import { LifeHealthSuperUserDeletePanel } from "@/components/life-health-superuser-delete-panel";
import { LifeHealthCaseRegister, type LifeHealthCaseRegisterRow } from "@/components/life-health-case-register";
import { loadLifeHealthCaseSummary } from "@/lib/life-health-case-summary";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requireCapability } from "@/lib/master-data-server";
import { getLifeTeamSalesWriteOwnerIds, usesLifeTeamPortfolio, getLifeTeamPortfolioReadFilter, getOperationsHeadDownlinePolicyScope, operationsHeadVisiblePolicyFilter } from "@/lib/policy-access-scope";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CaseRow = { id: string; rm_employee_id: string | null; case_number: string; business_line: string; status: string; sourcing_date: string; product_name: string; proposal_number: string; premium_amount: number; customer_id: string; insurance_company_id: string; rm_name: string | null; lead_source: string | null; remarks: string | null; final_policy_id: string | null; created_at: string };
type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string };
type InsurerRow = { id: string; name: string };
type CaseFilter = "pending" | "rejected" | "issued" | "all";
type BusinessLineFilter = "all" | "life" | "health";

export default async function LifeHealthCasesPage({ searchParams }: { searchParams?: Promise<{ status?: string; line?: string }> }) {
  const profile = await requireCapability("view_policies");
  const sharedViewer = usesLifeTeamPortfolio(profile.id,profile.role);
  if (profile.role !== "operations_head_life" && !sharedViewer) await requirePolicyCreator();
  const mayCreate = !sharedViewer || profile.role === "operations_head_life" || await hasEffectiveCapability(profile,"create_policies","edit") || await hasEffectiveCapability(profile,"view_policies","edit");
  const portfolioFilter = await getLifeTeamPortfolioReadFilter(profile.id, profile.role);
  const downlineCaseFilter = portfolioFilter ?? (profile.role === "operations_head_life"
    ? operationsHeadVisiblePolicyFilter(await getOperationsHeadDownlinePolicyScope(profile.id))
    : null);
  const params = searchParams ? await searchParams : undefined;
  const filter: CaseFilter = params?.status === "issued" || params?.status === "rejected" || params?.status === "all" ? params.status : "pending";
  const lineFilter: BusinessLineFilter = params?.line === "life" || params?.line === "health" ? params.line : "all";
  const admin = createSupabaseAdminClient();
  const [{ data: rows, error }, caseSummary] = await Promise.all([
    fetchAllPages<CaseRow, unknown>((from, to) => {
      let query = admin.from("life_health_cases").select("id,rm_employee_id,case_number,business_line,status,sourcing_date,product_name,proposal_number,premium_amount,customer_id,insurance_company_id,rm_name,lead_source,remarks,final_policy_id,created_at")
        .order("created_at", { ascending: false }).order("id").range(from, to);
      if (downlineCaseFilter !== null) query = query.or(downlineCaseFilter || "id.eq.00000000-0000-0000-0000-000000000000");
      return query.returns<CaseRow[]>();
    }),
    loadLifeHealthCaseSummary(admin, downlineCaseFilter),
  ]);
  if (error) return <AppShell title="Life / Health Cases"><div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-[10px] text-red-700">Life / Health cases could not be loaded.</div></AppShell>;
  const allRows = rows ?? [];
  const lineRows = lineFilter === "all" ? allRows : allRows.filter((row) => row.business_line.trim().toLowerCase() === lineFilter);
  const pendingCount = lineFilter === "all" && caseSummary ? caseSummary.pending : lineRows.filter((row) => !row.final_policy_id && row.status !== "rejected").length;
  const rejectedCount = lineFilter === "all" && caseSummary ? caseSummary.rejected : lineRows.filter((row) => row.status === "rejected" && !row.final_policy_id).length;
  const issuedCount = lineFilter === "all" && caseSummary ? caseSummary.issued : lineRows.filter((row) => Boolean(row.final_policy_id)).length;
  const allCount = lineFilter === "all" && caseSummary ? caseSummary.all : lineRows.length;
  const customerIds = Array.from(new Set(allRows.map((row) => row.customer_id)));
  const insurerIds = Array.from(new Set(allRows.map((row) => row.insurance_company_id)));
  const [customersResult, insurersResult] = await Promise.all([
    customerIds.length ? admin.from("customers").select("id,contact_name,company_name,phone").in("id", customerIds).returns<CustomerRow[]>() : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    insurerIds.length ? admin.from("insurance_companies").select("id,name").in("id", insurerIds).returns<InsurerRow[]>() : Promise.resolve({ data: [] as InsurerRow[], error: null }),
  ]);
  const customerMap = new Map((customersResult.data ?? []).map((item) => [item.id, item]));
  const insurerMap = new Map((insurersResult.data ?? []).map((item) => [item.id, item.name]));
  const filters: Array<{ key: CaseFilter; label: string; count: number }> = [
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "rejected", label: "Rejected", count: rejectedCount },
    { key: "issued", label: "Issued", count: issuedCount },
    { key: "all", label: "All", count: allCount },
  ];
  const salesWriteIds = await getLifeTeamSalesWriteOwnerIds(profile.id,profile.role);
  const registerRows: LifeHealthCaseRegisterRow[] = lineRows.map((row) => {
    const customer = customerMap.get(row.customer_id);
    return {
      id: row.id,
      readOnly: salesWriteIds !== null && (!mayCreate || !row.rm_employee_id || !salesWriteIds.includes(row.rm_employee_id)),
      caseNumber: row.case_number,
      businessLine: row.business_line,
      customerName: customer?.company_name?.trim() || customer?.contact_name || "Customer",
      customerPhone: customer?.phone || "",
      insurerName: insurerMap.get(row.insurance_company_id) || "Insurer",
      productName: row.product_name,
      proposalNumber: row.proposal_number,
      sourcingDate: row.sourcing_date,
      rmName: row.rm_name || "",
      leadSource: row.lead_source || "",
      remarks: row.remarks || "",
      premiumAmount: Number(row.premium_amount || 0),
      finalPolicyId: row.final_policy_id,
      status: row.status,
    };
  });
  return <AppShell title="Life / Health Cases"><div className="mx-auto max-w-[1480px] space-y-4 pb-8">
    {profile.role === "it_super_user" ? <LifeHealthSuperUserDeletePanel records={allRows.map((row) => { const customer = customerMap.get(row.customer_id); return { id: row.id, label: row.case_number, detail: [row.business_line, customer?.company_name?.trim() || customer?.contact_name, insurerMap.get(row.insurance_company_id), row.proposal_number].filter(Boolean).join(" • "), issued: Boolean(row.final_policy_id) }; })} /> : null}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9E2F0] bg-white px-4 py-3 shadow-sm"><div><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Case register</p><h1 className="mt-1 text-[15px] font-semibold text-[#17365D]">Life & Health Cases</h1></div><div className="flex flex-wrap items-center gap-2"><LifeHealthLineFilter line={lineFilter} status={filter} /><div className="flex items-center rounded-xl border border-[#D9E2F0] bg-[#F8FAFC] p-1">{filters.map((item) => <Link key={item.key} href={`/policies/life-health-cases?${new URLSearchParams({ ...(item.key === "pending" ? {} : { status: item.key }), ...(lineFilter === "all" ? {} : { line: lineFilter }) }).toString()}`} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] font-bold transition-colors ${filter === item.key ? "bg-[#17365D] text-white shadow-sm" : "text-[#64748B] hover:bg-white hover:text-[#17365D]"}`}><span>{item.label}</span><span className={`tabular-nums ${filter === item.key ? "text-white/80" : "text-[#98A2B3]"}`}>{item.count}</span></Link>)}</div>{mayCreate?<Link href="/policies/new" className="rounded-xl bg-[#17365D] px-4 py-2.5 text-[10px] font-bold text-white">Add Policy / Case</Link>:null}</div></div><LifeHealthCaseRegister rows={registerRows} statusFilter={filter} emptyLabel={`No ${lineFilter === "all" ? "Life / Health" : lineFilter === "life" ? "Life" : "Health"} ${filter === "all" ? "" : filter} cases found.`} /></div></AppShell>;
}
