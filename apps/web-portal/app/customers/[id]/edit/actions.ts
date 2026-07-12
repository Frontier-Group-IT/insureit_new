"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function updateCustomerProfile(id: string, formData: FormData) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) throw new Error("You are not authorized to update customers.");

  const contactName = textValue(formData, "contact_name");
  if (!contactName) throw new Error("Customer name is required.");

  const supabase = await createServerSupabaseClient();
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const panNumber = textValue(formData, "pan_number")?.toUpperCase() ?? null;
  const gstNumber = textValue(formData, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;

  const { error } = await supabase.from("customers").update({
    contact_name: contactName,
    company_name: textValue(formData, "legal_trade_name"),
    legal_trade_name: textValue(formData, "legal_trade_name"),
    email: textValue(formData, "email"),
    address_street: textValue(formData, "address_street"),
    address_locality: textValue(formData, "address_locality"),
    address: textValue(formData, "address"),
    city: textValue(formData, "city"),
    state: textValue(formData, "state"),
    postal_code: textValue(formData, "postal_code"),
    partner_type: textValue(formData, "partner_type"),
    fleet_size_band: textValue(formData, "fleet_size_band"),
    pan_number: panNumber,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    onboarding_status: textValue(formData, "onboarding_status") ?? "active",
    assigned_agent_id: textValue(formData, "assigned_agent_id"),
    updated_by: profile.id
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}/edit`);
  redirect("/customers");
}
