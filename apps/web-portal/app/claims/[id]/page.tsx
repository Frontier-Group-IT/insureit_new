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

  const { data: verificationRows } = await supabase
    .from("claim_document_verifications")
    .select("id, claim_id, document_id, document_type, verification_type, incident_date, is_valid, invalid_reason, details, created_at")
    .eq("claim_id", id)
    .order("created_at", { ascending: false })
    .returns<SpotSurveyVerification[]>();

  const queue = operationsQueueForStatus(claim.current_status);
  const backHref = queue ? `/claims?queue=${queue.key}` : "/claims";

  return (
    <ClaimManagerShell title="Spot Survey Verification" backHref={backHref}>
      <SpotSurveyWorkspace claim={claim} documents={signedDocs} verifications={verificationRows ?? []} />
    </ClaimManagerShell>
  );
}
