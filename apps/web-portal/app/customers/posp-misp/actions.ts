"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { beginPortalOnboardingApplication } from "../onboarding-applications";

export type PospMispState = { error: string | null; field: string | null };

type PartnerType = "posp" | "misp";
type DocumentKey =
  | "aadhaar_front"
  | "aadhaar_back"
  | "pan_copy"
  | "education_certificate"
  | "cancelled_cheque"
  | "photograph"
  | "registration_form"
  | "agreement_copy"
  | "gst_copy";

type NormalizedRow = {
  partner_type: PartnerType;
  associate_name: string | null;
  associate_id: string | null;
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  address: string | null;
  pan_number: string | null;
  aadhaar_last_four: string | null;
  aadhaar_hash: string | null;
  date_of_birth: string | null;
  gst_number: string | null;
  education_status: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  iib_remarks: string | null;
  iib_upload_status: string | null;
  iib_uploaded_at: string | null;
  training_credentials_shared: string | null;
  training_login_id: string | null;
  training_password: string | null;
  training_start_date: string | null;
  training_end_date: string | null;
  training_status: string | null;
  training_certificate_number: string | null;
  exam_status: string | null;
  onboarding_date: string | null;
  oem_name: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
};

type ContactPayload = {
  application_id: string;
  contact_role: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  login_required: boolean;
  membership_status: string;
};

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DOCUMENT_FIELDS: Array<{ key: DocumentKey; label: string }> = [
  { key: "aadhaar_front", label: "Aadhaar front" },
  { key: "aadhaar_back", label: "Aadhaar back" },
  { key: "pan_copy", label: "PAN copy" },
  { key: "education_certificate", label: "10th / 12th certificate" },
  { key: "cancelled_cheque", label: "Cancelled cheque" },
  { key: "photograph", label: "Photograph" },
  { key: "registration_form", label: "Registration form" },
  { key: "agreement_copy", label: "Agreement copy" },
  { key: "gst_copy", label: "GST certificate" }
];

function fail(error: string, field: string | null = null): PospMispState {
  return { error, field };
}

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formFile(data: FormData, name: string) {
  const value = data.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function cell(row: Record<string, unknown>, name: string) {
  const value = row[name];
  if (value === null || value === undefined) return null;
  const output = String(value).trim();
  return output || null;
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  return digits.length === 10 ? `+91${digits}` : null;
}

function normalizePan(value: string | null) {
  const normalized = value?.replace(/\s/g, "").toUpperCase() ?? "";
  return normalized || null;
}

function normalizeGst(value: string | null) {
  const normalized = value?.replace(/\s/g, "").toUpperCase() ?? "";
  return normalized || null;
}

function normalizeAadhaar(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!/^[0-9]{12}$/.test(digits)) return { lastFour: null, hash: null };
  return { lastFour: digits.slice(-4), hash: createHash("sha256").update(digits).digest("hex") };
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replaceAll("'", " ");
  if (!trimmed) return null;
  const parts = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,}|\d{1,2})[-/\s](\d{2,4})$/);
  if (parts) {
    const day = Number(parts[1]);
    const monthText = parts[2];
    const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
    const month = /^[0-9]+$/.test(monthText)
      ? Number(monthText) - 1
      : ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthText.slice(0, 3).toLowerCase());
    if (month >= 0) return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function extension(value: File) {
  if (value.type === "application/pdf") return "pdf";
  if (value.type === "image/png") return "png";
  return "jpg";
}

function validateFile(value: File | null, label: string) {
  if (!value) return null;
  if (!ALLOWED_FILE_TYPES.has(value.type)) return `${label} must be PDF, JPG or PNG.`;
  if (value.size > MAX_FILE_SIZE) return `${label} must be 5 MB or smaller.`;
  return null;
}

function documentStatusesFromForm(data: FormData) {
  return Object.fromEntries(DOCUMENT_FIELDS.map(({ key }) => [key, formFile(data, key) ? "received" : "not_received"]));
}

