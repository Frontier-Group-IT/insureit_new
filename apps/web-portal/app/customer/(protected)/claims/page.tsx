import Link from "next/link";
import { AlertTriangle, CarFront, Search, ShieldCheck } from "lucide-react";
import { projectInternalClaim } from "@insureit/claim-journey";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  buildExternalClaimProjection,
  customerClaimStatusTone,
  formatCustomerDateTime,
  isCompletedCustomerClaim,
  isExternalCustomerClaim,
  loadCustomerClaimListContext,
} from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClaimFilter = "all" | "open" | "action" | "completed";

export default async function CustomerClaimsPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string; filter?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const { claims, milestones_by_claim } = await loadCustomerClaimListContext(account.id);
  const requested = params.filter;
  const filter: ClaimFilter = requested === "open" || requested === "action" || requested === "completed" ? requested : "all";
  const query = params.q?.trim().toLowerCase() ?? "";

  function actionRequired(claim: (typeof claims)[number]) {
    if (isExternalCustomerClaim(claim)) {
      const projection = buildExternalClaimProjection(milestones_by_claim.get(claim.id) ?? []);
      return !projection.completed && claim.claim_service_mode === "self_managed" &&
        (claim.current_status.includes("Document") || claim.current_status.includes("Awaited") || claim.current_status.includes("Pending"));
    }
    return projectInternalClaim(claim.current_status).customerActionRequired;
  }

  function matchesFilter(claim: (typeof claims)[number]) {
    const milestones = milestones_by_claim.get(claim.id) ?? [];
    const completed = isCompletedCustomerClaim(claim, milestones);
    if (filter === "completed") return completed;
    if (filter === "open") return !completed && claim.current_status !== "Rejected";
    if (filter === "action") return actionRequired(claim);
    return true;
  }

  const rows = claims.filter((claim) => {
    if (!matchesFilter(claim)) return false;
    if (!query) return true;
    return [
      claim.claim_no,
      claim.insurer_claim_no,
      claim.current_status,
      claim.accident_location,
      claim.vehicle_no,
      claim.vehicle_make,
      claim.vehicle_model,
      claim.policy_no,
      claim.insurer_name,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  const counts = {
    all: claims.length,
    open: claims.filter((claim) => !isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []) && claim.current_status !== "Rejected").length,
    action: claims.filter(actionRequired).length,
    completed: claims.filter((claim) => isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? [])).length,
  };

  const filterHref = (next: ClaimFilter) => ({
    pathname: "/customer/claims",
    query: {
      account: account.id,
      ...(params.q ? { q: params.q } : {}),
      ...(next !== "all" ? { filter: next } : {}),
    },
  });

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Claim tracker"
        title="Claims"
        description="Track internal and external claims, action states and journey progress."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <form className="flex max-w-xl flex-1 items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-[#73829A]" />
          <input type="hidden" name="account" value={account.id} />
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search vehicle, control no., claim no. or insurer"
            className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#10213D] outline-none placeholder:text-[#9AA6B7]"
          />
          <button className="rounded-lg bg-[#142746] px-3 py-1.5 text-[10px] font-black text-white">Search</button>
        </form>

        <div className="flex flex-wrap gap-2">
          {([
            ["all", "All"],
            ["open", "Open"],
            ["action", "Action Required"],
            ["completed", "Completed"],
          ] as const).map(([key, label]) => (
            <Link key={key} href={filterHref(key)} className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${filter === key ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B]"}`}>
              {label} · {counts[key]}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyCustomerState title={claims.length ? "No matching claims" : "No claims yet"} body={claims.length ? "Change the search or filter." : "Reported claims will appear here."} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((claim) => {
            const external = isExternalCustomerClaim(claim);
            const milestones = milestones_by_claim.get(claim.id) ?? [];
            const externalProjection = external ? buildExternalClaimProjection(milestones) : null;
            const internalProjection = external ? null : projectInternalClaim(claim.current_status);
            const completed = isCompletedCustomerClaim(claim, milestones);
            const action = actionRequired(claim);
            const stage = externalProjection?.current_stage.label ?? internalProjection?.stageLabel ?? claim.current_status;
            return (
              <Link
                key={claim.id}
                href={{ pathname: `/customer/claims/${claim.id}`, query: { account: account.id } }}
                className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,0.04)] transition hover:-translate-y-0.5 hover:border-[#B9C9DB]"
              >
                <div className="h-1 bg-[#142746]" />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><CarFront className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-black text-[#10213D]">{claim.vehicle_no || "Vehicle linked"}</p>
                        <StatusPill tone={completed ? "active" : action ? "due" : customerClaimStatusTone(claim.current_status)}>
                          {completed ? "Completed" : action ? "Action required" : external ? "Self tracked" : "In progress"}
                        </StatusPill>
                      </div>
                      <p className="mt-1 truncate text-[10.5px] font-bold text-[#6E7D93]">{claim.insurer_name || claim.policy_no || "Claim"}</p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8B97A8]">{stage}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#F7F9FC] p-3 text-[9.5px]">
                    <div><p className="font-bold text-[#8995A8]">Incident</p><p className="truncate font-black text-[#35445B]">{formatCustomerDateTime(claim.accident_at)}</p></div>
                    <div><p className="font-bold text-[#8995A8]">Control no.</p><p className="truncate font-black text-[#35445B]">{claim.claim_no}</p></div>
                    <div><p className="font-bold text-[#8995A8]">Claim no.</p><p className="truncate font-black text-[#35445B]">{claim.insurer_claim_no || "Awaiting insurer"}</p></div>
                  </div>

                  {claim.assistance_status === "requested" ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E8] px-2.5 py-1 text-[9px] font-black text-[#8C6419]"><AlertTriangle className="h-3 w-3" /> Assistance requested</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}