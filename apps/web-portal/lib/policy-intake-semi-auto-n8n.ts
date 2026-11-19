import "server-only";
import type { PolicyIssuanceDateEvidence } from "@/lib/policy-issuance-signature-evidence";

import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createCurrentIntakePdfSignedSource } from "@/lib/policy-intake-n8n-signed-source";
import { segregatePolicyIntakeLanes } from "@/lib/policy-ocr-routing-mode";
import { requestN8nPolicyIntakeBySignedSource, type N8nOcrField, type N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-bridge";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";

const BUCKET = "policy-documents";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["processing", "ready_for_review", "in_review", "needs_attention"]);

type Intake = {
  id: string; intake_number: string; status: string; policy_type: string | null;
  processing_lane?: "manual" | "automation";
  ocr_status: string; ocr_fields: N8nOcrField[] | null; created_at: string;
  storage_bucket: string; storage_path: string; file_name: string; mime_type: string | null;
};
type Document = {
  id: string; storage_bucket: string; storage_path: string;
  file_name: string; mime_type: string | null;
};
type SourceSnapshot = { intake: Intake; document: Document };

export type SemiAutoN8nChangedField = {
  key: string; label: string; kind: "new" | "different";
  previousValue: string | null; extractedValue: string;
  evidence: string; page: number | null;
};
export type SemiAutoN8nPreview = {
  documentId: string;
  fingerprint: string;
  fields: N8nOcrField[];
  parserId: string;
  parserVersion: string;
  changedFieldCount: number;
  changedFields: SemiAutoN8nChangedField[];
  premium: N8nVerifiedPremiumBreakdown;
  checksPassed: number;
  warnings: string[];
  canApply: boolean;
  issuanceEvidence?: PolicyIssuanceDateEvidence;
  savedDraftIssueDate?: { value:string; revision:number };
};
export type SemiAutoN8nResult =
  | { ok: true; preview: SemiAutoN8nPreview }
  | { ok: false; error: string; reason?: "untrained_or_unverified" | "unavailable"; diagnosticCode?: string };
export type SemiAutoN8nApplyResult = { ok: boolean; error?: string };

/**
 * Only the AI Policy Onboarding workbench switches to n8n-first review.
 * The upstream Operations/Partner upload pipelines retain their own rollout
 * flags; enabling this does not rewrite, book, or auto-extract other Intakes.
 */
export function isN8nWorkbenchPrimary(): boolean {
  return process.env.INSUREIT_N8N_WORKBENCH_PRIMARY === "true"
    && process.env.INSUREIT_N8N_OCR_MODE === "shadow";
}

export function semiAutoN8nEnabledForIntake(intakeId: string): boolean {
  const mode = process.env.INSUREIT_N8N_OCR_MODE;
  if (mode !== "shadow" && mode !== "prefer" && mode !== "required") return false;
  if (!UUID.test(intakeId)) return false;
  if (isN8nWorkbenchPrimary()) return true;
  // Deliberate read-only workbench scope: every open Motor Intake may be
  // previewed in shadow mode. The parser must still verify the actual PDF.
  // This does not enable authoritative OCR or any failed-OCR apply action.
  if (mode === "shadow" && process.env.INSUREIT_N8N_OCR_PREVIEW_ALL_MOTOR === "true") return true;
  if (mode === "required" && process.env.INSUREIT_N8N_OCR_ALL_MOTOR === "true") return true;
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
      .select("id,intake_number,status,policy_type,processing_lane,ocr_status,ocr_fields,created_at,storage_bucket,storage_path,file_name,mime_type")
      .eq("id", id).maybeSingle<Intake>(),
    admin.from("policy_intake_documents")
      .select("id,storage_bucket,storage_path,file_name,mime_type")
      .eq("intake_id", id).eq("is_current", true).maybeSingle<Document>(),
  ]);
  if (record.error || copy.error || !record.data || !copy.data) return null;
  const intake = record.data, document = copy.data;
  if ((segregatePolicyIntakeLanes() && intake.processing_lane!=="automation")
      || (intake.policy_type !== null
      && !["motor", "non_motor", "life", "health"].includes(intake.policy_type))
      || !ALLOWED_STATUSES.has(intake.status)
      || intake.storage_bucket !== BUCKET || document.storage_bucket !== BUCKET
      || !intake.storage_path || intake.storage_path !== document.storage_path
      || document.mime_type !== "application/pdf" || intake.mime_type !== "application/pdf") {
    return null;
  }
  return { intake, document };
}

