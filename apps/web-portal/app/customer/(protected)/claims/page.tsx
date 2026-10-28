import "./customer-claims-motion.css";
import Link from "next/link";
import { ClipboardList, Plus, ShieldCheck, CircleCheck, ArrowRight, FileText } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { CustomerClaimLogo } from "@/components/customer-portal/customer-claim-logo";
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
        <div className="claims-motion-toolbar flex flex-col gap-3 border-b border-[#E6ECF4] p-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3"><h2 className="flex shrink-0 items-center gap-2 text-[17px] font-bold text-[#102B54]"><ClipboardList className="h-5 w-5 text-[#1769DC]"/>My Claims <span className="rounded-full bg-[#E7F0FD] px-2.5 py-1 text-[11px] text-[#205BA3]">{enriched.length} claims</span></h2>
          <Link href={{ pathname: "/customer/start-claim", query: { account: account.id } }} className="claims-motion-new-claim inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#1769DC] px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-[#1058BD]"><Plus className="h-4 w-4"/>Start a New Claim</Link></div>
          <div className="flex w-full flex-wrap items-center justify-between gap-3"><CustomerClaimsSearch initialQuery={params.q ?? ""} accountId={account.id} />
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Claim status" className="claims-motion-filters flex flex-wrap items-center gap-1.5">
              {filterOptions.map(({ key, label, count }) => <Link key={key} href={href({filter:key,page:"1"})} aria-current={statusFilter === key ? "page" : undefined} className={`claims-motion-filter claims-motion-filter-${key} rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors ${statusFilter === key ? "border-[#071E45] bg-[#071E45] text-white" : "border-[#DCE4EE] bg-white text-[#344767] hover:bg-[#F0F6FF]"}`}>{label} ({count})</Link>)}
            </nav>

          </div></div>
        </div>

        {rows.length ? (
          <div key={statusFilter + ":" + query + ":" + page} className="claims-motion-results bg-[#F4F2FF]/60 px-4 py-7 sm:px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ claim, stage, stageHref, completed, external }) => {
                const detailHref = `/customer/claims/${encodeURIComponent(claim.id)}?account=${encodeURIComponent(account.id)}`;
                const lossDate = claim.accident_at ? new Date(claim.accident_at) : null;
                const stageIndex = INTERNAL_JOURNEY_STAGES.findIndex((item) => item.label.toLowerCase() === stage.toLowerCase());
                const progress = completed ? INTERNAL_JOURNEY_STAGES.length : Math.max(1, stageIndex + 1);
                return (
                  <article key={claim.id} className="group relative flex min-w-0 flex-col rounded-[28px] border border-[#E3E3F5] bg-white p-4 pt-8 shadow-[0_12px_28px_rgba(31,48,89,.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(31,48,89,.12)]">
                    <span className="absolute left-1/2 top-0 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[7px] border-[#E9E7FF] bg-[#F4F2FF] text-[#5544C7] shadow-sm" aria-hidden="true">
                      {completed ? <CircleCheck className="h-5 w-5"/> : <span className="text-sm font-bold">{progress}</span>}
                    </span>
                    <div className="flex flex-1 flex-col rounded-[22px] bg-[#F5F5FA] px-4 py-5 text-center">
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <CustomerClaimLogo value={claim.vehicle_make} size={34}/>
                        <span className="min-w-0 truncate text-[13px] font-bold text-[#132451]">{claim.vehicle_no || "Vehicle not recorded"}</span>
                      </div>
                      <h3 className="line-clamp-2 min-h-9 text-[13px] font-semibold text-[#142650]">{claim.vehicle_model || claim.vehicle_make || "Vehicle claim"}</h3>
                      <p className="mt-1 text-[12px] font-medium text-[#62718F]">Control No. {claim.claim_no || "—"}</p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <CustomerClaimLogo value={claim.insurer_name} kind="insurer" size={30}/>
                        <span className="line-clamp-2 text-left text-[11px] text-[#536687]">{claim.insurer_name || "Insurer not recorded"}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-[#62718F]">Insurer Claim No. <span className="font-semibold">{claim.insurer_claim_no || "Pending insurer claim number"}</span></p>
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white/90 p-3 text-left text-[11px]">
                        <div><span className="block text-[#7A86A3]">Loss Date</span><span className="font-semibold text-[#233657]">{lossDate && !Number.isNaN(lossDate.getTime()) ? lossDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</span></div>
                        <div><span className="block text-[#7A86A3]">Policy No.</span><span className="break-all font-semibold text-[#233657]">{claim.policy_no || "—"}</span></div>
                      </div>
                      <div className="mt-4">
                        <p className="text-[11px] text-[#6A7896]">Current stage</p>
                        <p className="mt-1 text-[13px] font-bold text-[#142B61]">{completed ? "Claim Complete" : stage}</p>
                        {external ? <p className="mt-1 text-[11px] text-[#6A7896]">{progress} of {INTERNAL_JOURNEY_STAGES.length} stages</p> : null}
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E2E2F2]"><div className="h-full rounded-full bg-[#4D57CF]" style={{width:`${Math.round(progress / INTERNAL_JOURNEY_STAGES.length * 100)}%`}}/></div>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <Link href={detailHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[#C7D7EF] bg-white px-3 py-2 text-[11px] font-semibold text-[#174B86] hover:bg-[#ECF4FF]"><FileText className="h-3.5 w-3.5"/>View Details</Link>
                        {!completed ? <Link href={stageHref} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769DC] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#1058BD]">Continue <ArrowRight className="h-3.5 w-3.5"/></Link> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
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
