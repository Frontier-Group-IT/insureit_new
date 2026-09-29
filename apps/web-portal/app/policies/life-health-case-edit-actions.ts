"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const clean = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const numberValue = (value: string) => {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export async function updateLifeHealthCaseDetails(formData: FormData) {
  await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const caseId = clean(formData.get("caseId"));
  const customerId = clean(formData.get("customerId"));
  const insurerId = clean(formData.get("insurerId"));
  const customerName = clean(formData.get("customerName"));
  const customerPhone = clean(formData.get("customerPhone")).replace(/\D/g, "").slice(-10);
  const customerEmail = clean(formData.get("customerEmail"));
  const premium = numberValue(clean(formData.get("premiumAmount")));
  const sourcingDate = clean(formData.get("sourcingDate"));

  if (!caseId || !customerId) return { ok: false as const, error: "Case or customer reference is missing." };
  if (!customerName) return { ok: false as const, error: "Enter the customer name." };
  if (!/^[6-9][0-9]{9}$/.test(customerPhone)) return { ok: false as const, error: "Enter a valid 10 digit Indian mobile number." };
  if (!insurerId) return { ok: false as const, error: "Select an insurer." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourcingDate)) return { ok: false as const, error: "Enter a valid sourcing date." };
  if (premium === null || premium < 0) return { ok: false as const, error: "Enter a valid premium." };

  const { data: row } = await admin.from("life_health_cases").select("id,final_policy_id").eq("id", caseId).maybeSingle<{ id: string; final_policy_id: string | null }>();
  if (!row) return { ok: false as const, error: "This case is no longer available." };
  if (row.final_policy_id) return { ok: false as const, error: "Issued cases cannot be edited." };

  const { error: customerError } = await admin.from("customers").update({
    contact_name: customerName,
    phone: customerPhone,
    email: customerEmail || null,
    updated_at: new Date().toISOString(),
  }).eq("id", customerId);
  if (customerError) return { ok: false as const, error: "Customer details could not be updated." };

  const { error: caseError } = await admin.from("life_health_cases").update({
    insurance_company_id: insurerId,
    product_name: clean(formData.get("productName")),
    proposal_number: clean(formData.get("proposalNumber")).toUpperCase(),
    premium_paying_term: clean(formData.get("ppt")) || null,
    policy_duration: clean(formData.get("pd")) || null,
    payment_frequency: clean(formData.get("paymentFrequency")),
    payment_mode: clean(formData.get("paymentMode")),
    premium_amount: premium,
    sourcing_date: sourcingDate,
    rm_name: clean(formData.get("rmName")) || null,
    rm_code: clean(formData.get("rmCode")) || null,
    lead_source: clean(formData.get("leadSource")) || null,
    intermediary_code: clean(formData.get("intermediaryCode")) || null,
    intermediary_mobile: clean(formData.get("intermediaryMobile")) || null,
    remarks: clean(formData.get("remarks")) || null,
    updated_at: new Date().toISOString(),
  }).eq("id", caseId);
  if (caseError) return { ok: false as const, error: "Case details could not be updated." };

  revalidatePath(`/policies/life-health-cases/${caseId}`);
  revalidatePath("/policies/life-health-cases");
  return { ok: true as const };
}
