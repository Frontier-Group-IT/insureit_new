import Link from "next/link";
import { ClipboardList } from "lucide-react";
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
  const cell = "border-r border-[#E2E9F3] px-3 py-3 text-[11px] text-[#1B355B] last:border-r-0";
  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-[#DCE4EE] bg-white px-4 py-3 shadow-sm">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#15345B] text-white"><ClipboardList className="h-5 w-5" /></span>
        <h1 className="mr-1 text-[17px] font-bold text-[#142746]">Claim Portfolio</h1>
        <CustomerClaimsSearch initialQuery={params.q ?? ""} accountId={account.id} type={type} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CustomerClaimsStageFilter value={stageFilter} stages={stages} accountId={account.id} type={type} query={params.q ?? ""} />

