"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ExternalRenewalImportState = {
  ok: boolean;
  message: string;
  summary?: { total: number; accepted: number; rejected: number; duplicates: number };
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const DAY_MS = 86_400_000;

const HEADER_ALIASES: Record<string, string[]> = {
  invoiceDate: ["invoice date"],
  mLob: ["m lob"],
  lob: ["lob"],
  chassisNo: ["chassis no", "chassis number"],
  registrationNo: ["registration no", "registration number", "vehicle no", "vehicle number"],
  productLine: ["product line", "model"],
  accountName: ["account name", "customer name"],
  contactName: ["contact name"],
  accountPhone: ["account phone/fax number", "account phone", "phone"],
  contactPhone: ["contact phone number", "mobile", "mobile number"],
  insurer: ["current insurer", "insurer"],
  policyNo: ["current policy no", "current policy number", "policy no", "policy number"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function pick(row: Record<string, unknown>, key: keyof typeof HEADER_ALIASES) {
  const normalized = new Map(Object.entries(row).map(([header, value]) => [normalizeHeader(header), value]));
  for (const alias of HEADER_ALIASES[key]) {
    if (normalized.has(alias)) return normalized.get(alias);
  }
  return "";
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const raw = text(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const indian = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (indian) return new Date(Date.UTC(Number(indian[3]), Number(indian[2]) - 1, Number(indian[1])));
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())) : null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addCalendarYear(date: Date) {
  const year = date.getUTCFullYear() + 1;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function normalizeMobile(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return "";
}

function normalizeVehicleKey(chassis: string, registration: string) {
  const normalizedChassis = chassis.trim().toUpperCase();
  const normalizedRegistration = registration.trim().toUpperCase();
  return normalizedChassis || (normalizedRegistration ? `REG:${normalizedRegistration}` : "");
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function uploadExternalRenewalWorkbook(
  _previous: ExternalRenewalImportState,
  formData: FormData,
): Promise<ExternalRenewalImportState> {
  const profile = await requireCapability("manage_master_data", "edit");
  const partnerId = text(formData.get("partner_id"));
  const sourceName = text(formData.get("source_name"));
  const sourcePeriod = text(formData.get("source_period"));
  const file = formData.get("workbook");

  if (!partnerId || !sourceName) return { ok: false, message: "Select a Partner and enter the source name." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an Excel workbook to upload." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: "Workbook is too large. Maximum file size is 5 MB." };
  if (!/\.(xlsx|xls)$/i.test(file.name)) return { ok: false, message: "Upload an .xlsx or .xls workbook." };

  const admin = createSupabaseAdminClient();
  const { data: partner } = await admin.from("partners").select("id").eq("id", partnerId).maybeSingle();
  if (!partner) return { ok: false, message: "The selected Partner is no longer available." };

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    return { ok: false, message: "The workbook could not be read. Download a fresh template and try again." };
  }

  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === "external renewals") ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return { ok: false, message: "The workbook does not contain a readable worksheet." };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (!rows.length) return { ok: false, message: "The workbook has no data rows." };
  if (rows.length > MAX_ROWS) return { ok: false, message: `Workbook has ${rows.length} rows. Maximum supported per import is ${MAX_ROWS}.` };

  const today = startOfTodayUtc();
  const oldestAllowedEnd = new Date(today.getTime() - 30 * DAY_MS);
  const parsed: Array<Record<string, unknown> & { _businessKey: string; _invoiceDate: string }> = [];
  let rejected = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const invoice = parseExcelDate(pick(row, "invoiceDate"));
    const chassis = text(pick(row, "chassisNo"));
    const registration = text(pick(row, "registrationNo"));
    const mobile = normalizeMobile(pick(row, "contactPhone")) || normalizeMobile(pick(row, "accountPhone"));
    const businessKey = normalizeVehicleKey(chassis, registration);
    if (!invoice || invoice > today || !businessKey || !mobile) {
      rejected += 1;
      continue;
    }
    const policyEnd = addCalendarYear(invoice);
    if (policyEnd < oldestAllowedEnd) {
      rejected += 1;
      continue;
    }
    const invoiceDate = isoDate(invoice);
    parsed.push({
      batch_id: "",
      partner_id: partnerId,
      source_row_number: index + 2,
      account_name: text(pick(row, "accountName")) || null,
      customer_name: text(pick(row, "accountName")) || null,
      contact_name: text(pick(row, "contactName")) || null,
      mobile,
      chassis_no: chassis || null,
      registration_no: registration || null,
      vehicle_model: text(pick(row, "productLine")) || null,
      vehicle_lob: text(pick(row, "lob")) || text(pick(row, "mLob")) || null,
      invoice_date: invoiceDate,
      current_insurer: text(pick(row, "insurer")) || null,
      current_policy_no: text(pick(row, "policyNo")) || null,
      source_payload: {
        sale_lob: text(pick(row, "mLob")) || null,
        lob: text(pick(row, "lob")) || null,
        product_line: text(pick(row, "productLine")) || null,
      },
      _businessKey: businessKey,
      _invoiceDate: invoiceDate,
    });
  }

  const workbookSeen = new Set<string>();
  let duplicates = 0;
  const deduped = parsed.filter((row) => {
    const key = `${row._businessKey}|${row._invoiceDate}`;
    if (workbookSeen.has(key)) {
      duplicates += 1;
      return false;
    }
    workbookSeen.add(key);
    return true;
  });

  const { data: existing, error: existingError } = await admin
    .from("external_renewal_opportunities")
    .select("chassis_no,registration_no,invoice_date")
    .eq("partner_id", partnerId)
    .limit(10000);
  if (existingError) return { ok: false, message: "Unable to check existing external renewal opportunities." };

  const existingKeys = new Set((existing ?? []).map((row) => `${normalizeVehicleKey(row.chassis_no ?? "", row.registration_no ?? "")}|${row.invoice_date}`));
  const insertable = deduped.filter((row) => {
    const key = `${row._businessKey}|${row._invoiceDate}`;
    if (existingKeys.has(key)) {
      duplicates += 1;
      return false;
    }
    return true;
  });

  const { data: batch, error: batchError } = await admin
    .from("external_renewal_import_batches")
    .insert({
      partner_id: partnerId,
      source_name: sourceName,
      source_file_name: file.name,
      source_period: sourcePeriod || null,
      status: "draft",
      total_rows: rows.length,
      accepted_rows: insertable.length,
      rejected_rows: rejected,
      duplicate_rows: duplicates,
      imported_by: profile?.id ?? null,
    })
    .select("id")
    .single();
  if (batchError || !batch) return { ok: false, message: "Unable to create the external renewal import batch." };

  const cleanRows = insertable.map(({ _businessKey, _invoiceDate, ...row }) => ({ ...row, batch_id: batch.id }));
  for (let offset = 0; offset < cleanRows.length; offset += 500) {
    const { error } = await admin.from("external_renewal_opportunities").insert(cleanRows.slice(offset, offset + 500));
    if (error) {
      await admin.from("external_renewal_import_batches").delete().eq("id", batch.id);
      return { ok: false, message: "Import failed before publication. No partial opportunity batch was retained." };
    }
  }

  const { error: publishError } = await admin
    .from("external_renewal_import_batches")
    .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", batch.id);
  if (publishError) {
    await admin.from("external_renewal_import_batches").delete().eq("id", batch.id);
    return { ok: false, message: "Import could not be published. No partial opportunity batch was retained." };
  }

  revalidatePath("/master-data/external-renewal-imports");
  revalidatePath("/partner");
  revalidatePath("/partner/renewals/external");

  return {
    ok: true,
    message: `Published ${insertable.length} external renewal opportunities.`,
    summary: { total: rows.length, accepted: insertable.length, rejected, duplicates },
  };
}
