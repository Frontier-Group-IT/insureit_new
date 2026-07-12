"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCustomer, updateCustomer } from "@/app/actions";
import { requireMasterDataManager } from "@/lib/master-data-server";
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

export async function addCustomer(formData: FormData) {
  await requireMasterDataManager();
  return createCustomer(formData);
}

export async function saveCustomer(id: string, formData: FormData) {
  await requireMasterDataManager();
  return updateCustomer(id, formData);
}

export async function addVehicle(formData: FormData) {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();
  const customerId = requiredText(formData, "customer_id");
  const vehicleNo = requiredText(formData, "vehicle_no")?.replace(/\s/g, "").toUpperCase() ?? null;
  const vehicleType = requiredText(formData, "vehicle_type");
  if (!customerId || !vehicleNo || !vehicleType) redirect(errorUrl("/vehicles/new", "Select a customer and enter the vehicle number and vehicle type."));

  const { data: customer, error: customerError } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle<{ id: string }>();
  if (customerError || !customer) redirect(errorUrl("/vehicles/new", customerError?.message ?? "The selected customer does not exist."));

  const { error } = await admin.from("vehicles").insert({
    customer_id: customerId,
    vehicle_no: vehicleNo,
    vehicle_type: vehicleType,
    make: requiredText(formData, "make"),
    model: requiredText(formData, "model"),
    year: numberValue(formData, "year"),
    chassis_no: requiredText(formData, "chassis_no")?.toUpperCase() ?? null,
    engine_no: requiredText(formData, "engine_no")?.toUpperCase() ?? null,
    permit_no: requiredText(formData, "permit_no")?.toUpperCase() ?? null
  });
  if (error) redirect(errorUrl("/vehicles/new", `Vehicle could not be saved: ${error.message}`));

  revalidatePath("/vehicles");
  redirect("/vehicles?success=vehicle_created");
}

export async function saveVehicle(id: string, formData: FormData) {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();
  const customerId = requiredText(formData, "customer_id");
  const vehicleNo = requiredText(formData, "vehicle_no")?.replace(/\s/g, "").toUpperCase() ?? null;
  const vehicleType = requiredText(formData, "vehicle_type");
  if (!customerId || !vehicleNo || !vehicleType) redirect(errorUrl(`/vehicles/${id}/edit`, "Select a customer and enter the vehicle number and vehicle type."));

  const { error } = await admin.from("vehicles").update({
    customer_id: customerId,
    vehicle_no: vehicleNo,
    vehicle_type: vehicleType,
    make: requiredText(formData, "make"),
    model: requiredText(formData, "model"),
    year: numberValue(formData, "year"),
    chassis_no: requiredText(formData, "chassis_no")?.toUpperCase() ?? null,
    engine_no: requiredText(formData, "engine_no")?.toUpperCase() ?? null,
    permit_no: requiredText(formData, "permit_no")?.toUpperCase() ?? null
  }).eq("id", id);
  if (error) redirect(errorUrl(`/vehicles/${id}/edit`, `Vehicle could not be updated: ${error.message}`));

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}/edit`);
  redirect("/vehicles?success=vehicle_updated");
}

export async function createInsuranceCompany(formData: FormData): Promise<{ ok: boolean; insurer?: { value: string; label: string }; error?: string }> {
  await requireMasterDataManager();
  const name = requiredText(formData, "name");
  if (!name) return { ok: false, error: "Enter the insurance company name." };

  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin.from("insurance_companies").select("id, name").ilike("name", name).limit(1).maybeSingle<{ id: string; name: string }>();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (existing) return { ok: true, insurer: { value: existing.id, label: existing.name } };

  const { data, error } = await admin.from("insurance_companies").insert({ name }).select("id, name").single<{ id: string; name: string }>();
  if (error || !data) return { ok: false, error: error?.message ?? "Unable to create insurance company." };
  revalidatePath("/policies/new");
  return { ok: true, insurer: { value: data.id, label: data.name } };
}

async function resolveInsurerId(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const existingId = requiredText(formData, "insurance_company_id");
  if (existingId) return existingId;
  const newName = requiredText(formData, "insurance_company_name");
  if (!newName) return null;
  const { data: existing } = await admin.from("insurance_companies").select("id").ilike("name", newName).limit(1).maybeSingle<{ id: string }>();
  if (existing?.id) return existing.id;
  const { data, error } = await admin.from("insurance_companies").insert({ name: newName }).select("id").single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data.id;
}

async function savePolicyRecord(id: string | null, formData: FormData) {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();
  const basePath = id ? `/policies/${id}/edit` : "/policies/new";
  const customerId = requiredText(formData, "customer_id");
  const vehicleId = requiredText(formData, "vehicle_id");
  const policyNo = requiredText(formData, "policy_no")?.toUpperCase() ?? null;
  const policyType = requiredText(formData, "policy_type");
  const startDate = requiredText(formData, "start_date");
  const endDate = requiredText(formData, "end_date");
  if (!customerId || !vehicleId || !policyNo || !policyType || !startDate || !endDate) redirect(errorUrl(basePath, "Complete the customer, vehicle, policy number, policy type and policy dates."));

  const { data: vehicle, error: vehicleError } = await admin.from("vehicles").select("id, customer_id").eq("id", vehicleId).eq("customer_id", customerId).maybeSingle<{ id: string; customer_id: string }>();
  if (vehicleError || !vehicle) redirect(errorUrl(basePath, vehicleError?.message ?? "The selected vehicle does not belong to the selected customer."));

  let insurerId: string | null = null;
  try { insurerId = await resolveInsurerId(formData); } catch (error) { redirect(errorUrl(basePath, error instanceof Error ? error.message : "Unable to save insurer.")); }
  if (!insurerId) redirect(errorUrl(basePath, "Select an insurance company."));

  const payload = {
    customer_id: customerId,
    vehicle_id: vehicleId,
    insurance_company_id: insurerId,
    policy_no: policyNo,
    policy_type: policyType,
    insured_declared_value: numberValue(formData, "insured_declared_value"),
    start_date: startDate,
    end_date: endDate
  };
  const result = id ? await admin.from("policies").update(payload).eq("id", id) : await admin.from("policies").insert(payload);
  if (result.error) redirect(errorUrl(basePath, `Policy could not be saved: ${result.error.message}`));

  revalidatePath("/policies");
  if (id) revalidatePath(`/policies/${id}/edit`);
  redirect(`/policies?success=${id ? "policy_updated" : "policy_created"}`);
}

export async function addPolicy(formData: FormData) {
  return savePolicyRecord(null, formData);
}

export async function savePolicy(id: string, formData: FormData) {
  return savePolicyRecord(id, formData);
}
