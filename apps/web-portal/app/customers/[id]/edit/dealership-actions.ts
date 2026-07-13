"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DealershipEditState = { error: string | null; field: string | null };

const BUCKET = "customer-documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function fail(error: string, field: string | null = null): DealershipEditState { return { error, field }; }
function text(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function selectedFile(formData: FormData, name: string) { const value = formData.get(name); return value instanceof File && value.size > 0 ? value : null; }
function phone(value: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+91${digits}` : digits.length === 12 && digits.startsWith("91") ? `+${digits}` : null; }
function ext(value: File) { return value.type === "application/pdf" ? "pdf" : value.type === "image/png" ? "png" : "jpg"; }
function validateUpload(value: File | null, label: string) { if (!value) return null; if (!ALLOWED.has(value.type)) return `${label} must be PDF, JPG or PNG.`; if (value.size > MAX_FILE_SIZE) return `${label} must be 5 MB or smaller.`; return null; }

export async function updateDealershipProfile(customerId: string, _state: DealershipEditState, formData: FormData): Promise<DealershipEditState> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) return fail("You are not authorized to update dealerships.");

  const dealershipType = text(formData, "dealership_type");
  const dealershipName = text(formData, "dealership_name");
  const ownerName = text(formData, "owner_name");
  const primaryPhone = phone(text(formData, "phone"));
  const city = text(formData, "city");
  const state = text(formData, "state");
  const postalCode = text(formData, "postal_code");
  const oemName = text(formData, "oem_name");
  const yearlySalesBand = text(formData, "yearly_sales_band");
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const gstNumber = text(formData, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;
  const representativeName = text(formData, "representative_name");
  const representativePhone = phone(text(formData, "representative_mobile"));
  const representativePan = text(formData, "representative_pan")?.replace(/\s/g, "").toUpperCase() ?? null;
  const aadhaar = text(formData, "representative_aadhaar")?.replace(/\D/g, "") ?? null;

  if (dealershipType !== "posp" && dealershipType !== "misp") return fail("Choose POSP or MISP.", "dealership_type");
  if (!dealershipName) return fail("Enter the dealership name.", "dealership_name");
  if (!ownerName) return fail("Enter the owner name.", "owner_name");
  if (!primaryPhone) return fail("Enter a valid 10-digit mobile number.", "phone");
  if (!city || !state || !postalCode) return fail("Complete City, State and PIN Code.", "city_search");
  if (!oemName) return fail("Select the dealership OEM.", "oem_name");
  if (!yearlySalesBand) return fail("Select yearly sales.", "yearly_sales_band");
  if (isGstRegistered && (!gstNumber || !GSTIN.test(gstNumber))) return fail("Enter a valid GSTIN.", "gst_number");
  if (!representativeName) return fail(`Enter the ${dealershipType === "posp" ? "POSP" : "DP"} name.`, "representative_name");
  if (!representativePhone) return fail("Enter a valid representative mobile number.", "representative_mobile");
  if (representativePan && !PAN.test(representativePan)) return fail("Enter a valid PAN number.", "representative_pan");
  if (aadhaar && !/^[0-9]{12}$/.test(aadhaar)) return fail("Enter a valid 12-digit Aadhaar number.", "representative_aadhaar");

  const uploadFields: Array<[string, string, string]> = [
    ["gst_copy", "gst_copy", "GST certificate"],
    ["representative_aadhaar_front", "aadhaar_front", "Aadhaar front"],
    ["representative_aadhaar_back", "aadhaar_back", "Aadhaar back"],
    ["representative_pan_copy", "pan_copy", "PAN copy"]
  ];
  for (const [field, , label] of uploadFields) { const error = validateUpload(selectedFile(formData, field), label); if (error) return fail(error, field); }

  const admin = createSupabaseAdminClient();
  const addressStreet = text(formData, "address_street");
  const addressLocality = text(formData, "address_locality");
  const address = [addressStreet, addressLocality, city, state, postalCode].filter(Boolean).join(", ");

  const { error: customerError } = await admin.from("customers").update({
    contact_name: ownerName, company_name: dealershipName, legal_trade_name: dealershipName,
    phone: primaryPhone, email: text(formData, "email"), address, address_street: addressStreet,
    address_locality: addressLocality, india_location_id: text(formData, "india_location_id"), city, state,
    postal_code: postalCode, is_gst_registered: isGstRegistered, gst_number: isGstRegistered ? gstNumber : null,
    updated_by: profile.id, updated_at: new Date().toISOString()
  }).eq("id", customerId);
  if (customerError) return fail(`Dealership details could not be updated: ${customerError.message}`);

  const { error: profileError } = await admin.from("dealership_profiles").upsert({
    customer_id: customerId, dealership_type: dealershipType, dealership_name: dealershipName,
    owner_name: ownerName, oem_name: oemName, yearly_sales_band: yearlySalesBand,
    updated_at: new Date().toISOString()
  }, { onConflict: "customer_id" });
  if (profileError) return fail(`Business profile could not be updated: ${profileError.message}`);

  const representativePayload: Record<string, unknown> = {
    customer_id: customerId, representative_type: dealershipType, representative_name: representativeName,
    mobile: representativePhone, email: text(formData, "representative_email"), pan_number: representativePan,
    updated_at: new Date().toISOString()
  };
  if (aadhaar) { representativePayload.aadhaar_last_four = aadhaar.slice(-4); representativePayload.aadhaar_hash = createHash("sha256").update(aadhaar).digest("hex"); }
  const { error: representativeError } = await admin.from("dealership_representatives").upsert(representativePayload, { onConflict: "customer_id" });
  if (representativeError) return fail(`Representative details could not be updated: ${representativeError.message}`);

  for (const role of ["sales_head", "bodyshop_head", "insurance_head", "insurance_spoc"] as const) {
    const { error } = await admin.from("dealership_contacts").upsert({
      customer_id: customerId, contact_role: role, contact_name: text(formData, `${role}_name`),
      mobile: phone(text(formData, `${role}_mobile`)), email: text(formData, `${role}_email`), updated_at: new Date().toISOString()
    }, { onConflict: "customer_id,contact_role" });
    if (error) return fail(`Additional contacts could not be updated: ${error.message}`);
  }

  for (const [field, documentType] of uploadFields) {
    const upload = selectedFile(formData, field); if (!upload) continue;
    const storagePath = `${customerId}/dealership/${field}/${randomUUID()}.${ext(upload)}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, new Uint8Array(await upload.arrayBuffer()), { contentType: upload.type, upsert: false });
    if (uploadError) return fail(`Document upload failed: ${uploadError.message}`, field);
    const { error: metadataError } = await admin.from("customer_documents").insert({
      customer_id: customerId, document_type: documentType, file_name: upload.name, storage_bucket: BUCKET,
      storage_path: storagePath, mime_type: upload.type, file_size: upload.size, verification_status: "verified",
      upload_source: "manager_portal", uploaded_by: profile.id, verified_by: profile.id, verified_at: new Date().toISOString()
    });
    if (metadataError) { await admin.storage.from(BUCKET).remove([storagePath]); return fail(`Document record could not be saved: ${metadataError.message}`, field); }
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}/edit`);
  redirect("/customers?success=dealership_updated");
}
