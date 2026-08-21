"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
