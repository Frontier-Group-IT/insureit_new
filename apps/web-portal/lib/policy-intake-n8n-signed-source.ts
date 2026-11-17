import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "policy-documents";
const EXPECTED_STORAGE_ORIGIN = "https://ilzhsfqqjyppzzvfscmh.supabase.co";
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 120;
const ELIGIBLE_STATUSES = new Set(["processing", "ready_for_review", "in_review", "needs_attention"]);
const SUPPORTED_INTAKE_TYPES = new Set(["motor", "non_motor", "life", "health"]);
// Legacy Intake rows may not have a policy_type; such rows are preview-only.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IntakeRow = {
  id: string; status: string; policy_type: string | null; storage_bucket: string;
  storage_path: string; mime_type: string | null;
};
type DocumentRow = {
  id: string; storage_bucket: string; storage_path: string;
  mime_type: string | null; file_size: number | null; is_current: boolean;
};

/**
 * The application owns Intake permissions. Call this function only after
 * its canonical per-Intake authorization. It never returns a URL to a client.
 *
 * n8n receives a 120-second bearer URL for exactly the currently linked PDF,
 * never an admin/service_role token or an unrestricted Storage credential.
 */
export async function createCurrentIntakePdfSignedSource(
  intakeId: string, expectedDocumentId?: string, expectedStoragePath?: string,
): Promise<{ documentId: string; signedUrl: string; storagePath: string }> {
  if (!UUID.test(intakeId) || (expectedDocumentId && !UUID.test(expectedDocumentId))) {
    throw new Error("n8n_pdf_reference_invalid");
  }

  const admin = createSupabaseAdminClient();
  const [current, latest] = await Promise.all([
    admin.from("policy_intake_requests")
      .select("id,status,policy_type,storage_bucket,storage_path,mime_type")
      .eq("id", intakeId).maybeSingle<IntakeRow>(),
    admin.from("policy_intake_documents")
      .select("id,storage_bucket,storage_path,mime_type,file_size,is_current")
      .eq("intake_id", intakeId).eq("is_current", true).maybeSingle<DocumentRow>(),
  ]);
  if (current.error || latest.error || !current.data || !latest.data) {
    throw new Error("n8n_current_document_unavailable");
  }
  const intake = current.data, document = latest.data;
  if (!ELIGIBLE_STATUSES.has(intake.status)
      || (intake.policy_type !== null && !SUPPORTED_INTAKE_TYPES.has(intake.policy_type))
      || !document.is_current || intake.storage_bucket !== BUCKET
      || document.storage_bucket !== BUCKET
      || !intake.storage_path || document.storage_path !== intake.storage_path
      || !intake.storage_path.startsWith(`intakes/${intakeId}/`)
      || intake.mime_type !== "application/pdf" || document.mime_type !== "application/pdf"
      || !Number.isSafeInteger(document.file_size) || document.file_size! <= 0
      || document.file_size! > MAX_PDF_BYTES
      || (expectedStoragePath && expectedStoragePath !== intake.storage_path)
      || (expectedDocumentId && expectedDocumentId !== document.id)) {
    throw new Error("n8n_current_pdf_not_eligible");
  }

  const signed = await admin.storage.from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error("n8n_pdf_download_authorization_failed");
  }

  const url = new URL(signed.data.signedUrl);
  if (url.origin !== EXPECTED_STORAGE_ORIGIN
      || !url.pathname.startsWith(`/storage/v1/object/sign/${BUCKET}/intakes/${intakeId}/`)
      || !url.searchParams.get("token") || url.hash || url.username || url.password) {
    throw new Error("n8n_signed_pdf_origin_invalid");
  }

  return { documentId: document.id, storagePath: document.storage_path, signedUrl: url.toString() };
}
