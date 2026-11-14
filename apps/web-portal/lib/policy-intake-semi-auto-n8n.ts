import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";
import { requestN8nPolicyIntakeExtraction, type N8nOcrField } from "@/lib/policy-intake-n8n-bridge";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";

const BUCKET = "policy-documents";
const MAX_BYTES = 15 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["processing", "ready_for_review", "in_review", "needs_attention"]);

type Intake = {
  id: string; intake_number: string; status: string; policy_type: string | null;
  ocr_status: string; ocr_fields: N8nOcrField[] | null; created_at: string;
  storage_bucket: string; storage_path: string; file_name: string; mime_type: string | null;
};
type Document = {
  id: string; storage_bucket: string; storage_path: string;
  file_name: string; mime_type: string | null;
};
type SourceSnapshot = { intake: Intake; document: Document };

export type SemiAutoN8nPreview = {
  documentId: string;
  fingerprint: string;
  fields: N8nOcrField[];
  changedFieldCount: number;
  warnings: string[];
  canApply: boolean;
};
export type SemiAutoN8nResult =
  | { ok: true; preview: SemiAutoN8nPreview }
  | { ok: false; error: string };
export type SemiAutoN8nApplyResult = { ok: boolean; error?: string };

export function semiAutoN8nEnabledForIntake(intakeId: string): boolean {
  const mode = process.env.INSUREIT_N8N_OCR_MODE;
  if (mode !== "shadow" && mode !== "prefer") return false;
  if (!UUID.test(intakeId)) return false;
  const allowlist = (process.env.INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS ?? "")
    .split(",").map(value => value.trim()).filter(UUID.test.bind(UUID));
  return allowlist.includes(intakeId);
}

export function semiAutoN8nApplyEnabled(): boolean {
  return process.env.INSUREIT_N8N_OCR_MODE === "prefer"
    && process.env.INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY === "true";
}

async function currentSnapshot(id: string): Promise<SourceSnapshot | null> {
  const admin = createSupabaseAdminClient();
  const [record, copy] = await Promise.all([
    admin.from("policy_intake_requests")
      .select("id,intake_number,status,policy_type,ocr_status,ocr_fields,created_at,storage_bucket,storage_path,file_name,mime_type")
      .eq("id", id).maybeSingle<Intake>(),
    admin.from("policy_intake_documents")
      .select("id,storage_bucket,storage_path,file_name,mime_type")
      .eq("intake_id", id).eq("is_current", true).maybeSingle<Document>(),
  ]);
  if (record.error || copy.error || !record.data || !copy.data) return null;
  const intake = record.data, document = copy.data;
  if (intake.policy_type !== "motor" || !ALLOWED_STATUSES.has(intake.status)
      || intake.storage_bucket !== BUCKET || document.storage_bucket !== BUCKET
      || !intake.storage_path || intake.storage_path !== document.storage_path
      || document.mime_type !== "application/pdf" || intake.mime_type !== "application/pdf") {
    return null;
  }
  return { intake, document };
}

function fingerprint(id: string, documentId: string, fields: N8nOcrField[], warnings: string[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ intakeId: id, documentId, fields, warnings }))
    .digest("hex");
}

export async function previewSemiAutoN8nExtraction(id: string): Promise<SemiAutoN8nResult> {
  if (!semiAutoN8nEnabledForIntake(id)) {
    return { ok: false, error: "n8n preview is not enabled for this Intake. Existing OCR and manual onboarding remain available." };
  }
  const snapshot = await currentSnapshot(id);
  if (!snapshot) return { ok: false, error: "The current Motor Intake PDF is unavailable, changed or no longer eligible." };
  const admin = createSupabaseAdminClient();
  const { data: blob, error } = await admin.storage.from(BUCKET).download(snapshot.document.storage_path);
  if (error || !blob || !blob.size || blob.size > MAX_BYTES) {
    return { ok: false, error: "The current PDF cannot be loaded or exceeds the 15 MB limit." };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return { ok: false, error: "The current document is not a valid PDF." };
  }
  try {
    const pages = await extractNativePdfTextPages(bytes);
    const text = pages.slice(0, 3).map(page => page.text).join("\n");
    if (!/ICICI\s+LOMBARD/i.test(text) || !/Product\s+Code\s*:?\s*3005\b/i.test(text)) {
      return { ok: false, error: "Only digitally readable ICICI Lombard Product 3005 PDFs are supported by this n8n pilot. Use the existing OCR workflow." };
    }
  } catch {
    return { ok: false, error: "This PDF has no supported native text. Use the existing Google OCR/manual review workflow." };
  }

  const file = new File([bytes], snapshot.document.file_name || snapshot.intake.file_name, { type: "application/pdf" });
  let extraction;
  try {
    extraction = await requestN8nPolicyIntakeExtraction({
      intakeId: id, documentId: snapshot.document.id, requestId: randomUUID(), file,
    });
  } catch {
    // Never return credentials, document text, or raw downstream error bodies.
    return { ok: false, error: "n8n extraction is unavailable or could not be validated. No Intake data was changed." };
  }
  const current = await currentSnapshot(id);
  if (!current || current.document.id !== snapshot.document.id
      || current.intake.storage_path !== snapshot.intake.storage_path
      || current.intake.status !== snapshot.intake.status
      || current.intake.ocr_status !== snapshot.intake.ocr_status
      || JSON.stringify(current.intake.ocr_fields ?? []) !== JSON.stringify(snapshot.intake.ocr_fields ?? [])) {
    return { ok: false, error: "The Intake, OCR output or its current document changed during extraction. Refresh and retry." };
  }
  const existing = new Map((snapshot.intake.ocr_fields ?? []).map(field => [field.key, field.value]));
  const changedFieldCount = extraction.fields.filter(field => existing.get(field.key) !== field.value).length;
  let canApply = extraction.warnings.length === 0 && semiAutoN8nApplyEnabled()
    && current.intake.status === "processing"
    && current.intake.ocr_status === "failed"
    && (current.intake.ocr_fields ?? []).length === 0;
  if (canApply) {
    const savedDraft = await admin.from("policy_intake_onboarding_drafts")
      .select("intake_id").eq("intake_id", id).limit(1);
    canApply = !savedDraft.error && (savedDraft.data?.length ?? 0) === 0;
  }
  return { ok: true, preview: {
    documentId: current.document.id,
    fingerprint: fingerprint(id, current.document.id, extraction.fields, extraction.warnings),
    fields: extraction.fields,
    changedFieldCount,
    warnings: extraction.warnings,
    canApply,
  } };
}

