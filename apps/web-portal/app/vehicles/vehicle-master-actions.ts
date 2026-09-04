"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyCapability, requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordVehicleActivity, VEHICLE_ACTIVITY_ACTIONS } from "@/lib/vehicle-activity";
import { isValidVehicleRegistrationNumber, normalizeVehicleRegistrationNumber } from "@/lib/vehicle-registration";

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

function normalizedVehicleIdentity(value: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const vehicleType = requiredText(formData, "vehicle_type");
  const registrationMode = requiredText(formData, "registration_mode") === "unregistered" ? "unregistered" : "registered";
  const chassisNo = normalizedVehicleIdentity(requiredText(formData, "chassis_no"));
  const engineNo = normalizedVehicleIdentity(requiredText(formData, "engine_no"));

  if (!customerId || !vehicleType) {
    return { payload: null, error: "Select a customer and vehicle class." };
  }

  let vehicleNo: string;
  let vehicleNoNormalized: string | null;
  let registrationStatus: "ACTIVE" | "registration_pending";
  let registrationDate: string | null;

  if (registrationMode === "unregistered") {
    if (!chassisNo || !engineNo) {
      return { payload: null, error: "Chassis number and engine number are required for an unregistered vehicle." };
    }
    vehicleNo = `NEW-${chassisNo}`;
    vehicleNoNormalized = null;
    registrationStatus = "registration_pending";
    registrationDate = null;
  } else {
    const rawVehicleNo = requiredText(formData, "vehicle_no") ?? "";
    if (!isValidVehicleRegistrationNumber(rawVehicleNo)) {
      return { payload: null, error: "Enter a valid vehicle registration number." };
    }
    vehicleNo = normalizeVehicleRegistrationNumber(rawVehicleNo);
    vehicleNoNormalized = vehicleNo;
    registrationStatus = "ACTIVE";
    registrationDate = dateValue(formData, "registration_date");
  }

  const capacity = numberValue(formData, "gvw_kg");
  return {
    payload: {
      customer_id: customerId,
      vehicle_no: vehicleNo,
      vehicle_no_normalized: vehicleNoNormalized,
      registration_status: registrationStatus,
      vehicle_type: vehicleType,
      make: requiredText(formData, "make"),
      model: requiredText(formData, "model"),
      year: numberValue(formData, "year"),
      chassis_no: chassisNo || null,
      engine_no: engineNo || null,
      fuel_type: requiredText(formData, "fuel_type"),
      registration_date: registrationDate,
      fitness_expiry_date: dateValue(formData, "fitness_expiry_date"),
      puc_expiry_date: dateValue(formData, "puc_expiry_date"),
      road_tax_expiry_date: dateValue(formData, "road_tax_expiry_date"),
      national_permit_expiry_date: dateValue(formData, "national_permit_expiry_date"),
      local_permit_expiry_date: dateValue(formData, "local_permit_expiry_date"),
      ...capacityColumns(vehicleType, capacity),
    },
    error: null,
  };
}

async function findRegistrationConflict(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  registration: string | null,
  excludeVehicleId?: string,
) {
  if (!registration) return null;
  let query = admin
    .from("vehicles")
    .select("id,vehicle_no")
    .or(`vehicle_no.eq.${registration},vehicle_no_normalized.eq.${registration}`);
  if (excludeVehicleId) query = query.neq("id", excludeVehicleId);
  const { data, error } = await query.limit(1).maybeSingle<{ id: string; vehicle_no: string }>();
  if (error) throw new Error(error.message);
  return data;
}

function isPendingVehicle(vehicle: { vehicle_no: string; registration_status: string | null }) {
  return vehicle.registration_status === "registration_pending" || /^(?:NEW|PENDING)-/i.test(vehicle.vehicle_no);
}

