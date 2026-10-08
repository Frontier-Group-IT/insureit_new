"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { loadCustomerWebPolicies, loadCustomerWebVehicles, resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaims } from "@/lib/customer-web-phase2-data";

export async function prepareCustomerClaim(form: FormData) {
  const customerId = String(form.get("account") || "");
  const vehicleId = String(form.get("vehicle") || "");
  const policyId = String(form.get("policy") || "");
  const { account } = await resolveCustomerWebScope(customerId);
  const session = await getCustomerWebSession();
  const [vehicles, policies, claims] = await Promise.all([
    loadCustomerWebVehicles(account.id), loadCustomerWebPolicies(account.id), loadCustomerClaims(account.id)
  ]);
  if (!vehicles.some(v => v.id === vehicleId)) throw new Error("Vehicle is not linked to your account");
  const policy = policies.find(p => p.id === policyId && p.vehicle_id === vehicleId);
  if (!policy) throw new Error("Policy is not linked to this vehicle");
  const active = claims.find(c => (policy.source === "external" ? c.external_policy_id === policy.id : c.policy_id === policy.id) && !["Settled","Closed","Claim Complete","Rejected"].includes(c.current_status));
  if (active) {
    redirect("/customer/claims/" + encodeURIComponent(active.id) + "?account=" + encodeURIComponent(account.id));
  }
  const supabase = await createServerSupabaseClient();
  if (policy.source === "external") {
    const { data, error } = await supabase.rpc("ensure_self_managed_external_claim_draft", {
      p_customer_id: account.id, p_vehicle_id: vehicleId, p_external_policy_id: policy.id,
    });
    if (error) throw new Error("Could not prepare external claim safely");
    const value = Array.isArray(data) ? data[0] : data;
    const claimId = value && typeof value === "object" && "claim_id" in value ? String(value.claim_id) : "";
    if (!claimId) throw new Error("External claim draft was not confirmed");
    redirect("/customer/spot-intimation?account=" + encodeURIComponent(account.id) + "&id=" + encodeURIComponent(claimId));
  }
  const stamp = new Date();
  const claimNo = "CLM-" + stamp.toISOString().slice(0, 10).replace(/-/g, "") + "-" + stamp.getTime().toString().slice(-6);
  const { data: created, error } = await supabase.from("claims").insert({
    claim_no: claimNo, customer_id: account.id, vehicle_id: vehicleId,
    policy_id: policy.id, insurance_company_id: policy.insurance_company_id,
    current_status: "Draft", created_by: session.user.id,
  }).select("id").single();
  if (error || !created?.id) {
    // Recover a concurrent draft instead of creating a second claim.
    const { data: recovered } = await supabase.from("claims").select("id,current_status").eq("customer_id", account.id).eq("policy_id", policy.id).not("current_status", "in", '("Settled","Closed","Claim Complete","Rejected")').limit(1).maybeSingle();
    if (!recovered?.id) throw new Error("Claim could not be prepared safely");
    redirect("/customer/spot-intimation?account=" + encodeURIComponent(account.id) + "&id=" + encodeURIComponent(recovered.id));
  }
  redirect("/customer/spot-intimation?account=" + encodeURIComponent(account.id) + "&id=" + encodeURIComponent(created.id));
}