function profileDraft(row: NormalizedRow, documentStatuses: Record<string, string>) {
  return {
    partner_type: row.partner_type,
    associate_name: row.associate_name,
    associate_id: row.associate_id,
    external_onboarding_id: row.external_onboarding_id,
    document_received_at: row.document_received_at,
    pos_name: row.pos_name,
    misp_name: row.misp_name,
    applicant_phone: row.applicant_phone,
    applicant_email: row.applicant_email,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    address: row.address,
    pan_number: row.pan_number,
    aadhaar_last_four: row.aadhaar_last_four,
    date_of_birth: row.date_of_birth,
    gst_number: row.gst_number,
    education_status: row.education_status,
    bank_name: row.bank_name,
    bank_account_number: row.bank_account_number,
    bank_ifsc_code: row.bank_ifsc_code,
    iib_remarks: row.iib_remarks,
    iib_upload_status: row.iib_upload_status,
    iib_uploaded_at: row.iib_uploaded_at,
    training_credentials_shared: row.training_credentials_shared,
    training_login_id: row.training_login_id,
    training_password: row.training_password,
    training_start_date: row.training_start_date,
    training_end_date: row.training_end_date,
    training_status: row.training_status,
    training_certificate_number: row.training_certificate_number,
    exam_status: row.exam_status,
    onboarding_date: row.onboarding_date,
    oem_name: row.oem_name,
    dp_name: row.dp_name,
    dp_phone: row.dp_phone,
    dp_email: row.dp_email,
    dp_pan_number: row.dp_pan_number,
    document_statuses: documentStatuses
  };
}

function validateRow(row: NormalizedRow) {
  const errors: string[] = [];
  if (row.partner_type === "posp" && !row.pos_name) errors.push("POS name is required.");
  if (row.partner_type === "misp" && !row.misp_name) errors.push("MISP name is required.");
  if (!row.applicant_phone) errors.push("Valid primary mobile is required.");
  if (row.partner_type === "misp" && !row.dp_name) errors.push("DP name is required.");
  if (row.partner_type === "misp" && !row.dp_phone) errors.push("Valid DP mobile is required.");
  if (row.pan_number && !PAN_PATTERN.test(row.pan_number)) errors.push("PAN number is invalid.");
  if (row.dp_pan_number && !PAN_PATTERN.test(row.dp_pan_number)) errors.push("DP PAN number is invalid.");
  if (row.gst_number && !GST_PATTERN.test(row.gst_number)) errors.push("GST number is invalid.");
  return errors;
}

function rowFromForm(data: FormData): NormalizedRow {
  const partnerType = text(data, "partner_type") === "misp" ? "misp" : "posp";
  const aadhaar = normalizeAadhaar(text(data, "aadhaar_number"));
  return {
    partner_type: partnerType,
    associate_name: text(data, "associate_name"),
    associate_id: text(data, "associate_id"),
    external_onboarding_id: text(data, "external_onboarding_id"),
    document_received_at: text(data, "document_received_at"),
    pos_name: partnerType === "posp" ? text(data, "pos_name") : null,
    misp_name: partnerType === "misp" ? text(data, "misp_name") : null,
    applicant_phone: normalizePhone(text(data, "applicant_phone")),
    applicant_email: text(data, "applicant_email")?.toLowerCase() ?? null,
    city: text(data, "city"),
    state: text(data, "state"),
    postal_code: text(data, "postal_code"),
    address: text(data, "address"),
    pan_number: normalizePan(text(data, "pan_number")),
    aadhaar_last_four: aadhaar.lastFour,
    aadhaar_hash: aadhaar.hash,
    date_of_birth: text(data, "date_of_birth"),
    gst_number: normalizeGst(text(data, "gst_number")),
    education_status: text(data, "education_status"),
    bank_name: text(data, "bank_name"),
    bank_account_number: text(data, "bank_account_number"),
    bank_ifsc_code: text(data, "bank_ifsc_code")?.toUpperCase() ?? null,
    iib_remarks: text(data, "iib_remarks"),
    iib_upload_status: text(data, "iib_upload_status"),
    iib_uploaded_at: text(data, "iib_uploaded_at"),
    training_credentials_shared: text(data, "training_credentials_shared"),
    training_login_id: text(data, "training_login_id"),
    training_password: text(data, "training_password"),
    training_start_date: text(data, "training_start_date"),
    training_end_date: text(data, "training_end_date"),
    training_status: text(data, "training_status"),
    training_certificate_number: text(data, "training_certificate_number"),
    exam_status: text(data, "exam_status"),
    onboarding_date: text(data, "onboarding_date"),
    oem_name: text(data, "oem_name"),
    dp_name: text(data, "dp_name"),
    dp_phone: normalizePhone(text(data, "dp_phone")),
    dp_email: text(data, "dp_email")?.toLowerCase() ?? null,
    dp_pan_number: normalizePan(text(data, "dp_pan_number"))
  };
}

