import { cache } from "react";
import { notFound } from "next/navigation";
import { projectInternalClaim } from "@insureit/claim-journey";
import { createServerSupabaseClient } from "@/lib/auth-server";
import {
  customerDisplayVehicleNo,
  formatCustomerDate,
  loadCustomerWebPolicies,
  loadCustomerWebVehicles,
  type CustomerPolicyRow,
  type CustomerVehicleRow,
} from "@/lib/customer-web-data";

export const CUSTOMER_RENEWAL_DUE_WINDOW_DAYS = 45;

export type CustomerRenewalKey =
  | "insurance_policy"
  | "national_permit"
  | "local_permit"
  | "road_tax"
  | "puc"
  | "fitness";

export type CustomerRenewalItem = {
  id: string;
  key: CustomerRenewalKey;
  title: string;
  vehicle_id: string;
  vehicle_no: string;
  expiry_date: string;
  days_until: number;
  status: "due" | "expired";
  meta: string | null;
};

export type CustomerRenewalSummary = {
  key: CustomerRenewalKey;
  title: string;
  due: number;
  expired: number;
  total_pending: number;
};

const renewalDescriptors: Array<{
  key: CustomerRenewalKey;
  title: string;
  expiry: (vehicle: CustomerVehicleRow, policy?: CustomerPolicyRow) => string | null;
  meta?: (vehicle: CustomerVehicleRow, policy?: CustomerPolicyRow) => string | null;
}> = [
  { key: "insurance_policy", title: "Insurance Policy", expiry: (_vehicle, policy) => policy?.end_date ?? null, meta: (_vehicle, policy) => policy?.policy_no ?? null },
  { key: "national_permit", title: "National permit", expiry: (vehicle) => vehicle.national_permit_expiry_date },
  { key: "local_permit", title: "Local permit", expiry: (vehicle) => vehicle.local_permit_expiry_date },
  { key: "road_tax", title: "Road tax", expiry: (vehicle) => vehicle.road_tax_expiry_date },
  { key: "puc", title: "PUC", expiry: (vehicle) => vehicle.puc_expiry_date },
  { key: "fitness", title: "Fitness", expiry: (vehicle) => vehicle.fitness_expiry_date },
];

export const loadCustomerRenewals = cache(async (customerId: string) => {
  const [vehicles, policies] = await Promise.all([
    loadCustomerWebVehicles(customerId),
    loadCustomerWebPolicies(customerId),
  ]);

  const policyByVehicle = new Map(
    policies.filter((policy) => policy.vehicle_id).map((policy) => [policy.vehicle_id as string, policy] as const),
  );
  const summaries = new Map<CustomerRenewalKey, CustomerRenewalSummary>(
    renewalDescriptors.map((item) => [item.key, { key: item.key, title: item.title, due: 0, expired: 0, total_pending: 0 }]),
  );
  const items: CustomerRenewalItem[] = [];
  const today = startOfDay(new Date());

  for (const vehicle of vehicles) {
    const policy = policyByVehicle.get(vehicle.id);
    for (const descriptor of renewalDescriptors) {
      const expiry = descriptor.expiry(vehicle, policy);
      if (!expiry) continue;
      const days = daysUntil(expiry, today);
      const status = days < 0 ? "expired" : days <= CUSTOMER_RENEWAL_DUE_WINDOW_DAYS ? "due" : null;
      if (!status) continue;
      const summary = summaries.get(descriptor.key);
      if (!summary) continue;
      summary[status] += 1;
      summary.total_pending += 1;
      items.push({
        id: `${descriptor.key}:${vehicle.id}:${expiry}`,
        key: descriptor.key,
        title: descriptor.title,
        vehicle_id: vehicle.id,
        vehicle_no: customerDisplayVehicleNo(vehicle),
        expiry_date: expiry,
        days_until: days,
        status,
        meta: descriptor.meta?.(vehicle, policy) ?? null,
      });
    }
  }

  return {
    summaries: renewalDescriptors.map((item) => summaries.get(item.key) as CustomerRenewalSummary),
    items: items.sort((left, right) => left.days_until - right.days_until),
    total_pending: items.length,
    expired_count: items.filter((item) => item.status === "expired").length,
    due_count: items.filter((item) => item.status === "due").length,
  };
});

