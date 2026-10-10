import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, ClipboardList, Clock3, FileText, ShieldCheck } from "lucide-react";
import { CustomerClaimsSearch, CustomerClaimsStageFilter } from "./customer-claims-search";
import { projectInternalClaim } from "@insureit/claim-journey";
import { CustomerAccountTabs, EmptyCustomerState } from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  buildExternalClaimProjection,
  isExternalCustomerClaim,
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
    const stage = external
      ? buildExternalClaimProjection(milestones_by_claim.get(claim.id) ?? []).current_stage.label
      : projectInternalClaim(claim.current_status).stageLabel;
    return { claim, external, stage: stage || claim.current_status };
  });
  const internalCount = enriched.filter((item) => !item.external).length;
  const externalCount = enriched.length - internalCount;
  const stages = [...new Set(enriched.filter((item) => item.external === (type === "external")).map((item) => item.stage))].sort();
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
  const cell = "px-3 py-3 text-[11px] text-[#1B355B]";
  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="absolute inset-y-0 right-0 w-[67%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
        <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[205px] sm:px-8">
          <div className="max-w-[58%]">
            <p className="text-[9px] font-extrabold uppercase tracking-[.15em] text-[#86C8FF]">Claims and assistance</p>
            <h1 className="mt-2 text-[clamp(23px,3vw,38px)] font-black leading-tight">Your <span className="text-[#369BFF]">Claim</span> Portfolio</h1>
            <p className="mt-2 max-w-[400px] text-[11px] leading-5 text-[#E0EEFF]">Track and manage your vehicle and asset claims in one place with complete transparency.</p>
          </div>
        </div>
      </section>
      <section aria-label="Claim summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Total claims", value: enriched.length, Icon: FileText, theme: "bg-[#EFF6FF]", color: "text-[#1671DA]" },
          { label: "In process", value: enriched.filter(({claim,stage}) => !/settled|approved|rejected|closed|cancelled|customer action/i.test(`${claim.current_status} ${stage}`)).length, Icon: Clock3, theme: "bg-[#EEFBF6]", color: "text-[#0DA87A]" },
          { label: "Approved / settled", value: enriched.filter(({claim,stage}) => /approved|settled/i.test(`${claim.current_status} ${stage}`)).length, Icon: CheckCircle2, theme: "bg-[#FFF7EC]", color: "text-[#E68A1B]" },
          { label: "Rejected", value: enriched.filter(({claim,stage}) => /rejected/i.test(`${claim.current_status} ${stage}`)).length, Icon: AlertCircle, theme: "bg-[#FFF1F2]", color: "text-[#D52E42]" },
          { label: "Customer action", value: enriched.filter(({claim,stage}) => /customer action/i.test(`${claim.current_status} ${stage}`)).length, Icon: ShieldCheck, theme: "bg-[#F4F1FF]", color: "text-[#7654D5]" },
        ].map(({label,value,Icon,theme,color}) => <div key={label} className={`flex min-h-[82px] items-center gap-3 rounded-xl border border-[#DEE7F1] p-3 ${theme}`}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 ${color}`}><Icon className="h-5 w-5" /></span>
          <span><strong className="block text-[22px] font-black text-[#10213D]">{value}</strong><span className="block text-[10px] font-semibold text-[#526985]">{label}</span></span>
        </div>)}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_30px_rgba(20,40,75,.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E6ECF4] p-3 sm:p-4">
          <CustomerClaimsSearch initialQuery={params.q ?? ""} accountId={account.id} type={type} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <CustomerClaimsStageFilter value={stageFilter} stages={stages} accountId={account.id} type={type} query={params.q ?? ""} />
            <div className="flex rounded-lg border border-[#DCE4EE] bg-[#F8FAFD] p-0.5 text-[11px] font-semibold">
              {(["internal", "external"] as const).map(key => <Link key={key} href={href({type:key,stage:"",page:"1"})} className={`rounded-md px-3 py-2 ${type === key ? "bg-[#E4EFFD] text-[#124788]" : "text-[#64748B]"}`}>
                {key === "internal" ? "Internal claims" : "External claims"} <span className="ml-1 rounded-full bg-[#D9E8FA] px-1.5 py-0.5">{key === "internal" ? internalCount : externalCount}</span>
              </Link>)}
            </div>
          </div>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="bg-[#F1F5FA] text-[10px] uppercase text-[#687991]">
                <tr>{["Claim / Control No.", "Vehicle / Asset", "Insurer", "Policy No.", "Claim type", "Incident date", "Stage", "Status", "Actions"].map((heading) =>
                  <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#E2E9F3]">
                {rows.map(({ claim, stage }) => (
                  <tr key={claim.id} className="hover:bg-[#F6F9FE]">
                    <td className={cell}><p className="font-bold text-[#16375C]">{claim.insurer_claim_no || claim.claim_no || "—"}</p><p className="mt-1 text-[9px] text-[#7B8CA4]">{claim.claim_no && claim.insurer_claim_no ? claim.claim_no : "—"}</p></td>
                    <td className={cell}><p className="font-bold text-[#164B91]">{claim.vehicle_no || "—"}</p><p className="mt-1 max-w-[175px] truncate text-[9px] text-[#7B8CA4]">{[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" ") || "—"}</p></td>
                    <td className={cell}>{claim.insurer_name || "—"}</td>
                    <td className={cell}>{claim.policy_no || "—"}</td>
                    <td className={cell}>Vehicle claim</td>
                    <td className={cell}>{claim.accident_at ? new Date(claim.accident_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
                    <td className={cell}>{stage}</td>
                    <td className={cell}><span className="rounded-full border border-[#D9E5F3] bg-[#F2F7FD] px-2 py-1 text-[10px] font-semibold text-[#315B89]">{claim.current_status || "—"}</span></td>
                    <td className={cell}><Link aria-label={`View claim ${claim.claim_no || claim.id}`} href={{pathname:`/customer/claims/${claim.id}`,query:{account:account.id}}} className="inline-flex rounded-lg border border-[#DCE6F2] p-2 text-[#1B5794] hover:bg-[#EDF5FF]"><ArrowUpRight className="h-4 w-4"/></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="py-8"><EmptyCustomerState title="No matching claims" body="Change the claim type, search or stage filter." /></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E9F3] px-5 py-4 text-[11px] text-[#536681]">
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