function normalizeExcelRow(partnerType: PartnerType, source: Record<string, unknown>): NormalizedRow {
  const aadhaar = normalizeAadhaar(cell(source, partnerType === "posp" ? "Aadhar Number" : "Aadhar Number"));
  return {
    partner_type: partnerType,
    associate_name: cell(source, "Associate Name"),
    associate_id: cell(source, "Associate ID"),
    external_onboarding_id: cell(source, partnerType === "posp" ? "Onboarding ID" : "MISP ID"),
    document_received_at: normalizeDate(source["Document Recv Date"]),
    pos_name: partnerType === "posp" ? cell(source, "POS Name") : null,
    misp_name: partnerType === "misp" ? cell(source, "MISP Name") : null,
    applicant_phone: normalizePhone(cell(source, partnerType === "posp" ? "Contact Number" : "DP Contact")),
    applicant_email: (cell(source, partnerType === "posp" ? "Email" : "DP Email") ?? "").toLowerCase() || null,
    city: cell(source, "City"),
    state: cell(source, "State"),
    postal_code: cell(source, partnerType === "posp" ? "Pin Code" : "PIN Code"),
    address: cell(source, "Address"),
    pan_number: normalizePan(cell(source, partnerType === "posp" ? "Pan Number" : "MISP PAN")),
    aadhaar_last_four: aadhaar.lastFour,
    aadhaar_hash: aadhaar.hash,
    date_of_birth: normalizeDate(source[partnerType === "posp" ? "D.O.B" : "Date of Birth"]),
    gst_number: normalizeGst(cell(source, partnerType === "posp" ? "GST Number( Optional)" : "GST No")),
    education_status: cell(source, partnerType === "posp" ? "Marsheet" : "10th/12th Certificate"),
    bank_name: cell(source, "Bank Name"),
    bank_account_number: cell(source, "Account Number"),
    bank_ifsc_code: cell(source, "IFSC Code")?.toUpperCase() ?? null,
    iib_remarks: cell(source, partnerType === "posp" ? "IIB Remarks POSP/ PARTNER" : "IIB Remarks MISP"),
    iib_upload_status: cell(source, "IIB Upload"),
    iib_uploaded_at: normalizeDate(source["IIB Upload date"]),
    training_credentials_shared: cell(source, "Training ID/Password SHARED"),
    training_login_id: cell(source, "Training ID"),
    training_password: cell(source, "Training Password"),
    training_start_date: normalizeDate(source["Training Start Date"]),
    training_end_date: normalizeDate(source["Training End Date"]),
    training_status: cell(source, "Trainings Status"),
    training_certificate_number: cell(source, "Training Certificate Number"),
    exam_status: cell(source, "Exam Status"),
    onboarding_date: normalizeDate(source["Onboarding Date"]),
    oem_name: cell(source, "OEM Name"),
    dp_name: cell(source, "DP Name"),
    dp_phone: normalizePhone(cell(source, "DP Contact")),
    dp_email: (cell(source, "DP Email") ?? "").toLowerCase() || null,
    dp_pan_number: normalizePan(cell(source, "DP PAN No"))
  };
}

async function currentManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) throw new Error("You are not authorized to manage POSP/MISP onboarding.");
  return profile;
}

