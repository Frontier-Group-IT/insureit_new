"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const ROLES = ["ceo_head", "admin_head", "dedicated_spoc"] as const;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function text(data: FormData, name: string) { const value = data.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function phone(value: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+91${digits}` : null; }

export async function updateCorporateProfile(customerId: string, formData: FormData) {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !canManageMasterData(profile.role)) redirect(`/customers/${customerId}/edit?error=unauthorized`);

  const companyName = text(formData, "company_name");
  const pan = text(formData, "company_pan")?.replace(/\s/g, "").toUpperCase() ?? null;
  const gst = text(formData, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;
  const street = text(formData, "address_street"); const locality = text(formData, "address_locality");
  const city = text(formData, "city"); const state = text(formData, "state"); const postalCode = text(formData, "postal_code");
  const locationId = text(formData, "india_location_id"); const fleet = text(formData, "fleet_size_band");
  if (!companyName || !pan || !PAN.test(pan) || (gst && !GST.test(gst)) || !street || !city || !state || !postalCode || !locationId || !fleet) redirect(`/customers/${customerId}/edit?error=invalid_corporate_details`);

  const contacts = ROLES.map((role) => ({ role, name: text(formData, `${role}_name`), phone: phone(text(formData, `${role}_mobile`)), email: text(formData, `${role}_email`) }));
  if (contacts.some((contact) => !contact.name || !contact.phone) || new Set(contacts.map((contact) => contact.phone)).size !== 3) redirect(`/customers/${customerId}/edit?error=invalid_contacts`);
  const spoc = contacts.find((contact) => contact.role === "dedicated_spoc")!;
  const admin = createSupabaseAdminClient();

  const { error: customerError } = await admin.from("customers").update({ company_name: companyName, legal_trade_name: companyName, contact_name: spoc.name, phone: spoc.phone, email: spoc.email, pan_number: pan, is_gst_registered: Boolean(gst), gst_number: gst, address: [street, locality, city, state, postalCode].filter(Boolean).join(", "), address_street: street, address_locality: locality, india_location_id: locationId, city, state, postal_code: postalCode, fleet_size_band: fleet, updated_by: profile.id }).eq("id", customerId).eq("partner_type", "corporate");
  if (customerError) redirect(`/customers/${customerId}/edit?error=customer_update_failed`);

  for (const contact of contacts) {
    const { data: existing } = await admin.from("customer_contacts").select("profile_id,access_status").eq("customer_id", customerId).eq("contact_role", contact.role).maybeSingle<{ profile_id: string | null; access_status: string }>();
    await admin.from("customer_contacts").upsert({ customer_id: customerId, contact_role: contact.role, full_name: contact.name!, phone: contact.phone!, email: contact.email, profile_id: existing?.profile_id ?? null, login_required: true, access_status: existing?.access_status ?? "pending", updated_at: new Date().toISOString(), created_by: profile.id }, { onConflict: "customer_id,contact_role" });
    const membership = await admin.from("customer_memberships").select("id,profile_id,status").eq("customer_id", customerId).eq("membership_role", contact.role).maybeSingle<{ id:string; profile_id:string|null; status:string }>();
    if (membership.data) await admin.from("customer_memberships").update({ invited_phone: contact.phone, invited_email: contact.email, is_primary: contact.role === "dedicated_spoc", updated_at: new Date().toISOString() }).eq("id", membership.data.id);
    else await admin.from("customer_memberships").insert({ customer_id: customerId, invited_phone: contact.phone, invited_email: contact.email, membership_role: contact.role, is_primary: contact.role === "dedicated_spoc", status: "pending", created_by: profile.id });
  }

  revalidatePath(`/customers/${customerId}/edit`);
  revalidatePath("/customers");
  redirect(`/customers/${customerId}/edit?success=corporate_updated`);
}
