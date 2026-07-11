"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

export type CustomerOnboardingState = {
  error: string | null;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
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
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
    return { error: "Enter a valid PAN number." };
  }
  if (!/^[0-9]{12}$/.test(aadhaarNumber)) {
    return { error: "Enter a valid 12-digit Aadhaar number." };
  }
  if (isGstRegistered && (!legalTradeName || !gstNumber)) {
    return { error: "Legal Trade Name and GST Number are required for GST-registered customers." };
  }

  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) {
    return { error: "Your login session could not be verified. Please sign in again." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: duplicatePhone, error: phoneLookupError } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (phoneLookupError) return { error: `Unable to validate mobile number: ${phoneLookupError.message}` };
  if (duplicatePhone) return { error: "A customer with this mobile number already exists." };

  const { data: duplicatePan, error: panLookupError } = await supabase
    .from("customers")
    .select("id")
    .eq("pan_number", panNumber)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (panLookupError) return { error: `Unable to validate PAN number: ${panLookupError.message}` };
  if (duplicatePan) return { error: "A customer with this PAN number already exists." };

  const customerCode = `CUST-${Date.now().toString().slice(-9)}`;
  const aadhaarHash = createHash("sha256").update(aadhaarNumber).digest("hex");
  const addressStreet = textValue(formData, "address_street");
  const addressLocality = textValue(formData, "address_locality");
  const address = [addressStreet, addressLocality, city, state, postalCode].filter(Boolean).join(", ");

  const { error } = await supabase.from("customers").insert({
    customer_code: customerCode,
    partner_type: partnerType,
    contact_name: contactName,
    company_name: legalTradeName,
    phone,
    email: textValue(formData, "email"),
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
  });

  if (error) {
    return { error: `Customer could not be created: ${error.message}` };
  }

  redirect("/customers");
}