"use server";

import { canAccessCustomer } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ExternalClaimReadonlyMilestone = {
  key: string;
  status: string;
  details: Record<string, unknown>;
  completedAt: string | null;
  updatedAt: string | null;
};

export type ExternalClaimReadonlyDocument = {
  id: string;
  milestoneKey: string | null;
  documentType: string;
  fileName: string;
  verificationStatus: string;
  openUrl: string;
};

export type ExternalClaimReadonlySnapshot = {
  accidentAt: string | null;
  spotIntimationAt: string | null;
  accidentLocation: string | null;
  accidentDescription: string | null;
  insurerClaimNo: string | null;
  policyNo: string | null;
  policyType: string | null;
  insurerName: string | null;
  milestones: ExternalClaimReadonlyMilestone[];
  documents: ExternalClaimReadonlyDocument[];
};

type ExternalClaimRow = {
  id: string;
  customer_id: string;
  external_policy_id: string | null;
  claim_service_mode: "broker_managed" | "self_managed" | null;
  accident_at: string | null;
  spot_intimation_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
  insurer_claim_no: string | null;
};

type MilestoneRow = {
  milestone_key: string;
  milestone_status: string;
  details: Record<string, unknown> | null;
  completed_at: string | null;
  updated_at: string | null;
};

type DocumentRow = {
  id: string;
  milestone_key: string | null;
  document_type: string | null;
  file_name: string | null;
  verification_status: string | null;
};

export async function loadExternalClaimReadonlyJourney(claimId: string): Promise<ExternalClaimReadonlySnapshot> {
  if (!claimId) throw new Error("Claim reference is missing.");

  const profile = await requireCapability("view_claims");
  if (!profile?.id) throw new Error("You do not have permission to view this claim.");

  const admin = createSupabaseAdminClient();
  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select("id,customer_id,external_policy_id,claim_service_mode,accident_at,spot_intimation_at,accident_location,accident_description,insurer_claim_no")
    .eq("id", claimId)
    .maybeSingle<ExternalClaimRow>();

  if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");
  if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "view_claims"))) {
    throw new Error("You do not have permission to view this claim.");
  }
  if (claim.claim_service_mode !== "self_managed") {
    throw new Error("This read-only view is available only for customer-managed claims.");
  }

  const [{ data: milestoneRows, error: milestoneError }, { data: documentRows, error: documentError }] = await Promise.all([
    admin
      .from("claim_milestones")
      .select("milestone_key,milestone_status,details,completed_at,updated_at")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true })
      .returns<MilestoneRow[]>(),
    admin
      .from("claim_documents")
      .select("id,milestone_key,document_type,file_name,verification_status")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>(),
  ]);

  if (milestoneError) throw new Error(milestoneError.message);
  if (documentError) throw new Error(documentError.message);

  let policyNo: string | null = null;
  let policyType: string | null = null;
  let insurerName: string | null = null;

  if (claim.external_policy_id) {
    const { data: policy } = await admin
      .from("external_policies")
      .select("policy_no,policy_type,insurance_company_id")
      .eq("id", claim.external_policy_id)
      .eq("customer_id", claim.customer_id)
      .maybeSingle<{ policy_no: string | null; policy_type: string | null; insurance_company_id: string | null }>();

    policyNo = policy?.policy_no ?? null;
    policyType = policy?.policy_type ?? null;

    if (policy?.insurance_company_id) {
      const { data: insurer } = await admin
        .from("insurance_companies")
        .select("name")
        .eq("id", policy.insurance_company_id)
        .maybeSingle<{ name: string | null }>();
      insurerName = insurer?.name ?? null;
    }
  }

  return {
    accidentAt: claim.accident_at,
    spotIntimationAt: claim.spot_intimation_at,
    accidentLocation: claim.accident_location,
    accidentDescription: claim.accident_description,
    insurerClaimNo: claim.insurer_claim_no,
    policyNo,
    policyType,
    insurerName,
    milestones: (milestoneRows ?? []).map((milestone) => ({
      key: milestone.milestone_key,
      status: milestone.milestone_status,
      details: milestone.details ?? {},
      completedAt: milestone.completed_at,
      updatedAt: milestone.updated_at,
    })),
    documents: (documentRows ?? []).map((document) => ({
      id: document.id,
      milestoneKey: document.milestone_key,
      documentType: document.document_type?.trim() || "Document",
      fileName: document.file_name?.trim() || "Unnamed claim document",
      verificationStatus: document.verification_status?.trim() || "pending",
      openUrl: `/claim-documents/${document.id}/open`,
    })),
  };
}