function fingerprint(
  id: string, documentId: string, fields: N8nOcrField[], warnings: string[],
  premium: N8nVerifiedPremiumBreakdown,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ intakeId: id, documentId, fields, warnings, premium }))
    .digest("hex");
}

export async function previewSemiAutoN8nExtraction(id: string): Promise<SemiAutoN8nResult> {
  if (!semiAutoN8nEnabledForIntake(id)) {
    return { ok: false, error: "n8n processing is not enabled for this Intake." };
  }
  const snapshot = await currentSnapshot(id);
  if (!snapshot) return { ok: false, error: "The current Intake PDF is unavailable, changed or not eligible for extraction." };
  // The portal validates the current version and grants a short-lived link,
  // but never downloads or forwards the PDF bytes to n8n. n8n fetches it.
  const admin = createSupabaseAdminClient();
  let extraction;
  try {
    const source = await createCurrentIntakePdfSignedSource(
      id, snapshot.document.id, snapshot.document.storage_path,
    );
    extraction = await requestN8nPolicyIntakeBySignedSource({
      intakeId: id, documentId: source.documentId,
      requestId: randomUUID(), signedUrl: source.signedUrl,
    });
  } catch (error) {
    // A failed n8n validation is not a reason to invoke legacy Google OCR.
    // Report the unsupported/unverified layout without leaking PDF text,
    // signed URLs, customer data or raw remote errors.
    const code = error instanceof Error ? error.message : "";
    // A policy whose parser ran but failed a strict response check is not
    // necessarily a new/untrained insurer. Surface only the safe validation
    // code (never raw PDF text, signed URLs, headers, or n8n responses).
    const parserValidationCodes=new Set([
      "n8n_review_required","n8n_financial_validation_failed",
      "n8n_wrong_policy_product","n8n_required_field_missing",
      "n8n_premium_breakdown_missing","n8n_premium_reconciliation_failed",
      "n8n_coverage_dates_invalid","n8n_od_reference_missing",
      "n8n_fields_invalid","n8n_field_shape_invalid",
      "n8n_issuance_date_invalid",
    ]);
    if(parserValidationCodes.has(code)) {
      console.error("[ai-policy] rejected n8n validation",{code});
      return { ok: false, reason: "untrained_or_unverified",
        diagnosticCode:code,
        error:"The n8n parser response failed a strict policy verification check ("+code+"). Check its policy variant, premiums, issue date and extracted fields; no old OCR fallback or booking was performed." };
    }
    // Only known, safe error codes are exposed. Never show signed URLs,
    // response bodies or private PDF content in an operator-facing error.
    const problem =
      ["n8n_current_pdf_not_eligible", "n8n_current_document_unavailable",
       "n8n_pdf_reference_invalid", "n8n_pdf_download_authorization_failed",
       "n8n_signed_pdf_origin_invalid", "n8n_signed_source_invalid"].includes(code)
        ? "The current private PDF reference or signed access could not be validated. Check the linked document in Policy Intake."
      : ["n8n_bridge_not_configured", "n8n_webhook_url_not_allowed"].includes(code)
        ? "The portal's n8n bridge configuration is unavailable or invalid. Contact the portal administrator."
      : code === "n8n_bridge_http_failure_401" || code === "n8n_bridge_http_failure_403"
        ? "n8n rejected the portal webhook credentials (HTTP " + code.slice(-3) + "). The n8n Header Auth credential and portal connection must be reconciled by an administrator."
      : code === "n8n_bridge_http_failure_404" || code === "n8n_bridge_http_failure_405"
        ? "n8n did not recognize the configured production webhook (HTTP " + code.slice(-3) + "). Verify the workflow is active and the POST webhook path is published."
      : code === "n8n_bridge_http_failure_429"
        ? "n8n is rate-limiting incoming requests (HTTP 429). Stop bulk conversion and verify n8n capacity before explicitly retrying."
      : ["n8n_bridge_http_failure_500","n8n_bridge_http_failure_502",
         "n8n_bridge_http_failure_503","n8n_bridge_http_failure_504"].includes(code)
        ? "The n8n service or workflow failed (HTTP " + code.slice(-3) + "). Stop bulk conversion and inspect workflow health before retrying."
      : code.startsWith("n8n_bridge_http_failure_")
        ? "The n8n webhook returned HTTP " + code.slice(-3) + ". Stop the batch and inspect the production n8n connection before retrying."
      : code === "n8n_bridge_http_failure"
        ? "The n8n webhook returned an unsuccessful response. Check workflow availability before retrying."
      : code === "n8n_issuance_date_invalid"
        ? "The n8n response contained an invalid policy issuance date. Review the parser's printed-date extraction."
      : code === "AbortError" || (error instanceof Error && error.name === "AbortError")
        ? "The n8n PDF processing request timed out. The saved OCR is still available below."
        : "n8n could not complete the current PDF re-extraction or response validation. Check the n8n workflow logs.";
    console.error("[ai-policy] n8n re-extraction failed", {code: code.slice(0,80) || "unknown"});
    return { ok: false, reason: "unavailable",
      error: problem + " No old OCR fallback, Intake update or booking was performed." };
  }
  // The only currently validated n8n parser is for Motor ICICI 3005.
  // A mismatched, explicitly Non-Motor/Life/Health Intake must never be
  // represented as a verified business-line extraction, even if its PDF
  // coincidentally contains similar identifiers.
  if (snapshot.intake.policy_type !== null && snapshot.intake.policy_type !== "motor") {
    return { ok: false, reason: "untrained_or_unverified",
      error: "This Intake belongs to an untrained policy category. n8n has retrieved the private PDF, but a policy-type-specific parser is required before its fields can be accepted. No Google OCR fallback or booking was performed." };
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
  // The previous UI reported only a number. Return the exact differences,
  // including the old value, to the *same authorized* reviewer for comparison.
  // This does not persist either extraction or modify canonical OCR fields.
  const changedFields: SemiAutoN8nChangedField[] = extraction.fields.flatMap(field => {
    const previous = existing.get(field.key);
    if (previous === field.value) return [];
    return [{
      key: field.key, label: field.label,
      kind: previous === undefined ? "new" as const : "different" as const,
      previousValue: previous ?? null, extractedValue: field.value,
      evidence: field.evidence, page: field.page,
    }];
  });
  const changedFieldCount = changedFields.length;
  let canApply = current.intake.policy_type === "motor"
    && !isN8nWorkbenchPrimary()
    && extraction.warnings.length === 0 && semiAutoN8nApplyEnabled()
    && current.intake.status === "processing"
    && current.intake.ocr_status === "failed"
    && (current.intake.ocr_fields ?? []).length === 0;
  if (canApply) {
    const savedDraft = await admin.from("policy_intake_onboarding_drafts")
      .select("intake_id").eq("intake_id", id).limit(1);
    canApply = !savedDraft.error && (savedDraft.data?.length ?? 0) === 0;
  }
  // Existing manual issue dates must be displayed, not silently overwritten.
  const {data:reviewDraft}=await admin.from("policy_intake_onboarding_drafts")
    .select("draft_payload,revision").eq("intake_id",id)
    .maybeSingle<{draft_payload:{issuanceDate?:string}|null;revision:number}>();
  return { ok: true, preview: {
    documentId: current.document.id,
    fingerprint: fingerprint(id, current.document.id, extraction.fields, extraction.warnings, extraction.premium),
    fields: extraction.fields,
    parserId: extraction.parserId,
    parserVersion: extraction.parserVersion,
    changedFieldCount,
    changedFields,
    premium: extraction.premium,
    checksPassed: extraction.checksPassed,
    warnings: extraction.warnings,
    ...(extraction.issuanceEvidence?{issuanceEvidence:extraction.issuanceEvidence}:{}),
    ...(reviewDraft && typeof reviewDraft.draft_payload?.issuanceDate==="string"
      ? {savedDraftIssueDate:{value:reviewDraft.draft_payload.issuanceDate,revision:reviewDraft.revision}}:{}),
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
      || snapshot.intake.policy_type !== "motor"
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
      ocr_parser_id: parsed.preview.parserId,
      ocr_parser_version: parsed.preview.parserVersion,
      ocr_warnings: parsed.preview.warnings,
      attention_reason: null,
    })
    .eq("id", id).eq("status", "processing").eq("ocr_status", "failed")
    .eq("storage_bucket", BUCKET).eq("storage_path", finalSource.document.storage_path)
    .select("id").maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: "The Intake changed before the validated fields could be saved. Refresh the page." };
  return { ok: true };
}
