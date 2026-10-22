"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";
import { loadCustomerWebPolicies, loadCustomerWebVehicles, resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaims } from "@/lib/customer-web-phase2-data";

export type PrepareCustomerClaimState = { error: string | null };

export async function prepareCustomerClaim(_previous: PrepareCustomerClaimState, form: FormData): Promise<PrepareCustomerClaimState> {
  const customerId = String(form.get("account") || "");
  const vehicleId = String(form.get("vehicle") || "");
  const policyId = String(form.get("policy") || "");
  const { account } = await resolveCustomerWebScope(customerId);
  const session = await getCustomerWebSession();
  const [vehicles, policies, claims] = await Promise.all([
    loadCustomerWebVehicles(account.id), loadCustomerWebPolicies(account.id), loadCustomerClaims(account.id)
  ]);
  if (!vehicles.some(v => v.id === vehicleId)) return { error: "This vehicle is not linked to your account. Please refresh and select a vehicle again." };
  const policy = policies.find(p => p.id === policyId && p.vehicle_id === vehicleId);
  if (policyId && !policy) return { error: "This policy is not linked to the selected vehicle." };
  const active = claims.find(c => (policy ? (policy.source === "external" ? c.external_policy_id === policy.id : c.policy_id === policy.id) : c.vehicle_id === vehicleId && !c.policy_id && !c.external_policy_id) && !["Settled","Closed","Claim Complete","Rejected"].includes(c.current_status));
  if (active) {
    redirect((active.current_status === "Draft" ? "/customer/spot-intimation" : "/customer/claims/" + encodeURIComponent(active.id)) + "?account=" + encodeURIComponent(account.id) + (active.current_status === "Draft" ? "&id=" + encodeURIComponent(active.id) : ""));
  }
  const supabase = await createServerSupabaseClient();
  if (policy?.source === "external") {
    const { data, error } = await supabase.rpc("ensure_self_managed_external_claim_draft", {
      p_customer_id: account.id, p_vehicle_id: vehicleId, p_external_policy_id: policy.id,
    });
    if (error) return { error: "We could not prepare your claim. Please try again or contact support." };
    const value = Array.isArray(data) ? data[0] : data;
    const claimId = value && typeof value === "object" && "claim_id" in value ? String(value.claim_id) : "";
    if (!claimId) return { error: "We could not confirm your claim draft. Please try again." };
    redirect("/customer/spot-intimation?account=" + encodeURIComponent(account.id) + "&id=" + encodeURIComponent(claimId));
  }
  const stamp = new Date();
  const claimNo = "CLM-" + stamp.toISOString().slice(0, 10).replace(/-/g, "") + "-" + stamp.getTime().toString().slice(-6);
  const { data: created, error } = await supabase.from("claims").insert({
    claim_no: claimNo, customer_id: account.id, vehicle_id: vehicleId,
    policy_id: policy?.id ?? null, insurance_company_id: policy?.insurance_company_id ?? null,
    current_status: "Draft", created_by: session.user.id,
  }).select("id").single();
  if (error || !created?.id) {
    // Recover a concurrent draft instead of creating a second claim.
    const base = supabase.from("claims").select("id,current_status").eq("customer_id", account.id);
    const scoped = policy ? base.eq("policy_id", policy.id) : base.eq("vehicle_id", vehicleId).is("policy_id", null).is("external_policy_id", null);
    const { data: recovered, error: recoveryError } = await scoped.not("current_status", "in", '("Settled","Closed","Claim Complete","Rejected")').limit(1).maybeSingle();
    if (!recovered?.id) {
      console.error("Customer claim draft creation failed", { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint, recoveryCode: recoveryError?.code, recoveryMessage: recoveryError?.message });
      return { error: error?.code === "23514" ? "Claim registration without a linked policy is not yet enabled. Please contact support." : "Your claim could not be registered. Please try again or contact support." };
    }
    redirect("/customer/spot-intimation?account=" + encodeURIComponent(account.id) + "&id=" + encodeURIComponent(recovered.id));
  }
  redirect("/customer/spot-intimation?account=" + encodeURIComponent(account.id) + "&id=" + encodeURIComponent(created.id));
}
