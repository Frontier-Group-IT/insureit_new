"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { beginPortalOnboardingApplication } from "../onboarding-applications";
import type { PospMispState } from "./actions";

const DOCUMENT_BUCKET = "customer-documents";
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DOCUMENT_FIELDS = [
  "aadhaar_front", "aadhaar_back", "pan_copy", "education_10th_marksheet",
  "education_12th_marksheet", "education_graduation_marksheet",
  "education_post_graduation_marksheet", "cancelled_cheque", "photograph", "gst_copy"
] as const;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type PartnerType = "posp" | "misp";
type Manager = { id: string };

type Associate = {
  id: string;
  profile_id: string | null;
  full_name: string | null;
  employee_code: string | null;
};

export async function createManualPospMispOnboarding(_state: PospMispState, data: FormData): Promise<PospMispState> {
  let manager: Manager;
  try {
    manager = await currentManager();
  } catch (error) {
    return fail(errorMessage(error, "You are not authorized."));
  }

  const partnerType: PartnerType = value(data, "partner_type") === "misp" ? "misp" : "posp";
  const admin = createSupabaseAdminClient();
  const associateId = value(data, "associate_employee_id");
  const bankId = value(data, "bank_id");

  const [{ data: associate }, { data: bank }, { data: manufacturer }] = await Promise.all([
    associateId
      ? admin.from("employees").select("id, profile_id, full_name, employee_code").eq("id", associateId).maybeSingle<Associate>()
      : Promise.resolve({ data: null }),
    bankId
      ? admin.from("banks").select("id, name").eq("id", bankId).eq("is_active", true).maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null }),
    partnerType === "misp" && value(data, "oem_name")
      ? admin.from("vehicle_manufacturers").select("name").eq("name", value(data, "oem_name")!).eq("is_active", true).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null })
  ]);

  if (!associate) return fail("Select a valid RM Name.", "associate_employee_id");
  if (!bank) return fail("Select a valid Bank Name.", "bank_id");
  if (partnerType === "misp" && !manufacturer) return fail("Select a valid OEM Name.", "oem_name");

  const onboardingId = upper(data, "external_onboarding_id");
  const panNumber = upper(data, "pan_number");
  const address = value(data, "address");
  const city = value(data, "city");
  const state = value(data, "state");
  const postalCode = digits(data, "postal_code");
  const accountNumber = digits(data, "bank_account_number");
  const ifscCode = upper(data, "bank_ifsc_code");
  const gstNumber = upper(data, "gst_number");

  if (!onboardingId) return fail(`${partnerType === "misp" ? "MISP" : "POSP"} ID is required.`, "external_onboarding_id");
  if (!PAN_PATTERN.test(panNumber ?? "")) return fail(`${partnerType === "misp" ? "MISP" : "POSP"} PAN is invalid.`, "pan_number");
  if (!address) return fail("Address is required.", "address");
  if (!city) return fail("City is required.", "city");
  if (!state) return fail("State is required.", "state");
  if (!/^[0-9]{6}$/.test(postalCode ?? "")) return fail("PIN Code must contain exactly 6 digits.", "postal_code");
  if (!accountNumber || accountNumber.length < 6 || accountNumber.length > 20) return fail("Enter a valid Account Number.", "bank_account_number");
  if (!IFSC_PATTERN.test(ifscCode ?? "")) return fail("Enter a valid IFSC Code.", "bank_ifsc_code");
  if (gstNumber && !GST_PATTERN.test(gstNumber)) return fail("GST Number is invalid.", "gst_number");

  const posName = partnerType === "posp" ? value(data, "pos_name") : null;
  const mispName = partnerType === "misp" ? value(data, "misp_name") : null;
  if (partnerType === "posp" && !posName) return fail("POS Name is required.", "pos_name");
  if (partnerType === "misp" && !mispName) return fail("MISP Name is required.", "misp_name");

  const dpFirstName = partnerType === "misp" ? value(data, "dp_first_name") : null;
  const dpMiddleName = partnerType === "misp" ? value(data, "dp_middle_name") : null;
  const dpLastName = partnerType === "misp" ? value(data, "dp_last_name") : null;
  const dpName = [dpFirstName, dpMiddleName, dpLastName].filter(Boolean).join(" ") || null;
  const dpPhone = partnerType === "misp" ? normalizePhone(value(data, "dp_phone")) : null;
  const dpEmail = partnerType === "misp" ? value(data, "dp_email")?.toLowerCase() ?? null : null;
  const dpPan = partnerType === "misp" ? upper(data, "dp_pan_number") : null;
  const dateOfBirth = value(data, "date_of_birth");
  const aadhaarDigits = digits(data, "aadhaar_number");

  if (partnerType === "misp") {
    if (!dpFirstName) return fail("DP First Name is required.", "dp_first_name");
    if (!dpMiddleName) return fail("DP Middle Name is required.", "dp_middle_name");
    if (!dpLastName) return fail("DP Last Name is required.", "dp_last_name");
    if (!dpPhone) return fail("Enter a valid DP Contact.", "dp_phone");
    if (!dpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dpEmail)) return fail("Enter a valid DP Email.", "dp_email");
    if (!PAN_PATTERN.test(dpPan ?? "")) return fail("DP PAN No is invalid.", "dp_pan_number");
    if (!dateOfBirth || Number.isNaN(Date.parse(dateOfBirth))) return fail("Enter a valid DP Date of Birth.", "date_of_birth");
    if (!/^[0-9]{12}$/.test(aadhaarDigits ?? "")) return fail("DP Aadhaar Number must contain exactly 12 digits.", "aadhaar_number");
  }

  const applicantPhone = partnerType === "misp" ? dpPhone : normalizePhone(value(data, "applicant_phone"));
  const applicantEmail = partnerType === "misp" ? dpEmail : value(data, "applicant_email")?.toLowerCase() ?? null;
  if (!applicantPhone) return fail("Enter a valid Mobile Number.", partnerType === "misp" ? "dp_phone" : "applicant_phone");

  const aadhaar = aadhaarDigits && /^[0-9]{12}$/.test(aadhaarDigits)
    ? {
        lastFour: aadhaarDigits.slice(-4),
        hash: createHash("sha256").update(aadhaarDigits).digest("hex"),
        encrypted: encryptSensitiveValue(aadhaarDigits)
      }
    : { lastFour: null, hash: null, encrypted: null };

  for (const field of DOCUMENT_FIELDS) {
    const selected = file(data, field);
    if (!selected) continue;
    if (!ALLOWED_FILE_TYPES.has(selected.type)) return fail(`${documentLabel(field)} must be PDF, JPG or PNG.`, field);
    if (selected.size > MAX_FILE_SIZE) return fail(`${documentLabel(field)} must be 5 MB or smaller.`, field);
  }

  const draftData = {
    partner_type: partnerType,
    associate_employee_id: associate.id,
    associate_profile_id: associate.profile_id,
    associate_name: associate.full_name,
    associate_id: associate.employee_code,
    external_onboarding_id: onboardingId,
    document_received_at: value(data, "document_received_at"),
    pos_name: posName,
    misp_name: mispName,
    applicant_phone: applicantPhone,
    applicant_email: applicantEmail,
    pan_number: panNumber,
    gst_number: gstNumber,
    address,
    city,
    state,
    postal_code: postalCode,
    bank_id: bank.id,
    bank_name: bank.name,
    bank_account_last_four: accountNumber.slice(-4),
    bank_ifsc_code: ifscCode,
    oem_name: partnerType === "misp" ? manufacturer?.name ?? null : null,
    dp_first_name: dpFirstName,
    dp_middle_name: dpMiddleName,
    dp_last_name: dpLastName,
    dp_name: dpName,
    dp_phone: dpPhone,
    dp_email: dpEmail,
    dp_pan_number: dpPan,
    dp_date_of_birth: partnerType === "misp" ? dateOfBirth : null,
    dp_aadhaar_last_four: partnerType === "misp" ? aadhaar.lastFour : null,
    date_of_birth: partnerType === "posp" ? dateOfBirth : null,
    aadhaar_last_four: partnerType === "posp" ? aadhaar.lastFour : null
  };

  let applicationId: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    const { data: duplicateId } = await admin
      .from("posp_misp_onboarding_profiles")
      .select("id")
      .eq("external_onboarding_id", onboardingId)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (duplicateId) return fail(`${partnerType === "misp" ? "MISP" : "POSP"} ID already exists.`, "external_onboarding_id");

    const application = await beginPortalOnboardingApplication(admin, {
      initiatedBy: manager.id,
      partnerType,
      phone: applicantPhone,
      email: applicantEmail,
      draftData
    });
    applicationId = application.id;

    const profilePayload = {
      application_id: application.id,
      partner_type: partnerType,
      requested_account_type: partnerType,
      final_account_type: null,
      partner_decision: "not_applicable",
      associate_employee_id: associate.id,
      associate_profile_id: associate.profile_id,
      associate_name: associate.full_name,
      associate_id: associate.employee_code,
      external_onboarding_id: onboardingId,
      document_received_at: value(data, "document_received_at"),
      pos_name: posName,
      misp_name: mispName,
      applicant_phone: applicantPhone,
      applicant_email: applicantEmail,
      pan_number: panNumber,
      gst_number: gstNumber,
      address,
      city,
      state,
      postal_code: postalCode,
      bank_id: bank.id,
      bank_name: bank.name,
      bank_account_number: accountNumber,
      bank_ifsc_code: ifscCode,
      oem_name: partnerType === "misp" ? manufacturer?.name ?? null : null,
      dp_first_name: dpFirstName,
      dp_middle_name: dpMiddleName,
      dp_last_name: dpLastName,
      dp_name: dpName,
      dp_phone: dpPhone,
      dp_email: dpEmail,
      dp_pan_number: dpPan,
      dp_date_of_birth: partnerType === "misp" ? dateOfBirth : null,
      dp_aadhaar_last_four: partnerType === "misp" ? aadhaar.lastFour : null,
      dp_aadhaar_hash: partnerType === "misp" ? aadhaar.hash : null,
      dp_aadhaar_number_encrypted: partnerType === "misp" ? aadhaar.encrypted : null,
      date_of_birth: partnerType === "posp" ? dateOfBirth : null,
      aadhaar_last_four: partnerType === "posp" ? aadhaar.lastFour : null,
      aadhaar_hash: partnerType === "posp" ? aadhaar.hash : null,
      aadhaar_number_encrypted: partnerType === "posp" ? aadhaar.encrypted : null,
      education_status: "not_received",
      iib_remarks: null,
      iib_upload_status: "pending",
      iib_uploaded: false,
      workflow_stage: "pre_iib",
      pre_iib_submitted_at: new Date().toISOString(),
      source: "manual",
      raw_data: {},
      created_by: manager.id,
      updated_by: manager.id
    };

    const { error: profileError } = await admin.from("posp_misp_onboarding_profiles").insert(profilePayload);
    if (profileError) throw profileError;

    const contact = {
      application_id: application.id,
      contact_role: partnerType === "misp" ? "misp_dp" : "posp",
      full_name: partnerType === "misp" ? dpName! : posName!,
      phone: applicantPhone,
      email: applicantEmail,
      login_required: false,
      membership_status: "pending"
    };
    const { error: contactError } = await admin.from("customer_onboarding_contacts").upsert(contact, { onConflict: "application_id,contact_role" });
    if (contactError) throw contactError;

    for (const field of DOCUMENT_FIELDS) {
      const selected = file(data, field);
      if (!selected) continue;
      const path = `${application.id}/posp-misp/${field}/${randomUUID()}.${extension(selected)}`;
      const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(
        path,
        new Uint8Array(await selected.arrayBuffer()),
        { contentType: selected.type, upsert: false }
      );
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const { error: documentError } = await admin.from("customer_onboarding_documents").upsert({
        application_id: application.id,
        document_type: field,
        file_name: selected.name,
        storage_bucket: DOCUMENT_BUCKET,
        storage_path: path,
        mime_type: selected.type,
        file_size: selected.size,
        verification_status: "pending",
        uploaded_by: manager.id
      }, { onConflict: "application_id,document_type" });
      if (documentError) throw documentError;
    }
  } catch (error) {
    if (uploadedPaths.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
    if (applicationId) {
      await admin.from("customer_onboarding_documents").delete().eq("application_id", applicationId);
      await admin.from("customer_onboarding_contacts").delete().eq("application_id", applicationId);
      await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", applicationId);
      await admin.from("customer_onboarding_applications").delete().eq("id", applicationId);
    }
    return fail(`Application could not be submitted: ${errorMessage(error, "Unknown database error")}`);
  }

  redirect(`/customers/applications/${applicationId}?success=posp_misp_submitted`);
}

