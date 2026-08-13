import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { type QueueClaimRow } from "@/components/claim-manager/claim-queue-table";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { operationsQueueForKey } from "@/lib/claim-workflow";
import { ClaimsWorkspace } from "./claims-workspace";

type SearchParams = { queue?: string; journey?: string; status?: string; q?: string; page?: string; pageSize?: string };
export type AssistanceQueueClaimRow = QueueClaimRow & {
  claim_service_mode?: string | null;
  assistance_status?: string | null;
  assistance_requested_at?: string | null;
  external_policies?: { policy_no: string } | null;
};

const customerJourneyTitles: Record<string, string> = {
  "loss-report": "Loss Report",
  "spot-intimation": "Spot Intimation",
  "spot-surveyor-assigned": "Spot Surveyor Assigned",
  "spot-survey-completed": "Spot Survey Completed",
  "final-documents": "Final Documents",
  "claim-intimation": "Claim Intimation",
  "final-surveyor": "Final Surveyor",
  "work-approval": "Work Approval",
  "under-repair": "Under Repair",
  "ri-stage": "RI Stage",
  "do-stage": "DO Stage",
  "vehicle-release": "Vehicle Release",
  "payment-advice-received": "Payment Advice Received",
  "journey-complete": "Journey Complete",
};

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, insurer_claim_no, current_status, accident_at, created_at, claim_service_mode, assistance_status, assistance_requested_at, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model), policies(policy_no), external_policies(policy_no), insurance_companies(name), assignee:profiles!claims_assigned_to_fkey(full_name)")
    .or("claim_service_mode.eq.broker_managed,assistance_status.eq.requested")
    .order("updated_at", { ascending: false })
    .returns<AssistanceQueueClaimRow[]>();
  const title = titleForParams(params);

  return (
    <ClaimManagerShell title={title} backHref="/dashboard" activeNav="dashboard">
      <ClaimsWorkspace rows={data ?? []} initialParams={params} loadError={error ? "The claims register is temporarily unavailable. Please refresh the page or try again shortly." : null} />
    </ClaimManagerShell>
  );
}

function titleForParams(params: SearchParams) {
  if (params.queue === "assistance") return "External Claim Assistance Requests";
  if (params.journey && customerJourneyTitles[params.journey]) return customerJourneyTitles[params.journey];
  const operationalQueue = operationsQueueForKey(params.queue);
  if (operationalQueue) return operationalQueue.label;
  if (params.queue === "active") return "Active Claims";
  if (params.queue === "documents") return "Documents Pending Verification";
  if (params.queue === "customer-action") return "Customer Action Awaited";
  if (params.queue === "manager-action") return "Our Action Required";
  if (params.queue === "closed") return "Closed Cases";
  return "Vehicle Claims Intimated";
}
