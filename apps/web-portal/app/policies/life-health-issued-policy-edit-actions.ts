"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type LifeHealthIssuedPolicyEditResult = { ok: true } | { ok: false; error: string };

const clean = (value: unknown) => String(value ?? "").trim();
const amount = (value: unknown) => {
  const parsed = Number(clean(value).replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

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
  const remarks = clean(formData.get("remarks"));

  if (!policyId || !caseId) return { ok: false, error: "Policy edit reference is missing." };
  if (businessLine !== "Life" && businessLine !== "Health") return { ok: false, error: "Only Life and Health policies can use this editor." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourcingDate)) return { ok: false, error: "Enter a valid policy issuance date." };
  if (!sourceId || !insurerId || !productName || !proposalNumber || !paymentFrequency || !paymentMode || premiumAmount === null) return { ok: false, error: "Complete all required policy onboarding fields." };

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
    // A Partner source can inherit RM ownership through onboarding rather than the direct intermediary column.
    // When the source is unchanged, retain that established ownership instead of clearing it on an unrelated edit.
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
    policy_term: pd || null,
    premium_amount: premiumAmount,
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
  await admin.from("policy_premium_details").update({ net_premium: premiumAmount, gross_premium: premiumAmount }).eq("policy_id", policyId);

  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}`);
  revalidatePath(`/policies/${policyId}/edit`);
  revalidatePath(`/policies/life-health-cases/${caseId}`);
  return { ok: true };
}
