"use server";

import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_EDITABLE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_HIDDEN_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  loadBusinessMisRecordsByPolicyIds,
  type BusinessMisCell,
  type BusinessMisRecord,
} from "@/lib/accounts-business-mis";

export type PreviewStatus = "Ready" | "Warning" | "Error";
export type PayinPreviewRow = {
  rowNumber: number;
  policyId: string;
  policyNumber: string;
  insurer: string;
  projectedPayin: number;
  projectedTds: number;
  projectedNetPayin: number;
  billNumber: string;
  billAmount: number | null;
  billDate: string;
  actualTds: number | null;
  amountReceived: number | null;
  receiptDate: string;
  reference: string;
  difference: number | null;
  uploadedDifference: number | null;
  status: PreviewStatus;
  message: string;
};
export type PayoutPreviewRow = {
  rowNumber: number;
  payoutId: string;
  policyId: string;
  policyNumber: string;
  intermediaryType: string;
  intermediaryCode: string;
  payoutOdPercent: number;
  payoutTpPercent: number;
  projectedGrossPayout: number;
  projectedRetention: number;
  paidAmount: number | null;
  paidDate: string;
  reference: string;
  status: PreviewStatus;
  message: string;
};
export type ReconciliationUploadPreview = {
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  payinRows: PayinPreviewRow[];
  payoutRows: PayoutPreviewRow[];
  message?: string;
};

type PolicyRef = { id: string; insurance_company_id: string | null };
type PayoutRef = { id: string; commercial_status: string | null; status: string | null };
type ReceiptRefRow = { insurer_id: string; bank_reference: string | null };
type PartnerPaymentRefRow = { intermediary_code: string | null; payment_reference: string | null };

const TEMPLATE_VERSION = "Business MIS Reconciliation v2";
const POLICY_ID_INDEX = BUSINESS_MIS_HEADERS.length;
const PAYOUT_ID_INDEX = BUSINESS_MIS_HEADERS.length + 1;
const BILL_NUMBER_INDEX = 20;
const BILL_AMOUNT_INDEX = 21;
const BILL_DATE_INDEX = 22;
const DIFFERENCE_INDEX = 23;
const TDS_INDEX = 24;
const PAID_AMOUNT_INDEX = 29;
const PAID_DATE_INDEX = 30;
const UTR_INDEX = 31;

