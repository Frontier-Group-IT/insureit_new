"use server";

import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type LifeHealthCustomerEditResult = { ok: true } | { ok: false; error: string };
const clean = (value: unknown) => String(value ?? "").trim();

export async function updateIssuedLifeHealthCustomer(formData: FormData): Promise<LifeHealthCustomerEditResult> {
  await requirePolicyEditor();
  const policyId = clean(formData.get("policyId"));
  const caseId = clean(formData.get("caseId"));
  const customerName = clean(formData.get("customerName"));
  const customerPhone = clean(formData.get("customerPhone")).replace(/\D/g, "");
  const customerEmail = clean(formData.get("customerEmail"));
  if (!policyId || !caseId || !customerName || customerPhone.length !== 10) return { ok: false, error: "Enter a valid proposer name and 10 digit mobile number." };
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return { ok: false, error: "Enter a valid email address." };

  const admin = createSupabaseAdminClient();
  const { data: caseRow } = await admin.from("life_health_cases").select("customer_id").eq("id", caseId).eq("final_policy_id", policyId).maybeSingle<{ customer_id: string }>();
  if (!caseRow?.customer_id) return { ok: false, error: "The linked Life/Health customer is no longer available." };
  const { error } = await admin.from("customers").update({ contact_name: customerName, phone: customerPhone, email: customerEmail || null, updated_at: new Date().toISOString() }).eq("id", caseRow.customer_id);
  if (error) return { ok: false, error: "The customer details could not be updated." };
  return { ok: true };
}
