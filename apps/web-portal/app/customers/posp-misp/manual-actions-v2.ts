"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PospMispState } from "./actions";

const DOCUMENT_BUCKET = "customer-documents";
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_FIELDS = ["aadhaar_front","aadhaar_back","pan_copy","education_10th_marksheet","education_12th_marksheet","education_graduation_marksheet","education_post_graduation_marksheet","cancelled_cheque","photograph","gst_copy"] as const;

type PartnerType = "posp" | "misp";

export async function createManualPospMispOnboardingV2(_state: PospMispState, data: FormData): Promise<PospMispState> {
  const manager = await currentManager().catch((error) => ({ error } as const));
  if ("error" in manager) return fail(message(manager.error, "You are not authorized."));

  const admin = createSupabaseAdminClient();
  const partnerType: PartnerType = value(data, "partner_type") === "misp" ? "misp" : "posp";
  const associates = await loadPospMispAssociates(admin).catch(() => []);
  const associate = associates.find((row) => row.id === value(data, "associate_employee_id")) ?? null;
  if (!associate) return fail("Select a valid RM Name.", "associate_employee_id");

  const bankId = value(data, "bank_id");
  const { data: bank } = bankId
    ? await admin.from("banks").select("id,name").eq("id", bankId).eq("is_active", true).maybeSingle<{ id: string; name: string }>()
    : { data: null };
  if (!bank) return fail("Select a valid Bank Name.", "bank_id");

  let manufacturer: { name: string } | null = null;
  if (partnerType === "misp") {
    const oem = value(data, "oem_name");
    const result = oem
      ? await admin.from("vehicle_manufacturers").select("name").eq("name", oem).eq("is_active", true).maybeSingle<{ name: string }>()
      : { data: null };
    manufacturer = result.data ?? null;
    if (!manufacturer) return fail("Select a valid OEM Name.", "oem_name");
  }

  const onboardingId = compactUpper(data, "external_onboarding_id");
  const businessPan = compactUpper(data, "pan_number");
  const address = value(data, "address");
  const city = value(data, "city");
  const state = value(data, "state");
  const postalCode = onlyDigits(data, "postal_code");
  const accountNumber = onlyDigits(data, "bank_account_number");
  const ifsc = compactUpper(data, "bank_ifsc_code");
  const gst = compactUpper(data, "gst_number");
  const posFirst = partnerType === "posp" ? value(data, "pos_first_name") : null;
  const posMiddle = partnerType === "posp" ? value(data, "pos_middle_name") : null;
  const posLast = partnerType === "posp" ? value(data, "pos_last_name") : null;
  const posName = partnerType === "posp" ? [posFirst, posMiddle, posLast].filter(Boolean).join(" ") || null : null;
  const mispName = partnerType === "misp" ? value(data, "misp_name") : null;

  if (!onboardingId) return fail(`${partnerType === "misp" ? "MISP" : "POSP"} ID is required.`, "external_onboarding_id");
  if (!PAN.test(businessPan ?? "")) return fail(`${partnerType === "misp" ? "MISP" : "POSP"} PAN is invalid.`, "pan_number");
  if (partnerType === "posp" && !posFirst) return fail("POS First Name is required.", "pos_first_name");
  if (partnerType === "posp" && !posLast) return fail("POS Last Name is required.", "pos_last_name");
  if (partnerType === "misp" && !mispName) return fail("MISP Name is required.", "misp_name");
  if (!address) return fail("Address is required.", "address");
  if (!city) return fail("City is required.", "city");
  if (!state) return fail("State is required.", "state");
  if (!/^[0-9]{6}$/.test(postalCode ?? "")) return fail("PIN Code must contain exactly 6 digits.", "postal_code");
  if (!accountNumber || !/^[0-9]{6,20}$/.test(accountNumber)) return fail("Enter a valid Account Number.", "bank_account_number");
  if (!IFSC.test(ifsc ?? "")) return fail("Enter a valid IFSC Code.", "bank_ifsc_code");
  if (gst && !GST.test(gst)) return fail("GST Number is invalid.", "gst_number");

  const dpFirst = partnerType === "misp" ? value(data, "dp_first_name") : null;
  const dpMiddle = partnerType === "misp" ? value(data, "dp_middle_name") : null;
  const dpLast = partnerType === "misp" ? value(data, "dp_last_name") : null;
  const dpName = [dpFirst, dpMiddle, dpLast].filter(Boolean).join(" ") || null;
  const dpPhone = partnerType === "misp" ? normalizePhone(value(data, "dp_phone")) : null;
  const dpEmail = partnerType === "misp" ? value(data, "dp_email")?.toLowerCase() ?? null : null;
  const dpPan = partnerType === "misp" ? compactUpper(data, "dp_pan_number") : null;
  const dob = value(data, "date_of_birth");
  const aadhaarDigits = onlyDigits(data, "aadhaar_number");

  if (partnerType === "misp") {
    if (!dpFirst) return fail("DP First Name is required.", "dp_first_name");
    if (!dpLast) return fail("DP Last Name is required.", "dp_last_name");
    if (!dpPhone) return fail("Enter a valid DP Contact.", "dp_phone");
    if (!dpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dpEmail)) return fail("Enter a valid DP Email.", "dp_email");
    if (!PAN.test(dpPan ?? "")) return fail("DP PAN No is invalid.", "dp_pan_number");
    if (!dob || Number.isNaN(Date.parse(dob))) return fail("Enter a valid DP Date of Birth.", "date_of_birth");
    if (!/^[0-9]{12}$/.test(aadhaarDigits ?? "")) return fail("DP Aadhaar Number must contain exactly 12 digits.", "aadhaar_number");
  }

  const applicantPhone = partnerType === "misp" ? dpPhone : normalizePhone(value(data, "applicant_phone"));
  const applicantEmail = partnerType === "misp" ? dpEmail : value(data, "applicant_email")?.toLowerCase() ?? null;
  if (!applicantPhone) return fail("Enter a valid Mobile Number.", partnerType === "misp" ? "dp_phone" : "applicant_phone");

  const aadhaar = aadhaarDigits && /^[0-9]{12}$/.test(aadhaarDigits)
    ? { lastFour: aadhaarDigits.slice(-4), hash: createHash("sha256").update(aadhaarDigits).digest("hex"), encrypted: encryptSensitiveValue(aadhaarDigits) }
    : { lastFour: null, hash: null, encrypted: null };

  for (const field of DOCUMENT_FIELDS) {
    const selected = upload(data, field);
    if (!selected) continue;
    if (!ALLOWED_FILE_TYPES.has(selected.type)) return fail(`${label(field)} must be PDF, JPG or PNG.`, field);
    if (selected.size > MAX_FILE_SIZE) return fail(`${label(field)} must be 5 MB or smaller.`, field);
  }

  const { data: duplicate } = await admin.from("posp_misp_onboarding_profiles").select("id").eq("external_onboarding_id", onboardingId).limit(1).maybeSingle<{ id: string }>();
  if (duplicate) return fail(`${partnerType === "misp" ? "MISP" : "POSP"} ID already exists.`, "external_onboarding_id");

  const draftData = {
    partner_type: partnerType, associate_employee_id: associate.id, associate_profile_id: associate.profile_id,
    associate_name: associate.full_name, associate_id: associate.employee_code, external_onboarding_id: onboardingId,
    document_received_at: value(data, "document_received_at"), pos_first_name: posFirst, pos_middle_name: posMiddle,
    pos_last_name: posLast, pos_name: posName, misp_name: mispName,
    applicant_phone: applicantPhone, applicant_email: applicantEmail, pan_number: businessPan, gst_number: gst,
    address, city, state, postal_code: postalCode, bank_id: bank.id, bank_name: bank.name,
    bank_account_last_four: accountNumber.slice(-4), bank_ifsc_code: ifsc, oem_name: manufacturer?.name ?? null,
    dp_first_name: dpFirst, dp_middle_name: dpMiddle, dp_last_name: dpLast, dp_name: dpName,
    dp_phone: dpPhone, dp_email: dpEmail, dp_pan_number: dpPan,
    dp_date_of_birth: partnerType === "misp" ? dob : null,
    dp_aadhaar_last_four: partnerType === "misp" ? aadhaar.lastFour : null,
    date_of_birth: partnerType === "posp" ? dob : null,
    aadhaar_last_four: partnerType === "posp" ? aadhaar.lastFour : null
  };

  let applicationId: string | null = null;
  const uploaded: string[] = [];
  try {
    const now = new Date().toISOString();
    const { data: application, error: applicationError } = await admin.from("intermediary_onboarding_applications").insert({
      initiated_by: manager.id,
      source: "manager_portal",
      requested_type: partnerType,
      final_type: null,
      status: "submitted",
      current_step: 1,
      applicant_phone: applicantPhone,
      applicant_email: applicantEmail,
      draft_data: draftData,
      submitted_at: now,
      updated_at: now
    }).select("id").single<{ id: string }>();
    if (applicationError || !application) throw applicationError ?? new Error("Unable to create intermediary onboarding application.");
    applicationId = application.id;

    const { error: profileError } = await admin.from("posp_misp_onboarding_profiles").insert({
      application_id: application.id, partner_type: partnerType, requested_account_type: partnerType,
      final_account_type: null, partner_decision: "not_applicable", associate_employee_id: associate.id,
      associate_profile_id: associate.profile_id, associate_name: associate.full_name, associate_id: associate.employee_code,
      external_onboarding_id: onboardingId, document_received_at: value(data, "document_received_at"),
      pos_name: posName, misp_name: mispName, applicant_phone: applicantPhone, applicant_email: applicantEmail,
      pan_number: businessPan, gst_number: gst, address, city, state, postal_code: postalCode,
      bank_id: bank.id, bank_name: bank.name, bank_account_number: accountNumber, bank_ifsc_code: ifsc,
      oem_name: manufacturer?.name ?? null, dp_first_name: dpFirst, dp_middle_name: dpMiddle,
      dp_last_name: dpLast, dp_name: dpName, dp_phone: dpPhone, dp_email: dpEmail, dp_pan_number: dpPan,
      dp_date_of_birth: partnerType === "misp" ? dob : null,
      dp_aadhaar_last_four: partnerType === "misp" ? aadhaar.lastFour : null,
      dp_aadhaar_hash: partnerType === "misp" ? aadhaar.hash : null,
      dp_aadhaar_number_encrypted: partnerType === "misp" ? aadhaar.encrypted : null,
      date_of_birth: partnerType === "posp" ? dob : null,
      aadhaar_last_four: partnerType === "posp" ? aadhaar.lastFour : null,
      aadhaar_hash: partnerType === "posp" ? aadhaar.hash : null,
      aadhaar_number_encrypted: partnerType === "posp" ? aadhaar.encrypted : null,
      education_status: "not_received", iib_remarks: null, iib_upload_status: "pending", iib_uploaded: false,
      workflow_stage: "pre_iib", pre_iib_submitted_at: now, source: "manual", raw_data: {},
      created_by: manager.id, updated_by: manager.id
    });
    if (profileError) throw profileError;

    const { error: contactError } = await admin.from("intermediary_onboarding_contacts").upsert({
      application_id: application.id,
      contact_role: partnerType === "misp" ? "misp_dp" : "posp",
      full_name: partnerType === "misp" ? dpName! : posName!,
      phone: applicantPhone,
      email: applicantEmail,
      is_designated_person: partnerType === "misp",
      login_required: false,
      membership_status: "pending"
    }, { onConflict: "application_id,contact_role" });
    if (contactError) throw contactError;

    for (const field of DOCUMENT_FIELDS) {
      const selected = upload(data, field);
      if (!selected) continue;
      const path = `${application.id}/intermediary/${field}/${randomUUID()}.${fileExtension(selected)}`;
      const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(path, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
      if (uploadError) throw uploadError;
      uploaded.push(path);
      const { error: documentError } = await admin.from("intermediary_onboarding_documents").upsert({
        application_id: application.id, document_type: field, file_name: selected.name,
        storage_bucket: DOCUMENT_BUCKET, storage_path: path, mime_type: selected.type,
        file_size: selected.size, verification_status: "pending", uploaded_by: manager.id
      }, { onConflict: "application_id,document_type" });
      if (documentError) throw documentError;
    }
  } catch (error) {
    if (uploaded.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploaded);
    if (applicationId) {
      await admin.from("intermediary_onboarding_documents").delete().eq("application_id", applicationId);
      await admin.from("intermediary_onboarding_contacts").delete().eq("application_id", applicationId);
      await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", applicationId);
      await admin.from("intermediary_onboarding_applications").delete().eq("id", applicationId);
    }
    return fail(`Application could not be submitted: ${message(error, "Unknown database error")}`);
  }

  redirect(`/intermediaries/applications/${applicationId}?success=posp_misp_submitted`);
}

async function currentManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManagePospMispOnboarding(profile.role)) throw new Error("You are not authorized to manage intermediary onboarding.");
  return { id: profile.id };
}
function fail(error: string, field: string | null = null): PospMispState { return { error, field }; }
function value(data: FormData, key: string) { const current = data.get(key); return typeof current === "string" && current.trim() ? current.trim() : null; }
function compactUpper(data: FormData, key: string) { return value(data, key)?.replace(/\s/g, "").toUpperCase() ?? null; }
function onlyDigits(data: FormData, key: string) { return value(data, key)?.replace(/\D/g, "") ?? null; }
function upload(data: FormData, key: string) { const current = data.get(key); return current instanceof File && current.size > 0 ? current : null; }
function normalizePhone(input: string | null) { let digits = input?.replace(/\D/g, "") ?? ""; if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10); return /^[6-9][0-9]{9}$/.test(digits) ? `+91${digits}` : null; }
function fileExtension(file: File) { return file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg"; }
function label(field: string) { return field.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function message(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const item = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const text = [item.message, item.details, item.hint].filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
    if (text.length) return text.join(" ");
    if (typeof item.code === "string") return `Database error ${item.code}`;
  }
  return fallback;
}
