"use server";

import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { loadBusinessMisRecordsByPolicyIds, type BusinessMisRecord } from "@/lib/accounts-business-mis";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const TEMPLATE_MARKER = "INSUREIT_ACCOUNTS_TRANSACTION_TEMPLATE_V1";
const PAYIN_SHEET = "Pay-In Transactions";
const PAYOUT_SHEET = "Payout Transactions";
const TOLERANCE = 0.01;

const PAYIN_HEADERS = [
  "System Policy ID",
  "Policy Number",
  "Registration No.",
  "Insured Name",
  "Insurance Company",
  "Projected Pay-In",
  "Already Received",
  "Current Difference",
  "New Bill Number",
  "New Bill Amount",
  "New Bill Date",
  "TDS",
  "Remarks",
] as const;

const PAYOUT_HEADERS = [
  "System Policy ID",
  "System Payout ID",
  "Policy Number",
  "Insured Name",
  "Intermediary Type",
  "Intermediary Code",
  "Projected Payout",
  "Already Paid",
  "Remaining",
  "New Paid Amount",
  "New Paid Date",
  "New UTR / Reference",
  "Remarks",
] as const;

export type TransactionTemplateType = "payin" | "payout";
export type TransactionPreviewStatus = "Ready" | "Warning" | "Error";

export type AccountsTransactionPreviewRow = {
  rowNumber: number;
  policyId: string;
  policyNumber: string;
  type: TransactionTemplateType;
  reference: string;
  amount: number;
  date: string;
  tds: number;
  remarks: string;
  status: TransactionPreviewStatus;
  message: string;
};

export type AccountsTransactionUploadPreview = {
  recognized: boolean;
  type: TransactionTemplateType | null;
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  rows: AccountsTransactionPreviewRow[];
  message: string;
};

export type AccountsTransactionImportResult = {
  entries: number;
  payinEntries: number;
  payoutEntries: number;
  message: string;
};

type ParsedWorkbook = {
  recognized: boolean;
  type: TransactionTemplateType | null;
  rows: unknown[][];
  message: string;
};

type ValidatedEntry = AccountsTransactionPreviewRow & {
  payload: Record<string, unknown>;
};

export async function previewAccountsTransactionUpload(formData: FormData): Promise<AccountsTransactionUploadPreview> {
  const profile = await requireAccountsAccess();
  const file = getFile(formData);
  const parsed = await parseWorkbook(file);
  if (!parsed.recognized || !parsed.type) return emptyPreview(parsed.message, false);
  return validateWorkbook(profile, parsed.type, parsed.rows);
}

export async function confirmAccountsTransactionUpload(formData: FormData): Promise<AccountsTransactionImportResult> {
  const profile = await requireAccountsAccess();
  const file = getFile(formData);
  const parsed = await parseWorkbook(file);
  if (!parsed.recognized || !parsed.type) throw new Error("This is not an INSUREIT reconciliation transaction template.");

  // Revalidate the live summary immediately before the atomic write. The workbook's
  // downloaded projected/current values act as an optimistic concurrency snapshot,
  // so a replay or a stale workbook cannot silently append on top of newer activity.
  const validation = await validateWorkbook(profile, parsed.type, parsed.rows, true);
  if (!validation.totalRows) throw new Error("No new reconciliation transactions were found in this workbook.");
  if (validation.errorRows) throw new Error("The workbook is stale or contains validation errors. Download a fresh transaction template before importing.");

  const entries = validation.rows.map((row) => ({
    policyId: row.policyId,
    entryType: row.type,
    payload: row.type === "payin"
      ? {
          billNumber: row.reference,
          billAmount: row.amount,
          billDate: row.date,
          actualTds: row.tds,
          remarks: row.remarks || null,
        }
      : {
          paidAmount: row.amount,
          paidDate: row.date,
          reference: row.reference,
          remarks: row.remarks || null,
        },
  }));

  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("post_accounts_policy_reconciliation_batch", {
    p_actor: profile.id,
    p_entries: entries,
  });
  if (error) throw new Error(publicImportError(error.message));

  const result = asObject(data);
  const total = integer(result.entries, entries.length);
  const payinEntries = integer(result.payinEntries, entries.filter((entry) => entry.entryType === "payin").length);
  const payoutEntries = integer(result.payoutEntries, entries.filter((entry) => entry.entryType === "payout").length);
  return {
    entries: total,
    payinEntries,
    payoutEntries,
    message: `${total} reconciliation transaction${total === 1 ? "" : "s"} posted successfully.`,
  };
}

