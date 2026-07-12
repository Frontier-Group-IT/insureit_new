"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type CustomerOnboardingState = { error: string | null; field: string | null };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_BUCKET = "customer-documents";
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

type DocumentInput = { field: string; type: "pan_copy" | "aadhaar_front" | "aadhaar_back" | "gst_copy" };
type ExistingCustomer = { id: string; profile_id: string | null; phone: string; pan_number: string | null; onboarding_status: string };

function failure(error: string, field: string | null = null): CustomerOnboardingState { return { error, field }; }
function textValue(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function fileValue(formData: FormData, name: string) { const value = formData.get(name); return value instanceof File && value.size > 0 ? value : null; }
function normalizeIndianPhone(value: string) { const digits = value.replace(/\D/g, ""); if (digits.length === 10) return `+91${digits}`; if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`; if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`; return null; }
function safeExtension(file: File) { if (file.type === "application/pdf") return "pdf"; if (file.type === "image/png") return "png"; return "jpg"; }
function validateDocument(file: File | null, label: string) { if (!file) return null; if (!ALLOWED_FILE_TYPES.has(file.type)) return `${label} must be a PDF, JPG or PNG file.`; if (file.size > MAX_FILE_SIZE) return `${label} must be 5 MB or smaller.`; return null; }

export async function createCustomerOnboarding(_previousState: CustomerOnboardingState, formData: FormData): Promise<CustomerOnboardingState> {
  const partnerType = textValue(formData, "partner_type");
  const contactName = textValue(formData, "contact_name");
  const rawPhone = textValue(formData, "phone");
  const phone = rawPhone ? normalizeIndianPhone(rawPhone) : null;
  const email = textValue(formData, "email");
  const locationId = textValue(formData, "india_location_id");
  const city = textValue(formData, "city");
  const state = textValue(formData, "state");
  const postalCode = textValue(formData, "postal_code");
  const panNumber = textValue(formData, "pan_number")?.replace(/\s/g, "").toUpperCase() ?? null;
  const aadhaarNumber = textValue(formData, "aadhaar_number")?.replace(/\D/g, "") ?? null;
  const fleetSizeBand = textValue(formData, "fleet_size_band");
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const legalTradeName = textValue(formData, "legal_trade_name");
  const gstNumber = textValue(formData, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;

  if (partnerType !== "individual_proprietor") return failure("Only the Individual / Proprietor workflow is available in this release.", "partner_type");
  if (!contactName) return failure("Enter the customer or proprietor name.", "contact_name");
  if (!phone) return failure("Enter a valid 10-digit mobile number.", "phone");
  if (!locationId || !city || !state || !postalCode) return failure("Select a city from the suggestions and confirm State and PIN Code.", "city_search");
  if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) return failure("Enter a valid PAN number.", "pan_number");
  if (!aadhaarNumber || !/^[0-9]{12}$/.test(aadhaarNumber)) return failure("Enter a valid 12-digit Aadhaar number.", "aadhaar_number");
  if (!fleetSizeBand) return failure("Select the customer fleet size.", "fleet_size_band");
  if (isGstRegistered && !legalTradeName) return failure("Legal Trade Name is required for a GST-registered customer.", "legal_trade_name");
  if (isGstRegistered && !gstNumber) return failure("GST Number is required for a GST-registered customer.", "gst_number");
  if (isGstRegistered && gstNumber && !GSTIN_PATTERN.test(gstNumber)) return failure("Enter a valid 15-character GSTIN, for example 22AAAAA0000A1Z5.", "gst_number");

  const documentInputs: DocumentInput[] = [
    { field: "pan_copy", type: "pan_copy" },
    { field: "aadhaar_front", type: "aadhaar_front" },
    { field: "aadhaar_back", type: "aadhaar_back" },
    { field: "gst_copy", type: "gst_copy" }
  ];
  const labels: Record<DocumentInput["type"], string> = { pan_copy: "PAN copy", aadhaar_front: "Aadhaar front", aadhaar_back: "Aadhaar back", gst_copy: "GST copy" };
  for (const input of documentInputs) { const validationError = validateDocument(fileValue(formData, input.field), labels[input.type]); if (validationError) return failure(validationError, input.field); }

  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) return failure("You are not authorized to onboard customers.");

  let admin;
  try { admin = createSupabaseAdminClient(); } catch (error) { return failure(error instanceof Error ? error.message : "Supabase Admin configuration is missing."); }

  let profileId: string;
  let createdAuthUserId: string | null = null;
  const { data: existingProfile, error: existingProfileError } = await admin.from("profiles").select("id, role").eq("phone", phone).limit(1).maybeSingle<{ id: string; role: string }>();
  if (existingProfileError) return failure(`Unable to check mobile login: ${existingProfileError.message}`, "phone");
  if (existingProfile) {
    if (existingProfile.role !== "customer") return failure("This mobile number is already assigned to an internal user account.", "phone");
    profileId = existingProfile.id;
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({ phone, phone_confirm: true, email: email ?? undefined, app_metadata: { app_role: "customer" }, user_metadata: { full_name: contactName, phone, app_role: "customer" } });
    if (authError || !authData.user) return failure(`Mobile OTP account could not be created: ${authError?.message ?? "Unknown authentication error"}`, "phone");
    profileId = authData.user.id;
    createdAuthUserId = authData.user.id;
    const { error: profileUpdateError } = await admin.from("profiles").update({ full_name: contactName, phone, role: "customer" }).eq("id", profileId);
    if (profileUpdateError) { await admin.auth.admin.deleteUser(createdAuthUserId); return failure(`Customer profile could not be prepared: ${profileUpdateError.message}`, "phone"); }
  }

  const { data: matchingCustomers, error: matchingCustomerError } = await admin.from("customers").select("id, profile_id, phone, pan_number, onboarding_status").or(`profile_id.eq.${profileId},phone.eq.${phone}`).order("created_at", { ascending: true }).limit(3).returns<ExistingCustomer[]>();
  if (matchingCustomerError) { if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId); return failure(`Unable to check the existing customer record: ${matchingCustomerError.message}`, "phone"); }
  if ((matchingCustomers?.length ?? 0) > 1) return failure("More than one customer record already exists for this mobile number. Run the duplicate-customer repair migration before retrying.", "phone");
  const existingCustomer = matchingCustomers?.[0] ?? null;

  const { data: duplicatePan, error: panLookupError } = await admin.from("customers").select("id").eq("pan_number", panNumber).limit(2).returns<Array<{ id: string }>>();
  if (panLookupError) return failure(`Unable to validate PAN number: ${panLookupError.message}`, "pan_number");
  if ((duplicatePan ?? []).some((row) => row.id !== existingCustomer?.id)) return failure("A different customer already uses this PAN number.", "pan_number");

  const customerCode = `CUST-${Date.now().toString().slice(-9)}`;
  const aadhaarHash = createHash("sha256").update(aadhaarNumber).digest("hex");
  const addressStreet = textValue(formData, "address_street");
  const addressLocality = textValue(formData, "address_locality");
  const address = [addressStreet, addressLocality, city, state, postalCode].filter(Boolean).join(", ");
  const suppliedDocumentTypes = documentInputs.filter((item) => fileValue(formData, item.field)).map((item) => item.type);
  const requiredDocumentTypes = isGstRegistered ? ["pan_copy", "aadhaar_front", "aadhaar_back", "gst_copy"] : ["pan_copy", "aadhaar_front", "aadhaar_back"];
  const hasAllDocuments = requiredDocumentTypes.every((type) => suppliedDocumentTypes.includes(type as DocumentInput["type"]));

  const customerPayload = {
    profile_id: profileId, partner_type: partnerType, contact_name: contactName, company_name: legalTradeName, phone, email, address,
    address_street: addressStreet, address_locality: addressLocality, india_location_id: locationId, city, state, postal_code: postalCode,
    pan_number: panNumber, aadhaar_last_four: aadhaarNumber.slice(-4), aadhaar_hash: aadhaarHash, legal_trade_name: legalTradeName,
    is_gst_registered: isGstRegistered, gst_number: isGstRegistered ? gstNumber : null, fleet_size_band: fleetSizeBand,
    onboarding_status: hasAllDocuments ? "active" : "documents_pending", onboarding_completed_at: hasAllDocuments ? new Date().toISOString() : null, updated_by: profile.id
  };

  let customer: { id: string } | null = null;
  let customerError: { message: string } | null = null;
  let createdCustomer = false;
  if (existingCustomer) {
    const result = await admin.from("customers").update(customerPayload).eq("id", existingCustomer.id).select("id").single<{ id: string }>(); customer = result.data; customerError = result.error;
  } else {
    const result = await admin.from("customers").insert({ ...customerPayload, customer_code: customerCode, created_by: profile.id }).select("id").single<{ id: string }>(); customer = result.data; customerError = result.error; createdCustomer = Boolean(result.data);
  }

  if (customerError || !customer) {
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
    if (customerError?.message.includes("customers_gst_number_format_check")) return failure("Enter a valid 15-character GSTIN, for example 22AAAAA0000A1Z5.", "gst_number");
    if (customerError?.message.includes("customers_phone_normalized_uidx") || customerError?.message.includes("customers_profile_id_uidx")) return failure("A customer record already exists for this mobile login. Refresh the Customers page and edit that record instead.", "phone");
    return failure(`Customer could not be saved: ${customerError?.message ?? "Unknown database error"}`);
  }

  const uploadedPaths: string[] = [];
  for (const input of documentInputs) {
    const file = fileValue(formData, input.field); if (!file) continue;
    const storagePath = `${customer.id}/${input.type}/${randomUUID()}.${safeExtension(file)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (uploadError) { if (uploadedPaths.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths); if (createdCustomer) await admin.from("customers").delete().eq("id", customer.id); if (createdAuthUserId && createdCustomer) await admin.auth.admin.deleteUser(createdAuthUserId); return failure(`${labels[input.type]} upload failed: ${uploadError.message}`, input.field); }
    uploadedPaths.push(storagePath);
    const { error: metadataError } = await admin.from("customer_documents").insert({ customer_id: customer.id, document_type: input.type, file_name: file.name, storage_bucket: DOCUMENT_BUCKET, storage_path: storagePath, mime_type: file.type, file_size: file.size, verification_status: "pending", uploaded_by: profile.id });
    if (metadataError) { await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths); if (createdCustomer) await admin.from("customers").delete().eq("id", customer.id); if (createdAuthUserId && createdCustomer) await admin.auth.admin.deleteUser(createdAuthUserId); return failure(`Document record could not be saved: ${metadataError.message}`, input.field); }
  }

  redirect("/customers");
}
