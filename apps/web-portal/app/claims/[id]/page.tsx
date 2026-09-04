import { notFound, redirect } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { OperationsClaimStages } from "@/components/claim-manager/operations-claim-stages";
import { AssistanceIntakePanel } from "@/components/claims/assistance-intake-panel";
import { finalDocumentDefinitions } from "@/components/final-documents/final-document-groups";
import { FinalDocumentsWorkspaceV2, type DealershipDetailsV2, type FinalDocumentRowV2 } from "@/components/final-documents/final-documents-workspace-v2";
import { SpotClaimHeader, SpotSurveyWorkspace, type SpotSurveyClaim, type SpotSurveyDocument, type SpotSurveyVerification, type SurveyorDetails } from "@/components/spot-survey/spot-survey-workspace-v2";
import { matchesClaimIntimationDocument } from "@insureit/claim-journey";
import { type ClaimStatus } from "@/lib/claim-workflow";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { readInternalSpotIntimationDetails } from "@/lib/internal-spot-intimation";

type ClaimDetail = SpotSurveyClaim & {
  customer_id: string;
  vehicle_id: string;
  policy_id: string | null;
  external_policy_id: string | null;
  current_status: ClaimStatus;
  claim_service_mode: "broker_managed" | "self_managed" | null;
  assistance_status: "not_requested" | "requested" | "accepted" | "declined" | "cancelled" | null;
  assistance_notes: string | null;
  policy_service_source: "sibl" | "external" | null;
  accident_at: string | null;
  accident_description: string | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null; email: string | null } | null;
  vehicles: { vehicle_no: string; vehicle_type: string | null; make: string | null; model: string | null } | null;
  policies: { policy_no: string | null; policy_type: string | null; start_date: string | null; end_date: string | null; premium_amount: number | null; insured_declared_value: number | null } | null;
  insurance_companies: { name: string | null; contact_email: string | null; contact_phone: string | null } | null;
};

type ClaimDocument = SpotSurveyDocument & {
  storage_bucket: string;
  storage_path: string;
};

type StageDetailRow = {
  id: string;
  claim_id: string;
  details: Record<string, unknown> | null;
  stage: string | null;
  created_at: string;
};

