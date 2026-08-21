"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordVehicleActivity, VEHICLE_ACTIVITY_ACTIONS } from "@/lib/vehicle-activity";

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  return value ? Number(value) : null;
}

function dateValue(formData: FormData, name: string) {
  return requiredText(formData, name);
}

function errorUrl(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

function capacityColumns(vehicleType: string, capacity: number | null) {
  return {
    engine_capacity_cc: vehicleType === "PCP" || vehicleType === "TWP" || vehicleType === "MISD" ? capacity : null,
    seating_capacity: vehicleType === "PCV" ? capacity : null,
    gvw_kg: vehicleType === "GCV" || vehicleType === "CPM" ? capacity : null,
  };
}

function vehiclePayload(formData: FormData) {
  const customerId = requiredText(formData, "customer_id");
  const vehicleNo = requiredText(formData, "vehicle_no")?.replace(/\s/g, "").toUpperCase() ?? null;
  const vehicleType = requiredText(formData, "vehicle_type");
  if (!customerId || !vehicleNo || !vehicleType) return null;

  const capacity = numberValue(formData, "gvw_kg");
  return {
    customer_id: customerId,
    vehicle_no: vehicleNo,
    vehicle_type: vehicleType,
    make: requiredText(formData, "make"),
    model: requiredText(formData, "model"),
    year: numberValue(formData, "year"),
    chassis_no: requiredText(formData, "chassis_no")?.toUpperCase() ?? null,
    engine_no: requiredText(formData, "engine_no")?.toUpperCase() ?? null,
    fuel_type: requiredText(formData, "fuel_type"),
    registration_date: dateValue(formData, "registration_date"),
    fitness_expiry_date: dateValue(formData, "fitness_expiry_date"),
    puc_expiry_date: dateValue(formData, "puc_expiry_date"),
    road_tax_expiry_date: dateValue(formData, "road_tax_expiry_date"),
    national_permit_expiry_date: dateValue(formData, "national_permit_expiry_date"),
    local_permit_expiry_date: dateValue(formData, "local_permit_expiry_date"),
    ...capacityColumns(vehicleType, capacity),
  };
}

export async function addVehicleMaster(formData: FormData) {
  const profile = await requireCapability("view_vehicles", "edit");
  const admin = createSupabaseAdminClient();
  const payload = vehiclePayload(formData);
  if (!payload) redirect(errorUrl("/vehicles/new", "Select a customer and enter the vehicle number and class."));

  const { data: customer, error: customerError } = await admin.from("customers").select("id").eq("id", payload.customer_id).maybeSingle<{ id: string }>();
  if (customerError || !customer) redirect(errorUrl("/vehicles/new", customerError?.message ?? "The selected customer does not exist."));

  const { data: vehicle, error } = await admin.from("vehicles").insert(payload).select("id").single<{ id: string }>();
  if (error || !vehicle) redirect(errorUrl("/vehicles/new", `Vehicle could not be saved: ${error?.message ?? "Unknown error"}`));

  await recordVehicleActivity(admin, vehicle.id, profile.id, VEHICLE_ACTIVITY_ACTIONS.VEHICLE_CREATED);
  revalidatePath("/vehicles");
  redirect("/vehicles?success=vehicle_created");
}

export async function saveVehicleMaster(id: string, formData: FormData) {
  const profile = await requireCapability("view_vehicles", "edit");
  const admin = createSupabaseAdminClient();
  const payload = vehiclePayload(formData);
  if (!payload) redirect(errorUrl(`/vehicles/${id}/edit`, "Select a customer and enter the vehicle number and class."));

  const { error } = await admin.from("vehicles").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(errorUrl(`/vehicles/${id}/edit`, `Vehicle could not be updated: ${error.message}`));

  await recordVehicleActivity(admin, id, profile.id, VEHICLE_ACTIVITY_ACTIONS.VEHICLE_EDITED);
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}/edit`);
  revalidatePath("/policies");
  redirect("/vehicles?success=vehicle_updated");
}
