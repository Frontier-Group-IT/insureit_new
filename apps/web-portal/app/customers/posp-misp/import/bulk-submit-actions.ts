"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PartnerType = "posp" | "misp";
type RowRecord = {
  id: string;
  row_number: number;
  partner_type: PartnerType;
  source_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
};
type RowDocument = {
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
};

export async function submitPospMispImportBatch(data: FormData) {
  const manager = await currentManager();
  const batchId = value(data, "batch_id");
  const retryFailed = data.get("retry_failed") === "true";
  if (!batchId) redirect("/customers/posp-misp/import?error=batch_missing");

  const admin = createSupabaseAdminClient();
  const expectedStatus = retryFailed ? "failed" : "parsed";
  const { data: rows, error: rowsError } = await admin
    .from("posp_misp_import_rows")
    .select("id,row_number,partner_type,source_data,normalized_data")
    .eq("import_batch_id", batchId)
    .eq("status", expectedStatus)
    .order("row_number", { ascending: true })
    .returns<RowRecord[]>();

  if (rowsError || !rows?.length) {
    redirect(`/customers/posp-misp/import/${batchId}?error=no_valid_rows`);
  }

  for (const row of rows) {
    const { data: claimed } = await admin
      .from("posp_misp_import_rows")
      .update({ status: "processing", error_message: null })
      .eq("id", row.id)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (!claimed) continue;

    let createdApplicationId: string | null = null;
    try {
      const normalized = row.normalized_data ?? {};
      validateNormalizedRow(row.partner_type, normalized);

      const { data: rowDocuments, error: documentLoadError } = await admin
        .from("posp_misp_import_row_documents")
        .select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size,uploaded_by")
        .eq("import_row_id", row.id)
        .returns<RowDocument[]>();
      if (documentLoadError) throw stageError("Load row documents", documentLoadError);

      const phone = stringValue(normalized.applicant_phone);
      const email = stringValue(normalized.applicant_email)?.toLowerCase() ?? null;
      const onboardingId = stringValue(normalized.external_onboarding_id)?.toUpperCase() ?? null;

      const { data: duplicateProfile, error: duplicateError } = await admin
        .from("posp_misp_onboarding_profiles")
        .select("application_id,external_onboarding_id")
        .eq("external_onboarding_id", onboardingId)
        .maybeSingle<{ application_id: string; external_onboarding_id: string }>();
      if (duplicateError) throw stageError("Check onboarding ID", duplicateError);
      if (duplicateProfile) throw new Error(`Onboarding ID ${onboardingId} already exists in application ${duplicateProfile.application_id}.`);

      const now = new Date().toISOString();
      const { data: application, error: applicationError } = await admin
        .from("intermediary_onboarding_applications")
        .insert({
          initiated_by: manager.id,
          source: "excel_import",
          requested_type: row.partner_type,
          final_type: null,
          status: "submitted",
          current_step: 1,
          applicant_phone: phone,
          applicant_email: email,
          draft_data: normalized,
          submitted_at: now,
          updated_at: now
        })
        .select("id")
        .single<{ id: string }>();
      if (applicationError || !application) throw stageError("Create intermediary application", applicationError);
      createdApplicationId = application.id;

      const dpNames = designatedPersonNames(normalized);
      const isMisp = row.partner_type === "misp";
      const profilePayload = {
        application_id: application.id,
        partner_type: row.partner_type,
        requested_account_type: row.partner_type,
        final_account_type: null,
        partner_decision: "not_applicable",
        associate_employee_id: stringValue(normalized.associate_employee_id),
        associate_profile_id: stringValue(normalized.associate_profile_id),
        associate_name: stringValue(normalized.associate_name),
        associate_id: stringValue(normalized.associate_id),
        external_onboarding_id: onboardingId,
        document_received_at: stringValue(normalized.document_received_at),
        pos_name: isMisp ? null : stringValue(normalized.pos_name),
        misp_name: isMisp ? stringValue(normalized.misp_name) : null,
        applicant_phone: phone,
        applicant_email: email,
        pan_number: stringValue(normalized.pan_number)?.toUpperCase() ?? null,
        gst_number: stringValue(normalized.gst_number)?.toUpperCase() ?? null,
        address: stringValue(normalized.address),
        city: stringValue(normalized.city),
        state: stringValue(normalized.state),
        postal_code: stringValue(normalized.postal_code),
        bank_id: stringValue(normalized.bank_id),
        bank_name: stringValue(normalized.bank_name),
        bank_account_number: unmaskAccount(stringValue(normalized.bank_account_number)),
        bank_ifsc_code: stringValue(normalized.bank_ifsc_code)?.toUpperCase() ?? null,
        oem_name: isMisp ? stringValue(normalized.oem_name) : null,
        dp_first_name: isMisp ? dpNames.first : null,
        dp_middle_name: isMisp ? dpNames.middle : null,
        dp_last_name: isMisp ? dpNames.last : null,
        dp_name: isMisp ? dpNames.full : null,
        dp_phone: isMisp ? stringValue(normalized.dp_phone) ?? phone : null,
        dp_email: isMisp ? stringValue(normalized.dp_email)?.toLowerCase() ?? email : null,
        dp_pan_number: isMisp ? stringValue(normalized.dp_pan_number)?.toUpperCase() ?? null : null,
        dp_date_of_birth: isMisp ? stringValue(normalized.dp_date_of_birth) ?? stringValue(normalized.date_of_birth) : null,
        dp_aadhaar_last_four: isMisp ? stringValue(normalized.dp_aadhaar_last_four) ?? stringValue(normalized.aadhaar_last_four) : null,
        dp_aadhaar_hash: isMisp ? stringValue(normalized.dp_aadhaar_hash) ?? stringValue(normalized.aadhaar_hash) : null,
        dp_aadhaar_number_encrypted: isMisp ? stringValue(normalized.dp_aadhaar_number_encrypted) ?? stringValue(normalized.aadhaar_number_encrypted) : null,
        date_of_birth: isMisp ? null : stringValue(normalized.date_of_birth),
        aadhaar_last_four: isMisp ? null : stringValue(normalized.aadhaar_last_four),
        aadhaar_hash: isMisp ? null : stringValue(normalized.aadhaar_hash),
        aadhaar_number_encrypted: isMisp ? null : stringValue(normalized.aadhaar_number_encrypted),
        education_status: stringValue(normalized.education_status) ?? "not_received",
        iib_remarks: null,
        iib_upload_status: "pending",
        iib_uploaded: false,
        workflow_stage: "pre_iib",
        pre_iib_submitted_at: now,
        source: "excel_import",
        import_batch_id: batchId,
        import_row_number: row.row_number,
        raw_data: row.source_data ?? {},
        created_by: manager.id,
        updated_by: manager.id
      };

      const { error: profileError } = await admin.from("posp_misp_onboarding_profiles").insert(profilePayload);
      if (profileError) throw stageError("Create intermediary profile", profileError);

      const contactName = isMisp ? dpNames.full : stringValue(normalized.pos_name);
      const { error: contactError } = await admin.from("intermediary_onboarding_contacts").upsert({
        application_id: application.id,
        contact_role: isMisp ? "misp_dp" : "posp",
        full_name: contactName,
        phone: isMisp ? stringValue(normalized.dp_phone) ?? phone : phone,
        email: isMisp ? stringValue(normalized.dp_email)?.toLowerCase() ?? email : email,
        is_designated_person: isMisp,
        login_required: false,
        membership_status: "pending"
      }, { onConflict: "application_id,contact_role" });
      if (contactError) throw stageError("Create intermediary contact", contactError);

      if (rowDocuments?.length) {
        const { error: linkError } = await admin.from("intermediary_onboarding_documents").upsert(
          rowDocuments.map((document) => ({
            application_id: application.id,
            document_type: document.document_type,
            file_name: document.file_name,
            storage_bucket: document.storage_bucket,
            storage_path: document.storage_path,
            mime_type: document.mime_type,
            file_size: document.file_size,
            verification_status: "pending",
            uploaded_by: document.uploaded_by ?? manager.id
          })),
          { onConflict: "application_id,document_type" }
        );
        if (linkError) throw stageError("Link intermediary documents", linkError);
      }

      const { error: rowUpdateError } = await admin.from("posp_misp_import_rows").update({
        status: "submitted",
        application_id: application.id,
        error_message: null
      }).eq("id", row.id);
      if (rowUpdateError) throw stageError("Finalize import row", rowUpdateError);
    } catch (error) {
      if (createdApplicationId) {
        await admin.from("intermediary_onboarding_applications").delete().eq("id", createdApplicationId);
      }
      const reference = randomUUID().slice(0, 8);
      const clearReason = formatSubmissionError(error, reference);
      console.error(`POSP/MISP import row ${row.row_number} failed [${reference}]`, error);
      await admin.from("posp_misp_import_rows").update({
        status: "failed",
        application_id: null,
        error_message: clearReason
      }).eq("id", row.id);
    }
  }

  await refreshBatchCounts(batchId);
  redirect(`/customers/posp-misp/import/${batchId}?success=${retryFailed ? "retried" : "submitted"}`);
}

