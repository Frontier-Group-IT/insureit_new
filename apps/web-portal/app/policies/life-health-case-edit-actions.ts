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
  const profile = requester?.role === "operations_head_life" ? await requireOperationsHeadRecordOwnership("life_health_case", caseId) : await requirePolicyCreator();
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

  const { data: row } = await admin.from("life_health_cases").select("id,customer_id,final_policy_id").eq("id", caseId).maybeSingle<{ id: string; customer_id: string; final_policy_id: string | null }>();
  if (!row) return { ok: false as const, error: "This case is no longer available." };
  if (row.final_policy_id) return { ok: false as const, error: "Issued cases cannot be edited." };
  if (!row.customer_id) return { ok: false as const, error: "The case customer reference is missing." };

  if (profile.role === "operations_head_life") {
    const { data: customer, error } = await admin.from("customers")
      .select("contact_name,phone,address,address_street").eq("id", row.customer_id)
      .maybeSingle<{ contact_name: string; phone: string; address: string | null; address_street: string | null }>();
    if (error || !customer ||
        customer.contact_name.trim() !== customerName ||
        customer.phone.replace(/\D/g, "").slice(-10) !== customerPhone ||
        (customer.address_street || customer.address || "").trim() !== customerAddress) {
      return { ok: false as const, error: "Customer master changes require separate authorization; case fields can be updated without changing customer identity." };
    }
  } else {
    const { error: customerError } = await admin.from("customers").update({ contact_name: customerName, phone: customerPhone, address: customerAddress || null, address_street: customerAddress || null, updated_at: new Date().toISOString() }).eq("id", row.customer_id);
    if (customerError) return { ok: false as const, error: "Customer details could not be updated." };
  }

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
    remarks: clean(formData.get("remarks")) || null,
    updated_at: new Date().toISOString(),
  }).eq("id", caseId);
  if (caseError) return { ok: false as const, error: "Case details could not be updated." };

  revalidatePath(`/policies/life-health-cases/${caseId}`);
  revalidatePath("/policies/life-health-cases");
  return { ok: true as const };
}