export async function previewAccountsReconciliationUpload(formData: FormData): Promise<ReconciliationUploadPreview> {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return emptyPreview("Choose the Business MIS Excel exported from the Accounts Dashboard.");
  if (file.size > 8 * 1024 * 1024) return emptyPreview("The upload must be 8 MB or smaller.");

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    return emptyPreview("The workbook could not be read. Upload the Business MIS Excel exported from the Accounts Dashboard.");
  }

  if (workbook.SheetNames.length !== 1 || workbook.SheetNames[0] !== "Business MIS") {
    return emptyPreview("Upload the original single-sheet Business MIS workbook. Sheets must not be added, removed or renamed.");
  }

  const props = workbook.Custprops ?? {};
  if (text(props.INSUREITTemplate) !== TEMPLATE_VERSION) {
    return emptyPreview("This is not the current INSUREIT Business MIS reconciliation template. Download a fresh Export from the Accounts Dashboard.");
  }

  const sheet = workbook.Sheets["Business MIS"];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (grid.length < 2) return emptyPreview("The Business MIS workbook is empty or damaged.");

  const expectedHeaders = [...BUSINESS_MIS_HEADERS, ...BUSINESS_MIS_HIDDEN_HEADERS];
  const uploadedHeaders = Array.from({ length: expectedHeaders.length }, (_, index) => text(grid[1]?.[index]));
  if (uploadedHeaders.some((header, index) => header !== expectedHeaders[index])) {
    return emptyPreview("Business MIS columns were changed. Do not add, remove, rename or reorder any column; download a fresh Export and enter only the allowed transaction fields.");
  }
  if ((grid[1]?.slice(expectedHeaders.length) ?? []).some((value) => text(value) !== "")) {
    return emptyPreview("Extra columns were detected. Do not add columns to the Business MIS workbook.");
  }

  const declaredRowCount = integer(props.INSUREITRowCount);
  const dataRows = grid.slice(2).filter((row) => text(row?.[POLICY_ID_INDEX]) !== "" || row.slice(0, BUSINESS_MIS_HEADERS.length).some((value) => text(value) !== ""));
  if (declaredRowCount < 0 || dataRows.length !== declaredRowCount) {
    return emptyPreview("Business MIS rows were added or removed. Upload the workbook exactly as exported and only fill the allowed blank transaction cells.");
  }

  const structure = uploadedStructureHash(dataRows);
  if (!text(props.INSUREITStructureHash) || structure !== text(props.INSUREITStructureHash)) {
    return emptyPreview("Business MIS row order or hidden system IDs were changed. Download a fresh Export and do not add, remove, duplicate or reorder rows.");
  }

  const uploadedSystem = uploadedSystemHash(dataRows);
  if (!text(props.INSUREITSystemHash) || uploadedSystem !== text(props.INSUREITSystemHash)) {
    return emptyPreview("System-controlled Business MIS values were edited. Only Bill Number, Bill Amount, Bill Date, Difference, Paid Amount, Paid Date and UTR Details may be filled.");
  }

  const policyIds = dataRows.map((row) => text(row[POLICY_ID_INDEX]));
  if (policyIds.some((id) => !validUuid(id)) || new Set(policyIds).size !== policyIds.length) {
    return emptyPreview("Business MIS hidden policy IDs are invalid or duplicated. Download a fresh Export.");
  }

  const liveRecords = await loadBusinessMisRecordsByPolicyIds(profile, policyIds);
  const liveByPolicy = new Map(liveRecords.map((record) => [record.policyId, record]));
  if (liveRecords.length !== policyIds.length) {
    return emptyPreview("One or more Business MIS rows are no longer available in your Accounts scope. Download a fresh Export.");
  }

  const db = createSupabaseAdminClient();
  const [policyResults, payoutResults] = await Promise.all([
    Promise.all(chunk(policyIds, 120).map((ids) => db.from("policies").select("id,insurance_company_id").in("id", ids))),
    Promise.all(chunk(dataRows.map((row) => text(row[PAYOUT_ID_INDEX])).filter(validUuid), 120).map((ids) => db.from("policy_intermediary_payouts").select("id,commercial_status,status").in("id", ids))),
  ]);
  const firstLiveError = [...policyResults, ...payoutResults].find((result) => result.error)?.error;
  if (firstLiveError) throw new Error(firstLiveError.message || "Unable to validate live Accounts data.");
  const policyRefs = policyResults.flatMap((result) => (result.data ?? []) as PolicyRef[]);
  const payoutRefs = payoutResults.flatMap((result) => (result.data ?? []) as PayoutRef[]);
  const insurerByPolicy = new Map(policyRefs.map((row) => [row.id, row.insurance_company_id]));
  const payoutRefById = new Map(payoutRefs.map((row) => [row.id, row]));

  const rowChecks: Array<{
    row: unknown[];
    rowNumber: number;
    live: BusinessMisRecord;
    errors: string[];
    warnings: string[];
    hasNewPayin: boolean;
    hasNewPayout: boolean;
  }> = [];

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index];
    const rowNumber = index + 3;
    const policyId = text(row[POLICY_ID_INDEX]);
    const payoutId = text(row[PAYOUT_ID_INDEX]);
    const live = liveByPolicy.get(policyId)!;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (payoutId !== live.payoutId) errors.push("The hidden payout reference no longer matches live INSUREIT data.");

    for (let columnIndex = 0; columnIndex < BUSINESS_MIS_HEADERS.length; columnIndex++) {
      if (BUSINESS_MIS_EDITABLE_COLUMNS.has(columnIndex)) continue;
      if (canonicalCell(row[columnIndex], columnIndex) !== canonicalCell(live.row[columnIndex], columnIndex)) {
        errors.push(`${BUSINESS_MIS_HEADERS[columnIndex]} changed since this workbook was downloaded. Download a fresh Export before posting.`);
        break;
      }
    }

    const livePayinValues = [live.row[BILL_NUMBER_INDEX], live.row[BILL_AMOUNT_INDEX], live.row[BILL_DATE_INDEX], live.row[DIFFERENCE_INDEX]];
    const uploadedPayinValues = [row[BILL_NUMBER_INDEX], row[BILL_AMOUNT_INDEX], row[BILL_DATE_INDEX], row[DIFFERENCE_INDEX]];
    const liveHasPayin = livePayinValues.slice(0, 3).some(nonBlank);
    const uploadedHasPayin = uploadedPayinValues.some(nonBlank);
    let hasNewPayin = false;

    if (liveHasPayin) {
      if (uploadedPayinValues.some((value, i) => canonicalEditable(value, [BILL_NUMBER_INDEX, BILL_AMOUNT_INDEX, BILL_DATE_INDEX, DIFFERENCE_INDEX][i]) !== canonicalEditable(livePayinValues[i], [BILL_NUMBER_INDEX, BILL_AMOUNT_INDEX, BILL_DATE_INDEX, DIFFERENCE_INDEX][i]))) {
        errors.push("Existing posted Pay-In values cannot be edited through the upload workbook.");
      }
    } else if (uploadedHasPayin) {
      hasNewPayin = true;
      const billNumber = text(row[BILL_NUMBER_INDEX]);
      const billAmount = optionalMoney(row[BILL_AMOUNT_INDEX]);
      const billDate = normalizedDate(row[BILL_DATE_INDEX]);
      const uploadedDifference = optionalMoney(row[DIFFERENCE_INDEX]);
      const totalPayin = money(live.row[19]);
      const calculatedDifference = money(totalPayin - (billAmount ?? 0));

      if (!billNumber || billAmount === null || !billDate) errors.push("Bill Number, Bill Amount and Bill Date are required together for Pay-In.");
      if (billAmount !== null && billAmount <= 0) errors.push("Bill Amount must be greater than zero.");
      if (uploadedDifference !== null && billAmount !== null && Math.abs(uploadedDifference - calculatedDifference) > 0.01) {
        warnings.push(`Uploaded Difference ${formatAmount(uploadedDifference)} does not match INSUREIT Difference ${formatAmount(calculatedDifference)}. The uploaded Difference will not be updated; INSUREIT will always use the internally calculated value.`);
      }
    }

    const livePayoutValues = [live.row[PAID_AMOUNT_INDEX], live.row[PAID_DATE_INDEX], live.row[UTR_INDEX]];
    const uploadedPayoutValues = [row[PAID_AMOUNT_INDEX], row[PAID_DATE_INDEX], row[UTR_INDEX]];
    const liveHasPayout = livePayoutValues.some(nonBlank);
    const uploadedHasPayout = uploadedPayoutValues.some(nonBlank);
    let hasNewPayout = false;

    if (liveHasPayout) {
      if (uploadedPayoutValues.some((value, i) => canonicalEditable(value, [PAID_AMOUNT_INDEX, PAID_DATE_INDEX, UTR_INDEX][i]) !== canonicalEditable(livePayoutValues[i], [PAID_AMOUNT_INDEX, PAID_DATE_INDEX, UTR_INDEX][i]))) {
        errors.push("Existing posted Pay-Out values cannot be edited through the upload workbook.");
      }
    } else if (uploadedHasPayout) {
      hasNewPayout = true;
      const paidAmount = optionalMoney(row[PAID_AMOUNT_INDEX]);
      const paidDate = normalizedDate(row[PAID_DATE_INDEX]);
      const reference = text(row[UTR_INDEX]);
      if (!validUuid(payoutId) || !payoutRefById.has(payoutId)) errors.push("This row has no valid live payout reference.");
      const payoutRef = payoutRefById.get(payoutId);
      if (payoutRef && !["entered", "reviewed"].includes(text(payoutRef.commercial_status).toLowerCase())) errors.push("Commercial payout terms are not finalized. Complete Commercial Review first.");
      if (money(live.row[27]) <= 0) errors.push("Gross Payout must be greater than zero before Accounts can record a payment.");
      if (paidAmount === null || paidAmount <= 0) errors.push("Paid Amount must be greater than zero.");
      if (!paidDate || !reference) errors.push("Paid Date and UTR Details are required together for Pay-Out.");
    }

    rowChecks.push({ row, rowNumber, live, errors, warnings, hasNewPayin, hasNewPayout });
  }

  const payinRefs = rowChecks.filter((item) => item.hasNewPayin).map((item) => text(item.row[BILL_NUMBER_INDEX])).filter(Boolean);
  const payoutRefsInput = rowChecks.filter((item) => item.hasNewPayout).map((item) => text(item.row[UTR_INDEX])).filter(Boolean);
  const [receiptRefResults, payoutPaymentResults] = await Promise.all([
    Promise.all(chunk([...new Set(payinRefs)], 120).map((refs) => db.from("accounts_receipts").select("insurer_id,bank_reference").in("bank_reference", refs))),
    Promise.all(chunk([...new Set(payoutRefsInput)], 120).map((refs) => db.from("partner_payments").select("intermediary_code,payment_reference").in("payment_reference", refs))),
  ]);
  const firstRefError = [...receiptRefResults, ...payoutPaymentResults].find((result) => result.error)?.error;
  if (firstRefError) throw new Error(firstRefError.message || "Unable to check transaction references.");
  const existingReceipts = receiptRefResults.flatMap((result) => (result.data ?? []) as ReceiptRefRow[]);
  const existingPartnerPayments = payoutPaymentResults.flatMap((result) => (result.data ?? []) as PartnerPaymentRefRow[]);
  const existingReceiptKeys = new Set(existingReceipts.map((row) => `${row.insurer_id}|${normalizeRef(row.bank_reference)}`));
  const existingPayoutKeys = new Set(existingPartnerPayments.map((row) => `${normalizeRef(row.intermediary_code)}|${normalizeRef(row.payment_reference)}`));

  const payinUploadGroups = new Map<string, string>();
  const payoutUploadGroups = new Map<string, string>();
  const payinRows: PayinPreviewRow[] = [];
  const payoutRows: PayoutPreviewRow[] = [];

  for (const item of rowChecks) {
    const { row, rowNumber, live } = item;
    const policyId = live.policyId;
    const policyNumber = text(live.row[12]);
    const intermediaryType = text(live.row[3]);
    const intermediaryCode = text(live.row[5]);

    if (item.hasNewPayin) {
      const insurerId = insurerByPolicy.get(policyId);
      const billNumber = text(row[BILL_NUMBER_INDEX]);
      const billAmount = optionalMoney(row[BILL_AMOUNT_INDEX]);
      const billDate = normalizedDate(row[BILL_DATE_INDEX]);
      const uploadedDifference = optionalMoney(row[DIFFERENCE_INDEX]);
      const projectedPayin = money(live.row[19]);
      const projectedTds = money(live.row[TDS_INDEX]);
      const calculatedDifference = billAmount === null ? null : money(projectedPayin - billAmount);
      const issues = [...item.errors.map(error), ...item.warnings.map(warning)];

      if (!insurerId) issues.push(error("Insurance Company is missing for this policy."));
      if (insurerId && billNumber) {
        const key = `${insurerId}|${normalizeRef(billNumber)}`;
        if (existingReceiptKeys.has(key)) issues.push(error("This insurer Bill Number / reference already exists in INSUREIT."));
        const priorDate = payinUploadGroups.get(key);
        if (priorDate && priorDate !== billDate) issues.push(error("The same insurer Bill Number is used with different Bill Dates in this workbook."));
        else if (!priorDate) payinUploadGroups.set(key, billDate);
      }

      payinRows.push({
        rowNumber,
        policyId,
        policyNumber,
        insurer: text(live.row[13]),
        projectedPayin,
        projectedTds,
        projectedNetPayin: money(projectedPayin - projectedTds),
        billNumber,
        billAmount,
        billDate,
        actualTds: 0,
        amountReceived: billAmount,
        receiptDate: billDate,
        reference: billNumber,
        difference: calculatedDifference,
        uploadedDifference,
        ...summarize(issues),
      });
    }

    if (item.hasNewPayout) {
      const payoutId = live.payoutId;
      const paidAmount = optionalMoney(row[PAID_AMOUNT_INDEX]);
      const paidDate = normalizedDate(row[PAID_DATE_INDEX]);
      const reference = text(row[UTR_INDEX]);
      const issues = [...item.errors.map(error), ...item.warnings.map(warning)];

      if (reference && intermediaryCode) {
        const key = `${normalizeRef(intermediaryCode)}|${normalizeRef(reference)}`;
        if (existingPayoutKeys.has(key)) issues.push(error("This intermediary UTR Details reference already exists in INSUREIT."));
        const priorDate = payoutUploadGroups.get(key);
        if (priorDate && priorDate !== paidDate) issues.push(error("The same intermediary UTR Details reference is used with different Paid Dates in this workbook."));
        else if (!priorDate) payoutUploadGroups.set(key, paidDate);
      }

      payoutRows.push({
        rowNumber,
        payoutId,
        policyId,
        policyNumber,
        intermediaryType,
        intermediaryCode,
        payoutOdPercent: money(live.row[25]),
        payoutTpPercent: money(live.row[26]),
        projectedGrossPayout: money(live.row[27]),
        projectedRetention: money(live.row[28]),
        paidAmount,
        paidDate,
        reference,
        ...summarize(issues),
      });
    }
  }

  const rowLevelBlockingErrors = rowChecks.filter((item) => item.errors.length && !item.hasNewPayin && !item.hasNewPayout);
  if (rowLevelBlockingErrors.length) {
    const first = rowLevelBlockingErrors[0];
    return emptyPreview(`Row ${first.rowNumber}: ${first.errors.join(" ")}`);
  }

  const all = [...payinRows, ...payoutRows];
  if (!all.length) {
    return {
      ...emptyPreview("No new Pay-In or Pay-Out values were entered. Fill only the blank Bill Number, Bill Amount, Bill Date, Difference, Paid Amount, Paid Date or UTR Details cells."),
      skippedRows: dataRows.length,
    };
  }

  return {
    totalRows: all.length,
    readyRows: all.filter((row) => row.status === "Ready").length,
    warningRows: all.filter((row) => row.status === "Warning").length,
    errorRows: all.filter((row) => row.status === "Error").length,
    skippedRows: dataRows.length - new Set([...payinRows.map((row) => row.rowNumber), ...payoutRows.map((row) => row.rowNumber)]).size,
    payinRows,
    payoutRows,
  };
}