async function validateWorkbook(
  profile: Awaited<ReturnType<typeof requireAccountsAccess>>,
  type: TransactionTemplateType,
  rows: unknown[][],
  strict = false,
): Promise<AccountsTransactionUploadPreview> {
  if (rows.length < 2) return emptyPreview("The transaction sheet is empty.", true, type);

  const expectedHeaders = type === "payin" ? PAYIN_HEADERS : PAYOUT_HEADERS;
  const actualHeaders = rows[1]?.map(text) ?? [];
  if (actualHeaders.length !== expectedHeaders.length || expectedHeaders.some((header, index) => actualHeaders[index] !== header)) {
    return emptyPreview("The transaction template structure has changed. Download a fresh template and try again.", true, type);
  }

  const dataRows = rows.slice(2).map((row, index) => ({ row, rowNumber: index + 3 })).filter(({ row }) => row.some((value) => text(value)));
  if (!dataRows.length) return emptyPreview("No transaction rows were entered. Fill the yellow transaction fields and upload again.", true, type);
  if (dataRows.length > 500) return emptyPreview("A maximum of 500 transaction rows can be imported at once.", true, type);

  const policyIds = [...new Set(dataRows.map(({ row }) => text(row[0])).filter(Boolean))];
  const scopedRecords = policyIds.length ? await loadBusinessMisRecordsByPolicyIds(profile, policyIds) : [];
  const recordByPolicy = new Map(scopedRecords.map((record) => [record.policyId, record]));
  const seen = new Set<string>();
  const validated: ValidatedEntry[] = [];

  for (const { row, rowNumber } of dataRows) {
    validated.push(validateRow(type, row, rowNumber, recordByPolicy, seen, strict));
  }

  const rowsForPreview = validated.map(({ payload: _payload, ...row }) => row);
  const readyRows = rowsForPreview.filter((row) => row.status === "Ready").length;
  const warningRows = rowsForPreview.filter((row) => row.status === "Warning").length;
  const errorRows = rowsForPreview.filter((row) => row.status === "Error").length;
  return {
    recognized: true,
    type,
    totalRows: rowsForPreview.length,
    readyRows,
    warningRows,
    errorRows,
    rows: rowsForPreview,
    message: errorRows
      ? "Some rows are stale or need correction. Download a fresh transaction template for any row whose reconciliation state changed."
      : "Transaction rows match the current Accounts state. Duplicate, balance and concurrency controls are checked again atomically during import.",
  };
}

function validateRow(
  type: TransactionTemplateType,
  row: unknown[],
  rowNumber: number,
  recordByPolicy: Map<string, BusinessMisRecord>,
  seen: Set<string>,
  _strict: boolean,
): ValidatedEntry {
  const policyId = text(row[0]);
  const record = recordByPolicy.get(policyId);
  const workbookPolicyNumber = text(row[type === "payin" ? 1 : 2]);
  let status: TransactionPreviewStatus = "Ready";
  const messages: string[] = [];

  if (!policyId || !record) {
    status = "Error";
    messages.push("Policy is missing or outside your current Accounts scope.");
  } else if (normalize(workbookPolicyNumber) !== normalize(text(record.row[12]))) {
    status = "Error";
    messages.push("Policy Number no longer matches the hidden System Policy ID. Download a fresh template.");
  }

  if (type === "payin") {
    const workbookProjected = money(row[5]);
    const workbookReceived = money(row[6]);
    const workbookDifference = money(row[7]);
    const reference = text(row[8]);
    const amount = money(row[9]);
    const date = isoDate(row[10]);
    const tds = optionalMoney(row[11]);
    const remarks = text(row[12]);
    if (!reference) { status = "Error"; messages.push("New Bill Number is required."); }
    if (amount <= 0) { status = "Error"; messages.push("New Bill Amount must be greater than zero."); }
    if (!date) { status = "Error"; messages.push("New Bill Date must be a valid date."); }
    if (tds < 0 || tds > amount) { status = "Error"; messages.push("TDS must be between zero and the Bill Amount."); }

    const duplicateKey = `${policyId}|${normalize(reference)}|${date}|${amount.toFixed(2)}`;
    if (reference && date && amount > 0 && seen.has(duplicateKey)) { status = "Error"; messages.push("Duplicate Pay-In transaction inside this workbook."); }
    seen.add(duplicateKey);

    if (record) {
      const projected = money(record.row[19]);
      const received = money(record.row[21]);
      const rawDifference = roundMoney(projected - received);
      const templateDifference = Math.max(rawDifference, 0);
      if (
        changed(workbookProjected, projected)
        || changed(workbookReceived, received)
        || changed(workbookDifference, templateDifference)
      ) {
        status = "Error";
        messages.push("Pay-In reconciliation changed after this template was downloaded. This also blocks replay of an already imported workbook; download a fresh Pay-In template.");
      }

      const remaining = templateDifference;
      if (remaining > TOLERANCE && amount - remaining > TOLERANCE && status !== "Error") {
        status = "Warning";
        messages.push("This Pay-In exceeds the current projected remaining amount and will create a variance.");
      } else if (projected <= TOLERANCE && amount > TOLERANCE && status !== "Error") {
        status = "Warning";
        messages.push("Projected Pay-In is zero; posting this amount will create a variance.");
      }
    }

    return {
      rowNumber, policyId, policyNumber: record ? text(record.row[12]) : workbookPolicyNumber,
      type, reference, amount, date, tds, remarks,
      status, message: messages.join(" ") || "Ready to append as a new Pay-In transaction.",
      payload: { billNumber: reference, billAmount: amount, billDate: date, actualTds: tds, remarks: remarks || null },
    };
  }

  const payoutId = text(row[1]);
  const workbookProjected = money(row[6]);
  const workbookPaid = money(row[7]);
  const workbookRemaining = money(row[8]);
  const reference = text(row[11]);
  const amount = money(row[9]);
  const date = isoDate(row[10]);
  const remarks = text(row[12]);
  if (!reference) { status = "Error"; messages.push("New UTR / Reference is required."); }
  if (amount <= 0) { status = "Error"; messages.push("New Paid Amount must be greater than zero."); }
  if (!date) { status = "Error"; messages.push("New Paid Date must be a valid date."); }
  if (!record?.payoutId || payoutId !== record.payoutId) { status = "Error"; messages.push("Payout identity is missing or stale. Download a fresh template."); }

  const duplicateKey = `${policyId}|${normalize(reference)}`;
  if (reference && seen.has(duplicateKey)) { status = "Error"; messages.push("Duplicate Payout reference inside this workbook."); }
  seen.add(duplicateKey);

  if (record) {
    const projected = money(record.row[27]);
    const paid = money(record.row[29]);
    const rawRemaining = roundMoney(projected - paid);
    const templateRemaining = Math.max(rawRemaining, 0);
    if (
      changed(workbookProjected, projected)
      || changed(workbookPaid, paid)
      || changed(workbookRemaining, templateRemaining)
    ) {
      status = "Error";
      messages.push("Payout reconciliation changed after this template was downloaded. This also blocks replay of an already imported workbook; download a fresh Payout template.");
    }
    if (amount - templateRemaining > TOLERANCE) { status = "Error"; messages.push("New Paid Amount exceeds the current projected remaining payout."); }
  }

  return {
    rowNumber, policyId, policyNumber: record ? text(record.row[12]) : workbookPolicyNumber,
    type, reference, amount, date, tds: 0, remarks,
    status, message: messages.join(" ") || "Ready to append as a new Payout transaction.",
    payload: { paidAmount: amount, paidDate: date, reference, remarks: remarks || null },
  };
}

