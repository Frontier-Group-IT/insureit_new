"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PospMispState } from "./actions";
import { createManualPospMispOnboardingV2 } from "./manual-actions-v2";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export async function createPartnerFirstOnboarding(state: PospMispState, data: FormData): Promise<PospMispState> {
  if (text(data, "partner_type") === "misp") return createManualPospMispOnboardingV2(state, data);

  const accessToken = await getServerAccessToken();
  const { profile: actor } = await getAuthenticatedProfile(accessToken);
  if (!actor?.id || !canManagePospMispOnboarding(actor.role)) return fail("You are not authorized to create Partner applications.");

  const admin = createSupabaseAdminClient();
  const associates = await loadPospMispAssociates(admin).catch(() => []);
  const associate = associates.find((row) => row.id === text(data, "associate_employee_id")) ?? null;
  if (!associate) return fail("Select a valid RM Name.", "associate_employee_id");

  const firstName = text(data, "pos_first_name");
  const middleName = text(data, "pos_middle_name");
  const lastName = text(data, "pos_last_name");
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const phone = normalizePhone(text(data, "applicant_phone"));
  const email = text(data, "applicant_email")?.toLowerCase() ?? null;
  const pan = compactUpper(data, "pan_number");
  const aadhaar = digits(data, "aadhaar_number");
  const address = text(data, "address");
  const city = text(data, "city");
  const stateName = text(data, "state");
  const postalCode = digits(data, "postal_code");
  const bankId = text(data, "bank_id");
  const accountNumber = digits(data, "bank_account_number");
  const ifsc = compactUpper(data, "bank_ifsc_code");

  if (!firstName) return fail("First Name is required.", "pos_first_name");
  if (!lastName) return fail("Last Name is required.", "pos_last_name");
  if (!phone) return fail("Enter a valid Contact Number.", "applicant_phone");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid Email.", "applicant_email");
  if (!PAN.test(pan ?? "")) return fail("PAN format is invalid.", "pan_number");
  if (!/^[0-9]{12}$/.test(aadhaar ?? "")) return fail("Aadhaar Number must contain exactly 12 digits.", "aadhaar_number");
  if (!address) return fail("Address is required.", "address");
  if (!city) return fail("City is required.", "city");
  if (!stateName) return fail("State is required.", "state");
  if (!/^[0-9]{6}$/.test(postalCode ?? "")) return fail("PIN Code must contain exactly 6 digits.", "postal_code");
  if (!accountNumber || !/^[0-9]{6,20}$/.test(accountNumber)) return fail("Enter a valid Account Number.", "bank_account_number");
  if (!IFSC.test(ifsc ?? "")) return fail("Enter a valid IFSC Code.", "bank_ifsc_code");

  const { data: bank } = bankId
    ? await admin.from("banks").select("id,name").eq("id", bankId).eq("is_active", true).maybeSingle<{ id: string; name: string }>()
    : { data: null };
  if (!bank) return fail("Select a valid Bank Name.", "bank_id");

  const aadhaarHash = createHash("sha256").update(aadhaar!).digest("hex");
  const [{ data: panDuplicate }, { data: aadhaarDuplicate }, { data: phoneMatches }, { data: emailMatches }] = await Promise.all([
    admin.from("posp_misp_onboarding_profiles").select("application_id,partner_id,pos_name,applicant_phone").eq("pan_number", pan).not("partner_id", "is", null).limit(1).maybeSingle(),
    admin.from("posp_misp_onboarding_profiles").select("application_id,partner_id,pos_name,applicant_phone").eq("aadhaar_hash", aadhaarHash).not("partner_id", "is", null).limit(1).maybeSingle(),
    admin.from("posp_misp_onboarding_profiles").select("application_id,partner_id,pos_name").eq("applicant_phone", phone).limit(3),
    admin.from("posp_misp_onboarding_profiles").select("application_id,partner_id,pos_name").eq("applicant_email", email).limit(3),
  ]);

  const existing = panDuplicate ?? aadhaarDuplicate;
  if (existing?.application_id) {
    redirect(`/intermediaries/applications/${existing.application_id}?warning=existing_partner_opened`);
  }

  const warnings = [
    ...(phoneMatches?.length ? ["The contact number is already used in another application and requires manual review."] : []),
    ...(emailMatches?.length ? ["The email is already used in another application and requires manual review."] : []),
  ];

  const { data: referenceData, error: referenceError } = await admin.rpc("next_partner_application_reference");
  const applicationReference = typeof referenceData === "string" ? referenceData : null;
  if (referenceError || !applicationReference) return fail("The application reference could not be generated.");

  const now = new Date().toISOString();
  const encryptedAadhaar = encryptSensitiveValue(aadhaar!);
  let applicationId: string | null = null;

  try {
    const draftData = {
      application_reference: applicationReference,
      associate_employee_id: associate.id,
      associate_profile_id: associate.profile_id,
      associate_name: associate.full_name,
      pos_first_name: firstName,
      pos_middle_name: middleName,
      pos_last_name: lastName,
      pos_name: fullName,
      applicant_phone: phone,
      applicant_email: email,
      address,
      city,
      state: stateName,
      postal_code: postalCode,
      pan_number: pan,
      aadhaar_last_four: aadhaar!.slice(-4),
      bank_id: bank.id,
      bank_name: bank.name,
      bank_account_last_four: accountNumber.slice(-4),
      bank_ifsc_code: ifsc,
      duplicate_warnings: warnings,
    };

    const { data: application, error: applicationError } = await admin.from("intermediary_onboarding_applications").insert({
      application_reference: applicationReference,
      initiated_by: actor.id,
      source: "manager_portal",
      requested_type: "partner",
      final_type: null,
      status: "draft",
      partner_status: "documents_pending",
      registration_status: "pan_checking",
      current_step: 1,
      applicant_phone: phone,
      applicant_email: email,
      draft_data: draftData,
      submitted_at: now,
      updated_at: now,
    }).select("id").single<{ id: string }>();
    if (applicationError || !application) throw applicationError ?? new Error("Unable to create Partner application.");
    applicationId = application.id;

    const { data: onboardingProfile, error: profileError } = await admin.from("posp_misp_onboarding_profiles").insert({
      application_id: application.id,
      partner_type: "posp",
      requested_account_type: "partner",
      final_account_type: null,
      partner_decision: "not_applicable",
      partner_status: "documents_pending",
      associate_employee_id: associate.id,
      associate_profile_id: associate.profile_id,
      associate_name: associate.full_name,
      associate_id: associate.employee_code,
      external_onboarding_id: applicationReference,
      document_received_at: text(data, "document_received_at"),
      pos_first_name: firstName,
      pos_middle_name: middleName,
      pos_last_name: lastName,
      pos_name: fullName,
      applicant_phone: phone,
      applicant_email: email,
      pan_number: pan,
      address,
      city,
      state: stateName,
      postal_code: postalCode,
      bank_id: bank.id,
      bank_name: bank.name,
      bank_account_number: accountNumber,
      bank_ifsc_code: ifsc,
      aadhaar_last_four: aadhaar!.slice(-4),
      aadhaar_hash: aadhaarHash,
      aadhaar_number_encrypted: encryptedAadhaar,
      iib_remarks: null,
      iib_upload_status: "pending",
      iib_uploaded: false,
      workflow_stage: "pre_iib",
      source: "manual",
      raw_data: { duplicate_warnings: warnings },
      created_by: actor.id,
      updated_by: actor.id,
    }).select("id").single<{ id: string }>();
    if (profileError || !onboardingProfile) throw profileError ?? new Error("Unable to create Partner profile.");

    const { error: contactError } = await admin.from("intermediary_onboarding_contacts").upsert({
      application_id: application.id,
      contact_role: "partner",
      full_name: fullName,
      phone,
      email,
      is_designated_person: false,
      login_required: false,
      membership_status: "pending",
    }, { onConflict: "application_id,contact_role" });
    if (contactError) throw contactError;

    const { error: jobError } = await admin.from("pan_verification_jobs").upsert({
      application_id: application.id,
      onboarding_profile_id: onboardingProfile.id,
      partner_type: "posp",
      pan_number: pan,
      status: "pending",
      result_code: null,
      result_message: null,
      requested_at: now,
      requested_by: actor.id,
      updated_at: now,
    }, { onConflict: "application_id" });
    if (jobError) throw jobError;
  } catch (error) {
    if (applicationId) {
      await admin.from("pan_verification_jobs").delete().eq("application_id", applicationId);
      await admin.from("intermediary_onboarding_contacts").delete().eq("application_id", applicationId);
      await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", applicationId);
      await admin.from("intermediary_onboarding_applications").delete().eq("id", applicationId);
    }
    return fail(errorMessage(error));
  }

  redirect(`/intermediaries/applications/${applicationId}?success=partner_application_created${warnings.length ? "&warning=duplicate_contact_review" : ""}`);
}

function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function compactUpper(data: FormData, key: string) { return text(data, key)?.replace(/\s/g, "").toUpperCase() ?? null; }
function digits(data: FormData, key: string) { return text(data, key)?.replace(/\D/g, "") ?? null; }
function normalizePhone(input: string | null) { let value = input?.replace(/\D/g, "") ?? ""; if (value.length > 10 && value.startsWith("91")) value = value.slice(-10); return /^[6-9][0-9]{9}$/.test(value) ? `+91${value}` : null; }
function fail(error: string, field: string | null = null): PospMispState { return { error, field }; }
function errorMessage(error: unknown) { if (error instanceof Error) return error.message; if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message ?? "Unknown database error"); return "Partner application could not be created."; }
