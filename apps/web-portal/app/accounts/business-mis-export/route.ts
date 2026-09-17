import * as XLSX from "xlsx";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAccountsDashboardFilters } from "@/lib/accounts-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = [
  "Month",
  "Policy Issuance Date",
  "RM Name",
  "Intermediary Type",
  "Lead Source",
  "Intermediary Code",
  "Registration No.",
  "Insured Name",
  "OD Premium",
  "Third Party Premium",
  "CPA",
  "Net Premium",
  "Policy Number",
  "Insurance Company",
  "Valid Upto",
  "Pay-in % OD",
  "OD Pay-in Amount",
  "Pay-in % TP",
  "TP Pay-in Amount",
  "Total Pay-in",
  "Bill Number",
  "Bill Amount",
  "Bill Date",
  "Difference",
  "TDS",
  "Payout OD %",
  "Payout TP %",
  "Gross Payout",
  "Retention",
  "Paid Amount",
  "Paid Date",
  "UTR Details",
] as const;

const AMOUNT_COLUMNS = new Set([8, 9, 10, 11, 16, 18, 19, 21, 23, 24, 27, 28, 29]);
const PERCENT_COLUMNS = new Set([15, 17, 25, 26]);
const DATE_COLUMNS = new Set([1, 14, 22, 30]);
const TOTAL_COLUMNS = [8, 9, 10, 11, 16, 18, 19, 21, 23, 24, 27, 28, 29];

