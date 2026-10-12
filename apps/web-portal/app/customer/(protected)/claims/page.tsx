import Link from "next/link";
import { FileText } from "lucide-react";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";
import { ManufacturerMark } from "../vehicles/customer-vehicles-register";
import { CustomerClaimsSearch, CustomerClaimsStageFilter } from "./customer-claims-search";
import { INTERNAL_JOURNEY_STAGES, projectInternalClaim } from "@insureit/claim-journey";
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
  const cell = "px-3 py-3 text-[11px] text-[#1B355B]";
  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="absolute inset-y-0 right-0 w-[67%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
        <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[205px] sm:px-8">
          <div className="max-w-[58%]">
            <h1 className="text-[clamp(23px,3vw,38px)] font-black leading-tight">Your <span className="text-[#369BFF]">Claim</span> Portfolio</h1>
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_30px_rgba(20,40,75,.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E6ECF4] p-3 sm:p-4 xl:flex-nowrap">
          <h2 className="shrink-0 text-[17px] font-black text-[#10213D]">Claims Register</h2>
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
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead className="bg-[#F1F5FA] text-[10px] uppercase text-[#687991]">
                <tr>{["Claim / Control No.", "Vehicle / Asset", "Insurer", "Policy No.", "Claim type", "Incident date", "Stage", "Status"].map((heading) =>
                  <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#E2E9F3]">
                {rows.map(({ claim, stage }) => (
                  <tr key={claim.id} className="group relative hover:bg-[#F6F9FE] focus-within:bg-[#EFF6FF]">
                    <td className={cell}><Link href={{pathname:`/customer/claims/${claim.id}`,query:{account:account.id}}} aria-label={`View claim ${claim.claim_no || claim.id}`} className="font-bold text-[#16375C] after:absolute after:inset-0 after:cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF] focus-visible:outline-offset-2">{claim.insurer_claim_no || claim.claim_no || "—"}</Link><p className="mt-1 text-[9px] text-[#7B8CA4]">{claim.claim_no && claim.insurer_claim_no ? claim.claim_no : "—"}</p></td>
                    <td className={cell}><p className="font-bold text-[#164B91]">{claim.vehicle_no || "—"}</p><div className="mt-1 flex items-center gap-1" title={[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" ")}><ManufacturerMark make={claim.vehicle_make || ""} /></div></td>
                    <td className={cell}>{getStaticInsurerLogo(claim.insurer_name) ? <img src={getStaticInsurerLogo(claim.insurer_name)!} alt={claim.insurer_name || "Insurer"} title={claim.insurer_name || "Insurer"} className="h-7 w-7 object-contain" /> : <span title={claim.insurer_name || "Insurer unavailable"} aria-label={claim.insurer_name || "Insurer unavailable"} className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EDF2F8] text-[#506786]"><FileText className="h-4 w-4" /></span>}</td>
                    <td className={cell}>{claim.policy_no || "—"}</td>
                    <td className={cell}>—</td>
                    <td className={cell}>{claim.accident_at ? new Date(claim.accident_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</td>
                    <td className={cell}>{stage}</td>
                    <td className={cell}><span className="rounded-full border border-[#D9E5F3] bg-[#F2F7FD] px-2 py-1 text-[10px] font-semibold text-[#315B89]">{claim.current_status || "—"}</span></td>
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
