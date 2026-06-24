import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { ClaimQueueTable, type QueueClaimRow } from "@/components/claim-manager/claim-queue-table";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { isCustomerActionAwaited, isDocumentVerificationPending, isManagerActionRequired, isOpenClaimStatus, operationsQueueForKey, operationsQueueForStatus, terminalClaimStatuses, type ClaimStatus } from "@/lib/claim-workflow";

type SearchParams = { queue?: string; status?: string; q?: string; page?: string };

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, insurer_claim_no, current_status, accident_at, created_at, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model), policies(policy_no), insurance_companies(name), assignee:profiles!claims_assigned_to_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .returns<QueueClaimRow[]>();

  const query = (params.q ?? "").trim().toLowerCase();
  const rows = (data ?? []).filter((claim) => {
    const process = operationsQueueForStatus(claim.current_status)?.label;
    const haystack = [
      claim.claim_no,
      claim.insurer_claim_no,
      claim.current_status,
      process,
      claim.customers?.company_name,
      claim.customers?.contact_name,
      claim.customers?.phone,
      claim.vehicles?.vehicle_no,
      claim.vehicles?.make,
      claim.vehicles?.model,
      claim.policies?.policy_no,
      claim.insurance_companies?.name,
      claim.assignee?.full_name
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesQueue(claim.current_status, params.queue) && (!query || haystack.includes(query));
  });

  const title = titleForQueue(params.queue);
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const baseParams = Object.fromEntries(Object.entries({ queue: params.queue, q: params.q }).filter(([, value]) => Boolean(value))) as Record<string, string>;

  return (
    <ClaimManagerShell title={title} backHref="/dashboard" activeNav="dashboard">
      <div className="mb-4 grid grid-cols-[170px_1fr_76px] items-end gap-4 max-xl:grid-cols-1">
        <div>
          <p className="text-[13px] font-semibold leading-none text-[#071D49]">Total Claims <span className="text-[12px] font-normal text-[#5C6878]">(All Stages)</span></p>
          <p className="mt-1.5 text-[38px] font-semibold leading-none tracking-tight text-[#003A83]">{rows.length}</p>
        </div>
        <form action="/claims" className="col-span-2 flex items-center gap-3 max-md:flex-col max-md:items-stretch">
          {params.queue ? <input type="hidden" name="queue" value={params.queue} /> : null}
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search by customer, vehicle no., claim no., policy no., control no." aria-label="Search claims" className="h-11 flex-1 rounded-lg border border-[#CCD6E4] bg-white px-4 text-[13px] font-normal text-[#071D49] shadow-sm outline-none placeholder:text-[#7A8797] focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" />
          <button className="h-11 w-[76px] rounded-lg border border-[#D4DDE9] bg-white text-[12px] font-medium text-[#071D49] shadow-sm transition hover:border-[#174EA6] hover:bg-[#F2F7FF] max-md:w-full" type="submit">Filter</button>
        </form>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error.message}</div> : null}
      <ClaimQueueTable rows={rows} page={page} baseParams={baseParams} />
    </ClaimManagerShell>
  );
}

function matchesQueue(status: ClaimStatus, queue?: string) {
  if (!queue) return true;
  const operationalQueue = operationsQueueForKey(queue);
  if (operationalQueue) return operationalQueue.statuses.includes(status);
  if (queue === "active") return isOpenClaimStatus(status);
  if (queue === "documents") return isDocumentVerificationPending(status);
  if (queue === "customer-action") return isCustomerActionAwaited(status);
  if (queue === "manager-action") return isManagerActionRequired(status);
  if (queue === "closed") return terminalClaimStatuses.includes(status);
  return true;
}

function titleForQueue(queue?: string) {
  const operationalQueue = operationsQueueForKey(queue);
  if (operationalQueue) return operationalQueue.label;
  if (queue === "active") return "Active Claims";
  if (queue === "documents") return "Documents Pending Verification";
  if (queue === "customer-action") return "Customer Action Awaited";
  if (queue === "manager-action") return "Our Action Required";
  if (queue === "closed") return "Closed Cases";
  return "Vehicle Claims Intimated";
}
