import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimStatus } from "./claim-workflow";

export type CustomerActivityEventType =
  | "claim_submitted"
  | "claim_document_uploaded"
  | "claim_document_reuploaded"
  | "claim_documents_completed"
  | "support_ticket_created"
  | "support_ticket_message_sent"
  | "support_ticket_attachment_uploaded"
  | "customer_kyc_uploaded"
  | "customer_kyc_deleted"
  | "endorsement_requested"
  | "roadside_call_started"
  | "notification_unread";

export type CustomerActivityPriority = "low" | "medium" | "high" | "critical";
export type CustomerActivityStatus = "new" | "seen" | "in_progress" | "handled" | "dismissed";

export type JourneyStage = {
  key: string;
  label: string;
  statuses: ClaimStatus[];
};

export const customerJourneyStages: JourneyStage[] = [
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
];

type ClaimRow = {
  id: string;
  current_status: ClaimStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

type RelatedCustomer = {
  company_name: string | null;
  contact_name: string | null;
  phone?: string | null;
} | null;

type RelatedClaim = {
  claim_no: string | null;
  insurer_claim_no: string | null;
  current_status: ClaimStatus | null;
} | null;

type RelatedVehicle = {
  vehicle_no: string | null;
  make?: string | null;
  model?: string | null;
} | null;

type RelatedSupportTicket = {
  ticket_no: string | null;
  category: string | null;
  priority: string | null;
  subject: string | null;
  status: string | null;
} | null;

export type DashboardActivityRow = {
  id: string;
  customer_id: string | null;
  claim_id: string | null;
  vehicle_id: string | null;
  support_ticket_id: string | null;
  event_type: CustomerActivityEventType;
  title: string;
  message: string | null;
  priority: CustomerActivityPriority;
  status: CustomerActivityStatus;
  source_table: string | null;
  source_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  customers: RelatedCustomer;
  claims: RelatedClaim;
  vehicles: RelatedVehicle;
  support_tickets: RelatedSupportTicket;
};

export type AttentionKpi = {
  key: string;
  label: string;
  value: number;
  hint: string;
  href: string;
};

export type JourneyKpi = JourneyStage & {
  index: number;
  count: number;
  updatedCount: number;
  oldestAgeLabel: string;
};

export type ManagerDashboardData = {
  attentionKpis: AttentionKpi[];
  journeyKpis: JourneyKpi[];
  actionRows: DashboardActivityRow[];
  activityFeed: DashboardActivityRow[];
  errors: string[];
};

export async function getManagerDashboardData(supabase: SupabaseClient): Promise<ManagerDashboardData> {
  const [claimsResult, activityResult] = await Promise.all([
    supabase.from("claims").select("id, current_status, created_at, updated_at").returns<ClaimRow[]>(),
    supabase
      .from("customer_activity_events")
      .select("id, customer_id, claim_id, vehicle_id, support_ticket_id, event_type, title, message, priority, status, source_table, source_id, metadata, created_at, customers(company_name, contact_name, phone), claims(claim_no, insurer_claim_no, current_status), vehicles(vehicle_no, make, model), support_tickets(ticket_no, category, priority, subject, status)")
      .order("created_at", { ascending: false })
      .limit(80)
      .returns<DashboardActivityRow[]>()
  ]);

  const claims = claimsResult.data ?? [];
  const activities = activityResult.data ?? [];
  const activeActivities = activities.filter((event) => event.status === "new" || event.status === "in_progress");

  const journeyKpis = customerJourneyStages.map((stage, index) => {
    const stageClaims = claims.filter((claim) => stage.statuses.includes(claim.current_status));
    const updatedCount = activities.filter((event) => event.claims?.current_status && stage.statuses.includes(event.claims.current_status)).length;
    return {
      ...stage,
      index: index + 1,
      count: stageClaims.length,
      updatedCount,
      oldestAgeLabel: oldestAgeLabel(stageClaims)
    };
  });

  return {
    attentionKpis: [
      {
        key: "new-updates",
        label: "New Customer Updates",
        value: activeActivities.length,
        hint: "Unhandled mobile activity",
        href: "/dashboard#customer-activity"
      },
      {
        key: "documents-uploaded",
        label: "Documents Uploaded",
        value: countEvents(activeActivities, ["claim_document_uploaded", "claim_documents_completed"]),
        hint: "Pending document review",
        href: "/dashboard?activity=documents#manager-action"
      },
      {
        key: "replacement-received",
        label: "Replacement Received",
        value: countEvents(activeActivities, ["claim_document_reuploaded"]),
        hint: "Rejected docs reuploaded",
        href: "/dashboard?activity=replacements#manager-action"
      },
      {
        key: "support-replies",
        label: "Support Replies",
        value: countEvents(activeActivities, ["support_ticket_message_sent"]),
        hint: "Customer waiting reply",
        href: "/dashboard?activity=support#manager-action"
      },
      {
        key: "high-priority",
        label: "High Priority",
        value: activeActivities.filter((event) => event.priority === "high" || event.priority === "critical").length,
        hint: "Needs quick action",
        href: "/dashboard?priority=high#manager-action"
      },
      {
        key: "kyc-updates",
        label: "KYC / Profile Updates",
        value: countEvents(activeActivities, ["customer_kyc_uploaded", "customer_kyc_deleted"]),
        hint: "Customer profile changes",
        href: "/dashboard?activity=kyc#customer-activity"
      }
    ],
    journeyKpis,
    actionRows: activeActivities
      .slice()
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 8),
    activityFeed: activities.slice(0, 12),
    errors: [claimsResult.error?.message, activityResult.error?.message].filter(Boolean) as string[]
  };
}

function countEvents(events: DashboardActivityRow[], eventTypes: CustomerActivityEventType[]) {
  return events.filter((event) => eventTypes.includes(event.event_type)).length;
}

function priorityRank(priority: CustomerActivityPriority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function oldestAgeLabel(claims: ClaimRow[]) {
  if (!claims.length) return "No pending claims";
  const timestamps = claims
    .map((claim) => Date.parse(claim.updated_at ?? claim.created_at ?? ""))
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return "Age not available";
  const oldest = Math.min(...timestamps);
  const ageDays = Math.max(0, Math.floor((Date.now() - oldest) / 86400000));
  if (ageDays === 0) return "Updated today";
  if (ageDays === 1) return "Oldest 1 day";
  return `Oldest ${ageDays} days`;
}