async function currentManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManagePospMispOnboarding(profile.role)) {
    throw new Error("You are not authorized to manage intermediary onboarding.");
  }
  return { id: profile.id };
}

async function refreshBatchCounts(batchId: string) {
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin.from("posp_misp_import_rows").select("status").eq("import_batch_id", batchId).returns<Array<{ status: string }>>();
  if (error) throw error;
  const statuses = rows ?? [];
  const count = (status: string) => statuses.filter((row) => row.status === status).length;
  const submitted = count("submitted");
  const failed = count("failed");
  const parsed = count("parsed");
  const processing = count("processing");
  const invalid = count("invalid");
  const batchStatus = processing ? "processing" : statuses.length && submitted === statuses.length ? "submitted" : submitted ? "partially_submitted" : failed && !parsed ? "failed" : "parsed";
  const { error: updateError } = await admin.from("posp_misp_import_batches").update({
    total_rows: statuses.length,
    valid_rows: parsed,
    invalid_rows: invalid,
    pending_rows: parsed + processing,
    submitted_rows: submitted,
    failed_rows: failed,
    status: batchStatus,
    submitted_at: submitted ? new Date().toISOString() : null
  }).eq("id", batchId);
  if (updateError) throw updateError;
}

function validateNormalizedRow(type: PartnerType, row: Record<string, unknown>) {
  const required: Array<[string, unknown]> = [
    [type === "misp" ? "MISP ID" : "POSP ID", row.external_onboarding_id],
    ["RM Name", row.associate_employee_id],
    [type === "misp" ? "MISP Name" : "POS Name", type === "misp" ? row.misp_name : row.pos_name],
    ["Mobile Number", row.applicant_phone],
    ["Email", row.applicant_email],
    ["Date of Birth", row.date_of_birth],
    ["Aadhaar Number", row.aadhaar_hash],
    ["Address", row.address],
    ["City", row.city],
    ["State", row.state],
    ["PIN Code", row.postal_code],
    ["Bank Name", row.bank_id],
    ["Account Number", row.bank_account_number],
    ["IFSC Code", row.bank_ifsc_code]
  ];
  if (type === "misp") required.push(["DP PAN No", row.dp_pan_number], ["OEM Name", row.oem_name], ["DP Name", row.dp_name ?? row.dp_first_name]);
  else required.push(["PAN Number", row.pan_number]);
  const missing = required.filter(([, field]) => !stringValue(field)).map(([label]) => label);
  if (missing.length) throw new Error(`Required fields are missing: ${missing.join(", ")}.`);
}