export default async function ClaimDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ stage?: string }> }) {
  const { id } = await params;
  const requestedStage = (await searchParams)?.stage;
  const profile = await requireCapability("view_claims");
  if (!profile?.id) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const { data: claim, error } = await admin
    .from("claims")
    .select("id, claim_no, insurer_claim_no, customer_id, vehicle_id, policy_id, external_policy_id, current_status, claim_service_mode, assistance_status, assistance_notes, policy_service_source, accident_at, accident_location, accident_description, estimated_loss, approved_amount, settlement_amount, updated_at, created_at, customers(company_name, contact_name, phone, email), vehicles(vehicle_no, vehicle_type, make, model), policies(policy_no, policy_type, start_date, end_date, premium_amount, insured_declared_value), insurance_companies(name, contact_email, contact_phone)")
    .eq("id", id)
    .maybeSingle<ClaimDetail>();

  if (error || !claim) notFound();
  if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "view_claims"))) notFound();

  const { data: vehiclePolicies } = await admin
    .from("policies")
    .select("id, vehicle_id, customer_id, policy_no, policy_type, start_date, end_date, premium_amount, insured_declared_value")
    .eq("vehicle_id", claim.vehicle_id)
    .eq("customer_id", claim.customer_id)
    .order("end_date", { ascending: false });

  const { data: externalPolicy } = claim.external_policy_id
    ? await admin
      .from("external_policies")
      .select("id, policy_no, policy_type, start_date, end_date, premium_amount, insured_declared_value, document_storage_path")
      .eq("id", claim.external_policy_id)
      .eq("customer_id", claim.customer_id)
      .eq("vehicle_id", claim.vehicle_id)
      .maybeSingle<{
        id: string;
        policy_no: string | null;
        policy_type: string | null;
        start_date: string | null;
        end_date: string | null;
        premium_amount: number | null;
        insured_declared_value: number | null;
        document_storage_path: string | null;
      }>()
    : { data: null };

  const incidentDate = claim.accident_at?.slice(0, 10) ?? null;
  const exactClaimPolicy = (vehiclePolicies ?? []).find((policy) => policy.id === claim.policy_id) ?? null;
  const policyCoveringIncident = incidentDate
    ? (vehiclePolicies ?? []).find((policy) => policy.start_date <= incidentDate && policy.end_date >= incidentDate) ?? null
    : null;
  const vehicleRegisterPolicy = exactClaimPolicy ?? policyCoveringIncident ?? vehiclePolicies?.[0] ?? null;
  const linkedPolicy = externalPolicy
    ? {
        policy_no: externalPolicy.policy_no,
        policy_type: externalPolicy.policy_type,
        start_date: externalPolicy.start_date,
        end_date: externalPolicy.end_date,
        premium_amount: externalPolicy.premium_amount,
        insured_declared_value: externalPolicy.insured_declared_value,
      }
    : vehicleRegisterPolicy
      ? vehicleRegisterPolicy
      : claim.policies
        ? claim.policies
        : null;
  const claimForVerification: ClaimDetail = {
    ...claim,
    policies: linkedPolicy
  };

  const [{ data: documents }, { data: verificationRows }, { data: stageRows }] = await Promise.all([
    admin
      .from("claim_documents")
      .select("id, document_type, file_name, storage_bucket, storage_path, verification_status, rejection_reason, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .returns<ClaimDocument[]>(),
    admin
      .from("claim_document_verifications")
      .select("id, claim_id, document_id, document_type, verification_type, incident_date, is_valid, invalid_reason, details, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .returns<SpotSurveyVerification[]>(),
    admin
      .from("claim_stage_details")
      .select("id, claim_id, stage, details, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .returns<StageDetailRow[]>()
  ]);

  const signedDocs: SpotSurveyDocument[] = (documents ?? []).filter(Boolean).map((document) => ({
    ...document,
    document_type: cleanText(document.document_type) || "Unclassified Spot Attachment",
    file_name: cleanText(document.file_name) || "Unnamed claim document",
    signedUrl: `/claim-documents/${document.id}/open`
  }));
  const policyDocument = claim.policy_id
    ? (await admin.from("policy_documents").select("id,file_name").eq("policy_id", claim.policy_id).eq("document_type", "policy_copy").order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string; file_name: string }>()).data
    : externalPolicy
      ? (await admin.from("customer_documents").select("id,file_name").eq("customer_id", claim.customer_id).eq("external_policy_id", externalPolicy.id).eq("document_type", "policy_copy").order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string; file_name: string }>()).data
        ?? (externalPolicy.document_storage_path
          ? (await admin.from("customer_documents").select("id,file_name").eq("customer_id", claim.customer_id).eq("storage_path", externalPolicy.document_storage_path).eq("document_type", "policy_copy").maybeSingle<{ id: string; file_name: string }>()).data
          : null)
      : null;
  const policyCopy = policyDocument
    ? {
        fileName: policyDocument.file_name,
        signedUrl: claim.policy_id ? `/policies/documents/${policyDocument.id}/open` : `/customers/documents/${policyDocument.id}/open`,
        documentId: policyDocument.id
      }
    : null;

  const stageVerifications = (stageRows ?? [])
    .filter((row) => row.details?.verification_type === "spot_survey_document")
    .map((row): SpotSurveyVerification => {
      const details = row.details ?? {};
      const documentId = typeof details.document_id === "string" ? details.document_id : null;
      const documentType = typeof details.document_type === "string" ? details.document_type : "Document";
      return {
        id: `stage-${row.id}`,
        claim_id: row.claim_id,
        document_id: documentId,
        document_type: documentType,
        verification_type: verificationTypeFromDocument(documentType),
        incident_date: typeof details.incident_date === "string" ? details.incident_date : claimForVerification.accident_at,
        is_valid: details.is_valid !== false,
        invalid_reason: typeof details.invalid_reason === "string" ? details.invalid_reason : null,
        details,
        created_at: row.created_at
      };
    });

  const surveyorDetails = extractSurveyorDetails(stageRows ?? []);
  const mergedVerifications = [...(verificationRows ?? []), ...stageVerifications];
  const spotDetails = readInternalSpotIntimationDetails(stageRows ?? [], claim);
  const claimWithSpotIntimation = {
    ...claimForVerification,
    spotIntimationAt: spotDetails.spot_intimation_at,
    spotDetails
  };
  const finalRows: FinalDocumentRowV2[] = finalDocumentDefinitions.map((document, index) => {
    const uploaded = (documents ?? []).find((item) => matchesClaimIntimationDocument(item.document_type ?? "", document.type) && item.verification_status !== "rejected");
    return {
      sr: index + 1,
      groupIndex: document.groupIndex,
      groupSr: document.groupSr,
      type: document.type,
      name: document.name,
      documentId: uploaded?.id ?? null,
      fileName: uploaded?.file_name ?? null,
      viewUrl: uploaded?.id ? `/claim-documents/${uploaded.id}/open` : null,
      status: uploaded?.verification_status === "verified" ? "Verified" : uploaded ? "Uploaded" : "Pending"
    };
  });
  const dealershipDetails = extractDealershipDetails(stageRows ?? []);
  const backHref = "/claims";
  const title = `Documents Verification - ${claimForVerification.claim_no}${claimForVerification.insurer_claim_no ? ` / ${claimForVerification.insurer_claim_no}` : ""}`;

  if (claim.claim_service_mode === "self_managed") {
    const { data: milestoneRows } = await admin
      .from("claim_milestones")
      .select("milestone_key, milestone_status")
      .eq("claim_id", id)
      .order("created_at", { ascending: true })
      .returns<Array<{ milestone_key: string; milestone_status: string }>>();

    return (
      <ClaimManagerShell title={`Assistance Review - ${claim.claim_no}`} backHref={backHref}>
        <AssistanceIntakePanel
          claimId={claim.id}
          claimNo={claim.claim_no}
          currentStatus={claim.current_status}
          assistanceStatus={claim.assistance_status}
          assistanceNote={claim.assistance_notes}
          customerName={claim.customers?.company_name || claim.customers?.contact_name || "-"}
          vehicleNo={claim.vehicles?.vehicle_no ?? "-"}
          documents={signedDocs.map((document) => ({
            id: document.id,
            documentType: document.document_type ?? "Document",
            fileName: document.file_name,
            verificationStatus: document.verification_status,
            openUrl: document.signedUrl ?? "#",
          }))}
          milestones={(milestoneRows ?? []).map((milestone) => ({ key: milestone.milestone_key, status: milestone.milestone_status }))}
        />
      </ClaimManagerShell>
    );
  }

  return (
    <ClaimManagerShell title={title} backHref={backHref}>
      <SpotClaimHeader claim={{ ...claimWithSpotIntimation, policySource: externalPolicy ? "external" : "sibl", policyCopy }} />
      <OperationsClaimStages
        claimId={claim.id}
        currentStatus={claim.current_status}
        insurerClaimNo={claim.insurer_claim_no}
        details={stageRows ?? []}
        accidentAt={claim.accident_at}
        spotIntimationAt={claimWithSpotIntimation.spotIntimationAt}
        spotDetails={spotDetails}
        spotContent={<SpotSurveyWorkspace claim={{ ...claimWithSpotIntimation, policySource: externalPolicy ? "external" : "sibl", policyCopy }} documents={signedDocs} verifications={mergedVerifications} surveyorDetails={surveyorDetails} showContext={false} showSpotDetails={false} />}
        claimIntimationContent={<FinalDocumentsWorkspaceV2 claimId={claim.id} rows={finalRows} dealershipDetails={dealershipDetails} />}
        initialStageKey={requestedStage}
      />
    </ClaimManagerShell>
  );
}

