import "./customer-claims-motion.css";
import Link from "next/link";
import { ClipboardList, Plus, ShieldCheck, CalendarDays } from "lucide-react";
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
              {rows.map(({ claim, stage, stageHref, completed }) => {
                const lossDate = claim.accident_at ? new Date(claim.accident_at) : null;
                const stageIndex = INTERNAL_JOURNEY_STAGES.findIndex((item) => item.label.toLowerCase() === stage.toLowerCase());
                const progress = completed ? INTERNAL_JOURNEY_STAGES.length : Math.max(1, stageIndex + 1);
                return (
                  <Link key={claim.id} href={stageHref} aria-label={`Open claim ${claim.claim_no || claim.vehicle_no || "details"} journey`} className="group flex min-w-0 flex-col rounded-[22px] border border-[#E3E8F1] bg-white p-5 shadow-[0_8px_24px_rgba(31,48,89,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(31,48,89,.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1769DC]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F1F5FF]"><CustomerClaimLogo value={claim.vehicle_make} size={38}/></span>
                        <div className="min-w-0 pt-1">
                          <h3 className="truncate text-[15px] font-bold text-[#142B51]">{claim.vehicle_no || "Vehicle not recorded"}</h3>
                          <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[#647590]">{claim.vehicle_model || claim.vehicle_make || "Vehicle claim"}</p>
                        </div>
                      </div>
                      <span className="max-w-[40%] shrink-0 truncate rounded-full border border-[#E0EAF8] bg-[#F5F8FF] px-3 py-1.5 text-[11px] font-semibold text-[#31649F]" title={claim.claim_no || "Control number not recorded"}>{claim.claim_no || "—"}</span>
                    </div>
                    <div className="mt-4 border-t border-[#E8EDF4] pt-4">
                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="flex min-w-0 items-start gap-2">
                          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#2768B4]" aria-hidden="true"/>
                          <div><p className="text-[11px] text-[#71809A]">Loss Date</p><p className="mt-1 text-[12px] font-semibold text-[#243A60]">{lossDate && !Number.isNaN(lossDate.getTime()) ? lossDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</p></div>
                        </div>
                        <div className="flex min-w-0 items-start gap-2 border-l border-[#E9EDF5] pl-3">
                          <span className="shrink-0"><CustomerClaimLogo value={claim.insurer_name} kind="insurer" size={24}/></span>
                          <div className="min-w-0"><p className="text-[11px] text-[#71809A]">Policy No.</p><p className="mt-1 break-all text-[12px] font-semibold text-[#243A60]">{claim.policy_no || "—"}</p></div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-[11px] text-[#62718F]">Insurer Claim No. <span className="font-semibold">{claim.insurer_claim_no || "Pending insurer claim number"}</span></p>
                    <div className="mt-auto pt-5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#E4E9F3]"><div className="h-full rounded-full bg-[#1769DC]" style={{width:`${Math.round(progress / INTERNAL_JOURNEY_STAGES.length * 100)}%`}}/></div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-[#244673]"><span className="h-2 w-2 shrink-0 rounded-full bg-[#1769DC]"/><span className="truncate">{completed ? "Claim Complete" : stage}</span></span>
                        <span className="shrink-0 text-[#6D7D99]">{progress}/{INTERNAL_JOURNEY_STAGES.length}</span>
                      </div>
                    </div>
                  </Link>
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
