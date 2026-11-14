"use server";

import { revalidatePath } from "next/cache";
import { validScheduleDate, canonicalPaymentFrequency } from "@/lib/life-health-issued-schedule";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { consumePolicyDateApproval, recordPreviousMonthPolicyUpload, linkConsumedPolicyDateApproval } from "@/lib/policy-date-approval-server";
import { recordPolicyActivity, capturePolicyEditSnapshot, describePolicyEditChanges, POLICY_ACTIVITY_ACTIONS } from "@/lib/policy-activity";

export type LifeHealthIssuedPolicyEditResult = { ok: true } | { ok: false; error: string };
export type LifeHealthPolicyCopyResult =
  | { ok: true; document: { id: string; fileName: string; viewUrl: string } | null }
  | { ok: false; error: string };

const DOCUMENT_BUCKET = "policy-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const COMMERCIAL_BASES = new Set(["NET_PREMIUM_PERCENT", "FIXED_AMOUNT"]);
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
  const policyId = clean(formData.get("policyId"));
  const profile = await requirePolicyEditor(policyId);
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
  const policyId = clean(formData.get("policyId"));
  await requirePolicyEditor(policyId);
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
  const policyId = clean(formData.get("policyId"));
  const profile = await requirePolicyEditor(policyId);
  const commercialAccess = canAccessPolicyCommercials(profile, profile.role === "operations_head_life");
  const admin = createSupabaseAdminClient();
  const caseId = clean(formData.get("caseId"));
  const businessLine = clean(formData.get("businessLine"));
  const sourcingDate = clean(formData.get("sourcingDate"));
  const proposalDate = clean(formData.get("proposalDate"));
  const requestedPolicyNumber = clean(formData.get("policyNumber")).toUpperCase();
  const normalizedPolicyNumber = requestedPolicyNumber.replace(/\s+/g, "");
  const policyNumberConfirmed = clean(formData.get("confirmPolicyNumberChange")) === "true";
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
  const pptEndDate = clean(formData.get("pptEndDate"));
  const nextInstallmentDate = clean(formData.get("nextInstallmentDate"));
  const finalPremium = amount(formData.get("finalPremium"));
  const sumInsuredRaw = clean(formData.get("sumInsured"));
  const sumInsured = sumInsuredRaw ? amount(sumInsuredRaw) : null;
  const remarks = clean(formData.get("remarks"));
  const payinBasis = clean(formData.get("payinBasis")) || "FIXED_AMOUNT";
  const payoutBasis = clean(formData.get("payoutBasis")) || "FIXED_AMOUNT";
  const payinPercentEntered = clean(formData.get("payinPercent")) !== "";
  const payinFixedEntered = clean(formData.get("payinFixedAmount")) !== "";
  const schemeEntered = clean(formData.get("insurerSchemeAmount")) !== "";
  const payoutPercentEntered = clean(formData.get("payoutPercent")) !== "";
  const payoutFixedEntered = clean(formData.get("payoutFixedAmount")) !== "";
  const payinPercent = amount(formData.get("payinPercent")) ?? 0;
  const payinFixedAmount = amount(formData.get("payinFixedAmount")) ?? 0;
  const insurerSchemeAmount = amount(formData.get("insurerSchemeAmount")) ?? 0;
  const payoutPercent = amount(formData.get("payoutPercent")) ?? 0;
  const payoutFixedAmount = amount(formData.get("payoutFixedAmount")) ?? 0;

  if (!policyId || !caseId) return { ok: false, error: "Policy edit reference is missing." };
  if (businessLine !== "Life" && businessLine !== "Health") return { ok: false, error: "Only Life and Health policies can use this editor." };
  if (!validScheduleDate(sourcingDate)) return { ok: false, error: "Enter a valid policy issuance date." };
  if (!validScheduleDate(proposalDate)) return { ok: false, error: "Enter a valid proposal date." };
  if (!requestedPolicyNumber || !normalizedPolicyNumber || requestedPolicyNumber.length > 120) return { ok: false, error: "Enter a valid policy number." };
  if ((pptEndDate && !validScheduleDate(pptEndDate)) || (nextInstallmentDate && !validScheduleDate(nextInstallmentDate))) return { ok: false, error: "Enter valid PPT End and Next Installment dates." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) return { ok: false, error: "Enter a valid policy start date and, if provided, a valid policy end date." };
  if (endDate && endDate < startDate) return { ok: false, error: "Policy end date cannot be before the start date." };
  if (pptEndDate && pptEndDate < startDate) return { ok: false, error: "PPT End Date cannot be before the policy start date." };
  if (nextInstallmentDate && nextInstallmentDate < startDate) return { ok: false, error: "Next Installment Date cannot be before the policy start date." };
  if (!sourceId || !insurerId || !productName || !proposalNumber || !paymentFrequency || !paymentMode || premiumAmount === null || finalPremium === null) return { ok: false, error: "Complete all required policy onboarding fields." };
  if (sumInsuredRaw && sumInsured === null) return { ok: false, error: "Enter a valid sum assured / insured amount." };
  if (commercialAccess) {
    if (!COMMERCIAL_BASES.has(payinBasis) || !COMMERCIAL_BASES.has(payoutBasis)) return { ok: false, error: "Select a valid Pay-in and Payout basis." };
    if (payinPercent > 100 || payoutPercent > 100) return { ok: false, error: "Pay-in and Payout percentages cannot exceed 100%." };
  }

  const [{ data: policy }, { data: caseRow }, { data: source }] = await Promise.all([
    admin.from("policies").select("id,business_line,rm_employee_id,rm_name,policy_no,issuance_date").eq("id", policyId).maybeSingle<{ id: string; business_line: string | null; rm_employee_id: string | null; rm_name: string | null; policy_no: string | null; issuance_date: string | null }>(),
    admin.from("life_health_cases").select("id,final_policy_id,customer_id,intermediary_id,rm_employee_id,rm_name,rm_code").eq("id", caseId).eq("final_policy_id", policyId).maybeSingle<{ id: string; final_policy_id: string | null; customer_id: string; intermediary_id: string | null; rm_employee_id: string | null; rm_name: string | null; rm_code: string | null }>(),
    admin.from("intermediaries").select("id,intermediary_type,intermediary_code,display_name,mobile,associate_employee_id").eq("id", sourceId).eq("account_status", "active").maybeSingle<{ id: string; intermediary_type: string; intermediary_code: string | null; display_name: string; mobile: string | null; associate_employee_id: string | null }>(),
  ]);
  if (!policy || !caseRow || !source) return { ok: false, error: "The linked policy, Life/Health case or lead source is no longer available." };
  const changingPolicyNumber = requestedPolicyNumber !== clean(policy.policy_no).toUpperCase();
  if (changingPolicyNumber) {
    if (!policyNumberConfirmed) return { ok: false, error: "Confirm the issued policy number change before saving." };
    if (sourcingDate !== policy.issuance_date) return { ok: false, error: "Save the policy-number change separately from an issuance-date change requiring OTP." };
    const { data: duplicate, error: duplicateError } = await admin.from("policies").select("id")
      .eq("policy_no_normalized",normalizedPolicyNumber).neq("id",policyId).limit(1).maybeSingle<{id:string}>();
    if (duplicateError) return { ok: false, error: "Could not verify policy number uniqueness. Try again." };
    if (duplicate) return { ok: false, error: "This policy number is already used by another policy." };
  }

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

  const dateGuard = await consumePolicyDateApproval(admin,{requesterId:profile.id,issuanceDate:sourcingDate,policyNumber:policy.policy_no??"",operation:"edit",existingPolicyId:policyId,originalIssuanceDate:policy.issuance_date,approvalId:clean(formData.get("dateApprovalId"))});
  if(!dateGuard.ok)return{ok:false,error:dateGuard.error};
  const activityBefore = await capturePolicyEditSnapshot(admin, policyId).catch(() => null);
  const { error: caseError } = await admin.from("life_health_cases").update({
    business_line: businessLine,
    sourcing_date: proposalDate,
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
    updated_at: new Date().toISOString(),
  }).eq("id", caseId).eq("final_policy_id", policyId);
  if (caseError) return { ok: false, error: "The Life/Health case could not be updated." };

  const { error: policyError } = await admin.from("policies").update({
    insurance_company_id: insurerId,
    policy_type: businessLine,
    policy_product: productName,
    business_line: businessLine,
    issuance_date: sourcingDate,
    ...(changingPolicyNumber ? { policy_no: requestedPolicyNumber, policy_no_normalized: normalizedPolicyNumber } : {}),
    start_date: startDate,
    end_date: endDate || null,
    policy_term: pd || null,
    premium_amount: finalPremium,
    insured_declared_value: sumInsured,
    intermediary_type: intermediaryType,
    intermediary_code: intermediaryCode || null,
    lead_source: leadSource,
    rm_name: rmName,
    rm_employee_id: rmEmployeeId,
    updated_at: new Date().toISOString(),
  }).eq("id", policyId);
  if (policyError) return { ok: false, error: "The policy record could not be updated." };

  const { data: existingDetails, error: detailsLoadError } = await admin.from("life_health_policy_details")
    .select("additional_details").eq("policy_id", policyId).maybeSingle<{ additional_details: Record<string, unknown> | null }>();
  if (detailsLoadError || !existingDetails) return { ok: false, error: "Unable to load issued policy schedule details." };
  const savedAdditional = existingDetails.additional_details ?? {};
  const savedSchedule = savedAdditional.issued_schedule && typeof savedAdditional.issued_schedule === "object" && !Array.isArray(savedAdditional.issued_schedule)
    ? savedAdditional.issued_schedule as Record<string, unknown> : {};
  const { error: detailsUpdateError } = await admin.from("life_health_policy_details").update({
    additional_details: { ...savedAdditional, issued_schedule: { ...savedSchedule, policy_start_date: startDate, policy_end_maturity_date: endDate || null, ppt_end_date: canonicalPaymentFrequency(paymentFrequency) === "One Time" || ppt.trim().toLowerCase().includes("single") ? null : pptEndDate || null, next_installment_date: canonicalPaymentFrequency(paymentFrequency) === "One Time" ? null : nextInstallmentDate || null } },
    proposal_number: proposalNumber,
    premium_paying_term: ppt || null,
    policy_duration: pd || null,
    payment_frequency: paymentFrequency,
    payment_mode: paymentMode,
  }).eq("policy_id", policyId);
  if (detailsUpdateError) return { ok: false, error: "Unable to update the issued policy schedule." };
  await admin.from("policy_premium_details").update({ net_premium: finalPremium, gross_premium: finalPremium }).eq("policy_id", policyId);

  if (commercialAccess) {
    const payinEntered = payinBasis === "FIXED_AMOUNT" ? payinFixedEntered || schemeEntered : payinPercentEntered || schemeEntered;
    const payoutEntered = payoutBasis === "FIXED_AMOUNT" ? payoutFixedEntered : payoutPercentEntered;
    const payinBase = payinBasis === "FIXED_AMOUNT" ? payinFixedAmount : finalPremium * payinPercent / 100;
    const totalProjectedPayin = payinBase + insurerSchemeAmount;
    const tdsPercent = 10;
    const tdsAmount = totalProjectedPayin * tdsPercent / 100;
    const payinAfterTds = totalProjectedPayin - tdsAmount;
    const partnerPayoutAmount = payoutBasis === "FIXED_AMOUNT" ? payoutFixedAmount : finalPremium * payoutPercent / 100;
    const retentionAmount = payinAfterTds - partnerPayoutAmount;

    const { data: existingPayin, error: payinLookupError } = await admin.from("policy_payin_details").select("id").eq("policy_id", policyId).maybeSingle<{ id:string }>();
    if (payinLookupError) return { ok: false, error: "The insurer Pay-in record could not be loaded." };
    const payinValues = {
      commercial_basis: payinEntered ? payinBasis : null,
      projected_commission_percent: payinEntered && payinBasis === "NET_PREMIUM_PERCENT" ? payinPercent : null,
      projected_commission_amount: payinEntered ? payinBase : null,
      insurer_scheme_amount: insurerSchemeAmount,
      total_projected_payin: totalProjectedPayin,
      tds_percent: tdsPercent,
      tds_amount: tdsAmount,
      payin_after_tds: payinAfterTds,
      calculation_version: "life_health_case_v3",
      commercial_status: payinEntered ? "entered" : "needs_review",
      updated_at: new Date().toISOString(),
    };
    const payinWrite = existingPayin
      ? await admin.from("policy_payin_details").update(payinValues).eq("id", existingPayin.id)
      : await admin.from("policy_payin_details").insert({ policy_id:policyId, ...payinValues });
    if (payinWrite.error) return { ok: false, error: "The insurer Pay-in could not be updated." };

    const { data: existingPayout, error: payoutLookupError } = await admin.from("policy_intermediary_payouts").select("id").eq("policy_id", policyId).order("created_at", { ascending:false }).limit(1).maybeSingle<{ id:string }>();
    if (payoutLookupError) return { ok: false, error: "The Partner Payout record could not be loaded." };
    const payoutValues = {
      intermediary_type: intermediaryType,
      intermediary_code: intermediaryCode || null,
      payout_basis: payoutEntered ? payoutBasis : null,
      partner_payout_percent: payoutEntered && payoutBasis === "NET_PREMIUM_PERCENT" ? payoutPercent : null,
      partner_payout_amount: payoutEntered ? partnerPayoutAmount : null,
      retention_amount: retentionAmount,
      gross_payout: partnerPayoutAmount,
      calculation_version: "life_health_case_v3",
      commercial_status: payoutEntered ? "entered" : "needs_review",
    };
    const payoutWrite = existingPayout
      ? await admin.from("policy_intermediary_payouts").update(payoutValues).eq("id", existingPayout.id)
      : await admin.from("policy_intermediary_payouts").insert({ policy_id:policyId, status:"Pending", payout_date:null, voucher_number:null, remarks:remarks || null, ...payoutValues });
    if (payoutWrite.error) return { ok: false, error: "The Partner Payout could not be updated." };
  }

  const activityAfter = await capturePolicyEditSnapshot(admin, policyId).catch(() => null);
  const activityChanges = describePolicyEditChanges(activityBefore, activityAfter);
  // Do not create an edit event when both snapshots confirm no tracked changes.
  // Null means a snapshot was unavailable, so retain an honest unknown-change audit.
  if (activityChanges === null || activityChanges.length > 0)
    await recordPolicyActivity(admin, policyId, profile.id, POLICY_ACTIVITY_ACTIONS.POLICY_EDITED, activityChanges);
  if (changingPolicyNumber) await admin.from("audit_logs").insert({ actor_id: profile.id, table_name: "policies", record_id: policyId, action: "policy_number_changed", old_data: { policy_no: policy.policy_no }, new_data: { policy_no: requestedPolicyNumber } });
  if(dateGuard.previousMonth)await recordPreviousMonthPolicyUpload(admin,policyId,profile.id,sourcingDate,dateGuard.approverName);
  if(dateGuard.approverName)await linkConsumedPolicyDateApproval(admin,clean(formData.get("dateApprovalId")),policyId,profile.id);
  revalidateIssuedPolicy(policyId, caseId);
  return { ok: true };
}
/**
 * Append a new Life/Health issued policy remark without exposing any path to edit
 * previously saved policy remarks. The normal policy edit action does not write
 * either policy or case remarks, so later form saves cannot overwrite the history.
 */
