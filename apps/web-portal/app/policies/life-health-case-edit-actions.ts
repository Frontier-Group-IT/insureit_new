"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireOperationsHeadRecordOwnership } from "@/lib/operations-head-record-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordDailyWorkflowActivity } from "@/lib/daily-workflow-audit";

const PAYMENT_FREQUENCIES = new Set(["Monthly", "Quarterly", "Half Yearly", "Annually", "One Time"]);
const PAYMENT_MODES = new Set(["Cash", "Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"]);
const normalizePaymentMode = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  return [...PAYMENT_MODES].find(mode => mode.toLowerCase() === normalized) ?? "";
};
const clean = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const numberValue = (value: string) => { const parsed = Number(value.replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : null; };

export async function updateLifeHealthCaseDetails(formData: FormData) {
  const caseId = clean(formData.get("caseId"));
  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = requester?.role === "operations_head_life"
    ? await requireOperationsHeadRecordOwnership("life_health_case", caseId)
    : await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const insurerId = clean(formData.get("insurerId"));
  const customerName = clean(formData.get("customerName"));
  const customerPhone = clean(formData.get("customerPhone")).replace(/\D/g, "").slice(-10);
  const customerAddress = clean(formData.get("customerAddress"));
  const premium = numberValue(clean(formData.get("premiumAmount")));
  const sourcingDate = clean(formData.get("sourcingDate"));
  const paymentFrequency = clean(formData.get("paymentFrequency"));
  const paymentMode = normalizePaymentMode(clean(formData.get("paymentMode")));

  if (!caseId) return { ok: false as const, error: "Case reference is missing." };
  if (!customerName) return { ok: false as const, error: "Enter the customer name." };
  if (!/^[6-9][0-9]{9}$/.test(customerPhone)) return { ok: false as const, error: "Enter a valid 10 digit Indian mobile number." };
  if (!insurerId) return { ok: false as const, error: "Select an insurer." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourcingDate)) return { ok: false as const, error: "Enter a valid proposal date." };
  if (premium === null || premium < 0) return { ok: false as const, error: "Enter a valid premium." };
  if (!PAYMENT_FREQUENCIES.has(paymentFrequency)) return { ok: false as const, error: "Select a valid payment frequency." };
  if (!PAYMENT_MODES.has(paymentMode)) return { ok: false as const, error: "Select a valid payment mode." };

  const { data: row } = await admin.from("life_health_cases").select("id,customer_id,final_policy_id,status").eq("id", caseId).maybeSingle<{ id: string; customer_id: string; final_policy_id: string | null; status: string }>();
  if (!row) return { ok: false as const, error: "This case is no longer available." };
  if (row.final_policy_id || row.status === "rejected") return { ok: false as const, error: "Issued or rejected cases cannot be edited." };
  if (!row.customer_id) return { ok: false as const, error: "The case customer reference is missing." };

  const { error: customerError } = await admin.from("customers").update({ contact_name: customerName, phone: customerPhone, address: customerAddress || null, address_street: customerAddress || null, updated_at: new Date().toISOString() }).eq("id", row.customer_id);
  if (customerError) return { ok: false as const, error: "Customer details could not be updated." };

  const { data: savedCase, error: caseError } = await admin.from("life_health_cases").update({
    insurance_company_id: insurerId,
    product_name: clean(formData.get("productName")),
    proposal_number: clean(formData.get("proposalNumber")).toUpperCase(),
    premium_paying_term: clean(formData.get("ppt")) || null,
    policy_duration: clean(formData.get("pd")) || null,
    payment_frequency: paymentFrequency,
    payment_mode: paymentMode,
    premium_amount: premium,
    sourcing_date: sourcingDate,
    updated_at: new Date().toISOString(),
  }).eq("id", caseId).neq("status", "rejected").is("final_policy_id", null).select("id").maybeSingle<{id:string}>();
  if (caseError || !savedCase) return { ok: false as const, error: "Case details could not be updated." };
  await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:caseId,action:"life_health_case_edited"});

  revalidatePath(`/policies/life-health-cases/${caseId}`);
  revalidatePath("/policies/life-health-cases");
  return { ok: true as const };
}

/**
 * A case remark is append-only. The normal case-save and conversion flows do
 * not submit or replace remarks. Guard against concurrent writes to the same
 * case so an older browser session cannot erase a newer entry.
 */
export async function appendLifeHealthCaseRemark(formData: FormData): Promise<{ok:true;remarks:string}|{ok:false;error:string}> {
  const caseId = clean(formData.get("caseId"));
  const newRemark = clean(formData.get("newRemark"));
  if (!caseId) return {ok:false,error:"Case reference is missing."};
  const {profile:requester} = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = requester?.role === "operations_head_life"
    ? await requireOperationsHeadRecordOwnership("life_health_case",caseId)
    : await requirePolicyCreator();
  if (!newRemark || newRemark.length > 2000) return {ok:false,error:"Enter a remark of up to 2000 characters."};
  const admin = createSupabaseAdminClient();
  const {data:caseRow,error:loadError} = await admin.from("life_health_cases")
    .select("id,remarks,final_policy_id,status").eq("id",caseId)
    .maybeSingle<{id:string;remarks:string|null;final_policy_id:string|null;status:string}>();
  if (loadError || !caseRow) return {ok:false,error:"Case could not be loaded."};
  if (caseRow.final_policy_id || caseRow.status === "rejected") return {ok:false,error:"Issued or rejected cases cannot be edited."};
  const old = caseRow.remarks?.trim() ?? "";
  const timestamp = new Intl.DateTimeFormat("en-IN",{
    timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:true,
  }).format(new Date());
  const addition = `[${timestamp}] ${newRemark}`;
  const remarks = old ? `${old}\n\n${addition}` : addition;
  if (remarks.length > 50000) return {ok:false,error:"The remarks history is full."};
  let update = admin.from("life_health_cases")
    .update({remarks,updated_at:new Date().toISOString()})
    .eq("id",caseId).is("final_policy_id",null).neq("status","rejected");
  update = caseRow.remarks === null ? update.is("remarks",null) : update.eq("remarks",caseRow.remarks);
  const {data:saved,error:saveError} = await update.select("id").maybeSingle<{id:string}>();
  if (saveError || !saved) return {ok:false,error:"Remarks changed in another session. Reload and try again."};
  await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:caseId,action:"life_health_case_remark_added"});
  revalidatePath(`/policies/life-health-cases/${caseId}`);
  revalidatePath("/policies/life-health-cases");
  return {ok:true,remarks};
}