export type CustomerClaimRow = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  policy_id: string | null;
  external_policy_id: string | null;
  insurance_company_id: string | null;
  claim_no: string;
  insurer_claim_no: string | null;
  current_status: string;
  accident_at: string | null;
  accident_location: string | null;
  policy_service_source: "sibl" | "external" | null;
  claim_service_mode: "broker_managed" | "self_managed" | null;
  assistance_status: "not_requested" | "requested" | "accepted" | "declined" | "cancelled" | null;
  created_at: string;
  updated_at: string | null;
  vehicle_no: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  policy_no: string | null;
  insurer_name: string | null;
};

export type CustomerClaimMilestone = {
  id: string;
  claim_id: string;
  milestone_key: string;
  milestone_status: string;
  details: Record<string, unknown> | null;
  completed_at: string | null;
  updated_at: string | null;
};

export type CustomerClaimDocument = {
  id: string;
  claim_id: string;
  document_type: string;
  verification_status: string | null;
  created_at: string;
};

export type CustomerClaimTask = {
  id: string;
  claim_id: string;
  title: string;
  status: string;
};

export type CustomerClaimProjection = ReturnType<typeof projectInternalClaim>;

type RawClaim = Omit<CustomerClaimRow, "vehicle_no" | "vehicle_make" | "vehicle_model" | "policy_no" | "insurer_name">;

const externalMilestones = [
  ["spot_intimation", "Spot Intimation"],
  ["spot_status", "Spot Status"],
  ["claim_intimation", "Claim Intimation"],
  ["work_approval", "Work Approval"],
  ["repair_ri", "Repair & RI"],
  ["billing", "Billing"],
  ["delivery_order", "Delivery Order"],
  ["vehicle_delivery", "Vehicle Delivery"],
  ["payment_encashment", "Payment Encashment"],
] as const;

export const loadCustomerClaims = cache(async (customerId: string) => {
  const supabase = await createServerSupabaseClient();
  const [claimResult, vehicleResult, internalPolicyResult, externalPolicyResult, insurerResult] = await Promise.all([
    supabase.from("claims").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("vehicles").select("id,vehicle_no,make,model").eq("customer_id", customerId),
    supabase.from("policies").select("id,policy_no,insurance_company_id").eq("customer_id", customerId),
    supabase.from("external_policies").select("id,policy_no,insurance_company_id").eq("customer_id", customerId),
    supabase.from("insurance_companies").select("id,name"),
  ]);

  if (claimResult.error) throw new Error("Customer claims are temporarily unavailable.");

  const vehicles = new Map((vehicleResult.data ?? []).map((row) => [row.id, row] as const));
  const policies = new Map((internalPolicyResult.data ?? []).map((row) => [row.id, row] as const));
  const externalPolicies = new Map((externalPolicyResult.data ?? []).map((row) => [row.id, row] as const));
  const insurers = new Map((insurerResult.data ?? []).map((row) => [row.id, row.name] as const));

  return ((claimResult.data ?? []) as RawClaim[]).map((claim) => {
    const vehicle = vehicles.get(claim.vehicle_id);
    const policy = claim.policy_id ? policies.get(claim.policy_id) : claim.external_policy_id ? externalPolicies.get(claim.external_policy_id) : null;
    const insurerId = claim.insurance_company_id ?? policy?.insurance_company_id ?? null;
    return {
      ...claim,
      vehicle_no: vehicle?.vehicle_no ?? null,
      vehicle_make: vehicle?.make ?? null,
      vehicle_model: vehicle?.model ?? null,
      policy_no: policy?.policy_no ?? null,
      insurer_name: insurerId ? insurers.get(insurerId) ?? null : null,
    } satisfies CustomerClaimRow;
  });
});

export async function loadCustomerClaimListContext(customerId: string) {
  const claims = await loadCustomerClaims(customerId);
  if (!claims.length) return { claims, milestones_by_claim: new Map<string, CustomerClaimMilestone[]>() };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_milestones")
    .select("id,claim_id,milestone_key,milestone_status,details,completed_at,updated_at")
    .in("claim_id", claims.map((claim) => claim.id));

  if (error) return { claims, milestones_by_claim: new Map<string, CustomerClaimMilestone[]>() };

  const grouped = new Map<string, CustomerClaimMilestone[]>();
  for (const milestone of (data ?? []) as CustomerClaimMilestone[]) {
    grouped.set(milestone.claim_id, [...(grouped.get(milestone.claim_id) ?? []), milestone]);
  }
  return { claims, milestones_by_claim: grouped };
}