async function createSubmittedApplication(params: {
  row: NormalizedRow;
  documentStatuses: Record<string, string>;
  source: "manual" | "excel_import";
  importBatchId?: string | null;
  importRowNumber?: number | null;
  rawData?: Record<string, unknown> | null;
  initiatedBy: string;
}) {
  const admin = createSupabaseAdminClient();
  const draftData = profileDraft(params.row, params.documentStatuses);
  const application = await beginPortalOnboardingApplication(admin, {
    initiatedBy: params.initiatedBy,
    partnerType: params.row.partner_type,
    phone: params.row.applicant_phone ?? "",
    email: params.row.applicant_email,
    draftData
  });

  const profilePayload = {
    application_id: application.id,
    partner_type: params.row.partner_type,
    external_onboarding_id: params.row.external_onboarding_id,
    associate_name: params.row.associate_name,
    associate_id: params.row.associate_id,
    document_received_at: params.row.document_received_at,
    pos_name: params.row.pos_name,
    misp_name: params.row.misp_name,
    applicant_phone: params.row.applicant_phone,
    applicant_email: params.row.applicant_email,
    city: params.row.city,
    state: params.row.state,
    postal_code: params.row.postal_code,
    address: params.row.address,
    pan_number: params.row.pan_number,
    aadhaar_last_four: params.row.aadhaar_last_four,
    aadhaar_hash: params.row.aadhaar_hash,
    date_of_birth: params.row.date_of_birth,
    gst_number: params.row.gst_number,
    education_status: params.row.education_status,
    bank_name: params.row.bank_name,
    bank_account_number: params.row.bank_account_number,
    bank_ifsc_code: params.row.bank_ifsc_code,
    iib_remarks: params.row.iib_remarks,
    iib_upload_status: params.row.iib_upload_status,
    iib_uploaded_at: params.row.iib_uploaded_at,
    training_credentials_shared: params.row.training_credentials_shared,
    training_login_id: params.row.training_login_id,
    training_password: params.row.training_password,
    training_start_date: params.row.training_start_date,
    training_end_date: params.row.training_end_date,
    training_status: params.row.training_status,
    training_certificate_number: params.row.training_certificate_number,
    exam_status: params.row.exam_status,
    onboarding_date: params.row.onboarding_date,
    oem_name: params.row.oem_name,
    dp_name: params.row.dp_name,
    dp_phone: params.row.dp_phone,
    dp_email: params.row.dp_email,
    dp_pan_number: params.row.dp_pan_number,
    source: params.source,
    import_batch_id: params.importBatchId ?? null,
    import_row_number: params.importRowNumber ?? null,
    raw_data: params.rawData ?? {},
    created_by: params.initiatedBy,
    updated_by: params.initiatedBy
  };

  const { error: profileError } = await admin
    .from("posp_misp_onboarding_profiles")
    .upsert(profilePayload, { onConflict: "application_id" });
  if (profileError) throw profileError;

  const contacts = contactPayloads(application.id, params.row);
  if (contacts.length) {
    const { error: contactError } = await admin.from("customer_onboarding_contacts").upsert(contacts, { onConflict: "application_id,contact_role" });
    if (contactError) throw contactError;
  }

  return application;
}

function contactPayloads(applicationId: string, row: NormalizedRow): ContactPayload[] {
  if (row.partner_type === "posp") {
    return [{
      application_id: applicationId,
      contact_role: "posp",
      full_name: row.pos_name ?? row.associate_name ?? "POSP",
      phone: row.applicant_phone,
      email: row.applicant_email,
      login_required: true,
      membership_status: "pending"
    }];
  }

  if (row.applicant_phone && row.dp_phone && row.applicant_phone === row.dp_phone) {
    return [{
      application_id: applicationId,
      contact_role: "misp_primary_dp",
      full_name: row.dp_name ?? row.misp_name ?? "MISP contact",
      phone: row.dp_phone,
      email: row.dp_email ?? row.applicant_email,
      login_required: true,
      membership_status: "pending"
    }];
  }

  const possibleContacts = ([
    row.applicant_phone ? {
      application_id: applicationId,
      contact_role: "misp_primary",
      full_name: row.misp_name ?? "MISP",
      phone: row.applicant_phone,
      email: row.applicant_email,
      login_required: true,
      membership_status: "pending"
    } : null,
    row.dp_phone ? {
      application_id: applicationId,
      contact_role: "misp_dp",
      full_name: row.dp_name ?? "DP contact",
      phone: row.dp_phone,
      email: row.dp_email,
      login_required: true,
      membership_status: "pending"
    } : null
  ] as Array<ContactPayload | null>).filter((contact): contact is ContactPayload => Boolean(contact));
  return possibleContacts;
}