function uploadedStructureHash(rows: unknown[][]) {
  return sha(rows.map((row) => `${text(row[POLICY_ID_INDEX])}|${text(row[PAYOUT_ID_INDEX])}`).join("\n"));
}

function uploadedSystemHash(rows: unknown[][]) {
  return sha(rows.map((row) => {
    const controlled = Array.from({ length: BUSINESS_MIS_HEADERS.length }, (_, index) => BUSINESS_MIS_EDITABLE_COLUMNS.has(index) ? "" : canonicalCell(row[index], index));
    return [text(row[POLICY_ID_INDEX]), text(row[PAYOUT_ID_INDEX]), ...controlled].join("|");
  }).join("\n"));
}

function canonicalEditable(value: unknown, index: number) {
  if (!nonBlank(value)) return "";
  if (BUSINESS_MIS_DATE_COLUMNS.has(index)) return normalizedDate(value);
  if (BUSINESS_MIS_AMOUNT_COLUMNS.has(index) || BUSINESS_MIS_PERCENT_COLUMNS.has(index)) return money(value).toFixed(2);
  return text(value);
}

function canonicalCell(value: unknown, index: number) {
  if (!nonBlank(value)) return "";
  if (BUSINESS_MIS_DATE_COLUMNS.has(index)) return normalizedDate(value);
  if (BUSINESS_MIS_AMOUNT_COLUMNS.has(index) || BUSINESS_MIS_PERCENT_COLUMNS.has(index)) return money(value).toFixed(2);
  return text(value);
}

function normalizedDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(value);
  }
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(parsed);
}

function summarize(issues: Array<{ status: PreviewStatus; message: string }>): { status: PreviewStatus; message: string } {
  if (!issues.length) return { status: "Ready", message: "Ready for Confirm Import." };
  const status: PreviewStatus = issues.some((item) => item.status === "Error") ? "Error" : "Warning";
  return { status, message: issues.map((item) => item.message).join(" ") };
}

function error(message: string) { return { status: "Error" as const, message }; }
function warning(message: string) { return { status: "Warning" as const, message }; }
function emptyPreview(message: string): ReconciliationUploadPreview { return { totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, skippedRows: 0, payinRows: [], payoutRows: [], message }; }
function text(value: unknown) { return String(value ?? "").trim(); }
function nonBlank(value: unknown) { return text(value) !== ""; }
function normalizeRef(value: unknown) { return text(value).replace(/\s+/g, "").toUpperCase(); }
function number(value: unknown) { const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/₹/g, "").trim() || 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return Math.round(number(value) * 100) / 100; }
function optionalMoney(value: unknown) { return nonBlank(value) ? money(value) : null; }
function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function integer(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.trunc(parsed) : -1; }
function chunk<T>(values: T[], size: number) { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; }
function sha(value: string) { return createHash("sha256").update(value).digest("hex"); }
function formatAmount(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value); }