type Policy = {
  id: string;
  customer_id: string;
  insurance_company_id: string | null;
  policy_no: string | null;
  issuance_date: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  rm_name: string | null;
  customers: { contact_name?: string | null; company_name?: string | null } | Array<{ contact_name?: string | null; company_name?: string | null }> | null;
  vehicles: { vehicle_no?: string | null } | Array<{ vehicle_no?: string | null }> | null;
  insurance_companies: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type InvoiceLine = {
  policy_id: string | null;
  invoice_line_amount: number | string | null;
  accounts_invoices: { invoice_no?: string | null; invoice_date?: string | null; status?: string | null } | Array<{ invoice_no?: string | null; invoice_date?: string | null; status?: string | null }> | null;
};

type PaymentAllocation = {
  payable_id: string;
  allocated_amount: number | string | null;
  partner_payments: { payment_date?: string | null; payment_reference?: string | null } | Array<{ payment_date?: string | null; payment_reference?: string | null }> | null;
};

export async function GET(request: Request) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const filters = resolveAccountsDashboardFilters({
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    insurer: url.searchParams.get("insurer") ?? undefined,
  });

  const db = createSupabaseAdminClient();
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) return workbookResponse([], filters.fromDate, filters.toDate);

  let policyQuery = db
    .from("policies")
    .select("id,customer_id,insurance_company_id,policy_no,issuance_date,start_date,end_date,created_at,intermediary_type,intermediary_code,lead_source,rm_name,customers(contact_name,company_name),vehicles(vehicle_no),insurance_companies(name)")
    .limit(15000);
  if (customerIds !== null) policyQuery = policyQuery.in("customer_id", customerIds);
  if (filters.insurerId) policyQuery = policyQuery.eq("insurance_company_id", filters.insurerId);

  const { data: policyData, error: policyError } = await policyQuery;
  if (policyError) return new Response("Unable to generate Business MIS export.", { status: 500 });

  const policies = ((policyData ?? []) as Policy[]).filter((policy) => {
    const businessDate = policy.issuance_date || policy.start_date || String(policy.created_at ?? "").slice(0, 10);
    return businessDate >= filters.fromDate && businessDate <= filters.toDate;
  });
  const policyIds = policies.map((policy) => policy.id);
  if (!policyIds.length) return workbookResponse([], filters.fromDate, filters.toDate);

  const batches = chunk(policyIds, 120);
  const [premiumResults, payinResults, payoutResults, invoiceLineResults, payableResults] = await Promise.all([
    Promise.all(batches.map((ids) => db.from("policy_premium_details").select("policy_id,od_premium,tp_premium,cpa_amount,net_premium").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("policy_payin_details").select("policy_id,projected_od_percent,projected_od_amount,projected_tp_percent,projected_tp_amount,total_projected_payin,tds_amount").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("policy_intermediary_payouts").select("id,policy_id,od_payout_percent,tp_payout_percent,gross_payout,retention_amount").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("accounts_invoice_lines").select("policy_id,invoice_line_amount,accounts_invoices(invoice_no,invoice_date,status)").in("policy_id", ids))),
    Promise.all(batches.map((ids) => db.from("partner_payables").select("id,policy_id").in("policy_id", ids))),
  ]);

  if ([premiumResults, payinResults, payoutResults, invoiceLineResults, payableResults].some((group) => group.some((result) => result.error))) {
    return new Response("Unable to generate Business MIS export.", { status: 500 });
  }

  const premiums = premiumResults.flatMap((result) => result.data ?? []);
  const payins = payinResults.flatMap((result) => result.data ?? []);
  const payouts = payoutResults.flatMap((result) => result.data ?? []);
  const invoiceLines = invoiceLineResults.flatMap((result) => (result.data ?? []) as InvoiceLine[]);
  const payables = payableResults.flatMap((result) => result.data ?? []);
  const payableIds = payables.map((row) => row.id);
  const paymentAllocations: PaymentAllocation[] = [];
  for (const ids of chunk(payableIds, 120)) {
    const { data, error } = await db.from("partner_payment_allocations").select("payable_id,allocated_amount,partner_payments(payment_date,payment_reference)").in("payable_id", ids);
    if (error) return new Response("Unable to generate Business MIS export.", { status: 500 });
    paymentAllocations.push(...((data ?? []) as PaymentAllocation[]));
  }

  const premiumMap = new Map(premiums.map((row) => [row.policy_id, row]));
  const payinMap = new Map(payins.map((row) => [row.policy_id, row]));
  const payoutMap = new Map<string, Array<Record<string, unknown>>>();
  for (const row of payouts) pushMap(payoutMap, String(row.policy_id), row as Record<string, unknown>);

  const invoiceMap = new Map<string, InvoiceLine[]>();
  for (const row of invoiceLines) if (row.policy_id) {
    const invoice = one(row.accounts_invoices);
    if (invoice?.status !== "Cancelled") pushMap(invoiceMap, row.policy_id, row);
  }

  const payablePolicy = new Map(payables.map((row) => [row.id, row.policy_id]));
  const paymentMap = new Map<string, PaymentAllocation[]>();
  for (const allocation of paymentAllocations) {
    const policyId = payablePolicy.get(allocation.payable_id);
    if (policyId) pushMap(paymentMap, policyId, allocation);
  }

  const rows = policies
    .sort((a, b) => businessDate(a).localeCompare(businessDate(b)) || String(a.policy_no ?? "").localeCompare(String(b.policy_no ?? "")))
    .map((policy) => {
      const premium = premiumMap.get(policy.id);
      const payin = payinMap.get(policy.id);
      const policyPayouts = payoutMap.get(policy.id) ?? [];
      const policyInvoices = invoiceMap.get(policy.id) ?? [];
      const policyPayments = paymentMap.get(policy.id) ?? [];
      const issued = policy.issuance_date || policy.start_date || String(policy.created_at ?? "").slice(0, 10);
      const customer = one(policy.customers);
      const vehicle = one(policy.vehicles);
      const insurer = one(policy.insurance_companies);

      const billNumbers = unique(policyInvoices.map((line) => one(line.accounts_invoices)?.invoice_no).filter(Boolean));
      const billDates = unique(policyInvoices.map((line) => one(line.accounts_invoices)?.invoice_date).filter(Boolean)).sort();
      const billAmount = sum(policyInvoices.map((line) => line.invoice_line_amount));
      const totalPayin = money(payin?.total_projected_payin);
      const paymentRefs = unique(policyPayments.map((allocation) => one(allocation.partner_payments)?.payment_reference).filter(Boolean));
      const paymentDates = unique(policyPayments.map((allocation) => one(allocation.partner_payments)?.payment_date).filter(Boolean)).sort();

      return [
        monthLabel(issued),
        excelDate(issued),
        policy.rm_name ?? "",
        policy.intermediary_type ?? "",
        policy.lead_source ?? "",
        policy.intermediary_code ?? "",
        vehicle?.vehicle_no ?? "",
        customer?.contact_name || customer?.company_name || "",
        money(premium?.od_premium),
        money(premium?.tp_premium),
        money(premium?.cpa_amount),
        money(premium?.net_premium),
        policy.policy_no ?? "",
        insurer?.name ?? "",
        excelDate(policy.end_date),
        money(payin?.projected_od_percent),
        money(payin?.projected_od_amount),
        money(payin?.projected_tp_percent),
        money(payin?.projected_tp_amount),
        totalPayin,
        billNumbers.join(", "),
        billAmount || "",
        excelDate(billDates.at(-1) ?? null),
        billAmount ? money(totalPayin - billAmount) : "",
        money(payin?.tds_amount),
        average(policyPayouts.map((row) => row.od_payout_percent)),
        average(policyPayouts.map((row) => row.tp_payout_percent)),
        sum(policyPayouts.map((row) => row.gross_payout)),
        sum(policyPayouts.map((row) => row.retention_amount)),
        sum(policyPayments.map((allocation) => allocation.allocated_amount)) || "",
        excelDate(paymentDates.at(-1) ?? null),
        paymentRefs.join(", "),
      ];
    });

  return workbookResponse(rows, filters.fromDate, filters.toDate);
}