export async function createPospMispOnboarding(_state: PospMispState, data: FormData): Promise<PospMispState> {
  let manager: { id: string };
  try {
    manager = await currentManager();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "You are not authorized.");
  }

  const row = rowFromForm(data);
  const errors = validateRow(row);
  if (errors.length) return fail(errors[0], errors[0].includes("DP") ? "dp_phone" : "applicant_phone");

  for (const { key, label } of DOCUMENT_FIELDS) {
    const error = validateFile(formFile(data, key), label);
    if (error) return fail(error, key);
  }

  const documentStatuses = documentStatusesFromForm(data);
  let application: { id: string };
  try {
    application = await createSubmittedApplication({ row, documentStatuses, source: "manual", initiatedBy: manager.id });
  } catch (error) {
    return fail(`Application could not be submitted: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  const admin = createSupabaseAdminClient();
  const uploadedPaths: string[] = [];
  for (const { key } of DOCUMENT_FIELDS) {
    const selected = formFile(data, key);
    if (!selected) continue;
    const path = `${application.id}/posp-misp/${key}/${randomUUID()}.${extension(selected)}`;
    const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(path, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
    if (uploadError) {
      if (uploadedPaths.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
      return fail(`Document upload failed: ${uploadError.message}`, key);
    }
    uploadedPaths.push(path);
    const { error: documentError } = await admin.from("customer_onboarding_documents").upsert({
      application_id: application.id,
      document_type: key,
      file_name: selected.name,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: path,
      mime_type: selected.type,
      file_size: selected.size,
      verification_status: "pending",
      uploaded_by: manager.id
    }, { onConflict: "application_id,document_type" });
    if (documentError) {
      await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
      return fail(`Document record could not be saved: ${documentError.message}`, key);
    }
  }

  redirect(`/customers/applications/${application.id}?success=posp_misp_submitted`);
}

export async function uploadPospMispWorkbook(_state: PospMispState, data: FormData): Promise<PospMispState> {
  let manager: { id: string };
  try {
    manager = await currentManager();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "You are not authorized.");
  }

  const selected = formFile(data, "workbook");
  if (!selected) return fail("Choose the POSP/MISP Excel workbook.", "workbook");
  const admin = createSupabaseAdminClient();
  const bytes = await selected.arrayBuffer();
  const workbook = XLSX.read(bytes, { cellDates: true });
  const rows: Array<{ partner_type: PartnerType; sheet_name: string; row_number: number; source_data: Record<string, unknown>; normalized_data: NormalizedRow; validation_errors: string[] }> = [];

  for (const partnerType of ["posp", "misp"] as const) {
    const sheetName = partnerType.toUpperCase();
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });
    jsonRows.forEach((source, index) => {
      if (!Object.values(source).some((value) => value !== null && String(value).trim())) return;
      const normalized = normalizeExcelRow(partnerType, source);
      rows.push({ partner_type: partnerType, sheet_name: sheetName, row_number: index + 2, source_data: source, normalized_data: normalized, validation_errors: validateRow(normalized) });
    });
  }

  if (!rows.length) return fail("The workbook does not contain POSP or MISP rows.", "workbook");

  const { data: batch, error: batchError } = await admin.from("posp_misp_import_batches").insert({
    file_name: selected.name,
    uploaded_by: manager.id,
    total_rows: rows.length,
    valid_rows: rows.filter((row) => !row.validation_errors.length).length,
    invalid_rows: rows.filter((row) => row.validation_errors.length).length,
    status: "parsed"
  }).select("id").single<{ id: string }>();
  if (batchError || !batch) return fail(`Import batch could not be created: ${batchError?.message ?? "Unknown error"}`);

  const { error: rowError } = await admin.from("posp_misp_import_rows").insert(rows.map((row) => ({
    import_batch_id: batch.id,
    partner_type: row.partner_type,
    row_number: row.row_number,
    sheet_name: row.sheet_name,
    source_data: row.source_data,
    normalized_data: row.normalized_data,
    validation_errors: row.validation_errors,
    status: row.validation_errors.length ? "invalid" : "parsed"
  })));
  if (rowError) return fail(`Import rows could not be saved: ${rowError.message}`);

  redirect(`/customers/posp-misp/import/${batch.id}`);
}

export async function submitPospMispImportBatch(data: FormData) {
  const manager = await currentManager();
  const batchId = text(data, "batch_id");
  if (!batchId) redirect("/customers/posp-misp/import?error=batch_missing");
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("posp_misp_import_rows")
    .select("id, row_number, partner_type, source_data, normalized_data")
    .eq("import_batch_id", batchId)
    .eq("status", "parsed")
    .returns<Array<{ id: string; row_number: number; partner_type: PartnerType; source_data: Record<string, unknown>; normalized_data: NormalizedRow }>>();
  if (error || !rows?.length) redirect(`/customers/posp-misp/import/${batchId}?error=no_valid_rows`);

  for (const row of rows) {
    try {
      const application = await createSubmittedApplication({
        row: row.normalized_data,
        documentStatuses: Object.fromEntries(DOCUMENT_FIELDS.map(({ key }) => [key, "not_received"])),
        source: "excel_import",
        importBatchId: batchId,
        importRowNumber: row.row_number,
        rawData: row.source_data,
        initiatedBy: manager.id
      });
      await admin.from("posp_misp_import_rows").update({ status: "submitted", application_id: application.id, error_message: null }).eq("id", row.id);
    } catch (creationError) {
      await admin.from("posp_misp_import_rows").update({ status: "failed", error_message: creationError instanceof Error ? creationError.message : "Unknown error" }).eq("id", row.id);
    }
  }

  await admin.from("posp_misp_import_batches").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", batchId);
  redirect(`/customers/posp-misp/import/${batchId}?success=submitted`);
}
