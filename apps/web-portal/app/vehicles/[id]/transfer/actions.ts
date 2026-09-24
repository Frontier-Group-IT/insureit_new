"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TRANSFER_ROLES = new Set(["manager", "admin", "super_admin", "it_super_user"]);

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorUrl(vehicleId: string, message: string) {
  return `/vehicles/${vehicleId}/transfer?error=${encodeURIComponent(message)}`;
}

export async function transferVehicleCustomer(vehicleId: string, formData: FormData) {
  const profile = await requireCapability("view_vehicles", "edit");
  if (!profile?.id || !TRANSFER_ROLES.has(profile.role ?? "")) {
    redirect("/access-denied");
  }

  const destinationCustomerId = textValue(formData, "destination_customer_id");
  const effectiveDate = textValue(formData, "effective_date");
  const reason = textValue(formData, "reason");
  const confirmEverything = formData.get("confirm_everything") === "on";

  if (!destinationCustomerId) redirect(errorUrl(vehicleId, "Select the customer receiving this vehicle."));
  if (!effectiveDate) redirect(errorUrl(vehicleId, "Select the transfer effective date."));
  if (reason.length < 5) redirect(errorUrl(vehicleId, "Enter a clear transfer reason."));
  if (!confirmEverything) {
    redirect(errorUrl(vehicleId, "Confirm that the vehicle and every associated dependency will transfer together."));
  }

  const admin = createSupabaseAdminClient();
  const { data: vehicle, error: vehicleError } = await admin
    .from("vehicles")
    .select("id,customer_id")
    .eq("id", vehicleId)
    .maybeSingle<{ id: string; customer_id: string }>();

  if (vehicleError || !vehicle) redirect(errorUrl(vehicleId, "Vehicle could not be found."));
  if (vehicle.customer_id === destinationCustomerId) redirect(errorUrl(vehicleId, "The selected customer already owns this vehicle."));

  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_vehicles");
  if (accessibleCustomerIds !== null) {
    if (!accessibleCustomerIds.includes(vehicle.customer_id) || !accessibleCustomerIds.includes(destinationCustomerId)) {
      redirect("/access-denied");
    }
  }

  const { data: destination, error: destinationError } = await admin
    .from("customers")
    .select("id,status")
    .eq("id", destinationCustomerId)
    .maybeSingle<{ id: string; status: string | null }>();

  if (destinationError || !destination || (destination.status && destination.status.toLowerCase() !== "active")) {
    redirect(errorUrl(vehicleId, "The destination customer is not active or could not be found."));
  }

  const { data, error } = await admin.rpc("transfer_vehicle_customer_v1", {
    p_vehicle_id: vehicleId,
    p_new_customer_id: destinationCustomerId,
    p_effective_date: effectiveDate,
    p_reason: reason,
    p_actor_profile_id: profile.id,
  });

  if (error) {
    console.error("vehicle_customer_transfer_failed", { vehicleId, destinationCustomerId, actorProfileId: profile.id, error: error.message });
    redirect(errorUrl(vehicleId, "Transfer failed. No records were moved."));
  }
  const result = data as { ok?: boolean } | null;
  if (!result?.ok) redirect(errorUrl(vehicleId, "Transfer could not be completed. No records were moved."));

  for (const path of [
    "/vehicles",
    `/vehicles/${vehicleId}`,
    "/policies",
    "/claims",
    "/customers",
    "/dashboard",
  ]) {
    revalidatePath(path);
  }

  redirect(`/vehicles/${vehicleId}?success=vehicle_transferred`);
}
