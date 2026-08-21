"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { extractPolicyDocument } from "./policy-ocr-actions";

type OptionalNumericField =
  | "idv"
  | "od_premium"
  | "tp_premium"
  | "cpa_premium"
  | "printed_net_premium"
  | "printed_gst"
  | "printed_gross_premium";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numeric(formData: FormData, key: OptionalNumericField) {
  const value = text(formData, key);
  if (value === null) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function savePolicyOcrTrainingLabel(formData: FormData) {
  const reviewer = await requireCapability("manage_system", "approve");
  if (!reviewer) return;

  const documentId = text(formData, "policy_document_id");
  if (!documentId) throw new Error("Policy document reference is missing.");

  const status = text(formData, "status");
  if (status !== "needs_review" && status !== "approved" && status !== "rejected") {
    throw new Error("Invalid training label status.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("policy_ocr_training_labels").upsert({
    policy_document_id: documentId,
    insurer_name: text(formData, "insurer_name"),
    policy_product: text(formData, "policy_product"),
    policy_number: text(formData, "policy_number"),
    valid_from: text(formData, "valid_from"),
    valid_upto: text(formData, "valid_upto"),
    idv: numeric(formData, "idv"),
    od_premium: numeric(formData, "od_premium"),
    tp_premium: numeric(formData, "tp_premium"),
    cpa_opted: text(formData, "cpa_opted") === "yes",
    cpa_premium: numeric(formData, "cpa_premium"),
    printed_net_premium: numeric(formData, "printed_net_premium"),
    printed_gst: numeric(formData, "printed_gst"),
    printed_gross_premium: numeric(formData, "printed_gross_premium"),
    evidence_note: text(formData, "evidence_note"),
    status,
    reviewed_by: reviewer.id,
    reviewed_at: status === "needs_review" ? null : new Date().toISOString(),
  }, { onConflict: "policy_document_id" });

  if (error) throw new Error("Could not save the OCR training label.");
  revalidatePath("/policies/ocr-training");
}

export async function autoReadPolicyOcrTrainingLabel(formData: FormData) {
  const reviewer = await requireCapability("manage_system", "approve");
  if (!reviewer) return;

  const documentId = text(formData, "policy_document_id");
  if (!documentId) throw new Error("Policy document reference is missing.");

  const admin = createSupabaseAdminClient();
  const { data: document, error: documentError } = await admin
    .from("policy_documents")
    .select("id, file_name, storage_bucket, storage_path, mime_type")
    .eq("id", documentId)
    .eq("document_type", "policy_copy")
    .maybeSingle();
  if (documentError || !document) throw new Error("Could not load the policy copy.");

  const { data: blob, error: downloadError } = await admin.storage
    .from(document.storage_bucket)
    .download(document.storage_path);
  if (downloadError || !blob) throw new Error("Could not download the private policy copy.");

  const file = new File([blob], document.file_name, { type: document.mime_type || blob.type || "application/pdf" });
  const ocrData = new FormData();
  ocrData.set("policy_document", file);
  const result = await extractPolicyDocument(ocrData);
  if (!result.ok) throw new Error(result.error);

  const fields = new Map(result.fields.map((field) => [field.key, field.value]));
  const value = (key: string) => fields.get(key) ?? null;
  const { error: saveError } = await admin.from("policy_ocr_training_labels").upsert({
    policy_document_id: documentId,
    insurer_name: value("insurer_name"),
    policy_product: value("policy_product"),
    policy_number: value("policy_number"),
    valid_from: value("policy_start_date"),
    valid_upto: value("policy_end_date"),
    idv: numericValue(value("idv")),
    od_premium: numericValue(value("od_premium")),
    tp_premium: numericValue(value("tp_premium")),
    cpa_opted: value("cpa_opted")?.toLowerCase() === "yes",
    cpa_premium: numericValue(value("cpa_premium")),
    printed_net_premium: numericValue(value("total_premium")),
    printed_gst: numericValue(value("tax_amount")),
    printed_gross_premium: numericValue(value("gross_premium")),
    evidence_note: result.fields.map((field) => `${field.label}: ${field.evidence}`).join(" | ").slice(0, 4000),
    status: "needs_review",
    reviewed_by: reviewer.id,
    reviewed_at: null,
  }, { onConflict: "policy_document_id" });

  if (saveError) throw new Error("Could not save the OCR proposal.");
  revalidatePath("/policies/ocr-training");
}

function numericValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replaceAll(",", "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