export async function appendIssuedLifeHealthRemark(formData: FormData): Promise<{ ok:true; remarks:string } | { ok:false; error:string }> {
  const policyId = clean(formData.get("policyId"));
  const caseId = clean(formData.get("caseId"));
  const newRemark = clean(formData.get("newRemark"));
  if (!policyId || !caseId) return { ok:false, error:"Policy reference is missing." };
  await requirePolicyEditor(policyId);
  if (!newRemark || newRemark.length > 2000) return { ok:false, error:"Enter a remark of up to 2000 characters." };
  const { admin, valid } = await validatePolicyCase(policyId,caseId);
  if (!valid) return { ok:false, error:"The linked Life/Health policy case is no longer available." };
  const [{ data: policy, error: loadError }, { data: caseRow, error: caseLoadError }] = await Promise.all([
    admin.from("policies").select("remarks").eq("id",policyId).maybeSingle<{remarks:string|null}>(),
    admin.from("life_health_cases").select("remarks").eq("id",caseId).eq("final_policy_id",policyId).maybeSingle<{remarks:string|null}>(),
  ]);
  if (loadError || caseLoadError || !policy || !caseRow) return { ok:false, error:"Could not load the existing policy remarks." };
  const previous = (policy.remarks || caseRow.remarks || "").trim();
  const timestamp = new Intl.DateTimeFormat("en-IN",{ timeZone:"Asia/Kolkata", day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true }).format(new Date());
  const appended = `[${timestamp}] ${newRemark}`;
  const remarks = previous ? `${previous}\n\n${appended}` : appended;
  if (remarks.length > 50000) return { ok:false, error:"The remarks history has reached its maximum size." };
  // Match the loaded value to avoid replacing a concurrent append with stale history.
  let update = admin.from("policies").update({ remarks, updated_at:new Date().toISOString() }).eq("id",policyId);
  update = policy.remarks === null ? update.is("remarks",null) : update.eq("remarks",policy.remarks);
  const { data: saved, error: saveError } = await update.select("id").maybeSingle<{id:string}>();
  if (saveError || !saved) return { ok:false, error:"Remarks changed in another session. Reload the page and try again." };
  revalidateIssuedPolicy(policyId,caseId);
  return { ok:true, remarks };
}