async function currentManager(): Promise<Manager> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManagePospMispOnboarding(profile.role)) throw new Error("You are not authorized to manage intermediary onboarding.");
  return { id: profile.id };
}

function fail(error: string, field: string | null = null): PospMispState {
  return { error, field };
}
function value(data: FormData, key: string) {
  const current = data.get(key);
  return typeof current === "string" && current.trim() ? current.trim() : null;
}
function upper(data: FormData, key: string) {
  return value(data, key)?.replace(/\s/g, "").toUpperCase() ?? null;
}
function digits(data: FormData, key: string) {
  return value(data, key)?.replace(/\D/g, "") ?? null;
}
function file(data: FormData, key: string) {
  const current = data.get(key);
  return current instanceof File && current.size > 0 ? current : null;
}
function normalizePhone(input: string | null) {
  let digitsOnly = input?.replace(/\D/g, "") ?? "";
  if (digitsOnly.length > 10 && digitsOnly.startsWith("91")) digitsOnly = digitsOnly.slice(-10);
  return /^[6-9][0-9]{9}$/.test(digitsOnly) ? `+91${digitsOnly}` : null;
}
function extension(selected: File) {
  if (selected.type === "application/pdf") return "pdf";
  if (selected.type === "image/png") return "png";
  return "jpg";
}
function documentLabel(field: string) {
  return field.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [candidate.message, candidate.details, candidate.hint]
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
    if (parts.length) return parts.join(" ");
    if (typeof candidate.code === "string") return `Database error ${candidate.code}`;
  }
  return fallback;
}