export async function addVehicleMaster(formData: FormData) {
  const profile = await requireAnyCapability([
    { capability: "view_vehicles", minimumAccess: "edit" },
    { capability: "create_vehicles", minimumAccess: "edit" },
  ]);
  const admin = createSupabaseAdminClient();
  const parsed = vehiclePayload(formData);
  if (!parsed.payload) redirect(errorUrl("/vehicles/new", parsed.error ?? "Vehicle details are incomplete."));
  const payload = parsed.payload;

  const { data: customer, error: customerError } = await admin.from("customers").select("id").eq("id", payload.customer_id).maybeSingle<{ id: string }>();
  if (customerError || !customer) redirect(errorUrl("/vehicles/new", customerError?.message ?? "The selected customer does not exist."));

  let registrationConflict: { id: string; vehicle_no: string } | null = null;
  try {
    registrationConflict = await findRegistrationConflict(admin, payload.vehicle_no_normalized);
  } catch (error) {
    redirect(errorUrl("/vehicles/new", `Unable to validate the registration number: ${error instanceof Error ? error.message : "Unknown error"}`));
  }
  if (registrationConflict) {
    redirect(errorUrl("/vehicles/new", `Registration number ${payload.vehicle_no} already belongs to another vehicle.`));
  }

  const { data: vehicle, error } = await admin.from("vehicles").insert(payload).select("id").single<{ id: string }>();
  if (error || !vehicle) redirect(errorUrl("/vehicles/new", `Vehicle could not be saved: ${error?.message ?? "Unknown error"}`));

  await recordVehicleActivity(admin, vehicle.id, profile.id, VEHICLE_ACTIVITY_ACTIONS.VEHICLE_CREATED);
  revalidatePath("/vehicles");
  const nextAction = requiredText(formData, "next_action");
  if (nextAction === "post_save") {
    redirect(`/vehicles/new?vehicle_saved=1&customer_id=${encodeURIComponent(payload.customer_id)}&saved_vehicle_id=${encodeURIComponent(vehicle.id)}`);
  }
  redirect("/vehicles?success=vehicle_created");
}

export async function saveVehicleMaster(id: string, formData: FormData) {
  const profile = await requireCapability("view_vehicles", "edit");
  const admin = createSupabaseAdminClient();
  const parsed = vehiclePayload(formData);
  if (!parsed.payload) redirect(errorUrl(`/vehicles/${id}/edit`, parsed.error ?? "Vehicle details are incomplete."));
  const payload = parsed.payload;

  const { data: currentVehicle, error: currentError } = await admin
    .from("vehicles")
    .select("id,vehicle_no,vehicle_no_normalized,registration_status,registration_date")
    .eq("id", id)
    .maybeSingle<{ id: string; vehicle_no: string; vehicle_no_normalized: string | null; registration_status: string | null; registration_date: string | null }>();
  if (currentError || !currentVehicle) {
    redirect(errorUrl(`/vehicles/${id}/edit`, currentError?.message ?? "The vehicle record no longer exists."));
  }

  const wasPending = isPendingVehicle(currentVehicle);
  const willBePending = payload.registration_status === "registration_pending";
  const convertingRegisteredToPending = !wasPending && willBePending;
  const updatePayload = convertingRegisteredToPending
    ? {
        ...payload,
        vehicle_no: currentVehicle.vehicle_no,
        vehicle_no_normalized: currentVehicle.vehicle_no_normalized ?? normalizeVehicleRegistrationNumber(currentVehicle.vehicle_no),
        registration_date: currentVehicle.registration_date,
      }
    : payload;

  let registrationConflict: { id: string; vehicle_no: string } | null = null;
  try {
    registrationConflict = await findRegistrationConflict(admin, updatePayload.vehicle_no_normalized, id);
  } catch (error) {
    redirect(errorUrl(`/vehicles/${id}/edit`, `Unable to validate the registration number: ${error instanceof Error ? error.message : "Unknown error"}`));
  }
  if (registrationConflict) {
    redirect(errorUrl(`/vehicles/${id}/edit`, `Registration number ${updatePayload.vehicle_no} already belongs to another vehicle.`));
  }

  const { error } = await admin.from("vehicles").update({ ...updatePayload, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(errorUrl(`/vehicles/${id}/edit`, `Vehicle could not be updated: ${error.message}`));

  await recordVehicleActivity(admin, id, profile.id, VEHICLE_ACTIVITY_ACTIONS.VEHICLE_EDITED);
  if (wasPending !== willBePending) {
    await recordVehicleActivity(admin, id, profile.id, VEHICLE_ACTIVITY_ACTIONS.VEHICLE_REGISTRATION_UPDATED);
  }

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  revalidatePath(`/vehicles/${id}/edit`);
  revalidatePath("/policies");
  redirect("/vehicles?success=vehicle_updated");
}