function extractSurveyorDetails(rows: StageDetailRow[]): SurveyorDetails | null {
  const row = rows.find((item) => item.details?.verification_type === "spot_surveyor_deputation");
  if (!row?.details) return null;
  const name = typeof row.details.surveyor_name === "string" ? row.details.surveyor_name : "";
  const mobile = typeof row.details.surveyor_number === "string" ? row.details.surveyor_number : "";
  const email = typeof row.details.surveyor_email === "string" ? row.details.surveyor_email : "";
  const deputedAt = typeof row.details.deputed_at === "string" ? row.details.deputed_at : row.created_at;
  if (!name && !mobile && !email) return null;
  return { name, mobile, email, deputedAt };
}

function extractDealershipDetails(rows: StageDetailRow[]): DealershipDetailsV2 | null {
  const row = rows.find((item) => item.details?.verification_type === "final_documents_dealership_details");
  if (!row?.details) return null;
  return {
    dealership_name: typeof row.details.dealership_name === "string" ? row.details.dealership_name : "",
    dealership_address: typeof row.details.dealership_address === "string" ? row.details.dealership_address : "",
    contact_person_name: typeof row.details.contact_person_name === "string" ? row.details.contact_person_name : "",
    contact_number: typeof row.details.contact_number === "string" ? row.details.contact_number : ""
  };
}

function verificationTypeFromDocument(documentType: string): "rc" | "insurance" | "document" | "detail" {
  const normalized = documentType.toLowerCase();
  if (normalized.includes("registration") || normalized.includes("rc")) return "rc";
  if (normalized.includes("policy") || normalized.includes("insurance")) return "insurance";
  return "document";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
