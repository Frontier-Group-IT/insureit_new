"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { accessRank, getEffectivePermissionAccessMap } from "@/lib/effective-permissions";

const allowedStatuses = new Set(["open", "in_progress", "resolved", "closed"]);

export async function updateServiceEnquiryStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !allowedStatuses.has(status)) return;

  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile) return;

  const permissions = await getEffectivePermissionAccessMap(profile);
  if (accessRank[permissions.view_tasks ?? "none"] < accessRank.edit) return;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("service_enquiries").update({ status }).eq("id", id);
  if (error) throw new Error("Service enquiry status could not be updated.");

  revalidatePath("/service-enquiries");
}