function designatedPersonNames(row: Record<string, unknown>) {
  const first = stringValue(row.dp_first_name);
  const middle = stringValue(row.dp_middle_name);
  const last = stringValue(row.dp_last_name);
  if (first && middle && last) return { first, middle, last, full: `${first} ${middle} ${last}` };
  const parts = (stringValue(row.dp_name) ?? "").split(/\s+/).filter(Boolean);
  return {
    first: first ?? parts[0] ?? null,
    middle: middle ?? (parts.length > 2 ? parts.slice(1, -1).join(" ") : parts[1] ?? null),
    last: last ?? parts.at(-1) ?? null,
    full: [first ?? parts[0], middle ?? (parts.length > 2 ? parts.slice(1, -1).join(" ") : parts[1]), last ?? parts.at(-1)].filter(Boolean).join(" ")
  };
}

function stageError(stage: string, error: unknown) {
  const details = databaseErrorParts(error);
  return new Error(`${stage} failed${details ? `: ${details}` : "."}`);
}

function formatSubmissionError(error: unknown, reference: string) {
  const detail = databaseErrorParts(error) || "No error details were returned by the database.";
  return `${detail} Reference ${reference}.`;
}

function databaseErrorParts(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (!error || typeof error !== "object") return String(error ?? "").trim();
  const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  const parts: string[] = [];
  if (typeof value.message === "string" && value.message.trim()) parts.push(value.message.trim());
  if (typeof value.details === "string" && value.details.trim() && !parts.includes(value.details.trim())) parts.push(value.details.trim());
  if (typeof value.hint === "string" && value.hint.trim()) parts.push(`Hint: ${value.hint.trim()}`);
  if (typeof value.code === "string" && value.code.trim()) parts.push(`Code: ${value.code.trim()}`);
  return parts.join(" ");
}

function value(data: FormData, name: string) {
  const field = data.get(name);
  return typeof field === "string" && field.trim() ? field.trim() : null;
}
function stringValue(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}
function unmaskAccount(input: string | null) {
  if (!input) return null;
  return input.includes("•") ? null : input.replace(/\s/g, "");
}
