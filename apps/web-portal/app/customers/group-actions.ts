"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type GroupOnboardingState = { error: string | null; field: string | null };
const BUCKET = "customer-documents";
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function fail(error: string, field: string | null = null): GroupOnboardingState { return { error, field }; }
function text(data: FormData, name: string) { const value = data.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function upload(data: FormData, name: string) { const value = data.get(name); return value instanceof File && value.size > 0 ? value : null; }
function phone(value: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+91${digits}` : null; }
function ext(value: File) { return value.type === "application/pdf" ? "pdf" : value.type === "image/png" ? "png" : "jpg"; }
function checkFile(value: File | null, label: string, required = false) { if (!value) return required ? `${label} is required.` : null; if (!ALLOWED.has(value.type)) return `${label} must be PDF, JPG or PNG.`; if (value.size > 5 * 1024 * 1024) return `${label} must be 5 MB or smaller.`; return null; }

export async function createGroupOnboarding(_state: GroupOnboardingState, data: FormData): Promise<GroupOnboardingState> {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !canManageMasterData(profile.role)) return fail("You are not authorized to onboard groups.");

  const groupName = text(data, "group_name");
  const ownerName = text(data, "owner_name");
  const contactNumber = phone(text(data, "phone"));
  const companyName = text(data, "company_name");
  const companyPan = text(data, "company_pan")?.replace(/\s/g, "").toUpperCase() ?? null;
  const gstNumber = text(data, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;
  const ownerPan = text(data, "owner_pan")?.replace(/\s/g, "").toUpperCase() ?? null;
  const ownerAadhaar = text(data, "owner_aadhaar")?.replace(/\D/g, "") ?? null;
  const city = text(data, "city");
  const state = text(data, "state");
  const postalCode = text(data, "postal_code");
  const locationId = text(data, "india_location_id");
  const fleetSize = text(data, "fleet_size_band");

  if (!groupName) return fail("Enter the group name.", "group_name");
  if (!ownerName) return fail("Enter the owner name.", "owner_name");
  if (!contactNumber) return fail("Enter a valid 10-digit contact number.", "phone");
  if (!companyName) return fail("Enter the company name.", "company_name");
  if (!companyPan || !PAN.test(companyPan)) return fail("Enter a valid company PAN number.", "company_pan");
  if (gstNumber && !GST.test(gstNumber)) return fail("Enter a valid GST number.", "gst_number");
  if (ownerPan && !PAN.test(ownerPan)) return fail("Enter a valid owner PAN number.", "owner_pan");
  if (ownerAadhaar && !/^[0-9]{12}$/.test(ownerAadhaar)) return fail("Enter a valid 12-digit Aadhaar number.", "owner_aadhaar");
  if (!locationId || !city || !state || !postalCode) return fail("Select a city and confirm State and PIN Code.", "city_search");
  if (!fleetSize) return fail("Select the fleet size.", "fleet_size_band");

  const files: Array<[string,string,boolean]> = [
    ["owner_pan_copy","Owner PAN copy",Boolean(ownerPan)],
    ["owner_aadhaar_front","Aadhaar front",Boolean(ownerAadhaar)],
    ["owner_aadhaar_back","Aadhaar back",Boolean(ownerAadhaar)],
    ["gst_copy","GST certificate",Boolean(gstNumber)],
    ["company_pan_copy","Company PAN copy",true]
  ];
  for (const [field,label,required] of files) { const error = checkFile(upload(data, field), label, required); if (error) return fail(error, field); }

  const admin = createSupabaseAdminClient();
  const street = text(data, "address_street");
  const locality = text(data, "address_locality");
  const address = [street, locality, city, state, postalCode].filter(Boolean).join(", ");
  const { data: customer, error: customerError } = await admin.from("customers").insert({
    customer_code: `CUST-${Date.now().toString().slice(-9)}`, partner_type: "group", contact_name: ownerName,
    company_name: groupName, legal_trade_name: companyName, phone: contactNumber, email: text(data, "email"),
    address, address_street: street, address_locality: locality, india_location_id: locationId, city, state, postal_code: postalCode,
    is_gst_registered: Boolean(gstNumber), gst_number: gstNumber, pan_number: ownerPan,
    aadhaar_last_four: ownerAadhaar ? ownerAadhaar.slice(-4) : null, fleet_size_band: fleetSize,
    onboarding_status: "active", created_by: profile.id, updated_by: profile.id
  }).select("id").single<{ id: string }>();
  if (customerError || !customer) return fail(`Group could not be saved: ${customerError?.message ?? "Unknown error"}`);

  const cleanup = async () => { await admin.from("customers").delete().eq("id", customer.id); };
  const { error: groupError } = await admin.from("group_profiles").insert({ customer_id: customer.id, group_name: groupName, owner_name: ownerName, company_name: companyName, company_pan_number: companyPan });
  if (groupError) { await cleanup(); return fail(`Group profile could not be saved: ${groupError.message}`); }

  const roles = ["ceo_head", "admin_head", "dedicated_spoc"] as const;
  const contacts = roles.map((role) => ({ customer_id: customer.id, contact_role: role, contact_name: text(data, `${role}_name`), mobile: phone(text(data, `${role}_mobile`)), email: text(data, `${role}_email`) }));
  const { error: contactsError } = await admin.from("group_contacts").insert(contacts);
  if (contactsError) { await cleanup(); return fail(`Additional contacts could not be saved: ${contactsError.message}`); }

  const documentMap: Array<[string,string]> = [["owner_pan_copy","group_owner_pan_copy"],["owner_aadhaar_front","group_owner_aadhaar_front"],["owner_aadhaar_back","group_owner_aadhaar_back"],["gst_copy","gst_copy"],["company_pan_copy","group_company_pan_copy"]];
  const uploadedPaths: string[] = [];
  for (const [field,documentType] of documentMap) {
    const selected = upload(data, field); if (!selected) continue;
    const path = `${customer.id}/group/${field}/${randomUUID()}.${ext(selected)}`;
    const { error: storageError } = await admin.storage.from(BUCKET).upload(path, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
    if (storageError) { if (uploadedPaths.length) await admin.storage.from(BUCKET).remove(uploadedPaths); await cleanup(); return fail(`Document upload failed: ${storageError.message}`, field); }
    uploadedPaths.push(path);
    const { error: recordError } = await admin.from("customer_documents").insert({ customer_id: customer.id, document_type: documentType, file_name: selected.name, storage_bucket: BUCKET, storage_path: path, mime_type: selected.type, file_size: selected.size, verification_status: "verified", upload_source: "manager_portal", uploaded_by: profile.id, verified_by: profile.id, verified_at: new Date().toISOString() });
    if (recordError) { await admin.storage.from(BUCKET).remove(uploadedPaths); await cleanup(); return fail(`Document record could not be saved: ${recordError.message}`, field); }
  }

  redirect("/customers?success=group_created");
}
