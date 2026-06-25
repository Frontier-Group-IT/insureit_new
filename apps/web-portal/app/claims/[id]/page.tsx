import { notFound } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { SpotSurveyWorkspace, type SpotSurveyClaim, type SpotSurveyDocument, type SpotSurveyVerification } from "@/components/spot-survey/spot-survey-workspace-v2";
import { createServerSupabaseClient } from "@/lib/auth-server";
import type { ClaimStatus } from "@/lib/claim-workflow";
import { operationsQueueForStatus } from "@/lib/claim-workflow";

type ClaimDetail = SpotSurveyClaim & {
  customer_id: string;
  current_status: ClaimStatus;
  accident_at: string | null;
  accident_description: string | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null; email: string | null } | null;
  vehicles: { vehicle_no: string; vehicle_type: string | null; make: string | null; model: string | null } | null;
  policies: { policy_no: string | null; policy_type: string | null; start_date: string | null; end_date: string | null } | null;
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
  created_at: string;
};

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: claim, error }, { data: documents }] = await Promise.all([
    supabase
      .from("claims")
      .select("id, claim_no, insurer_claim_no, customer_id, current_status, accident_at, accident_location, accident_description, estimated_loss, approved_amount, settlement_amount, updated_at, created_at, customers(company_name, contact_name, phone, email), vehicles(vehicle_no, vehicle_type, make, model), policies(policy_no, policy_type, start_date, end_date), insurance_companies(name, contact_email, contact_phone)")
      .eq("id", id)
      .maybeSingle<ClaimDetail>(),
    supabase
      .from("claim_documents")
      .select("id, document_type, file_name, storage_bucket, storage_path, verification_status, rejection_reason, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .returns<ClaimDocument[]>()
  ]);

  if (error || !claim) notFound();

  const signedDocs: SpotSurveyDocument[] = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
    return { ...document, signedUrl: data?.signedUrl ?? null };
  }));

  const [{ data: verificationRows }, { data: stageRows }] = await Promise.all([
    supabase
      .from("claim_document_verifications")
      .select("id, claim_id, document_id, document_type, verification_type, incident_date, is_valid, invalid_reason, details, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .returns<SpotSurveyVerification[]>(),
    supabase
      .from("claim_stage_details")
      .select("id, claim_id, details, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false })
      .returns<StageDetailRow[]>()
  ]);

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
        incident_date: typeof details.incident_date === "string" ? details.incident_date : claim.accident_at,
        is_valid: details.is_valid !== false,
        invalid_reason: typeof details.invalid_reason === "string" ? details.invalid_reason : null,
        details,
        created_at: row.created_at
      };
    });

  const mergedVerifications = [...(verificationRows ?? []), ...stageVerifications];
  const queue = operationsQueueForStatus(claim.current_status);
  const backHref = queue ? `/claims?queue=${queue.key}` : "/claims";
  const title = `Documents Verification - ${claim.claim_no}${claim.insurer_claim_no ? ` / ${claim.insurer_claim_no}` : ""}`;

  return (
    <ClaimManagerShell title={title} backHref={backHref}>
      <SpotSurveyWorkspace claim={claim} documents={signedDocs} verifications={mergedVerifications} />
    </ClaimManagerShell>
  );
}

function verificationTypeFromDocument(documentType: string): "rc" | "insurance" | "document" | "detail" {
  const normalized = documentType.toLowerCase();
  if (normalized.includes("registration") || normalized.includes("rc")) return "rc";
  if (normalized.includes("policy") || normalized.includes("insurance")) return "insurance";
  return "document";
}
