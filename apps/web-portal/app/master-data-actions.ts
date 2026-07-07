"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

async function removeRecord(table: "customers" | "vehicles" | "policies", id: string) {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removePolicy(id: string) {
  await removeRecord("policies", id);
  revalidatePath("/policies");
}

export async function removeVehicle(id: string) {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { count, error: countError } = await supabase.from("policies").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) throw new Error("This vehicle has linked policies. Remove those policies before removing the vehicle.");
  await removeRecord("vehicles", id);
  revalidatePath("/vehicles");
}

export async function removeCustomer(id: string) {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const [{ count: vehicleCount, error: vehicleError }, { count: policyCount, error: policyError }] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("customer_id", id),
    supabase.from("policies").select("id", { count: "exact", head: true }).eq("customer_id", id)
  ]);
  if (vehicleError) throw new Error(vehicleError.message);
  if (policyError) throw new Error(policyError.message);
  if ((vehicleCount ?? 0) > 0 || (policyCount ?? 0) > 0) {
    throw new Error("This customer has linked vehicles or policies. Remove those records before removing the customer.");
  }
  await removeRecord("customers", id);
  revalidatePath("/customers");
}
