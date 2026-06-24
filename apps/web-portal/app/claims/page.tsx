import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { ClaimQueueTable, type QueueClaimRow } from "@/components/claim-manager/claim-queue-table";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { claimStatuses, isCustomerActionAwaited, isDocumentVerificationPending, isManagerActionRequired, isOpenClaimStatus, operationsQueueForKey, operationsQueueForStatus, terminalClaimStatuses, type ClaimStatus } from "@/lib/claim-workflow";

type SearchParams = { queue?: string; journey?: string; status?: string; q?: string; page?: string; pageSize?: string };

const allowedPageSizes = [5, 10, 20, 50, 100];

const customerJourneyStages = [
  { key: "loss-report", label: "Loss Report", statuses: ["Accident Reported"] as ClaimStatus[] },
  { key: "spot-intimation", label: "Spot Intimation", statuses: ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Initial Documents Verified", "Documents Submitted", "Documents Pending"] as ClaimStatus[] },
  { key: "spot-surveyor-assigned", label: "Spot Surveyor Assigned", statuses: ["Surveyor Appointed"] as ClaimStatus[] },
  { key: "spot-survey-completed", label: "Spot Survey Completed", statuses: ["Vehicle Inspected"] as ClaimStatus[] },
  { key: "final-documents", label: "Final Documents", statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified"] as ClaimStatus[] },
  { key: "claim-intimation", label: "Claim Intimation", statuses: ["Claim Intimated", "Claim Intimation"] as ClaimStatus[] },
  { key: "final-surveyor", label: "Final Surveyor", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done"] as ClaimStatus[] },
  { key: "work-approval", label: "Work Approval", statuses: ["Work Approval Status", "Work Approval Received", "Estimate Submitted", "Approval Pending"] as ClaimStatus[] },
  { key: "under-repair", label: "Under Repair", statuses: ["Under Repair", "Repair Done", "Repair Started", "Repair Completed"] as ClaimStatus[] },
  { key: "ri-stage", label: "RI Stage", statuses: ["RA Intimation", "RA Intimation Done"] as ClaimStatus[] },
  { key: "do-stage", label: "DO Stage", statuses: ["DO Status", "DO Submitted"] as ClaimStatus[] },
  { key: "vehicle-release", label: "Vehicle Release", statuses: ["Final Bill Submitted"] as ClaimStatus[] },
  { key: "payment-advice-received", label: "Payment Advice Received", statuses: ["Payment Stage", "Claim Completion In Progress", "Settlement Under Process"] as ClaimStatus[] },
  { key: "journey-complete", label: "Journey Complete", statuses: ["Claim Complete", "Settled", "Closed"] as ClaimStatus[] }
] as const;

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, insurer_claim_no, current_status, accident_at, created_at, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model), policies(policy_no), insurance_companies(name), assignee:profiles!claims_assigned_to_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .returns<QueueClaimRow[]>();

  const query = (params.q ?? "").trim().toLowerCase();
  const selectedStatus = params.status && params.status !== "all" ? params.status : null;
  const selectedJourney = customerJourneyForKey(params.journey);
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
    return matchesQueue(claim.current_status, params.queue) && (!selectedJourney || selectedJourney.statuses.includes(claim.current_status)) && (!selectedStatus || claim.current_status === selectedStatus) && (!query || haystack.includes(query));
  });

  const title = selectedJourney?.label ?? titleForQueue(params.queue);
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const requestedPageSize = Number(params.pageSize ?? "10") || 10;
  const pageSize = allowedPageSizes.includes(requestedPageSize) ? requestedPageSize : 10;
  const baseParams = Object.fromEntries(Object.entries({ queue: params.queue, journey: params.journey, q: params.q, status: selectedStatus ?? undefined }).filter(([, value]) => Boolean(value))) as Record<string, string>;

  return (
    <ClaimManagerShell title={title} backHref="/dashboard" activeNav="dashboard">
      <div className="mb-2 grid grid-cols-[145px_1fr] items-center gap-3 max-lg:grid-cols-1">
        <div>
          <p className="whitespace-nowrap text-[12px] font-medium leading-none text-[#071D49]">Total Claims <span className="text-[11px] font-normal text-[#5C6878]">(All Stages)</span></p>
          <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-[#003A83]">{rows.length}</p>
        </div>
        <form action="/claims" className="flex items-center gap-2 max-md:flex-col max-md:items-stretch">
          {params.queue ? <input type="hidden" name="queue" value={params.queue} /> : null}
          {params.journey ? <input type="hidden" name="journey" value={params.journey} /> : null}
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={pageSize} />
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search by customer, vehicle no., claim no., policy no., control no." aria-label="Search claims" className="h-10 flex-1 rounded-lg border border-[#CCD6E4] bg-white px-3.5 text-[12px] font-normal text-[#071D49] shadow-sm outline-none placeholder:text-[#7A8797] focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" />
          <select name="status" defaultValue={selectedStatus ?? "all"} aria-label="Filter by status" className="h-10 w-[220px] rounded-lg border border-[#D4DDE9] bg-white px-3 text-[12px] font-medium text-[#071D49] shadow-sm outline-none focus:border-[#174EA6] max-md:w-full">
            <option value="all">All statuses</option>
            {claimStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button className="h-10 w-[82px] rounded-lg border border-[#D4DDE9] bg-white text-[11px] font-medium text-[#071D49] shadow-sm transition hover:border-[#174EA6] hover:bg-[#F2F7FF] max-md:w-full" type="submit">Search</button>
        </form>
      </div>

      {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error.message}</div> : null}
      <ClaimQueueTable rows={rows} page={page} pageSize={pageSize} baseParams={baseParams} />
    </ClaimManagerShell>
  );
}

function customerJourneyForKey(key?: string) {
  return customerJourneyStages.find((stage) => stage.key === key);
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
