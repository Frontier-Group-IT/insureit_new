import Link from "next/link";
import { FileText, ClipboardList, ShieldCheck, Clock3, ArrowRight, Plus, CheckCircle2, CircleDot } from "lucide-react";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";
import { ManufacturerMark } from "../vehicles/customer-vehicles-register";
import { CustomerClaimsSearch, CustomerClaimsStageFilter } from "./customer-claims-search";
import { INTERNAL_JOURNEY_STAGES, projectInternalClaim } from "@insureit/claim-journey";
import { CustomerAccountTabs, EmptyCustomerState } from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  buildExternalClaimProjection,
  isExternalCustomerClaim,
  isCompletedCustomerClaim,
  loadCustomerClaimListContext,
} from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { account?: string; q?: string; type?: string; stage?: string; page?: string };
const PAGE_SIZE = 15;

export default async function CustomerClaimsPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const { claims, milestones_by_claim } = await loadCustomerClaimListContext(account.id);
  const type = params.type === "external" ? "external" : "internal";
  const query = (params.q ?? "").trim().toLowerCase();
  const stageFilter = params.stage ?? "";
  const enriched = claims.map((claim) => {
    const external = isExternalCustomerClaim(claim);
    const milestones = milestones_by_claim.get(claim.id) ?? [];
    const externalProjection = external ? buildExternalClaimProjection(milestones) : null;
    const internalProjection = external ? null : projectInternalClaim(claim.current_status);
    const stage = externalProjection?.current_stage.label || internalProjection?.stageLabel || claim.current_status;
    const progress = externalProjection?.progress ?? internalProjection?.progress ?? 0;
    const completed = isCompletedCustomerClaim(claim, milestones);
    const nextAction = completed
      ? "Claim journey completed"
      : externalProjection
        ? `Next: ${externalProjection.current_stage.label}`
        : internalProjection?.customerMessage || `Next: ${stage}`;
    return { claim, external, stage, progress, completed, nextAction };
  });
  const internalCount = enriched.filter((item) => !item.external).length;
  const externalCount = enriched.length - internalCount;
  const completedCount = enriched.filter((item) => item.completed).length;
  const openCount = enriched.filter((item) => !item.completed && item.claim.current_status !== "Rejected").length;
  const stages = INTERNAL_JOURNEY_STAGES.map((stage) => stage.label);
  const filtered = enriched.filter(({ claim, external, stage }) => {
    if (external !== (type === "external")) return false;
    if (stageFilter && stage !== stageFilter) return false;
    if (!query) return true;
    return [claim.vehicle_no, claim.claim_no, claim.insurer_claim_no, claim.policy_no, claim.insurer_name, claim.vehicle_make, claim.vehicle_model, stage]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, totalPages)) : 1;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (changes: Partial<Params>) => ({
    pathname: "/customer/claims",
    query: { account: account.id, type, ...(params.q ? { q: params.q } : {}), ...(stageFilter ? { stage: stageFilter } : {}), ...changes },
  });
  const journeyLabels = ["Submitted", "Survey", "Documents", "Assessment", "Settlement"];
  return (
    <div className="space-y-4 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />

      <section className="relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#DDEEFF] text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)]">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-contain bg-right-bottom bg-no-repeat opacity-55" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF] via-[#EEF7FF]/96 via-47% to-transparent" />
        <div className="relative flex min-h-[170px] items-center px-5 py-6 sm:px-7">
          <div className="max-w-[520px]">
            <h1 className="text-[clamp(28px,3.2vw,40px)] font-bold tracking-tight">Claims</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4B6C94]">Track your claims and see what happens next.</p>
          </div>
        </div>
      </section>

      <section aria-label="Claim overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {label:"Total claims",value:claims.length,detail:"Across your account",icon:ClipboardList,tint:"bg-[#EAF3FF] text-[#1769DC]"},
          {label:"Open",value:openCount,detail:"Still in progress",icon:Clock3,tint:"bg-[#FFF7E8] text-[#B66A16]"},
          {label:"Settled / completed",value:completedCount,detail:"Journey completed",icon:ShieldCheck,tint:"bg-[#E5F7EE] text-[#087A57]"},
        ].map(({label,value,detail,icon:Icon,tint})=><div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E1EAF5] bg-white p-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5"/></span>
          <span className="min-w-0"><span className="block text-[12px] font-medium text-[#60799B]">{label}</span><strong className="block text-[28px] font-bold leading-tight tabular-nums text-[#102B54]">{value}</strong><small className="block text-[12px] text-[#7890AD]">{detail}</small></span>
        </div>)}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Link href={{ pathname: "/customer/start-claim", query: { account: account.id } }} className="inline-flex items-center gap-2 rounded-xl bg-[#1769DC] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1058BD]"><Plus className="h-4 w-4"/>Start a new claim</Link>
        <Link href={{ pathname: "/customer/claims", query: { account: account.id, type } }} className="inline-flex items-center gap-2 rounded-xl border border-[#BFD3EC] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1769DC] hover:bg-[#F7FBFF]">Track existing claims <ArrowRight className="h-4 w-4"/></Link>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E6ECF4] p-4 xl:flex-nowrap">
          <h2 className="flex shrink-0 items-center gap-2 text-[17px] font-bold text-[#102B54]"><ClipboardList className="h-5 w-5 text-[#1769DC]"/>Claims Register</h2>
          <CustomerClaimsSearch initialQuery={params.q ?? ""} accountId={account.id} type={type} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <CustomerClaimsStageFilter value={stageFilter} stages={stages} accountId={account.id} type={type} query={params.q ?? ""} />
            <div className="flex rounded-lg border border-[#DCE4EE] bg-[#F8FAFD] p-0.5 text-[12px] font-semibold">
              {(["internal", "external"] as const).map(key => <Link key={key} href={href({type:key,stage:"",page:"1"})} className={`rounded-md px-3 py-2 ${type === key ? "bg-[#E7F0FD] text-[#124788]" : "text-[#64748B]"}`}>
                {key === "internal" ? "Internal" : "External"} <span className="ml-1 rounded-full bg-[#D9E8FA] px-1.5 py-0.5">{key === "internal" ? internalCount : externalCount}</span>
              </Link>)}
            </div>
          </div>
        </div>

        {rows.length ? <div className="space-y-3 p-4">
          {rows.map(({ claim, stage, progress, completed, nextAction }) => {
            const logo = getStaticInsurerLogo(claim.insurer_name);
            const activeStep = Math.min(journeyLabels.length - 1, Math.floor((Math.max(0, Math.min(100, progress)) / 100) * journeyLabels.length));
            return <article key={claim.id} className="rounded-2xl border border-[#E2EAF4] bg-white p-4 transition hover:border-[#B8D0EE]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="flex min-w-0 items-center gap-3 xl:w-[24%]">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F1F6FC]"><ManufacturerMark make={claim.vehicle_make || ""}/></span>
                  <div className="min-w-0"><span className="block text-[11px] uppercase tracking-wide text-[#8496AE]">Vehicle</span><strong className="block truncate text-[14px] text-[#15375F]">{claim.vehicle_no || "—"}</strong><span className="block truncate text-[12px] text-[#607B9F]">{[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" ") || "—"}</span></div>
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div><span className="block text-[11px] uppercase tracking-wide text-[#8496AE]">Claim number</span><strong className="block text-[13px] text-[#263F67]">{claim.insurer_claim_no || claim.claim_no || "—"}</strong></div>
                  <div><span className="block text-[11px] uppercase tracking-wide text-[#8496AE]">Insurer</span><div className="mt-1 flex items-center gap-2">{logo?<img src={logo} alt={claim.insurer_name || "Insurer"} className="h-7 w-7 object-contain"/>:<FileText className="h-5 w-5 text-[#607B9F]"/>}<span className="text-[13px] font-semibold text-[#263F67]">{claim.insurer_name || "—"}</span></div></div>
                  <div><span className="block text-[11px] uppercase tracking-wide text-[#8496AE]">Current stage</span><strong className="block text-[13px] text-[#263F67]">{stage || "—"}</strong><span className="mt-1 inline-flex rounded-full bg-[#F1F6FC] px-2 py-1 text-[11px] font-semibold text-[#315B89]">{claim.current_status || "—"}</span></div>
                </div>
                <Link href={{pathname:`/customer/claims/${claim.id}`,query:{account:account.id}}} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#EAF3FF] px-3 py-2 text-[12px] font-semibold text-[#1769DC] hover:bg-[#DCEBFF]">View claim <ArrowRight className="h-3.5 w-3.5"/></Link>
              </div>

              <div className="mt-4 border-t border-[#EDF2F7] pt-4">
                <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-[#385778]">Claim journey</span><span className="text-[12px] text-[#607B9F]">{completed ? "Completed" : nextAction}</span></div>
                <div className="grid grid-cols-5 gap-1.5">
                  {journeyLabels.map((label,index)=>{
                    const reached = completed || index <= activeStep;
                    return <div key={label} className="min-w-0">
                      <div className={`h-1.5 rounded-full ${reached?"bg-[#1769DC]":"bg-[#DCE7F4]"}`}/>
                      <div className="mt-1 flex items-center gap-1"><span className={`shrink-0 ${reached?"text-[#1769DC]":"text-[#A5B4C7]"}`}>{reached?<CheckCircle2 className="h-3.5 w-3.5"/>:<CircleDot className="h-3.5 w-3.5"/>}</span><span className="truncate text-[10px] font-medium text-[#6B7F98]">{label}</span></div>
                    </div>;
                  })}
                </div>
              </div>
            </article>;
          })}
        </div>:<div className="py-8"><EmptyCustomerState title="No matching claims" body="Change the claim type, search or stage filter." /></div>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E9F3] px-5 py-4 text-[12px] text-[#536681]">
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
