import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";
import { requestN8nPolicyIntakeExtraction } from "@/lib/policy-intake-n8n-bridge";
import type { PolicyIntakeOcrResult } from "@/lib/policy-intake-ocr-service";

export type PolicyIntakeLegacyExtractor = () => Promise<PolicyIntakeOcrResult>;

/**
 * Opt-in, per-intake n8n routing for BOTH Operations and Partner Policy Intake.
 * This helper is called only after the existing authenticated intake was created
 * and its uploaded document read from the protected policy-documents bucket.
 * It neither assigns reviewers nor creates/updates database records.
 */
export async function extractPolicyIntakeWithN8nFallback(
  intakeId: string,
  storagePath: string,
  file: File,
  extractWithExistingGoogle: PolicyIntakeLegacyExtractor,
): Promise<PolicyIntakeOcrResult> {
  const rawMode = process.env.INSUREIT_N8N_OCR_MODE;
  const mode = rawMode === "shadow" || rawMode === "prefer" ? rawMode : "off";
  // Never route any record unless its UUID was explicitly approved.
  const allowed = new Set((process.env.INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS ?? "")
    .split(",").map((v) => v.trim()).filter(Boolean));
  if (mode === "off" || !allowed.has(intakeId) ||
      file.type !== "application/pdf" || !file.size || file.size > 15 * 1024 * 1024) {
    return extractWithExistingGoogle();
  }

  // Native text detection costs no external API fee. Scanned/non-3005 formats
  // continue using the existing Google Document AI + layout parsing pipeline.
  let candidate = false;
  try {
    const pages = await extractNativePdfTextPages(new Uint8Array(await file.arrayBuffer()));
    const head = pages.slice(0, 3).map((p) => p.text).join("\n");
    candidate = /ICICI\s+LOMBARD/i.test(head) && /Product\s+Code\s*:?\s*3005\b/i.test(head);
  } catch {
    // Unreadable/native-text-free documents must keep the existing OCR fallback.
  }
  if (!candidate) return extractWithExistingGoogle();

  const admin = createSupabaseAdminClient();
  const loadCurrent = async () => {
    const [intakeResult, documentResult] = await Promise.all([
      admin.from("policy_intake_requests").select("status,policy_type,storage_bucket,storage_path")
        .eq("id", intakeId).maybeSingle<{
          status: string; policy_type: string | null; storage_bucket: string; storage_path: string;
        }>(),
      admin.from("policy_intake_documents").select("id,storage_bucket,storage_path")
        .eq("intake_id", intakeId).eq("is_current", true).maybeSingle<{
          id: string; storage_bucket: string; storage_path: string;
        }>(),
    ]);
    if (intakeResult.error || documentResult.error) return null;
    const intake = intakeResult.data, document = documentResult.data;
    if (!intake || !document || intake.status !== "processing" ||
        intake.policy_type !== "motor" || intake.storage_path !== storagePath ||
        intake.storage_bucket !== "policy-documents" ||
        document.storage_path !== storagePath || document.storage_bucket !== intake.storage_bucket) return null;
    return document.id;
  };
  const documentId = await loadCurrent();
  if (!documentId) {
    // Fail closed on changed or missing source documents; never OCR an old copy.
    return { ok: false, error: "The current Policy Intake document changed. Refresh and retry." };
  }

  let n8n: PolicyIntakeOcrResult | null = null;
  let stale = false;
  try {
    const result = await requestN8nPolicyIntakeExtraction({
      intakeId, documentId, requestId: crypto.randomUUID(), file,
    });
    if (await loadCurrent() !== documentId) stale = true;
    else n8n = { ok: true, fields: result.fields,
      warnings: result.warnings, parserId: result.parserId, parserVersion: result.parserVersion };
  } catch {
    // No identifiers, customer data, token, document text or raw errors in logs.
    console.info("[policy-intake-n8n] bridge unavailable; existing OCR fallback retained");
  }
  if (stale) return { ok: false, error: "The Policy Intake document was replaced during OCR." };

  if (mode === "prefer" && n8n?.ok) return n8n;

  const original = await extractWithExistingGoogle();
  if (mode === "shadow") {
    const oldFields = original.ok ? new Map(original.fields.map((v) => [v.key, v.value.trim()])) : new Map();
    const compared = n8n?.ok ? n8n.fields.filter((v) => oldFields.has(v.key)) : [];
    const mismatches = compared.filter((v) => oldFields.get(v.key) !== v.value.trim()).length;
    console.info("[policy-intake-n8n] shadow comparison", {
      n8nValidated: Boolean(n8n?.ok),
      googleSucceeded: original.ok,
      comparedFieldCount: compared.length,
      mismatchCount: mismatches,
    });
  }
  return original;
}
