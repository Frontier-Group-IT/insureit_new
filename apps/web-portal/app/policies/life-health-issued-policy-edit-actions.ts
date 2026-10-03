"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type LifeHealthIssuedPolicyEditResult = { ok: true } | { ok: false; error: string };
export type LifeHealthPolicyCopyResult =
  | { ok: true; document: { id: string; fileName: string; viewUrl: string } | null }
  | { ok: false; error: string };

const DOCUMENT_BUCKET = "policy-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const clean = (value: unknown) => String(value ?? "").trim();
const amount = (value: unknown) => {
  const parsed = Number(clean(value).replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const safeFileName = (name: string) => name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "policy-copy";

async function validatePolicyCase(policyId: string, caseId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("life_health_cases")
    .select("id")
    .eq("id", caseId)
    .eq("final_policy_id", policyId)
    .maybeSingle<{ id: string }>();
  return { admin, valid: Boolean(data) };
}

function revalidateIssuedPolicy(policyId: string, caseId: string) {
  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}`);
  revalidatePath(`/policies/${policyId}/edit`);
  revalidatePath(`/policies/life-health-cases/${caseId}`);
}

export async function replaceIssuedLifeHealthPolicyCopy(formData: FormData): Promise<LifeHealthPolicyCopyResult> {
  const profile = await requirePolicyEditor();
  const policyId = clean(formData.get("policyId"));
  const caseId = clean(formData.get("caseId"));
  const file = formData.get("file");
  if (!policyId || !caseId) return { ok: false, error: "Policy edit reference is missing." };
  if (!(file instanceof File) || file.size <= 0) return { ok: false, error: "Choose a policy copy to upload." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Policy copy must be 50 MB or smaller." };
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { ok: false, error: "Upload a PDF, JPG, PNG or WebP policy copy." };

  const { admin, valid } = await validatePolicyCase(policyId, caseId);
  if (!valid) return { ok: false, error: "The linked Life/Health policy case is no longer available." };

  const { data: existing } = await admin.from("life_health_case_documents")
    .select("id,storage_bucket,storage_path")
    .eq("case_id", caseId)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();

  const fileName = file.name || "policy-copy";
  const storagePath = `life-health-cases/${caseId}/policy_copy/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "The policy copy could not be uploaded." };

  const values = {
    file_name: fileName,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: profile.id,
    updated_at: new Date().toISOString(),
  };
  let documentId = existing?.id || "";
  if (existing) {
    const { error } = await admin.from("life_health_case_documents").update(values).eq("id", existing.id);
    if (error) {
      await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      return { ok: false, error: "The policy copy record could not be updated." };
    }
    if (existing.storage_path && existing.storage_path !== storagePath) await admin.storage.from(existing.storage_bucket || DOCUMENT_BUCKET).remove([existing.storage_path]);
  } else {
    const { data, error } = await admin.from("life_health_case_documents").insert({ case_id: caseId, document_type: "policy_copy", ...values }).select("id").single<{ id: string }>();
    if (error || !data) {
      await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      return { ok: false, error: "The policy copy record could not be saved." };
    }
    documentId = data.id;
  }

  const { data: signed } = await admin.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 60 * 60);
  revalidateIssuedPolicy(policyId, caseId);
  return { ok: true, document: { id: documentId, fileName, viewUrl: signed?.signedUrl || "" } };
}

export async function deleteIssuedLifeHealthPolicyCopy(formData: FormData): Promise<LifeHealthPolicyCopyResult> {
  await requirePolicyEditor();
  const policyId = clean(formData.get("policyId"));
  const caseId = clean(formData.get("caseId"));
  if (!policyId || !caseId) return { ok: false, error: "Policy edit reference is missing." };

  const { admin, valid } = await validatePolicyCase(policyId, caseId);
  if (!valid) return { ok: false, error: "The linked Life/Health policy case is no longer available." };
  const { data: existing } = await admin.from("life_health_case_documents")
    .select("id,storage_bucket,storage_path")
    .eq("case_id", caseId)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
  if (!existing) return { ok: true, document: null };

  const { error } = await admin.from("life_health_case_documents").delete().eq("id", existing.id);
  if (error) return { ok: false, error: "The policy copy could not be removed." };
  if (existing.storage_path) await admin.storage.from(existing.storage_bucket || DOCUMENT_BUCKET).remove([existing.storage_path]);
  revalidateIssuedPolicy(policyId, caseId);
  return { ok: true, document: null };
}