function workbookResponse(rows: unknown[][], fromDate: string, toDate: string) {
  const summary = Array(HEADERS.length).fill("");
  summary[0] = periodLabel(fromDate, toDate);
  const worksheet = XLSX.utils.aoa_to_sheet([summary, [...HEADERS], ...rows], { cellDates: true });
  const lastRow = Math.max(3, rows.length + 2);

  for (const col of TOTAL_COLUMNS) {
    const address = XLSX.utils.encode_cell({ r: 0, c: col });
    worksheet[address] = { t: "n", f: `SUM(${XLSX.utils.encode_cell({ r: 2, c: col })}:${XLSX.utils.encode_cell({ r: lastRow - 1, c: col })})`, v: 0 };
  }

  const grey = "B7B7B7";
  const border = { style: "thin", color: { rgb: "000000" } };
  const headerStyle = { font: { name: "Aptos Display", sz: 11, bold: true }, fill: { patternType: "solid", fgColor: { rgb: grey } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: border, bottom: border, left: border, right: border } };
  const summaryStyle = { font: { name: "Aptos Display", sz: 11, bold: false }, fill: { patternType: "solid", fgColor: { rgb: grey } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: border, bottom: border, left: border, right: border } };
  const bodyStyle = { font: { name: "Aptos", sz: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: { top: border, bottom: border, left: border, right: border } };

  for (let r = 0; r < lastRow; r++) {
    for (let c = 0; c < HEADERS.length; c++) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[address] ?? (worksheet[address] = { t: "s", v: "" });
      cell.s = r === 0 ? summaryStyle : r === 1 ? headerStyle : bodyStyle;
      if (r >= 2 && AMOUNT_COLUMNS.has(c)) cell.z = "#,##0.00";
      if (r >= 2 && PERCENT_COLUMNS.has(c)) cell.z = "0.00";
      if (r >= 2 && DATE_COLUMNS.has(c) && cell.t === "d") cell.z = "d/m/yyyy";
      if (r === 0 && TOTAL_COLUMNS.includes(c)) cell.z = "#,##0.00";
    }
  }
  worksheet["A1"].s = { ...summaryStyle, alignment: { horizontal: "left", vertical: "center" }, font: { name: "Aptos Display", sz: 11, bold: true } };
  worksheet["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 28 },
    { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 25 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 17 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 17 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
  ];
  worksheet["!rows"] = [{ hpt: 20 }, { hpt: 34 }, ...rows.map(() => ({ hpt: 20 }))];
  worksheet["!autofilter"] = { ref: `A2:AF${lastRow}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Business MIS");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
  const name = `INSUREIT-Business-MIS-${fromDate}-to-${toDate}.xlsx`;
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename=\"${name}\"`, "Cache-Control": "no-store" } });
}

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function pushMap<T>(map: Map<string, T[]>, key: string, value: T) { const list = map.get(key) ?? []; list.push(value); map.set(key, list); }
function unique(values: Array<string | null | undefined>) { return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))]; }
function chunk<T>(values: T[], size: number) { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; }
function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return Math.round(number(value) * 100) / 100; }
function sum(values: unknown[]) { return money(values.reduce<number>((total, value) => total + number(value), 0)); }
function average(values: unknown[]) { const numbers = values.map(number).filter((value) => value !== 0); return numbers.length ? money(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : 0; }
function businessDate(policy: Policy) { return policy.issuance_date || policy.start_date || String(policy.created_at ?? "").slice(0, 10); }
function excelDate(value: string | null | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : ""; }
function monthLabel(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }
function periodLabel(from: string, to: string) { const fromMonth = monthLabel(from); const toMonth = monthLabel(to); return fromMonth === toMonth ? fromMonth : `${fromMonth} - ${toMonth}`; }
