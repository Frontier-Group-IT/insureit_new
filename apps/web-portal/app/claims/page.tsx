import { redirect } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { type QueueClaimRow } from "@/components/claim-manager/claim-queue-table";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { operationsQueueForKey } from "@/lib/claim-workflow";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ClaimsWorkspace } from "./claims-workspace";

type SearchParams = { queue?: string; journey?: string; status?: string; q?: string; page?: string; pageSize?: string };

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
  const profile = await requireCapability("view_claims");
  if (!profile?.id) redirect("/access-denied");

  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_claims");
  const admin = createSupabaseAdminClient();

  let data: QueueClaimRow[] = [];
  let error: { message?: string } | null = null;
  if (accessibleCustomerIds === null || accessibleCustomerIds.length) {
    let request = admin
      .from("claims")
      .select("id, claim_no, insurer_claim_no, current_status, accident_at, created_at, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model), policies(policy_no), insurance_companies(name), assignee:profiles!claims_assigned_to_fkey(full_name)")
      .order("updated_at", { ascending: false });
    if (accessibleCustomerIds !== null) request = request.in("customer_id", accessibleCustomerIds);
    const result = await request.returns<QueueClaimRow[]>();
    data = result.data ?? [];
    error = result.error;
  }

  const title = titleForParams(params);
  const rows = data ?? [];

  return (
    <ClaimManagerShell title={title} backHref="/dashboard" activeNav="dashboard">
      {profile.role === "it_super_user" && !error ? (
        <ItSuperUserDeletePanel
          entity="claim"
          title="Delete claim record"
          records={rows.map((claim) => ({
            id: claim.id,
            label: claim.claim_no,
            detail: [
              claim.insurer_claim_no,
              claim.vehicles?.vehicle_no,
              claim.policies?.policy_no,
              claim.customers?.contact_name ?? claim.customers?.company_name,
              claim.current_status
            ].filter(Boolean).join(" • ")
          }))}
        />
      ) : null}
      <ClaimsWorkspace rows={rows} initialParams={params} loadError={error ? "The claims register is temporarily unavailable. Please refresh the page or try again shortly." : null} />
    </ClaimManagerShell>
  );
}

function titleForParams(params: SearchParams) {
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