/**
 * Explicit operator-confirmed action. Never trusts client-supplied OCR fields,
 * re-extracts against the current private copy and compares the reviewed hash.
 * Only failed, empty-OCR processing Intakes are recoverable by this first pilot.
 * Existing drafts, completed policies and review assignments are never changed.
 */
export async function applySemiAutoN8nExtraction(
  id: string, expectedDocumentId: string, expectedFingerprint: string,
): Promise<SemiAutoN8nApplyResult> {
  if (!semiAutoN8nEnabledForIntake(id) || !semiAutoN8nApplyEnabled()
      || !UUID.test(expectedDocumentId) || !/^[0-9a-f]{64}$/i.test(expectedFingerprint)) {
    return { ok: false, error: "n8n application is not enabled or the preview has expired." };
  }
  const snapshot = await currentSnapshot(id);
  if (!snapshot || snapshot.document.id !== expectedDocumentId
      || snapshot.intake.status !== "processing" || snapshot.intake.ocr_status !== "failed"
      || (snapshot.intake.ocr_fields ?? []).length > 0) {
    return { ok: false, error: "Only a failed, unchanged Motor OCR Intake with no existing extracted fields can be recovered here." };
  }
  const admin = createSupabaseAdminClient();
  const savedDraft = await admin.from("policy_intake_onboarding_drafts")
    .select("intake_id").eq("intake_id", id).limit(1);
  if (savedDraft.error || (savedDraft.data?.length ?? 0) > 0) {
    return { ok: false, error: "An onboarding draft already exists or could not be verified. Open and correct it through the canonical Policy Intake workflow." };
  }
  const parsed = await previewSemiAutoN8nExtraction(id);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.preview.warnings.length > 0) {
    return { ok: false, error: "n8n reported extraction warnings. Verify and correct this policy through the existing onboarding workflow." };
  }
  if (parsed.preview.documentId !== expectedDocumentId
      || parsed.preview.fingerprint !== expectedFingerprint || !parsed.preview.canApply) {
    return { ok: false, error: "The recovered PDF fields changed after preview. Recheck them before applying." };
  }

  // This shared register duplicate check also catches earlier Intake entries.
  // Fail closed instead of adding a new actionable duplicate.
  const duplicate = await loadPolicyIntakeDuplicateMatches(admin, [{
    id, intake_number: snapshot.intake.intake_number, status: snapshot.intake.status,
    created_at: snapshot.intake.created_at, ocr_fields: parsed.preview.fields,
  }]);
  if (!duplicate.ok || duplicate.matches.has(id)) {
    return { ok: false, error: "This policy is a duplicate or duplicate verification is unavailable. Resolve it in Policy Intake." };
  }

  const finalSource = await currentSnapshot(id);
  if (!finalSource || finalSource.document.id !== expectedDocumentId
      || finalSource.intake.storage_path !== snapshot.intake.storage_path
      || finalSource.intake.status !== "processing" || finalSource.intake.ocr_status !== "failed"
      || (finalSource.intake.ocr_fields ?? []).length > 0) {
    return { ok: false, error: "The source document or Intake changed. No recovered fields were saved." };
  }

  // Handoff/draft creation may race with the remote PDF extraction. Never
  // replace OCR under a draft created after the initial preflight.
  const lastDraft = await admin.from("policy_intake_onboarding_drafts")
    .select("intake_id").eq("intake_id", id).limit(1);
  if (lastDraft.error || (lastDraft.data?.length ?? 0) > 0) {
    return { ok: false, error: "An onboarding draft was created while extraction was running. Open and correct the existing draft instead." };
  }

  const { data, error } = await admin.from("policy_intake_requests")
    .update({
      status: "ready_for_review", ocr_status: "completed",
      ocr_fields: parsed.preview.fields,
      ocr_parser_id: "icici_3005_n8n_native_pdf",
      ocr_parser_version: "bridge-v1",
      ocr_warnings: parsed.preview.warnings,
      attention_reason: null,
    })
    .eq("id", id).eq("status", "processing").eq("ocr_status", "failed")
    .eq("storage_bucket", BUCKET).eq("storage_path", finalSource.document.storage_path)
    .select("id").maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: "The Intake changed before the validated fields could be saved. Refresh the page." };
  return { ok: true };
}
