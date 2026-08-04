"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  return value ? Number(value) : null;
}

function errorUrl(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export async function addPolicy(formData: FormData) {
  await requirePolicyEditor();

  const admin = createSupabaseAdminClient();
  const basePath = "/policies/new";
  const customerId = requiredText(formData, "customer_id");
  const vehicleId = requiredText(formData, "vehicle_id");
  const insurerId = requiredText(formData, "insurance_company_id");
  const policyNo = requiredText(formData, "policy_no")?.toUpperCase() ?? null;
  const policyType = requiredText(formData, "policy_type");
  const startDate = requiredText(formData, "start_date");
  const endDate = requiredText(formData, "end_date");

  if (!customerId || !vehicleId || !insurerId || !policyNo || !policyType || !startDate || !endDate) {
    redirect(errorUrl(basePath, "Complete the customer, vehicle, insurer, policy number, policy type and policy dates."));
  }

  const { data: vehicle, error: vehicleError } = await admin
    .from("vehicles")
    .select("id, customer_id")
    .eq("id", vehicleId)
    .eq("customer_id", customerId)
    .maybeSingle<{ id: string; customer_id: string }>();

  if (vehicleError || !vehicle) {
    redirect(errorUrl(basePath, vehicleError?.message ?? "The selected vehicle does not belong to the selected customer."));
  }

  const { error } = await admin.from("policies").insert({
    customer_id: customerId,
    vehicle_id: vehicleId,
    insurance_company_id: insurerId,
    policy_no: policyNo,
    policy_type: policyType,
    insured_declared_value: numberValue(formData, "insured_declared_value"),
    start_date: startDate,
    end_date: endDate,
  });

  if (error) redirect(errorUrl(basePath, `Policy could not be saved: ${error.message}`));

  revalidatePath("/policies");
  redirect("/policies?success=policy_created");
}
