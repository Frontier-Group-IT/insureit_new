"use server";

import * as XLSX from "xlsx";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ReconciliationPreviewRow = {
  rowNumber: number;
  reconciliationId: string;
  policyNumber: string;
  insurer: string;
  expectedPayin: number;
  billNumber: string;
  billAmount: number | null;
  billDate: string;
  difference: number | null;
  paidAmount: number | null;
  paidDate: string;
  utrDetails: string;
  status: "Ready" | "Warning" | "Error";
  message: string;
};

export type ReconciliationUploadPreview = {
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  rows: ReconciliationPreviewRow[];
  message?: string;
};

const REQUIRED_HEADERS = [
  "Reconciliation ID",
  "Policy Number",
  "Insurance Company",
  "Expected Pay-in",
  "Bill Number",
  "Bill Amount",
  "Bill Date",
  "Paid Amount",
  "Paid Date",
  "UTR Details",
] as const;

export async function previewAccountsReconciliationUpload(formData: FormData): Promise<ReconciliationUploadPreview> {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return emptyPreview("Choose an Excel file to preview.");
  if (file.size > 8 * 1024 * 1024) return emptyPreview("The upload must be 8 MB or smaller.");

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  } catch {
    return emptyPreview("The workbook could not be read. Upload an .xlsx file generated from the Accounts template.");
  }

  const sheetName = workbook.SheetNames.includes("Reconciliation Upload") ? "Reconciliation Upload" : workbook.SheetNames[0];
  if (!sheetName) return emptyPreview("The workbook does not contain a worksheet.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (!rows.length) return emptyPreview("The workbook contains no reconciliation rows.");

  const presentHeaders = new Set(Object.keys(rows[0] ?? {}).map((value) => value.trim()));
  const missing = REQUIRED_HEADERS.filter((header) => !presentHeaders.has(header));
  if (missing.length) return emptyPreview(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  if (rows.length > 1000) return emptyPreview("Preview supports up to 1,000 rows at a time.");

  const normalizedIds = [...new Set(rows.map((row) => text(row["Reconciliation ID"])).filter(validUuid))];
  if (!normalizedIds.length) return emptyPreview("No valid Reconciliation ID values were found.");

  const db = createSupabaseAdminClient();
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  let policyQuery = db.from("policies").select("id,policy_no,customer_id,insurance_company_id,insurance_companies(name)").in("id", normalizedIds);
  if (customerIds !== null) {
    if (!customerIds.length) return emptyPreview("No uploaded rows are inside your Accounts access scope.");
    policyQuery = policyQuery.in("customer_id", customerIds);
  }

  const [{ data: policies, error: policyError }, { data: payins, error: payinError }] = await Promise.all([
    policyQuery,
    db.from("policy_payin_details").select("policy_id,payin_after_tds").in("policy_id", normalizedIds),
  ]);
  if (policyError || payinError) throw new Error(policyError?.message ?? payinError?.message ?? "Unable to validate reconciliation upload.");

  const policyMap = new Map((policies ?? []).map((policy) => [policy.id, policy]));
  const payinMap = new Map((payins ?? []).map((row) => [row.policy_id, money(row.payin_after_tds)]));

  const previewRows: ReconciliationPreviewRow[] = rows.map((row, index) => {
    const reconciliationId = text(row["Reconciliation ID"]);
    const policy = policyMap.get(reconciliationId);
    const policyNumber = policy?.policy_no ?? text(row["Policy Number"]);
    const insurerRelation = policy?.insurance_companies as { name?: string | null } | Array<{ name?: string | null }> | null | undefined;
    const insurer = Array.isArray(insurerRelation) ? insurerRelation[0]?.name ?? "" : insurerRelation?.name ?? text(row["Insurance Company"]);
    const expectedPayin = policy ? payinMap.get(reconciliationId) ?? 0 : 0;
    const billNumber = text(row["Bill Number"]);
    const billAmount = optionalMoney(row["Bill Amount"]);
    const billDate = normalizedDate(row["Bill Date"]);
    const paidAmount = optionalMoney(row["Paid Amount"]);
    const paidDate = normalizedDate(row["Paid Date"]);
    const utrDetails = text(row["UTR Details"]);
    const difference = billAmount === null ? null : money(expectedPayin - billAmount);

    let status: ReconciliationPreviewRow["status"] = "Ready";
    let message = "Ready for a future confirmed import.";
    if (!validUuid(reconciliationId) || !policy) {
      status = "Error";
      message = "Reconciliation ID is invalid, inaccessible, or no longer matches a policy.";
    } else if (billAmount !== null && (!billNumber || !billDate)) {
      status = "Error";
      message = "Bill Number and Bill Date are required when Bill Amount is entered.";
    } else if (billAmount !== null && billAmount < 0) {
      status = "Error";
      message = "Bill Amount cannot be negative.";
    } else if (paidAmount !== null && (!paidDate || !utrDetails)) {
      status = "Error";
      message = "Paid Date and UTR Details are required when Paid Amount is entered.";
    } else if (paidAmount !== null && paidAmount < 0) {
      status = "Error";
      message = "Paid Amount cannot be negative.";
    } else if (billAmount === null && paidAmount === null && !billNumber && !billDate && !paidDate && !utrDetails) {
      status = "Warning";
      message = "No reconciliation values were entered in this row.";
    } else if (Math.abs(number(row["Expected Pay-in"]) - expectedPayin) > 0.01) {
      status = "Warning";
      message = "Expected Pay-in in the workbook was edited; the system value will be used.";
    }

    return {
      rowNumber: index + 2,
      reconciliationId,
      policyNumber,
      insurer,
      expectedPayin,
      billNumber,
      billAmount,
      billDate,
      difference,
      paidAmount,
      paidDate,
      utrDetails,
      status,
      message,
    };
  });

  return {
    totalRows: previewRows.length,
    readyRows: previewRows.filter((row) => row.status === "Ready").length,
    warningRows: previewRows.filter((row) => row.status === "Warning").length,
    errorRows: previewRows.filter((row) => row.status === "Error").length,
    rows: previewRows,
  };
}

function emptyPreview(message: string): ReconciliationUploadPreview {
  return { totalRows: 0, readyRows: 0, warningRows: 0, errorRows: 0, rows: [], message };
}
function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown) { const parsed = Number(String(value ?? "").replace(/,/g, "").trim() || 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return Math.round(number(value) * 100) / 100; }
function optionalMoney(value: unknown) { const raw = text(value); return raw === "" ? null : money(raw); }
function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function normalizedDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(parsed);
}
