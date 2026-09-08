"use server";

import { canAccessCustomer } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  resolveInsuranceVerificationCapacity,
  type InsuranceVerificationCapacity,
  type InsuranceVerificationVehicle,
} from "@/lib/insurance-verification-capacity";

type CapacityResult =
  | { ok: true; capacity: InsuranceVerificationCapacity }
  | { ok: false; message: string };

type ClaimVehicleLink = {
  id: string;
  customer_id: string;
  vehicle_id: string;
};

const vehicleCapacitySelect =
  "vehicle_class_code,vehicle_class_description,vehicle_type,fuel_type,engine_capacity_cc,seating_capacity,gvw_kg,vehicle_category";

export async function loadInsuranceVerificationCapacity(claimId: string): Promise<CapacityResult> {
  const cleanClaimId = claimId.trim();
  if (!cleanClaimId) return { ok: false, message: "Vehicle capacity is unavailable for this claim." };

  try {
    const profile = await requireCapability("view_claims");
    if (!profile?.id) return { ok: false, message: "Vehicle capacity is unavailable for this claim." };

    const admin = createSupabaseAdminClient();
    const { data: claim, error: claimError } = await admin
      .from("claims")
      .select("id,customer_id,vehicle_id")
      .eq("id", cleanClaimId)
      .maybeSingle<ClaimVehicleLink>();

    if (claimError || !claim) {
      return { ok: false, message: "Vehicle capacity could not be loaded. Enter the value shown on the insurance copy." };
    }

    if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "view_claims"))) {
      return { ok: false, message: "Vehicle capacity is unavailable for this claim." };
    }

    const { data: vehicle, error: vehicleError } = await admin
      .from("vehicles")
      .select(vehicleCapacitySelect)
      .eq("id", claim.vehicle_id)
      .maybeSingle<InsuranceVerificationVehicle>();

    if (vehicleError || !vehicle) {
      return { ok: false, message: "Vehicle capacity could not be loaded. Enter the value shown on the insurance copy." };
    }

    return { ok: true, capacity: resolveInsuranceVerificationCapacity(vehicle) };
  } catch (error) {
    console.error("loadInsuranceVerificationCapacity failed", error);
    return { ok: false, message: "Vehicle capacity could not be loaded. Enter the value shown on the insurance copy." };
  }
}
