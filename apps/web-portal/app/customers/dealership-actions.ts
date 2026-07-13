"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DealershipOnboardingState = { error: string | null; field: string | null };

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function fail(error: string, field: string | null = null): DealershipOnboardingState { return { error, field }; }
function text(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function file(formData: FormData, name: string) { const value = formData.get(name); return value instanceof File && value.size > 0 ? value : null; }
function normalizePhone(value: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+91${digits}` : digits.length === 12 && digits.startsWith("91") ? `+${digits}` : null; }
function extension(value: File) { if (value.type === "application/pdf") return "pdf"; if (value.type === "image/png") return "png"; return "jpg"; }
function validateFile(value: File | null, label: string, required = false) { if (!value) return required ? `${label} is required.` : null; if (!ALLOWED_FILE_TYPES.has(value.type)) return `${label} must be PDF, JPG or PNG.`; if (value.size > MAX_FILE_SIZE) return `${label} must be 5 MB or smaller.`; return null; }

export async function createDealershipOnboarding(_state: DealershipOnboardingState, formData: FormData): Promise<DealershipOnboardingState> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) return fail("You are not authorized to onboard dealerships.");

  const dealershipType = text(formData, "dealership_type");
  const dealershipName = text(formData, "dealership_name");
  const ownerName = text(formData, "owner_name");
  const phone = normalizePhone(text(formData, "phone"));
  const email = text(formData, "email");
  const city = text(formData, "city");
  const state = text(formData, "state");
  const postalCode = text(formData, "postal_code");
  const locationId = text(formData, "india_location_id");
  const oemName = text(formData, "oem_name");
  const yearlySalesBand = text(formData, "yearly_sales_band");
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const gstNumber = text(formData, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;
  const representativeName = text(formData, "representative_name");
  const representativePhone = normalizePhone(text(formData, "representative_mobile"));
  const representativeEmail = text(formData, "representative_email");
  const aadhaarNumber = text(formData, "representative_aadhaar")?.replace(/\D/g, "") ?? null;
  const panNumber = text(formData, "representative_pan")?.replace(/\s/g, "").toUpperCase() ?? null;

  if (dealershipType !== "posp" && dealershipType !== "misp") return fail("Choose POSP or MISP.", "dealership_type");
  if (!dealershipName) return fail("Enter the dealership name.", "dealership_name");
  if (!ownerName) return fail("Enter the owner name.", "owner_name");
  if (!phone) return fail("Enter a valid 10-digit mobile number.", "phone");
  if (!locationId || !city || !state || !postalCode) return fail("Select a city and confirm State and PIN Code.", "city_search");
  if (!oemName) return fail("Select the dealership OEM.", "oem_name");
  if (!yearlySalesBand) return fail("Select yearly sales.", "yearly_sales_band");
  if (isGstRegistered && (!gstNumber || !GSTIN_PATTERN.test(gstNumber))) return fail("Enter a valid 15-character GSTIN.", "gst_number");
  if (!representativeName) return fail(`Enter the ${dealershipType === "posp" ? "POSP" : "DP"} name.`, "representative_name");
  if (!representativePhone) return fail("Enter a valid representative mobile number.", "representative_mobile");
  if (!aadhaarNumber || !/^[0-9]{12}$/.test(aadhaarNumber)) return fail("Enter a valid 12-digit Aadhaar number.", "representative_aadhaar");
  if (!panNumber || !PAN_PATTERN.test(panNumber)) return fail("Enter a valid PAN number.", "representative_pan");

  const requiredFiles: Array<[string, string, boolean]> = [
    ["gst_copy", "GST certificate", isGstRegistered],
    ["representative_aadhaar_front", "Aadhaar front", true],
    ["representative_aadhaar_back", "Aadhaar back", true],
    ["representative_pan_copy", "PAN copy", true]
  ];
  for (const [field, label, required] of requiredFiles) { const error = validateFile(file(formData, field), label, required); if (error) return fail(error, field); }

  const admin = createSupabaseAdminClient();
  const addressStreet = text(formData, "address_street");
  const addressLocality = text(formData, "address_locality");
  const address = [addressStreet, addressLocality, city, state, postalCode].filter(Boolean).join(", ");

  const { data: customer, error: customerError } = await admin.from("customers").insert({
    customer_code: `CUST-${Date.now().toString().slice(-9)}`,
    partner_type: "dealership",
    contact_name: ownerName,
    company_name: dealershipName,
    legal_trade_name: dealershipName,
    phone,
    email,
    address,
    address_street: addressStreet,
    address_locality: addressLocality,
    india_location_id: locationId,
    city,
    state,
    postal_code: postalCode,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    onboarding_status: "active",
    created_by: profile.id,
    updated_by: profile.id
  }).select("id").single<{ id: string }>();
  if (customerError || !customer) return fail(`Dealership could not be saved: ${customerError?.message ?? "Unknown error"}`);

  const cleanup = async () => { await admin.from("customers").delete().eq("id", customer.id); };
  const { error: dealershipError } = await admin.from("dealership_profiles").insert({ customer_id: customer.id, dealership_type: dealershipType, dealership_name: dealershipName, owner_name: ownerName, oem_name: oemName, yearly_sales_band: yearlySalesBand });
  if (dealershipError) { await cleanup(); return fail(`Dealership profile could not be saved: ${dealershipError.message}`); }

  const { error: representativeError } = await admin.from("dealership_representatives").insert({
    customer_id: customer.id,
    representative_type: dealershipType,
    representative_name: representativeName,
    mobile: representativePhone,
    email: representativeEmail,
    aadhaar_last_four: aadhaarNumber.slice(-4),
    aadhaar_hash: createHash("sha256").update(aadhaarNumber).digest("hex"),
    pan_number: panNumber
  });
  if (representativeError) { await cleanup(); return fail(`Representative details could not be saved: ${representativeError.message}`); }

  const roles = ["sales_head", "bodyshop_head", "insurance_head", "insurance_spoc"] as const;
  const contacts = roles.map((role) => ({ customer_id: customer.id, contact_role: role, contact_name: text(formData, `${role}_name`), mobile: normalizePhone(text(formData, `${role}_mobile`)), email: text(formData, `${role}_email`) }));
  const { error: contactsError } = await admin.from("dealership_contacts").insert(contacts);
  if (contactsError) { await cleanup(); return fail(`Additional contacts could not be saved: ${contactsError.message}`); }

  const documentMap: Array<[string, string]> = [
    ["gst_copy", "gst_copy"],
    ["representative_aadhaar_front", "aadhaar_front"],
    ["representative_aadhaar_back", "aadhaar_back"],
    ["representative_pan_copy", "pan_copy"]
  ];
  const uploaded: string[] = [];
  for (const [field, documentType] of documentMap) {
    const selected = file(formData, field); if (!selected) continue;
    const storagePath = `${customer.id}/dealership/${field}/${randomUUID()}.${extension(selected)}`;
    const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
    if (uploadError) { if (uploaded.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploaded); await cleanup(); return fail(`Document upload failed: ${uploadError.message}`, field); }
    uploaded.push(storagePath);
    const { error: metadataError } = await admin.from("customer_documents").insert({ customer_id: customer.id, document_type: documentType, file_name: selected.name, storage_bucket: DOCUMENT_BUCKET, storage_path: storagePath, mime_type: selected.type, file_size: selected.size, verification_status: "verified", upload_source: "manager_portal", uploaded_by: profile.id, verified_by: profile.id, verified_at: new Date().toISOString() });
    if (metadataError) { await admin.storage.from(DOCUMENT_BUCKET).remove(uploaded); await cleanup(); return fail(`Document record could not be saved: ${metadataError.message}`, field); }
  }

  redirect("/customers?success=dealership_created");
}