export async function updateIssuedLifeHealthPolicy(formData: FormData): Promise<LifeHealthIssuedPolicyEditResult> {
  await requirePolicyEditor();
  const admin = createSupabaseAdminClient();
  const policyId = clean(formData.get("policyId"));
  const caseId = clean(formData.get("caseId"));
  const businessLine = clean(formData.get("businessLine"));
  const sourcingDate = clean(formData.get("sourcingDate"));
  const sourceId = clean(formData.get("sourceId"));
  const insurerId = clean(formData.get("insurerId"));
  const productName = clean(formData.get("productName"));
  const proposalNumber = clean(formData.get("proposalNumber")).toUpperCase();
  const ppt = clean(formData.get("ppt"));
  const pd = clean(formData.get("pd"));
  const paymentFrequency = clean(formData.get("paymentFrequency"));
  const paymentMode = clean(formData.get("paymentMode"));
  const premiumAmount = amount(formData.get("premiumAmount"));
  const startDate = clean(formData.get("startDate"));
  const endDate = clean(formData.get("endDate"));
  const finalPremium = amount(formData.get("finalPremium"));
  const sumInsuredRaw = clean(formData.get("sumInsured"));
  const sumInsured = sumInsuredRaw ? amount(sumInsuredRaw) : null;
  const remarks = clean(formData.get("remarks"));

  if (!policyId || !caseId) return { ok: false, error: "Policy edit reference is missing." };
  if (businessLine !== "Life" && businessLine !== "Health") return { ok: false, error: "Only Life and Health policies can use this editor." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourcingDate)) return { ok: false, error: "Enter a valid policy issuance date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { ok: false, error: "Enter valid policy start and end dates." };
  if (endDate < startDate) return { ok: false, error: "Policy end date cannot be before the start date." };
  if (!sourceId || !insurerId || !productName || !proposalNumber || !paymentFrequency || !paymentMode || premiumAmount === null || finalPremium === null) return { ok: false, error: "Complete all required policy onboarding fields." };
  if (sumInsuredRaw && sumInsured === null) return { ok: false, error: "Enter a valid sum assured / insured amount." };

  const [{ data: policy }, { data: caseRow }, { data: source }] = await Promise.all([
    admin.from("policies").select("id,business_line,rm_employee_id,rm_name").eq("id", policyId).maybeSingle<{ id: string; business_line: string | null; rm_employee_id: string | null; rm_name: string | null }>(),
    admin.from("life_health_cases").select("id,final_policy_id,customer_id,intermediary_id,rm_employee_id,rm_name,rm_code").eq("id", caseId).eq("final_policy_id", policyId).maybeSingle<{ id: string; final_policy_id: string | null; customer_id: string; intermediary_id: string | null; rm_employee_id: string | null; rm_name: string | null; rm_code: string | null }>(),
    admin.from("intermediaries").select("id,intermediary_type,intermediary_code,display_name,mobile,associate_employee_id").eq("id", sourceId).eq("account_status", "active").maybeSingle<{ id: string; intermediary_type: string; intermediary_code: string | null; display_name: string; mobile: string | null; associate_employee_id: string | null }>(),
  ]);
  if (!policy || !caseRow || !source) return { ok: false, error: "The linked policy, Life/Health case or lead source is no longer available." };

  const intermediaryType = source.intermediary_type === "posp" ? "POSP" : source.intermediary_type === "misp" ? "MISP" : "SIBL / Partner";
  const intermediaryCode = clean(source.intermediary_code);
  const leadSource = clean(source.display_name);
  let rmEmployeeId = source.associate_employee_id;
  let rmName: string | null = null;
  let rmCode: string | null = null;
  if (rmEmployeeId) {
    const { data: employee } = await admin.from("employees").select("full_name,employee_code").eq("id", rmEmployeeId).maybeSingle<{ full_name: string | null; employee_code: string | null }>();
    rmName = employee?.full_name?.trim() || null;
    rmCode = employee?.employee_code?.trim() || null;
  } else if (caseRow.intermediary_id === sourceId) {
    rmEmployeeId = caseRow.rm_employee_id || policy.rm_employee_id || null;
    rmName = caseRow.rm_name?.trim() || policy.rm_name?.trim() || null;
    rmCode = caseRow.rm_code?.trim() || null;
  }

  const { error: caseError } = await admin.from("life_health_cases").update({
    business_line: businessLine,
    sourcing_date: sourcingDate,
    insurance_company_id: insurerId,
    product_name: productName,
    proposal_number: proposalNumber,
    premium_paying_term: ppt || null,
    policy_duration: pd || null,
    payment_frequency: paymentFrequency,
    payment_mode: paymentMode,
    premium_amount: premiumAmount,
    intermediary_id: sourceId,
    intermediary_type: intermediaryType,
    intermediary_code: intermediaryCode || null,
    lead_source: leadSource,
    intermediary_mobile: source.mobile || null,
    rm_employee_id: rmEmployeeId,
    rm_name: rmName,
    rm_code: rmCode,
    remarks: remarks || null,
    updated_at: new Date().toISOString(),
  }).eq("id", caseId).eq("final_policy_id", policyId);
  if (caseError) return { ok: false, error: "The Life/Health case could not be updated." };

  const { error: policyError } = await admin.from("policies").update({
    insurance_company_id: insurerId,
    policy_type: businessLine,
    policy_product: productName,
    business_line: businessLine,
    issuance_date: sourcingDate,
    start_date: startDate,
    end_date: endDate,
    policy_term: pd || null,
    premium_amount: finalPremium,
    insured_declared_value: sumInsured,
    intermediary_type: intermediaryType,
    intermediary_code: intermediaryCode || null,
    lead_source: leadSource,
    rm_name: rmName,
    rm_employee_id: rmEmployeeId,
    remarks: remarks || null,
    updated_at: new Date().toISOString(),
  }).eq("id", policyId);
  if (policyError) return { ok: false, error: "The policy record could not be updated." };

  await admin.from("life_health_policy_details").update({
    proposal_number: proposalNumber,
    premium_paying_term: ppt || null,
    policy_duration: pd || null,
    payment_frequency: paymentFrequency,
    payment_mode: paymentMode,
  }).eq("policy_id", policyId);
  await admin.from("policy_premium_details").update({ net_premium: finalPremium, gross_premium: finalPremium }).eq("policy_id", policyId);

  revalidateIssuedPolicy(policyId, caseId);
  return { ok: true };
}