async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  if (file.size <= 0) return { recognized: false, type: null, rows: [], message: "Choose a non-empty .xlsx workbook." };
  if (file.size > MAX_FILE_BYTES) return { recognized: false, type: null, rows: [], message: "Workbook is too large. Maximum upload size is 8 MB." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { recognized: false, type: null, rows: [], message: "Only .xlsx workbooks are supported." };

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  } catch {
    return { recognized: false, type: null, rows: [], message: "Unable to read this Excel workbook." };
  }

  const metadataSheet = workbook.Sheets.INSUREIT_META;
  if (!metadataSheet) return { recognized: false, type: null, rows: [], message: "Not a transaction template." };
  const metadata = XLSX.utils.sheet_to_json<unknown[]>(metadataSheet, { header: 1, raw: false, defval: "" });
  if (text(metadata[0]?.[0]) !== TEMPLATE_MARKER) return { recognized: false, type: null, rows: [], message: "Not a transaction template." };
  const type = text(metadata[1]?.[1]);
  if (type !== "payin" && type !== "payout") return { recognized: true, type: null, rows: [], message: "Transaction template type is invalid." };

  const sheetName = type === "payin" ? PAYIN_SHEET : PAYOUT_SHEET;
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { recognized: true, type, rows: [], message: `The ${sheetName} sheet is missing.` };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  return { recognized: true, type, rows, message: "" };
}

async function requireAccountsAccess() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");
  return profile;
}

function getFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose an Excel workbook.");
  return file;
}

function emptyPreview(message: string, recognized: boolean, type: TransactionTemplateType | null = null): AccountsTransactionUploadPreview {
  return { recognized, type, totalRows: 0, readyRows: 0, warningRows: 0, errorRows: recognized ? 1 : 0, rows: [], message };
}

function publicImportError(message: string | null | undefined) {
  const value = String(message ?? "");
  const known = [
    "This Pay-In entry is already recorded for the policy",
    "This UTR/reference is already recorded for the intermediary",
    "Paid Amount exceeds the remaining payable balance",
    "Payout is not available for payment",
    "This policy has multiple payout records",
    "No partner payout is configured for this policy",
    "Partner commercial must be entered/reviewed before payment",
    "A maximum of 500 reconciliation entries may be posted at once",
  ];
  const matched = known.find((candidate) => value.includes(candidate));
  return matched ? `${matched}. No transaction from this workbook was posted.` : "The transaction workbook could not be posted. No transaction from this workbook was saved.";
}

function changed(workbookValue: number, liveValue: number) { return Math.abs(workbookValue - liveValue) > TOLERANCE; }
function roundMoney(value: number) { return Math.round(value * 100) / 100; }
function normalize(value: unknown) { return text(value).replace(/\s+/g, "").toUpperCase(); }
function text(value: unknown) { return String(value ?? "").trim(); }
function money(value: unknown) { const parsed = Number(String(value ?? "0").replace(/,/g, "")); return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0; }
function optionalMoney(value: unknown) { const raw = text(value); return raw ? money(raw) : 0; }
function isoDate(value: unknown) {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function integer(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback; }
