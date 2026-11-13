"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireOperationsHeadRecordOwnership } from "@/lib/operations-head-record-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
  if (requester?.role === "operations_head_life") await requireOperationsHeadRecordOwnership("life_health_case", caseId);
  else await requirePolicyCreator();
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

  const { data: row } = await admin.from("life_health_cases").select("id,customer_id,final_policy_id,status,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,sourcing_date").eq("id", caseId).maybeSingle<{ id: string; customer_id: string; final_policy_id: string | null; status: string; insurance_company_id:string;product_name:string;proposal_number:string;premium_paying_term:string|null;policy_duration:string|null;payment_frequency:string;payment_mode:string;premium_amount:number;sourcing_date:string }>();
  if (!row) return { ok: false as const, error: "This case is no longer available." };
  if (row.final_policy_id || row.status === "rejected") return { ok: false as const, error: "Issued or rejected cases cannot be edited." };
  if (!row.customer_id) return { ok: false as const, error: "The case customer reference is missing." };

  const { error: customerError } = await admin.from("customers").update({ contact_name: customerName, phone: customerPhone, address: customerAddress || null, address_street: customerAddress || null, updated_at: new Date().toISOString() }).eq("id", row.customer_id);
  if (customerError) return { ok: false as const, error: "Customer details could not be updated." };

  const { error: caseError } = await admin.from("life_health_cases").update({
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
  }).eq("id", caseId).neq("status", "rejected").is("final_policy_id", null);
  if (caseError) return { ok: false as const, error: "Case details could not be updated." };

  // Record only approved, user-editable case fields. Never store the
  // customer's name/mobile/address, raw proposal number or remarks.
  const changes: string[] = [];
  const compare = (label:string,oldValue:string|null|number,newValue:string|null|number,format:(v:string|number|null)=>string=(v)=>String(v??"Not set")) => {
    if(String(oldValue??"").trim()!==String(newValue??"").trim())
      changes.push(`${label}: ${format(oldValue)} → ${format(newValue)}`);
  };
  const currency=(value:string|number|null)=> {
    const n=Number(value??0);
    return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "Not set";
  };
  compare("Product",row.product_name,clean(formData.get("productName")));
  compare("Premium",row.premium_amount,premium,currency);
  compare("Premium paying term",row.premium_paying_term,clean(formData.get("ppt"))||null);
  compare("Policy duration",row.policy_duration,clean(formData.get("pd"))||null);
  compare("Payment frequency",row.payment_frequency,paymentFrequency);
  compare("Payment mode",row.payment_mode,paymentMode);
  compare("Sourcing date",row.sourcing_date,sourcingDate);
  if(row.insurance_company_id!==insurerId)changes.push("Insurer changed (values hidden)");
  if(row.proposal_number!==clean(formData.get("proposalNumber")).toUpperCase())changes.push("Proposal number changed (values hidden)");
  if(changes.length){
    const {error:auditError}=await admin.from("audit_logs").insert({
      actor_id:requester?.id??null,action:"life_health_case_edited",table_name:"life_health_cases",
      record_id:caseId,new_data:{changed_fields:changes.slice(0,20)},
    });
    if(auditError) console.error("Life/Health case activity audit could not be recorded",{caseId,code:auditError.code});
  }

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
  if (requester?.role === "operations_head_life") await requireOperationsHeadRecordOwnership("life_health_case",caseId);
  else await requirePolicyCreator();
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
  revalidatePath(`/policies/life-health-cases/${caseId}`);
  revalidatePath("/policies/life-health-cases");
  return {ok:true,remarks};
}
