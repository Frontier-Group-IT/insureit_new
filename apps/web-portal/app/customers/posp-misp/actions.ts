"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { parsePospMispWorkbook, WorkbookValidationError } from "@/lib/posp-misp-workbook";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { beginPortalOnboardingApplication } from "../onboarding-applications";
import { normalizeImportedDate } from "@/lib/indian-date";

export type PospMispState = { error: string | null; field: string | null };

type PartnerType = "posp" | "misp";
type DocumentKey =
  | "aadhaar_front"
  | "aadhaar_back"
  | "pan_copy"
  | "education_10th_marksheet"
  | "education_12th_marksheet"
  | "education_graduation_marksheet"
  | "education_post_graduation_marksheet"
  | "cancelled_cheque"
  | "photograph"
  | "agreement_copy"
  | "gst_copy";

type NormalizedRow = {
  partner_type: PartnerType;
  associate_profile_id: string | null;
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
  bank_id: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  iib_remarks: string | null;
  iib_upload_status: string | null;
  iib_uploaded: boolean;
  iib_uploaded_at: string | null;
  training_credentials_shared: string | null;
  training_credentials_shared_flag: boolean;
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

type SalesManagerOption = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
};

type BankOption = {
  id: string;
  name: string;
  normalized_name: string;
};

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EXTERNAL_ID_PATTERN = /^SIB\/[0-9]{4}\/(0[1-9]|1[0-2])\/[0-9]{4}$/;
const IIB_REMARK_OPTIONS = new Set(["Matching Record Found In DataBase", "No Data Found In POS System"]);
const PRE_IIB_DOCUMENT_FIELDS: Array<{ key: DocumentKey; label: string }> = [
  { key: "aadhaar_front", label: "Aadhaar front" },
  { key: "aadhaar_back", label: "Aadhaar back" },
  { key: "pan_copy", label: "PAN copy" },
  { key: "education_10th_marksheet", label: "10th Marksheet" },
  { key: "education_12th_marksheet", label: "12th Marksheet" },
  { key: "education_graduation_marksheet", label: "Graduation Marksheet" },
  { key: "education_post_graduation_marksheet", label: "Post Graduation Marksheet" },
  { key: "cancelled_cheque", label: "Cancelled cheque" },
  { key: "photograph", label: "Photograph" },
  { key: "gst_copy", label: "GST certificate" }
];
const POST_IIB_DOCUMENT_FIELDS: Array<{ key: DocumentKey; label: string }> = [
  { key: "agreement_copy", label: "Agreement copy" }
];
const DOCUMENT_FIELDS = [...PRE_IIB_DOCUMENT_FIELDS, ...POST_IIB_DOCUMENT_FIELDS];
const EDUCATION_DOCUMENT_KEYS = new Set<DocumentKey>([
  "education_10th_marksheet",
  "education_12th_marksheet",
  "education_graduation_marksheet",
  "education_post_graduation_marksheet"
]);

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
  return normalizeImportedDate(value);
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

function educationStatusFromForm(data: FormData) {
  return PRE_IIB_DOCUMENT_FIELDS.some(({ key }) => EDUCATION_DOCUMENT_KEYS.has(key) && Boolean(formFile(data, key)))
    ? "received"
    : "not_received";
}

function normalizeBoolean(value: string | null) {
  return /^(true|yes|y|1|uploaded|shared|done|complete|completed)$/i.test(value ?? "");
}

function normalizeIibRemark(value: string | null) {
  return value?.trim() || null;
}

function resolveSalesManagerByProfileId(managers: SalesManagerOption[], profileId: string | null) {
  if (!profileId) return null;
  return managers.find((manager) => manager.id === profileId) ?? null;
}

function resolveSalesManagerFromExcel(managers: SalesManagerOption[], associateName: string | null, associateId: string | null) {
  const normalizedId = associateId?.trim().toLowerCase();
  const normalizedName = associateName?.trim().toLowerCase();
  return managers.find((manager) => manager.employee_code?.trim().toLowerCase() === normalizedId)
    ?? managers.find((manager) => manager.full_name?.trim().toLowerCase() === normalizedName)
    ?? null;
}

function managerName(manager: SalesManagerOption | null) {
  return manager?.full_name?.trim() || null;
}

function managerCode(manager: SalesManagerOption | null) {
  return manager?.employee_code?.trim() || null;
}

function normalizeBankName(value?: string | null) {
  return value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(ltd|limited)\b/g, "limited")
    .replace(/[^a-z0-9]/g, "") ?? "";
}

