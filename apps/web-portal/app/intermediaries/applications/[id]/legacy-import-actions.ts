"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const reviewPath = (id: string) => `/intermediaries/applications/${id}`;

export async function importExistingLinkedIntermediary(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const sourceApplicationId = text(formData, "application_id");
  const requestedType = text(formData, "registration_type") === "misp" ? "misp" : "posp";
  const partnerCode = normalizedCode(formData, "partner_code");
  const registrationCode = normalizedCode(formData, "registration_code");
  const originalOnboardingDate = dateValue(formData, "original_onboarding_date");
  const originalActivationDate = dateValue(formData, "original_activation_date");
  const agreementDate = dateValue(formData, "agreement_date");
  const trainingCompletedDate = requestedType === "posp" ? dateValue(formData, "training_completed_date") : null;
  const examPassedDate = requestedType === "posp" ? dateValue(formData, "exam_passed_date") : null;
  const examScore = requestedType === "posp" ? numberValue(formData, "exam_score") : null;
  const remarks = text(formData, "migration_remarks");
  const confirmed = formData.get("confirmation") === "yes";

  if (!reviewer?.id || !sourceApplicationId) redirect("/intermediaries?error=legacy_import_invalid");
  if (!confirmed || !partnerCode || !registrationCode || !originalOnboardingDate || !originalActivationDate || !agreementDate || !remarks) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("Complete all mandatory legacy import fields and confirm the declaration.")}`);
  }
  if (partnerCode.startsWith("PENDING-") || registrationCode.startsWith("PENDING-")) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("Temporary PENDING identifiers cannot be imported as permanent IDs.")}`);
  }
  if (partnerCode === registrationCode) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("Partner ID and POSP/MISP ID must be different.")}`);
  }
  if (requestedType === "posp" && (!trainingCompletedDate || !examPassedDate)) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("Training completion and exam pass dates are mandatory for an existing POSP.")}`);
  }
  if (examScore !== null && (examScore < 0 || examScore > 100)) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("Exam score must be between 0 and 100.")}`);
  }

  const admin = createSupabaseAdminClient();
  const [{ data: sourceApp }, { data: sourceProfile }, { data: sourceIntermediary }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("*").eq("id", sourceApplicationId).maybeSingle<Record<string, unknown>>(),
    admin.from("posp_misp_onboarding_profiles").select("*").eq("application_id", sourceApplicationId).maybeSingle<Record<string, unknown>>(),
    admin.from("intermediaries").select("id,intermediary_code").eq("application_id", sourceApplicationId).maybeSingle<{ id: string; intermediary_code: string | null }>(),
  ]);

  if (!sourceApp || !sourceProfile || sourceApp.partner_status !== "active_partner" || !sourceApp.partner_record_id) {
    redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("Activate the Partner before importing an existing linked account.")}`);
  }
  const sourceDraft = object(sourceApp.draft_data);
  const expectedType = sourceApp.requested_type === "misp" ? "misp" : "posp";
  if (requestedType !== expectedType) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("Individual Partners can import POSP only, and Business Partners can import MISP only.")}`);
  }

  const duplicateChecks = await Promise.all([
    admin.from("partners").select("id").eq("partner_code", partnerCode).neq("id", String(sourceApp.partner_record_id)).limit(1),
    admin.from("intermediaries").select("id").eq("intermediary_code", partnerCode).neq("application_id", sourceApplicationId).limit(1),
    admin.from("intermediary_registrations").select("id").eq("registration_code", registrationCode).limit(1),
    admin.from("intermediaries").select("id").eq("intermediary_code", registrationCode).limit(1),
    admin.from("posp_misp_onboarding_profiles").select("application_id").eq("external_onboarding_id", registrationCode).limit(1),
    admin.from("intermediary_onboarding_applications").select("id,draft_data").eq("partner_record_id", String(sourceApp.partner_record_id)).neq("id", sourceApplicationId),
  ]);
  if (duplicateChecks.slice(0, 5).some((result) => (result.data?.length ?? 0) > 0)) {
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent("The entered Partner or POSP/MISP ID is already used by another record.")}`);
  }
  const existingLinked = (duplicateChecks[5].data ?? []).find((row) => {
    const context = object((row as { draft_data?: unknown }).draft_data).account_context;
    return context === "posp" || context === "misp";
  });
  if (existingLinked) {
    redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("This Partner already has a linked POSP or MISP account.")}`);
  }

  const now = new Date().toISOString();
  const childId = randomUUID();
  const oldPartnerCode = stringValue(sourceProfile.partner_id);
  let parentUpdated = false;
  let childCreated = false;

  try {
    const partnerUpdate = await admin.from("partners").update({ partner_code: partnerCode, updated_at: now }).eq("id", String(sourceApp.partner_record_id));
    if (partnerUpdate.error) throw stepError("partner_id", partnerUpdate.error);
    const profileUpdate = await admin.from("posp_misp_onboarding_profiles").update({
      partner_id: partnerCode,
      record_source: "legacy_manual",
      existing_registration_confirmed: true,
      existing_registration_code: registrationCode,
      existing_registration_confirmed_at: now,
      onboarding_date: originalOnboardingDate,
      updated_by: reviewer.id,
      updated_at: now,
    }).eq("application_id", sourceApplicationId);
    if (profileUpdate.error) throw stepError("partner_profile", profileUpdate.error);
    if (sourceIntermediary) {
      const intermediaryUpdate = await admin.from("intermediaries").update({ intermediary_code: partnerCode, updated_at: now }).eq("id", sourceIntermediary.id);
      if (intermediaryUpdate.error) throw stepError("partner_register", intermediaryUpdate.error);
    }
    parentUpdated = true;

    const childDraft = {
      ...sourceDraft,
      account_context: requestedType,
      parent_partner_application_id: sourceApplicationId,
      linked_partner_code: partnerCode,
      record_source: "legacy_manual",
      legacy_imported_at: now,
      legacy_imported_by: reviewer.id,
      legacy_original_onboarding_date: originalOnboardingDate,
      legacy_original_activation_date: originalActivationDate,
      legacy_remarks: remarks,
    };

    const childApp = await admin.from("intermediary_onboarding_applications").insert({
      id: childId,
      initiated_by: reviewer.id,
      source: "legacy_manual",
      requested_type: requestedType,
      final_type: requestedType,
      status: "approved",
      current_step: 6,
      applicant_phone: sourceApp.applicant_phone,
      applicant_email: sourceApp.applicant_email,
      draft_data: childDraft,
      submitted_at: originalOnboardingDate,
      updated_at: now,
      partner_record_id: sourceApp.partner_record_id,
      partner_status: "active_partner",
      registration_status: "iib_registered",
    });
    if (childApp.error) throw stepError("application", childApp.error);
    childCreated = true;

    const inherited = { ...sourceProfile };
    for (const key of ["id", "application_id", "customer_id", "posp_id", "partner_record_id", "registration_record_id", "intermediary_id", "created_at", "updated_at"]) delete inherited[key];
    const childProfile = {
      ...inherited,
      application_id: childId,
      partner_id: partnerCode,
      partner_record_id: sourceApp.partner_record_id,
      partner_type: requestedType,
      requested_account_type: requestedType,
      final_account_type: requestedType,
      external_onboarding_id: registrationCode,
      workflow_stage: "completed",
      partner_status: "active_partner",
      registration_record_id: null,
      training_status: requestedType === "posp" ? "completed" : "not_applicable",
      training_certificate_number: requestedType === "posp" ? `LEGACY-${registrationCode}` : null,
      training_start_date: trainingCompletedDate,
      training_end_date: trainingCompletedDate,
      exam_status: requestedType === "posp" ? "passed" : "not_applicable",
      iib_uploaded: true,
      iib_uploaded_at: originalActivationDate,
      iib_upload_status: "completed",
      iib_remarks: "Legacy registration confirmed",
      onboarding_date: originalOnboardingDate,
      record_source: "legacy_manual",
      existing_registration_confirmed: true,
      existing_registration_code: registrationCode,
      existing_registration_confirmed_at: now,
      created_by: reviewer.id,
      updated_by: reviewer.id,
      updated_at: now,
      raw_data: {
        ...object(inherited.raw_data),
        account_context: requestedType,
        parent_partner_application_id: sourceApplicationId,
        linked_partner_code: partnerCode,
        issued_registration_code: registrationCode,
        record_source: "legacy_manual",
        legacy_original_activation_date: originalActivationDate,
        legacy_remarks: remarks,
      },
    };
    const childProfileInsert = await admin.from("posp_misp_onboarding_profiles").insert(childProfile);
    if (childProfileInsert.error) throw stepError("profile", childProfileInsert.error);

    const registration = await admin.from("intermediary_registrations").insert({
      partner_id: sourceApp.partner_record_id,
      application_id: childId,
      registration_type: requestedType,
      registration_code: registrationCode,
      registration_status: "iib_registered",
      training_status: requestedType === "posp" ? "completed" : "not_applicable",
      exam_status: requestedType === "posp" ? "passed" : "not_applicable",
      agreement_status: "signed",
      iib_status: "registered",
      created_by: reviewer.id,
      updated_at: now,
    }).select("id").single<{ id: string }>();
    if (registration.error || !registration.data) throw stepError("registration", registration.error ?? new Error("Registration could not be created"));

    const assignment = await admin.from("intermediary_training_exam_assignments").insert({
      application_id: childId,
      training_title: requestedType === "posp" ? "Historical POSP training" : "Not applicable",
      training_status: requestedType === "posp" ? "completed" : "not_applicable",
      training_assigned_at: trainingCompletedDate,
      training_started_at: trainingCompletedDate,
      training_completed_at: trainingCompletedDate,
      exam_title: requestedType === "posp" ? "Historical POSP examination" : "Not applicable",
      exam_status: requestedType === "posp" ? "passed" : "not_applicable",
      exam_score: examScore,
      exam_completed_at: examPassedDate,
      exam_passed_at: examPassedDate,
      agreement_status: "signed",
      agreement_sent_at: agreementDate,
      agreement_opened_at: agreementDate,
      agreement_signed_at: agreementDate,
      created_at: now,
      updated_at: now,
    });
    if (assignment.error) throw stepError("historical_stages", assignment.error);

    const appLink = await admin.from("intermediary_onboarding_applications").update({ registration_record_id: registration.data.id, updated_at: now }).eq("id", childId);
    if (appLink.error) throw stepError("application_link", appLink.error);
    const profileLink = await admin.from("posp_misp_onboarding_profiles").update({ registration_record_id: registration.data.id, updated_at: now }).eq("application_id", childId);
    if (profileLink.error) throw stepError("profile_link", profileLink.error);

    const { data: generatedIntermediary } = await admin.from("intermediaries").select("id").eq("application_id", childId).maybeSingle<{ id: string }>();
    if (generatedIntermediary) {
      const registerUpdate = await admin.from("intermediaries").update({
        intermediary_code: registrationCode,
        onboarding_id: registrationCode,
        intermediary_type: requestedType,
        requested_type: requestedType,
        account_status: "active",
        portal_access_status: "not_created",
        iib_status: "registered",
        compliance_status: "active",
        updated_at: now,
      }).eq("id", generatedIntermediary.id);
      if (registerUpdate.error) throw stepError("intermediary_register", registerUpdate.error);
    }

    await admin.from("intermediary_onboarding_contacts").insert((await admin.from("intermediary_onboarding_contacts").select("contact_role,full_name,phone,email,is_designated_person,login_required,membership_status").eq("application_id", sourceApplicationId)).data?.map((row) => ({ ...row, application_id: childId })) ?? []);
    await admin.from("intermediary_onboarding_documents").insert((await admin.from("intermediary_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_status,verified_by,verified_at").eq("application_id", sourceApplicationId)).data?.map((row) => ({ ...row, id: randomUUID(), application_id: childId, uploaded_by: reviewer.id, created_at: now, updated_at: now })) ?? []);
  } catch (error) {
    if (childCreated) {
      await admin.from("intermediary_iib_submission_packets").delete().eq("application_id", childId);
      await admin.from("intermediary_training_exam_assignments").delete().eq("application_id", childId);
      await admin.from("intermediary_onboarding_documents").delete().eq("application_id", childId);
      await admin.from("intermediary_onboarding_contacts").delete().eq("application_id", childId);
      await admin.from("intermediaries").delete().eq("application_id", childId);
      await admin.from("intermediary_registrations").delete().eq("application_id", childId);
      await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", childId);
      await admin.from("intermediary_onboarding_applications").delete().eq("id", childId);
    }
    if (parentUpdated) {
      await admin.from("partners").update({ partner_code: oldPartnerCode, updated_at: now }).eq("id", String(sourceApp.partner_record_id));
      await admin.from("posp_misp_onboarding_profiles").update({ partner_id: oldPartnerCode, updated_by: reviewer.id, updated_at: now }).eq("application_id", sourceApplicationId);
      if (sourceIntermediary) await admin.from("intermediaries").update({ intermediary_code: sourceIntermediary.intermediary_code, updated_at: now }).eq("id", sourceIntermediary.id);
    }
    redirectFresh(`${reviewPath(sourceApplicationId)}/legacy-import?error=${encodeURIComponent(importError(error))}`);
  }

  revalidatePath(reviewPath(sourceApplicationId));
  revalidatePath(reviewPath(childId));
  revalidatePath("/intermediaries");
  redirectFresh(`${reviewPath(childId)}?success=legacy_intermediary_imported`);
}

function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function normalizedCode(data: FormData, key: string) { return text(data, key)?.replace(/\s+/g, " ").toUpperCase() ?? null; }
function dateValue(data: FormData, key: string) { const value = text(data, key); if (!value) return null; const date = new Date(`${value}T00:00:00+05:30`); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function numberValue(data: FormData, key: string) { const value = text(data, key); if (!value) return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function stepError(step: string, error: unknown) { return new Error(`[${step}] ${errorMessage(error)}`); }
function errorMessage(error: unknown) { if (error instanceof Error) return error.message; if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message ?? "Unknown database error"); return "Unknown database error"; }
function importError(error: unknown) { const message = errorMessage(error); if (message.includes("duplicate key") || message.includes("unique constraint")) return "A Partner, POSP, MISP, PAN, Aadhaar, mobile or email value already exists. No records were imported."; if (message.startsWith("[")) return `Legacy import failed at ${message.slice(1, message.indexOf("]"))}. All created records were rolled back.`; return "The existing intermediary could not be imported. No partial linked account was retained."; }
function redirectFresh(href: string): never { redirect(`${href}${href.includes("?") ? "&" : "?"}fresh=${Date.now()}`); }
