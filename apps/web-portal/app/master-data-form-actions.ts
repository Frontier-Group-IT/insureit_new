"use server";

import { createCustomer, createPolicy, createVehicle, updateCustomer, updatePolicy, updateVehicle } from "@/app/actions";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function ensureCustomerExists(customerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("customers").select("id").eq("id", customerId).maybeSingle<{ id: string }>();
  if (error || !data) throw new Error(error?.message ?? "The selected customer does not exist.");
}

async function ensureVehicleBelongsToCustomer(vehicleId: string, customerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, customer_id")
    .eq("id", vehicleId)
    .eq("customer_id", customerId)
    .maybeSingle<{ id: string; customer_id: string }>();
  if (error || !data) throw new Error(error?.message ?? "The selected vehicle does not belong to the selected customer.");
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
  const customerId = requiredText(formData, "customer_id");
  if (!customerId) throw new Error("Select a customer before adding the vehicle.");
  await ensureCustomerExists(customerId);
  return createVehicle(formData);
}

export async function saveVehicle(id: string, formData: FormData) {
  await requireMasterDataManager();
  const customerId = requiredText(formData, "customer_id");
  if (!customerId) throw new Error("Select a customer before saving the vehicle.");
  await ensureCustomerExists(customerId);
  return updateVehicle(id, formData);
}

export async function addPolicy(formData: FormData) {
  await requireMasterDataManager();
  const customerId = requiredText(formData, "customer_id");
  const vehicleId = requiredText(formData, "vehicle_id");
  if (!customerId || !vehicleId) throw new Error("Select both a customer and one of that customer's vehicles.");
  await ensureVehicleBelongsToCustomer(vehicleId, customerId);
  return createPolicy(formData);
}

export async function savePolicy(id: string, formData: FormData) {
  await requireMasterDataManager();
  const customerId = requiredText(formData, "customer_id");
  const vehicleId = requiredText(formData, "vehicle_id");
  if (!customerId || !vehicleId) throw new Error("Select both a customer and one of that customer's vehicles.");
  await ensureVehicleBelongsToCustomer(vehicleId, customerId);
  return updatePolicy(id, formData);
}