function compactBankName(value?: string | null) {
  return normalizeBankName(value)
    .replace(/limited$/g, "")
    .replace(/nationalassociation$/g, "")
    .replace(/bankingcorporation$/g, "");
}

function resolveBankById(banks: BankOption[], bankId: string | null) {
  return bankId ? banks.find((bank) => bank.id === bankId) ?? null : null;
}

function resolveBankFromExcel(banks: BankOption[], value: string | null) {
  if (!value) return null;
  const exact = normalizeBankName(value);
  const exactMatch = banks.find((bank) => normalizeBankName(bank.name) === exact);
  if (exactMatch) return exactMatch;
  const compact = compactBankName(value);
  const candidates = banks.filter((bank) => compactBankName(bank.name) === compact);
  return candidates.length === 1 ? candidates[0] : null;
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, employee_code")
    .eq("role", "sales_manager")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .returns<SalesManagerOption[]>();
  if (error) throw error;
  return data ?? [];
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin
    .from("banks")
    .select("id, name, normalized_name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<BankOption[]>();
  if (error) throw error;
  return data ?? [];
}

async function loadManufacturerNames(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin
    .from("vehicle_manufacturers")
    .select("name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<Array<{ name: string }>>();
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.name.trim()).filter(Boolean));
}

function normalizeOem(value: string | null, manufacturerNames: Set<string>) {
  if (!value) return null;
  const match = [...manufacturerNames].find((name) => name.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

function profileDraft(row: NormalizedRow, documentStatuses: Record<string, string>) {
  return {
    partner_type: row.partner_type,
    associate_profile_id: row.associate_profile_id,
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
    bank_id: row.bank_id,
    bank_name: row.bank_name,
    bank_account_last_four: row.bank_account_number?.replace(/\s/g, "").slice(-4) ?? null,
    bank_ifsc_code: row.bank_ifsc_code,
    iib_remarks: row.iib_remarks,
    iib_upload_status: row.iib_upload_status,
    iib_uploaded: row.iib_uploaded,
    iib_uploaded_at: row.iib_uploaded_at,
    training_credentials_shared: row.training_credentials_shared,
    training_credentials_shared_flag: row.training_credentials_shared_flag,
    training_login_id: row.training_login_id,
    training_password_on_file: Boolean(row.training_password),
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

function sanitizeSourceData(source: Record<string, unknown>) {
  const sanitized = { ...source };
  const account = cell(source, "Account Number");
  delete sanitized["Aadhar Number"];
  delete sanitized["Account Number"];
  delete sanitized["Training Password"];
  sanitized["Aadhaar"] = source["Aadhar Number"] ? "Stored separately" : null;
  sanitized["Account Last Four"] = account?.replace(/\s/g, "").slice(-4) ?? null;
  sanitized["Training Password"] = source["Training Password"] ? "Stored separately" : null;
  return sanitized;
}

function sanitizeSubmittedRow(row: NormalizedRow) {
  return {
    ...row,
    bank_account_number: row.bank_account_number ? `•••• ${row.bank_account_number.replace(/\s/g, "").slice(-4)}` : null,
    training_password: row.training_password ? "Stored separately" : null,
    aadhaar_hash: row.aadhaar_hash ? "Stored separately" : null
  };
}

function validateRow(row: NormalizedRow) {
  const errors: string[] = [];
  if (!row.associate_profile_id) errors.push("Select a valid Sales Manager as Associate.");
  if (row.partner_type === "posp" && !row.pos_name) errors.push("POS name is required.");
  if (row.partner_type === "misp" && !row.misp_name) errors.push("MISP name is required.");
  if (!row.applicant_phone) errors.push("Valid primary mobile is required.");
  if (row.partner_type === "misp" && !row.dp_name) errors.push("DP name is required.");
  if (row.partner_type === "misp" && !row.dp_phone) errors.push("Valid DP mobile is required.");
  if (row.pan_number && !PAN_PATTERN.test(row.pan_number)) errors.push("PAN number is invalid.");
  if (row.dp_pan_number && !PAN_PATTERN.test(row.dp_pan_number)) errors.push("DP PAN number is invalid.");
  if (row.gst_number && !GST_PATTERN.test(row.gst_number)) errors.push("GST number is invalid.");
  if (!row.bank_id) errors.push("Select a bank from the approved bank master.");
  if (row.external_onboarding_id && !EXTERNAL_ID_PATTERN.test(row.external_onboarding_id.toUpperCase())) errors.push("External ID must use SIB/YYYY/MM/NNNN format.");
  if (row.iib_remarks && !IIB_REMARK_OPTIONS.has(row.iib_remarks)) errors.push("Choose a valid IIB remark.");
  if (row.iib_uploaded && (!row.iib_remarks || !row.iib_uploaded_at)) {
    errors.push("IIB remarks and upload date are required when IIB is uploaded.");
  }
  if (row.training_end_date && row.training_start_date && row.training_end_date < row.training_start_date) {
    errors.push("Training end date cannot be before the start date.");
  }
  if (row.onboarding_date && (!row.training_login_id || !row.training_password || !row.training_start_date || !row.training_end_date || !row.training_status || !row.exam_status)) {
    errors.push("Complete the training credentials, dates, status and exam result for an onboarded record.");
  }
  if (row.partner_type === "misp" && !row.oem_name) errors.push("Select a valid OEM.");
  return errors;
}

function excelDateErrors(partnerType: PartnerType, source: Record<string, unknown>, row: NormalizedRow) {
  const fields: Array<[string, string, string | null]> = [
    ["Document Recv Date", "Document Received Date", row.document_received_at],
    [partnerType === "posp" ? "D.O.B" : "Date of Birth", "Date of Birth", row.date_of_birth],
    ["IIB Upload date", "IIB Upload Date", row.iib_uploaded_at],
    ["Training Start Date", "Training Start Date", row.training_start_date],
    ["Training End Date", "Training End Date", row.training_end_date],
    ["Onboarding Date", "Onboarding Date", row.onboarding_date]
  ];
  return fields.flatMap(([sourceKey, label, normalized]) => {
    const supplied = source[sourceKey];
    return supplied !== null && supplied !== undefined && String(supplied).trim() && !normalized
      ? [`${label} must use dd/mm/yyyy format.`]
      : [];
  });
}

function rowFromForm(data: FormData, salesManagers: SalesManagerOption[], manufacturerNames: Set<string>, banks: BankOption[]): NormalizedRow {
  const partnerType = text(data, "partner_type") === "misp" ? "misp" : "posp";
  const aadhaar = normalizeAadhaar(text(data, "aadhaar_number"));
  const associate = resolveSalesManagerByProfileId(salesManagers, text(data, "associate_profile_id"));
  const educationStatus = educationStatusFromForm(data);
  const bank = resolveBankById(banks, text(data, "bank_id"));
  const iibUploaded = data.get("iib_uploaded") === "true";
  const credentialsShared = data.get("training_credentials_shared_flag") === "true";
  return {
    partner_type: partnerType,
    associate_profile_id: associate?.id ?? null,
    associate_name: managerName(associate),
    associate_id: managerCode(associate),
    external_onboarding_id: text(data, "external_onboarding_id")?.toUpperCase() ?? null,
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
    education_status: educationStatus,
    bank_id: bank?.id ?? null,
    bank_name: bank?.name ?? null,
    bank_account_number: text(data, "bank_account_number"),
    bank_ifsc_code: text(data, "bank_ifsc_code")?.toUpperCase() ?? null,
    iib_remarks: normalizeIibRemark(text(data, "iib_remarks")),
    iib_upload_status: iibUploaded ? "uploaded" : "pending",
    iib_uploaded: iibUploaded,
    iib_uploaded_at: text(data, "iib_uploaded_at"),
    training_credentials_shared: credentialsShared ? "yes" : "no",
    training_credentials_shared_flag: credentialsShared,
    training_login_id: text(data, "training_login_id"),
    training_password: text(data, "training_password"),
    training_start_date: text(data, "training_start_date"),
    training_end_date: text(data, "training_end_date"),
    training_status: text(data, "training_status"),
    training_certificate_number: text(data, "training_certificate_number"),
    exam_status: text(data, "exam_status"),
    onboarding_date: text(data, "onboarding_date"),
    oem_name: partnerType === "misp" ? normalizeOem(text(data, "oem_name"), manufacturerNames) : null,
    dp_name: text(data, "dp_name"),
    dp_phone: normalizePhone(text(data, "dp_phone")),
    dp_email: text(data, "dp_email")?.toLowerCase() ?? null,
    dp_pan_number: normalizePan(text(data, "dp_pan_number"))
  };
}

function rowFromImportEditForm(data: FormData, existing: NormalizedRow, salesManagers: SalesManagerOption[], manufacturerNames: Set<string>, banks: BankOption[]): NormalizedRow {
  const partnerType = text(data, "partner_type") === "misp" ? "misp" : "posp";
  const aadhaarText = text(data, "aadhaar_number");
  const aadhaar = aadhaarText ? normalizeAadhaar(aadhaarText) : { lastFour: existing.aadhaar_last_four, hash: existing.aadhaar_hash };
  const associate = resolveSalesManagerByProfileId(salesManagers, text(data, "associate_profile_id"));
  const iibUploaded = data.get("iib_uploaded") === "true";
  const credentialsShared = data.get("training_credentials_shared_flag") === "true";
  const bank = resolveBankById(banks, text(data, "bank_id"));
  return {
    partner_type: partnerType,
    associate_profile_id: associate?.id ?? null,
    associate_name: managerName(associate),
    associate_id: managerCode(associate),
    external_onboarding_id: text(data, "external_onboarding_id")?.toUpperCase() ?? null,
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
    education_status: text(data, "education_status") === "received" ? "received" : "not_received",
    bank_id: bank?.id ?? null,
    bank_name: bank?.name ?? null,
    bank_account_number: text(data, "bank_account_number"),
    bank_ifsc_code: text(data, "bank_ifsc_code")?.toUpperCase() ?? null,
    iib_remarks: normalizeIibRemark(text(data, "iib_remarks")),
    iib_upload_status: iibUploaded ? "uploaded" : "pending",
    iib_uploaded: iibUploaded,
    iib_uploaded_at: text(data, "iib_uploaded_at"),
    training_credentials_shared: credentialsShared ? "yes" : "no",
    training_credentials_shared_flag: credentialsShared,
    training_login_id: text(data, "training_login_id"),
    training_password: text(data, "training_password"),
    training_start_date: text(data, "training_start_date"),
    training_end_date: text(data, "training_end_date"),
    training_status: text(data, "training_status"),
    training_certificate_number: text(data, "training_certificate_number"),
    exam_status: text(data, "exam_status"),
    onboarding_date: text(data, "onboarding_date"),
    oem_name: partnerType === "misp" ? normalizeOem(text(data, "oem_name"), manufacturerNames) : null,
    dp_name: text(data, "dp_name"),
    dp_phone: normalizePhone(text(data, "dp_phone")),
    dp_email: text(data, "dp_email")?.toLowerCase() ?? null,
    dp_pan_number: normalizePan(text(data, "dp_pan_number"))
  };
}

function normalizeExcelRow(partnerType: PartnerType, source: Record<string, unknown>, salesManagers: SalesManagerOption[], manufacturerNames: Set<string>, banks: BankOption[]): NormalizedRow {
  const aadhaar = normalizeAadhaar(cell(source, partnerType === "posp" ? "Aadhar Number" : "Aadhar Number"));
  const associate = resolveSalesManagerFromExcel(salesManagers, cell(source, "Associate Name"), cell(source, "Associate ID"));
  const iibUploaded = normalizeBoolean(cell(source, "IIB Upload"));
  const credentialsShared = normalizeBoolean(cell(source, "Training ID/Password SHARED"));
  const bank = resolveBankFromExcel(banks, cell(source, "Bank Name"));
  return {
    partner_type: partnerType,
    associate_profile_id: associate?.id ?? null,
    associate_name: managerName(associate) ?? cell(source, "Associate Name"),
    associate_id: managerCode(associate) ?? cell(source, "Associate ID"),
    external_onboarding_id: cell(source, partnerType === "posp" ? "Onboarding ID" : "MISP ID")?.toUpperCase() ?? null,
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
    education_status: "not_received",
    bank_id: bank?.id ?? null,
    bank_name: bank?.name ?? cell(source, "Bank Name"),
    bank_account_number: cell(source, "Account Number"),
    bank_ifsc_code: cell(source, "IFSC Code")?.toUpperCase() ?? null,
    iib_remarks: normalizeIibRemark(cell(source, partnerType === "posp" ? "IIB Remarks POSP/ PARTNER" : "IIB Remarks MISP")),
    iib_upload_status: iibUploaded ? "uploaded" : "pending",
    iib_uploaded: iibUploaded,
    iib_uploaded_at: normalizeDate(source["IIB Upload date"]),
    training_credentials_shared: credentialsShared ? "yes" : "no",
    training_credentials_shared_flag: credentialsShared,
    training_login_id: cell(source, "Training ID"),
    training_password: cell(source, "Training Password"),
    training_start_date: normalizeDate(source["Training Start Date"]),
    training_end_date: normalizeDate(source["Training End Date"]),
    training_status: cell(source, "Trainings Status"),
    training_certificate_number: cell(source, "Training Certificate Number"),
    exam_status: cell(source, "Exam Status"),
    onboarding_date: normalizeDate(source["Onboarding Date"]),
    oem_name: partnerType === "misp" ? normalizeOem(cell(source, "OEM Name"), manufacturerNames) : null,
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
    associate_profile_id: params.row.associate_profile_id,
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
    bank_id: params.row.bank_id,
    bank_name: params.row.bank_name,
    bank_account_number: params.row.bank_account_number,
    bank_ifsc_code: params.row.bank_ifsc_code,
    iib_remarks: params.row.iib_remarks,
    iib_upload_status: params.row.iib_upload_status,
    iib_uploaded: params.row.iib_uploaded,
    iib_uploaded_at: params.row.iib_uploaded_at,
    training_credentials_shared: params.row.training_credentials_shared,
    training_credentials_shared_flag: params.row.training_credentials_shared_flag,
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
    workflow_stage: params.row.onboarding_date && params.documentStatuses.agreement_copy === "received"
      ? "completed"
      : params.row.iib_uploaded
        ? "training"
        : params.row.iib_remarks
          ? "iib_processing"
          : "pre_iib",
    pre_iib_submitted_at: new Date().toISOString(),
    iib_completed_at: params.row.iib_uploaded ? new Date().toISOString() : null,
    training_completed_at: params.row.onboarding_date && params.documentStatuses.agreement_copy === "received"
      ? new Date().toISOString()
      : null,
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

  const admin = createSupabaseAdminClient();
  let salesManagers: SalesManagerOption[];
  let manufacturerNames: Set<string>;
  let banks: BankOption[];
  try {
    [salesManagers, manufacturerNames, banks] = await Promise.all([
      loadSalesManagers(admin),
      loadManufacturerNames(admin),
      loadBanks(admin)
    ]);
  } catch (error) {
    const reference = randomUUID().slice(0, 8);
    console.error(`POSP/MISP onboarding master data failed [${reference}]`, error);
    return fail(`Required master data could not be loaded. Reference ${reference}.`);
  }

  const row = rowFromForm(data, salesManagers, manufacturerNames, banks);
  const errors = validateRow(row);
  if (errors.length) return fail(errors[0], errors[0].includes("Associate") ? "associate_profile_id" : errors[0].includes("bank") ? "bank_id" : errors[0].includes("OEM") ? "oem_name" : errors[0].includes("DP") ? "dp_phone" : "applicant_phone");

  for (const { key, label } of PRE_IIB_DOCUMENT_FIELDS) {
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

  const uploadedPaths: string[] = [];
  for (const { key } of PRE_IIB_DOCUMENT_FIELDS) {
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
  let salesManagers: SalesManagerOption[];
  let manufacturerNames: Set<string>;
  let banks: BankOption[];
  try {
    [salesManagers, manufacturerNames, banks] = await Promise.all([
      loadSalesManagers(admin),
      loadManufacturerNames(admin),
      loadBanks(admin)
    ]);
  } catch (error) {
    const reference = randomUUID().slice(0, 8);
    console.error(`POSP/MISP import master data failed [${reference}]`, error);
    return fail(`Required master data could not be loaded. Reference ${reference}.`);
  }
  let workbookSheets;
  try {
    workbookSheets = await parsePospMispWorkbook(selected);
  } catch (error) {
    if (error instanceof WorkbookValidationError) return fail(error.message, "workbook");
    const reference = randomUUID().slice(0, 8);
    console.error(`POSP/MISP workbook parsing failed [${reference}]`, error);
    return fail(`The workbook could not be processed. Reference ${reference}.`, "workbook");
  }

  const rows: Array<{ partner_type: PartnerType; sheet_name: string; row_number: number; source_data: Record<string, unknown>; normalized_data: NormalizedRow; validation_errors: string[] }> = [];

  for (const partnerType of ["posp", "misp"] as const) {
    const sheetName = partnerType.toUpperCase();
    const sheet = workbookSheets.find((entry) => entry.name === sheetName);
    if (!sheet) continue;
    sheet.rows.forEach((source, index) => {
      const normalized = normalizeExcelRow(partnerType, source, salesManagers, manufacturerNames, banks);
      rows.push({
        partner_type: partnerType,
        sheet_name: sheetName,
        row_number: index + 2,
        source_data: sanitizeSourceData(source),
        normalized_data: normalized,
        validation_errors: [...validateRow(normalized), ...excelDateErrors(partnerType, source, normalized)]
      });
    });
  }

  if (!rows.length) return fail("The workbook does not contain POSP or MISP rows.", "workbook");

  const externalIdCounts = new Map<string, number>();
  for (const row of rows) {
    const externalId = row.normalized_data.external_onboarding_id;
    if (externalId) externalIdCounts.set(externalId, (externalIdCounts.get(externalId) ?? 0) + 1);
  }
  for (const row of rows) {
    const externalId = row.normalized_data.external_onboarding_id;
    if (externalId && (externalIdCounts.get(externalId) ?? 0) > 1) {
      row.validation_errors.push("External ID is duplicated in this workbook.");
    }
  }

  const { data: batch, error: batchError } = await admin.from("posp_misp_import_batches").insert({
    file_name: selected.name,
    uploaded_by: manager.id,
    total_rows: rows.length,
    valid_rows: rows.filter((row) => !row.validation_errors.length).length,
    invalid_rows: rows.filter((row) => row.validation_errors.length).length,
    pending_rows: rows.filter((row) => !row.validation_errors.length).length,
    submitted_rows: 0,
    failed_rows: 0,
    status: "parsed"
  }).select("id").single<{ id: string }>();
  if (batchError || !batch) {
    const reference = randomUUID().slice(0, 8);
    console.error(`POSP/MISP import batch creation failed [${reference}]`, batchError);
    return fail(`The import batch could not be created. Reference ${reference}.`);
  }

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
  if (rowError) {
    const reference = randomUUID().slice(0, 8);
    console.error(`POSP/MISP import row save failed [${reference}]`, rowError);
    await admin.from("posp_misp_import_batches").delete().eq("id", batch.id);
    return fail(`The parsed rows could not be saved. Reference ${reference}.`);
  }

  redirect(`/customers/posp-misp/import/${batch.id}`);
}

async function refreshImportBatchCounts(admin: ReturnType<typeof createSupabaseAdminClient>, batchId: string) {
  const { data: rows, error } = await admin
    .from("posp_misp_import_rows")
    .select("status")
    .eq("import_batch_id", batchId)
    .returns<Array<{ status: string }>>();
  if (error) throw error;
  const activeRows = rows ?? [];
  const invalidRows = activeRows.filter((row) => row.status === "invalid").length;
  const validRows = activeRows.filter((row) => row.status === "parsed").length;
  const pendingRows = activeRows.filter((row) => row.status === "parsed" || row.status === "processing").length;
  const submittedRows = activeRows.filter((row) => row.status === "submitted").length;
  const failedRows = activeRows.filter((row) => row.status === "failed").length;
  const processingRows = activeRows.filter((row) => row.status === "processing").length;
  const status = processingRows
    ? "processing"
    : activeRows.length > 0 && submittedRows === activeRows.length
      ? "submitted"
      : submittedRows > 0
        ? "partially_submitted"
        : failedRows > 0 && validRows === 0
          ? "failed"
          : "parsed";
  const { error: updateError } = await admin
    .from("posp_misp_import_batches")
    .update({
      total_rows: activeRows.length,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      pending_rows: pendingRows,
      submitted_rows: submittedRows,
      failed_rows: failedRows,
      status,
      submitted_at: status === "submitted" || status === "partially_submitted" ? new Date().toISOString() : null
    })
    .eq("id", batchId);
  if (updateError) throw updateError;
}

async function saveImportRowDocuments(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  batchId: string,
  rowId: string,
  data: FormData,
  uploadedBy: string
) {
  const selectedDocuments = DOCUMENT_FIELDS
    .map((document) => ({ ...document, file: formFile(data, document.key) }))
    .filter((document): document is typeof document & { file: File } => Boolean(document.file));

  for (const document of selectedDocuments) {
    const validationError = validateFile(document.file, document.label);
    if (validationError) throw new Error(validationError);
  }

  const { data: existingDocuments, error: existingError } = await admin
    .from("posp_misp_import_row_documents")
    .select("id, document_type, storage_bucket, storage_path")
    .eq("import_row_id", rowId)
    .returns<Array<{ id: string; document_type: string; storage_bucket: string; storage_path: string }>>();
  if (existingError) throw existingError;

  const existingByType = new Map((existingDocuments ?? []).map((document) => [document.document_type, document]));
  for (const document of selectedDocuments) {
    const path = `posp-misp-imports/${batchId}/${rowId}/${document.key}/${randomUUID()}.${extension(document.file)}`;
    const { error: uploadError } = await admin.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, new Uint8Array(await document.file.arrayBuffer()), {
        contentType: document.file.type,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { error: recordError } = await admin
      .from("posp_misp_import_row_documents")
      .upsert({
        import_row_id: rowId,
        document_type: document.key,
        file_name: document.file.name,
        storage_bucket: DOCUMENT_BUCKET,
        storage_path: path,
        mime_type: document.file.type,
        file_size: document.file.size,
        uploaded_by: uploadedBy
      }, { onConflict: "import_row_id,document_type" });
    if (recordError) {
      await admin.storage.from(DOCUMENT_BUCKET).remove([path]);
      throw recordError;
    }

    const previous = existingByType.get(document.key);
    if (previous?.storage_path && previous.storage_path !== path) {
      await admin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
    }
    existingByType.set(document.key, {
      id: previous?.id ?? "",
      document_type: document.key,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: path
    });
  }

  return new Set(existingByType.keys());
}

export async function updatePospMispImportRow(data: FormData) {
  const manager = await currentManager();
  const rowId = text(data, "row_id");
  const batchId = text(data, "batch_id");
  if (!rowId || !batchId) redirect("/customers/posp-misp/import?error=row_missing");

  const admin = createSupabaseAdminClient();
  const { data: existingRow, error: rowError } = await admin
    .from("posp_misp_import_rows")
    .select("id, import_batch_id, partner_type, status, normalized_data")
    .eq("id", rowId)
    .eq("import_batch_id", batchId)
    .maybeSingle<{ id: string; import_batch_id: string; partner_type: PartnerType; status: string; normalized_data: NormalizedRow }>();
  if (rowError || !existingRow) redirect(`/customers/posp-misp/import/${batchId}?error=row_missing`);
  if (existingRow.status === "submitted" || existingRow.status === "processing") redirect(`/customers/posp-misp/import/${batchId}?error=row_locked`);

  let salesManagers: SalesManagerOption[];
  let manufacturerNames: Set<string>;
  let banks: BankOption[];
  try {
    [salesManagers, manufacturerNames, banks] = await Promise.all([
      loadSalesManagers(admin),
      loadManufacturerNames(admin),
      loadBanks(admin)
    ]);
  } catch {
    redirect(`/customers/posp-misp/import/${batchId}?error=master_data`);
  }

  let documentTypes: Set<string>;
  try {
    documentTypes = await saveImportRowDocuments(admin, batchId, rowId, data, manager.id);
  } catch (error) {
    console.error("Import-row document upload failed", error);
    redirect(`/customers/posp-misp/import/${batchId}?error=document_upload_failed`);
  }

  const normalized = {
    ...rowFromImportEditForm(data, existingRow.normalized_data, salesManagers, manufacturerNames, banks),
    education_status: [...EDUCATION_DOCUMENT_KEYS].some((key) => documentTypes.has(key)) ? "received" : "not_received"
  };
  const validationErrors = validateRow(normalized);
  const { error: updateError } = await admin
    .from("posp_misp_import_rows")
    .update({
      normalized_data: normalized,
      validation_errors: validationErrors,
      status: validationErrors.length ? "invalid" : "parsed",
      error_message: null
    })
    .eq("id", rowId)
    .eq("import_batch_id", batchId);
  if (updateError) redirect(`/customers/posp-misp/import/${batchId}?error=row_update_failed`);

  await refreshImportBatchCounts(admin, batchId);
  revalidatePath(`/customers/posp-misp/import/${batchId}`);
  redirect(`/customers/posp-misp/import/${batchId}?success=row_updated`);
}

export async function deletePospMispImportRow(data: FormData) {
  await currentManager();
  const rowId = text(data, "row_id");
  const batchId = text(data, "batch_id");
  if (!rowId || !batchId) redirect("/customers/posp-misp/import?error=row_missing");

  const admin = createSupabaseAdminClient();
  const { data: existingRow } = await admin
    .from("posp_misp_import_rows")
    .select("id, status")
    .eq("id", rowId)
    .eq("import_batch_id", batchId)
    .maybeSingle<{ id: string; status: string }>();
  if (!existingRow) redirect(`/customers/posp-misp/import/${batchId}?error=row_missing`);
  if (existingRow.status === "submitted" || existingRow.status === "processing") redirect(`/customers/posp-misp/import/${batchId}?error=row_locked`);

  const { data: rowDocuments } = await admin
    .from("posp_misp_import_row_documents")
    .select("storage_bucket, storage_path")
    .eq("import_row_id", rowId)
    .returns<Array<{ storage_bucket: string; storage_path: string }>>();

  const { error: deleteError } = await admin
    .from("posp_misp_import_rows")
    .delete()
    .eq("id", rowId)
    .eq("import_batch_id", batchId);
  if (deleteError) redirect(`/customers/posp-misp/import/${batchId}?error=row_delete_failed`);

  const documentsByBucket = new Map<string, string[]>();
  for (const document of rowDocuments ?? []) {
    documentsByBucket.set(document.storage_bucket, [...(documentsByBucket.get(document.storage_bucket) ?? []), document.storage_path]);
  }
  await Promise.allSettled(
    [...documentsByBucket].map(([bucket, paths]) => admin.storage.from(bucket).remove(paths))
  );

  await refreshImportBatchCounts(admin, batchId);
  revalidatePath(`/customers/posp-misp/import/${batchId}`);
  redirect(`/customers/posp-misp/import/${batchId}?success=row_removed`);
}

export async function submitPospMispImportBatch(data: FormData) {
  const manager = await currentManager();
  const batchId = text(data, "batch_id");
  const retryFailed = data.get("retry_failed") === "true";
  if (!batchId) redirect("/customers/posp-misp/import?error=batch_missing");
  const admin = createSupabaseAdminClient();
  let rowsQuery = admin
    .from("posp_misp_import_rows")
    .select("id, row_number, partner_type, source_data, normalized_data")
    .eq("import_batch_id", batchId)
    .order("row_number", { ascending: true });
  rowsQuery = retryFailed ? rowsQuery.eq("status", "failed") : rowsQuery.eq("status", "parsed");
  const { data: rows, error } = await rowsQuery
    .returns<Array<{ id: string; row_number: number; partner_type: PartnerType; source_data: Record<string, unknown>; normalized_data: NormalizedRow }>>();
  if (error || !rows?.length) redirect(`/customers/posp-misp/import/${batchId}?error=no_valid_rows`);

  for (const row of rows) {
    const expectedStatus = retryFailed ? "failed" : "parsed";
    const { data: claimedRow } = await admin
      .from("posp_misp_import_rows")
      .update({ status: "processing", error_message: null })
      .eq("id", row.id)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (!claimedRow) continue;

    try {
      const { data: rowDocuments, error: documentsError } = await admin
        .from("posp_misp_import_row_documents")
        .select("document_type, file_name, storage_bucket, storage_path, mime_type, file_size, uploaded_by")
        .eq("import_row_id", row.id)
        .returns<Array<{
          document_type: DocumentKey;
          file_name: string;
          storage_bucket: string;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          uploaded_by: string | null;
        }>>();
      if (documentsError) throw documentsError;

      const attachedDocumentTypes = new Set((rowDocuments ?? []).map((document) => document.document_type));
      const derivedRow = {
        ...row.normalized_data,
        education_status: [...EDUCATION_DOCUMENT_KEYS].some((key) => attachedDocumentTypes.has(key)) ? "received" : "not_received"
      };
      const application = await createSubmittedApplication({
        row: derivedRow,
        documentStatuses: Object.fromEntries(DOCUMENT_FIELDS.map(({ key }) => [
          key,
          attachedDocumentTypes.has(key) ? "received" : "not_received"
        ])),
        source: "excel_import",
        importBatchId: batchId,
        importRowNumber: row.row_number,
        rawData: row.source_data,
        initiatedBy: manager.id
      });

      if (rowDocuments?.length) {
        const { error: documentLinkError } = await admin
          .from("customer_onboarding_documents")
          .upsert(rowDocuments.map((document) => ({
            application_id: application.id,
            document_type: document.document_type,
            file_name: document.file_name,
            storage_bucket: document.storage_bucket,
            storage_path: document.storage_path,
            mime_type: document.mime_type,
            file_size: document.file_size,
            verification_status: "pending",
            uploaded_by: document.uploaded_by ?? manager.id
          })), { onConflict: "application_id,document_type" });
        if (documentLinkError) throw documentLinkError;
      }

      await admin.from("posp_misp_import_rows").update({
        status: "submitted",
        application_id: application.id,
        error_message: null,
        normalized_data: sanitizeSubmittedRow(derivedRow)
      }).eq("id", row.id);
    } catch (creationError) {
      const reference = randomUUID().slice(0, 8);
      console.error(`POSP/MISP import row failed [${reference}]`, creationError);
      await admin.from("posp_misp_import_rows").update({
        status: "failed",
        error_message: `Submission failed. Reference ${reference}.`
      }).eq("id", row.id);
    }
  }

  await refreshImportBatchCounts(admin, batchId);
  redirect(`/customers/posp-misp/import/${batchId}?success=${retryFailed ? "retried" : "submitted"}`);
}
