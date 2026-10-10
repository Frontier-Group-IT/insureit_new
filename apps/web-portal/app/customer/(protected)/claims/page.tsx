import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { CustomerClaimsSearch } from "./customer-claims-search";
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
  const cell = "border-r border-[#E2E9F3] px-3 py-3 text-[11px] text-[#1B355B] last:border-r-0";
  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-[#DCE4EE] bg-white px-4 py-3 shadow-sm">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#15345B] text-white"><ClipboardList className="h-5 w-5" /></span>
        <h1 className="mr-1 text-[17px] font-bold text-[#142746]">Claim Portfolio</h1>
        <CustomerClaimsSearch initialQuery={params.q ?? ""} accountId={account.id} type={type} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <form method="get">
            <input type="hidden" name="account" value={account.id} />
            <input type="hidden" name="type" value={type} />
            {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
            <select name="stage" defaultValue={stageFilter} onChange={undefined} className="max-w-[210px] rounded-lg border border-[#CBD8E9] bg-white px-3 py-2.5 text-[11px] text-[#142746]">
              <option value="">All claim stages</option>
              {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
            </select>
            <button type="submit" className="sr-only">Apply claim stage filter</button>
          </form>
        <div className="flex rounded-lg border border-[#DCE4EE] bg-[#F8FAFD] p-0.5 text-[11px] font-semibold">
          {(["internal", "external"] as const).map((key) => (
            <Link key={key} href={href({ type: key, stage: "", page: "1" })}
              className={`rounded-md px-3 py-2 ${type === key ? "bg-[#E4EFFD] text-[#124788]" : "text-[#64748B]"}`}>
              {key === "internal" ? "Internal claims" : "External claims"} <span className="ml-1 rounded-full bg-[#D9E8FA] px-1.5 py-0.5">{key === "internal" ? internalCount : externalCount}</span>
            </Link>
          ))}
        </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 text-[13px] font-semibold text-[#142746]">
          {type === "internal" ? "Internal claims" : "External claims"}
          <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[10px] text-[#24538A]">{filtered.length} claims</span>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead className="bg-[#07367A] text-[11px] text-white">
                <tr>{["Customer / Mobile", "Vehicle No.", "Vehicle", "Loss Date", "Insurer", "Policy", "Control No.", "Claim No.", "Process", "Action"].map((heading) =>
                  <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#E2E9F3]">
                {rows.map(({ claim, stage }) => (
                  <tr key={claim.id} className="hover:bg-[#F6F9FE]">
                    <td className={cell}>Account holder</td>
                    <td className={cell}>{claim.vehicle_no || "—"}</td>
                    <td className={cell}>{[claim.vehicle_make, claim.vehicle_model].filter(Boolean).join(" ") || "—"}</td>
                    <td className={cell}>{claim.accident_at ? new Date(claim.accident_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                    <td className={cell}>{claim.insurer_name || "—"}</td>
                    <td className={cell}>{claim.policy_no || "—"}</td>
                    <td className={cell}>{claim.claim_no || "—"}</td>
                    <td className={cell}>{claim.insurer_claim_no || "—"}</td>
                    <td className={cell}>{stage}</td>
                    <td className={cell}><Link href={{ pathname: `/customer/claims/${claim.id}`, query: { account: account.id } }}
                      className="inline-block rounded-lg bg-[#07367A] px-3 py-2 font-semibold text-white hover:bg-[#0B4B9B]">Proceed</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyCustomerState title="No matching claims" body="Change the claim type, search or stage filter." />}
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