export async function loadCustomerClaimDetail(customerId: string, claimId: string) {
  const claims = await loadCustomerClaims(customerId);
  const claim = claims.find((item) => item.id === claimId);
  if (!claim) notFound();

  const supabase = await createServerSupabaseClient();
  const [milestoneResult, documentResult, taskResult] = await Promise.all([
    supabase.from("claim_milestones").select("id,claim_id,milestone_key,milestone_status,details,completed_at,updated_at").eq("claim_id", claimId),
    supabase.from("claim_documents").select("id,claim_id,document_type,verification_status,created_at").eq("claim_id", claimId).order("created_at", { ascending: false }),
    supabase.from("claim_tasks").select("id,claim_id,title,status").eq("claim_id", claimId).eq("status", "open"),
  ]);

  const milestones = (milestoneResult.data ?? []) as CustomerClaimMilestone[];
  const documents = (documentResult.data ?? []) as CustomerClaimDocument[];
  const tasks = (taskResult.data ?? []) as CustomerClaimTask[];

  return {
    claim,
    milestones,
    documents,
    tasks,
    internal_projection: isExternalCustomerClaim(claim)
      ? null
      : projectInternalClaim(claim.current_status, {
          hasRejectedDocuments: hasLatestRejectedDocument(documents),
          hasRequiredDocuments: hasUploadedClaimDocuments(documents),
        }),
    external_projection: isExternalCustomerClaim(claim)
      ? buildExternalClaimProjection(milestones)
      : null,
  };
}

export function isExternalCustomerClaim(claim: Pick<CustomerClaimRow, "policy_service_source" | "external_policy_id">) {
  return claim.policy_service_source === "external" || Boolean(claim.external_policy_id);
}

export function isCompletedCustomerClaim(claim: CustomerClaimRow, milestones: CustomerClaimMilestone[] = []) {
  if (isExternalCustomerClaim(claim)) return buildExternalClaimProjection(milestones).completed;
  return ["Closed", "Settled", "Claim Complete"].includes(claim.current_status);
}

export function customerClaimStatusTone(status: string) {
  if (["Closed", "Settled", "Claim Complete"].includes(status)) return "active" as const;
  if (status === "Rejected") return "expired" as const;
  if (status.includes("Document") || status.includes("Awaited") || status.includes("Pending")) return "due" as const;
  return "neutral" as const;
}

export function buildExternalClaimProjection(milestones: CustomerClaimMilestone[]) {
  const completedKeys = new Set(
    milestones
      .filter((item) => item.milestone_status === "completed" || item.milestone_status === "not_applicable")
      .map((item) => item.milestone_key),
  );
  const stages = externalMilestones.map(([key, label], index) => ({
    key,
    label,
    index,
    completed: completedKeys.has(key),
    milestone: milestones.find((item) => item.milestone_key === key) ?? null,
  }));
  const current = stages.find((stage) => !stage.completed) ?? stages[stages.length - 1];
  return {
    stages,
    current_stage: current,
    completed_count: completedKeys.size,
    completed: stages.every((stage) => stage.completed),
    progress: Math.round((completedKeys.size / stages.length) * 100),
  };
}

export function customerClaimFilter(
  claim: CustomerClaimRow,
  filter: "all" | "open" | "action" | "completed",
  detail?: Awaited<ReturnType<typeof loadCustomerClaimDetail>>,
) {
  if (filter === "all") return true;
  const completed = detail
    ? isCompletedCustomerClaim(claim, detail.milestones)
    : ["Closed", "Settled", "Claim Complete"].includes(claim.current_status);
  if (filter === "completed") return completed;
  if (filter === "open") return !completed && claim.current_status !== "Rejected";
  if (isExternalCustomerClaim(claim)) {
    return !completed && claim.claim_service_mode === "self_managed" &&
      (claim.current_status.includes("Document") || claim.current_status.includes("Awaited") || claim.current_status.includes("Pending"));
  }
  return detail?.internal_projection?.customerActionRequired ??
    (claim.current_status.includes("Document") || claim.current_status.includes("Awaited"));
}

export function formatCustomerDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function hasLatestRejectedDocument(documents: CustomerClaimDocument[]) {
  const latest = new Map<string, CustomerClaimDocument>();
  for (const document of documents) {
    const key = document.document_type.trim().toLowerCase();
    const current = latest.get(key);
    if (!current || Date.parse(document.created_at) > Date.parse(current.created_at)) latest.set(key, document);
  }
  return Array.from(latest.values()).some((document) => document.verification_status === "rejected");
}

function hasUploadedClaimDocuments(documents: CustomerClaimDocument[]) {
  return documents.some((document) => document.verification_status !== "rejected");
}

function daysUntil(value: string, today: Date) {
  const target = startOfDay(new Date(`${value}T00:00:00`));
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function formatRenewalExpiry(value: string) {
  return formatCustomerDate(value);
}