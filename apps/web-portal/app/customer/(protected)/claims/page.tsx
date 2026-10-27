import "./customer-claims-motion.css";
import Link from "next/link";
import { ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerClaimLogo } from "@/components/customer-portal/customer-claim-logo";
import { CustomerClaimClickableRow } from "./customer-claim-clickable-row";
import { CustomerClaimsSearch } from "./customer-claims-search";
import { INTERNAL_JOURNEY_STAGES, projectInternalClaim } from "@insureit/claim-journey";
import { CustomerAccountTabs, EmptyCustomerState } from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  buildExternalClaimProjection,
  isExternalCustomerClaim,
  isCompletedCustomerClaim,
  customerClaimFilter,
  loadCustomerClaimListContext,
} from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { account?: string; q?: string; filter?: string; page?: string };
const PAGE_SIZE = 15;

export default async function CustomerClaimsPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const { claims, milestones_by_claim } = await loadCustomerClaimListContext(account.id);
  // Query only the authorized customer record; missing mobile must not block the register.
  const db = await createServerSupabaseClient();
  const { data: customerContact } = await db.from("customers").select("id,phone").eq("id", account.id).maybeSingle();
  const customerName = account.customer_name || account.contact_name || "Account holder";
  const customerMobile = typeof customerContact?.phone === "string" ? customerContact.phone : null;
  const statusFilter = (["all", "open", "action", "completed"].includes(params.filter ?? "") ? params.filter : "all") as "all" | "open" | "action" | "completed";
  const query = (params.q ?? "").trim().toLowerCase();
  const enriched = claims.map((claim) => {
    const external = isExternalCustomerClaim(claim);
    const milestones = milestones_by_claim.get(claim.id) ?? [];
    const externalProjection = external ? buildExternalClaimProjection(milestones) : null;
    const internalProjection = external ? null : projectInternalClaim(claim.current_status);
    const stage = externalProjection?.current_stage.label || internalProjection?.stageLabel || claim.current_status;
    const completed = isCompletedCustomerClaim(claim, milestones);
    const currentStageKey = external
      ? externalProjection?.current_stage.key
      : INTERNAL_JOURNEY_STAGES[internalProjection?.stageIndex ?? 0]?.key;
    const targetStage = currentStageKey ?? INTERNAL_JOURNEY_STAGES[INTERNAL_JOURNEY_STAGES.length - 1].key;
    const stageHref = `/customer/claims/${encodeURIComponent(claim.id)}/stage/${targetStage}?account=${encodeURIComponent(account.id)}&mode=edit`;
    return { claim, external, stage, completed, stageHref };
  });
  const matchesStatus = (item: (typeof enriched)[number], filter: "all" | "open" | "action" | "completed") => {
    if (filter === "all") return true;
    if (filter === "completed") return item.completed;
    if (filter === "open") return !item.completed && item.claim.current_status !== "Rejected";
    return customerClaimFilter(item.claim, "action", {
      milestones: milestones_by_claim.get(item.claim.id) ?? [],
      internal_projection: item.external ? null : projectInternalClaim(item.claim.current_status),
    } as Parameters<typeof customerClaimFilter>[2]);
  };
  const filterOptions = ([["all", "All"], ["open", "Open"], ["action", "Action Required"], ["completed", "Completed"]] as const)
    .map(([key, label]) => ({ key, label, count: enriched.filter((item) => matchesStatus(item, key)).length }));
  const filtered = enriched.filter((item) => {
    const { claim, stage } = item;
    if (!matchesStatus(item, statusFilter)) return false;
    if (!query) return true;
    return [customerName, customerMobile, claim.vehicle_no, claim.claim_no, claim.insurer_claim_no, claim.policy_no, claim.insurer_name, claim.vehicle_make, claim.vehicle_model, stage]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, totalPages)) : 1;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (changes: Partial<Params>) => ({
    pathname: "/customer/claims",
    query: { account: account.id, ...(params.q ? { q: params.q } : {}), ...(statusFilter !== "all" ? { filter: statusFilter } : {}), ...changes },
  });
  return (
    <div className="customer-claims-motion space-y-4 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />

      <section className="claims-motion-hero relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#DDEEFF] text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)]">
        <div className="claims-motion-hero-photo pointer-events-none absolute inset-0 bg-[url('/assets/claim%20(2).jpeg')] bg-cover bg-center bg-no-repeat opacity-95" />
        <div className="claims-motion-hero-overlay pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF]/85 via-[#EEF7FF]/45 via-45% to-transparent" />
        <div className="relative flex min-h-[170px] items-center px-5 py-6 sm:px-7">
          <div className="max-w-[520px]">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E4E8FF]/90 text-[#6550D9] shadow-sm"><ShieldCheck className="h-7 w-7" aria-hidden="true"/></span><h1 className="text-[clamp(28px,3.2vw,40px)] font-bold tracking-tight text-[#242C89]">Claims</h1></div>
            <p className="mt-2 text-[12px] font-medium leading-5 text-[#5D6F8F] sm:text-[13px]">Track and manage your claims easily.<span className="block">Stay updated at every step.</span></p>
            <span className="mt-3 block h-1 w-14 rounded-full bg-gradient-to-r from-[#6953DC] to-[#B5B4F7]" aria-hidden="true"/>
          </div>
        </div>
      </section>

      <section className="claims-motion-panel overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white">
        <div className="claims-motion-toolbar flex flex-wrap items-center gap-2 border-b border-[#E6ECF4] p-4 xl:flex-nowrap">
          <h2 className="flex shrink-0 items-center gap-2 text-[17px] font-bold text-[#102B54]"><ClipboardList className="h-5 w-5 text-[#1769DC]"/>My Claims <span className="rounded-full bg-[#E7F0FD] px-2.5 py-1 text-[11px] text-[#205BA3]">{enriched.length} claims</span></h2>
          <CustomerClaimsSearch initialQuery={params.q ?? ""} accountId={account.id} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <nav aria-label="Claim status" className="claims-motion-filters flex flex-wrap items-center gap-1.5">
              {filterOptions.map(({ key, label, count }) => <Link key={key} href={href({filter:key,page:"1"})} aria-current={statusFilter === key ? "page" : undefined} className={`claims-motion-filter claims-motion-filter-${key} rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors ${statusFilter === key ? "border-[#071E45] bg-[#071E45] text-white" : "border-[#DCE4EE] bg-white text-[#344767] hover:bg-[#F0F6FF]"}`}>{label} ({count})</Link>)}
            </nav>
            <Link href={{ pathname: "/customer/start-claim", query: { account: account.id } }} className="claims-motion-new-claim inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#1769DC] px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-[#1058BD]"><Plus className="h-4 w-4"/>Start a new claim</Link>
          </div>
        </div>

        {rows.length ? (
          <div key={statusFilter + ":" + query + ":" + page} className="claims-motion-results w-full overflow-x-auto">
            <table className="claims-motion-table w-full min-w-[1280px] border-collapse text-center text-[12px] text-[#263F67]">
              <thead className="bg-[#073A7D] text-[12px] font-semibold text-white">
                <tr>
                  <th scope="col" className="border-r border-white/15 px-3 py-3 text-left">Customer / Mobile</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Vehicle No.</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Vehicle</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Loss Date</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Insurer</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Policy</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Control No.</th>
                  <th scope="col" className="border-r border-white/15 px-3 py-3">Claim No.</th>
                  <th scope="col" className="px-3 py-3">Process</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ claim, stage, stageHref }) => {
                  const detailHref = stageHref;
                  const lossDate = claim.accident_at ? new Date(claim.accident_at) : null;
                  return <CustomerClaimClickableRow key={claim.id} href={stageHref} label={`Open claim ${claim.claim_no || claim.vehicle_no || ""}`}>
                    <td className="border-r border-[#E1E9F4] px-3 py-3 text-left">
                      <Link href={detailHref} aria-label={`Open claim ${claim.claim_no || claim.vehicle_no || ""}`} className="block rounded outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1769DC]">
                        <span className="block font-medium">{customerName}</span>
                        <span className="block text-[11px] text-[#627691]">{customerMobile || "—"}</span>
                      </Link>
                    </td>
                    <td className="border-r border-[#E1E9F4] px-3 py-3 font-medium">{claim.vehicle_no || "—"}</td>
                    <td className="border-r border-[#E1E9F4] px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <CustomerClaimLogo value={claim.vehicle_make} size={34}/>
                        <span className="text-left">{claim.vehicle_model || "—"}</span>
                      </div>
                    </td>
                    <td className="border-r border-[#E1E9F4] px-3 py-3">{lossDate && !Number.isNaN(lossDate.getTime()) ? lossDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
                    <td className="border-r border-[#E1E9F4] px-3 py-3"><div className="flex justify-center" title={claim.insurer_name || "Insurer not assigned"}><CustomerClaimLogo value={claim.insurer_name} kind="insurer" size={36}/></div></td>
                    <td className="max-w-[180px] break-words border-r border-[#E1E9F4] px-3 py-3">{claim.policy_no || "—"}</td>
                    <td className="max-w-[210px] break-words border-r border-[#E1E9F4] px-3 py-3 font-medium">{claim.claim_no || "—"}</td>
                    <td className="border-r border-[#E1E9F4] px-3 py-3">{claim.insurer_claim_no || "Pending insurer claim number"}</td>
                    <td className="px-3 py-3 text-left"><span className="block font-medium">{stage || "—"}</span></td>
                  </CustomerClaimClickableRow>;
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="py-8"><EmptyCustomerState title="No matching claims" body="Try another search or status filter." /></div>}

        <div className="claims-motion-pagination flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E9F3] px-5 py-4 text-[12px] text-[#536681]">
          <span>Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-3">
            {page > 1 ? <Link href={href({ page: String(page - 1) })} className="rounded-lg border px-3 py-2">Previous</Link> : <span className="rounded-lg border px-3 py-2 opacity-40">Previous</span>}
            <span>{page} / {totalPages}</span>
            {page < totalPages ? <Link href={href({ page: String(page + 1) })} className="rounded-lg border px-3 py-2">Next</Link> : <span className="rounded-lg border px-3 py-2 opacity-40">Next</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
