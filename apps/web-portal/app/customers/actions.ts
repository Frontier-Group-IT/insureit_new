"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type CustomerOnboardingState = {
  error: string | null;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_BUCKET = "customer-documents";

type DocumentInput = {
  field: string;
  type: "pan_copy" | "aadhaar_front" | "aadhaar_back" | "gst_copy";
  required: boolean;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fileValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
  return null;
}

function safeExtension(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

function validateDocument(file: File | null, label: string, required: boolean) {
  if (!file) return required ? `${label} is required.` : null;
  if (!ALLOWED_FILE_TYPES.has(file.type)) return `${label} must be a PDF, JPG or PNG file.`;
  if (file.size > MAX_FILE_SIZE) return `${label} must be 5 MB or smaller.`;
  return null;
}

export async function createCustomerOnboarding(
  _previousState: CustomerOnboardingState,
  formData: FormData
): Promise<CustomerOnboardingState> {
  const partnerType = textValue(formData, "partner_type");
  const contactName = textValue(formData, "contact_name");
  const rawPhone = textValue(formData, "phone");
  const phone = rawPhone ? normalizeIndianPhone(rawPhone) : null;
  const email = textValue(formData, "email");
  const locationId = textValue(formData, "india_location_id");
  const city = textValue(formData, "city");
  const state = textValue(formData, "state");
  const postalCode = textValue(formData, "postal_code");
  const panNumber = textValue(formData, "pan_number")?.toUpperCase() ?? null;
  const aadhaarNumber = textValue(formData, "aadhaar_number")?.replace(/\D/g, "") ?? null;
  const fleetSizeBand = textValue(formData, "fleet_size_band");
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const legalTradeName = textValue(formData, "legal_trade_name");
  const gstNumber = textValue(formData, "gst_number")?.toUpperCase() ?? null;

  if (partnerType !== "individual_proprietor") {
    return { error: "Only the Individual / Proprietor workflow is available in this release." };
  }
  if (!contactName || !phone || !locationId || !city || !state || !postalCode || !panNumber || !aadhaarNumber || !fleetSizeBand) {
    return { error: "Please complete all required customer onboarding fields and select a city from the suggestions." };
  }
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) return { error: "Enter a valid PAN number." };
  if (!/^[0-9]{12}$/.test(aadhaarNumber)) return { error: "Enter a valid 12-digit Aadhaar number." };
  if (isGstRegistered && (!legalTradeName || !gstNumber)) {
    return { error: "Legal Trade Name and GST Number are required for GST-registered customers." };
  }

  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) {
    return { error: "You are not authorized to onboard customers." };
  }

  const documentInputs: DocumentInput[] = [
    { field: "pan_copy", type: "pan_copy", required: true },
    { field: "aadhaar_front", type: "aadhaar_front", required: true },
    { field: "aadhaar_back", type: "aadhaar_back", required: true },
    { field: "gst_copy", type: "gst_copy", required: isGstRegistered }
  ];
  const labels: Record<DocumentInput["type"], string> = {
    pan_copy: "PAN copy",
    aadhaar_front: "Aadhaar front",
    aadhaar_back: "Aadhaar back",
    gst_copy: "GST copy"
  };
  for (const input of documentInputs) {
    const validationError = validateDocument(fileValue(formData, input.field), labels[input.type], input.required);
    if (validationError) return { error: validationError };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Supabase Admin configuration is missing." };
  }

  const { data: duplicatePhone, error: phoneLookupError } = await admin
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (phoneLookupError) return { error: `Unable to validate mobile number: ${phoneLookupError.message}` };
  if (duplicatePhone) return { error: "A customer with this mobile number already exists." };

  const { data: duplicatePan, error: panLookupError } = await admin
    .from("customers")
    .select("id")
    .eq("pan_number", panNumber)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (panLookupError) return { error: `Unable to validate PAN number: ${panLookupError.message}` };
  if (duplicatePan) return { error: "A customer with this PAN number already exists." };

  let profileId: string | null = null;
  let createdAuthUserId: string | null = null;

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle<{ id: string; role: string }>();
  if (existingProfileError) return { error: `Unable to check mobile login: ${existingProfileError.message}` };

  if (existingProfile) {
    if (existingProfile.role !== "customer") {
      return { error: "This mobile number is already assigned to an internal user account." };
    }
    profileId = existingProfile.id;
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      email: email ?? undefined,
      app_metadata: { app_role: "customer" },
      user_metadata: { full_name: contactName, phone, app_role: "customer" }
    });
    if (authError || !authData.user) {
      return { error: `Mobile OTP account could not be created: ${authError?.message ?? "Unknown authentication error"}` };
    }
    profileId = authData.user.id;
    createdAuthUserId = authData.user.id;

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ full_name: contactName, phone, role: "customer" })
      .eq("id", profileId);
    if (profileUpdateError) {
      await admin.auth.admin.deleteUser(createdAuthUserId);
      return { error: `Customer profile could not be prepared: ${profileUpdateError.message}` };
    }
  }

  const customerCode = `CUST-${Date.now().toString().slice(-9)}`;
  const aadhaarHash = createHash("sha256").update(aadhaarNumber).digest("hex");
  const addressStreet = textValue(formData, "address_street");
  const addressLocality = textValue(formData, "address_locality");
  const address = [addressStreet, addressLocality, city, state, postalCode].filter(Boolean).join(", ");

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      profile_id: profileId,
      customer_code: customerCode,
      partner_type: partnerType,
      contact_name: contactName,
      company_name: legalTradeName,
      phone,
      email,
      address,
      address_street: addressStreet,
      address_locality: addressLocality,
      india_location_id: locationId,
      city,
      state,
      postal_code: postalCode,
      pan_number: panNumber,
      aadhaar_last_four: aadhaarNumber.slice(-4),
      aadhaar_hash: aadhaarHash,
      legal_trade_name: legalTradeName,
      is_gst_registered: isGstRegistered,
      gst_number: isGstRegistered ? gstNumber : null,
      fleet_size_band: fleetSizeBand,
      onboarding_status: "documents_pending",
      created_by: profile.id,
      updated_by: profile.id
    })
    .select("id")
    .single<{ id: string }>();

  if (customerError || !customer) {
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
    return { error: `Customer could not be created: ${customerError?.message ?? "Unknown database error"}` };
  }

  const uploadedPaths: string[] = [];
  for (const input of documentInputs) {
    const file = fileValue(formData, input.field);
    if (!file) continue;

    const storagePath = `${customer.id}/${input.type}/${randomUUID()}.${safeExtension(file)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      if (uploadedPaths.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
      await admin.from("customers").delete().eq("id", customer.id);
      if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
      return { error: `${labels[input.type]} upload failed: ${uploadError.message}` };
    }
    uploadedPaths.push(storagePath);

    const { error: metadataError } = await admin.from("customer_documents").insert({
      customer_id: customer.id,
      document_type: input.type,
      file_name: file.name,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      verification_status: "pending",
      uploaded_by: profile.id
    });

    if (metadataError) {
      await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
      await admin.from("customers").delete().eq("id", customer.id);
      if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
      return { error: `Document record could not be saved: ${metadataError.message}` };
    }
  }

  const { error: completionError } = await admin
    .from("customers")
    .update({ onboarding_status: "active", onboarding_completed_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", customer.id);

  if (completionError) {
    return { error: `Customer was created, but onboarding could not be completed: ${completionError.message}` };
  }

  redirect("/customers");
}
