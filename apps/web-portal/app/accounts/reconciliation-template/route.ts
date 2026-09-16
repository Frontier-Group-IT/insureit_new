import * as XLSX from "xlsx";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAccountsDashboardFilters } from "@/lib/accounts-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyRow = {
  id: string;
  policy_no: string | null;
  customer_id: string;
  insurance_company_id: string | null;
  issuance_date: string | null;
  start_date: string | null;
  created_at: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  insurance_companies: { name?: string | null } | Array<{ name?: string | null }> | null;
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

  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_accounts");
  if (customerIds !== null && customerIds.length === 0) {
    return workbookResponse([], [], filters.fromDate, filters.toDate);
  }

  const db = createSupabaseAdminClient();
  let query = db
    .from("policies")
    .select("id,policy_no,customer_id,insurance_company_id,issuance_date,start_date,created_at,intermediary_type,intermediary_code,insurance_companies(name)")
    .limit(5000);
  if (customerIds !== null) query = query.in("customer_id", customerIds);
  if (filters.insurerId) query = query.eq("insurance_company_id", filters.insurerId);

  const { data: policies, error } = await query;
  if (error) return new Response("Unable to generate reconciliation workbook.", { status: 500 });

  const filtered = ((policies ?? []) as PolicyRow[]).filter((row) => {
    const businessDate = row.issuance_date || row.start_date || String(row.created_at ?? "").slice(0, 10);
    return businessDate >= filters.fromDate && businessDate <= filters.toDate;
  });
  const policyIds = filtered.map((row) => row.id);

  const [{ data: payins, error: payinError }, { data: payouts, error: payoutError }] = policyIds.length
    ? await Promise.all([
        db.from("policy_payin_details").select("policy_id,total_projected_payin,tds_amount,payin_after_tds").in("policy_id", policyIds),
        db.from("policy_intermediary_payouts").select("id,policy_id,intermediary_type,intermediary_code,od_payout_percent,tp_payout_percent,gross_payout,retention_amount,commercial_status,status").in("policy_id", policyIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (payinError || payoutError) return new Response("Unable to generate reconciliation workbook.", { status: 500 });

  const policyMap = new Map(filtered.map((policy) => [policy.id, policy]));
  const payinMap = new Map((payins ?? []).map((row) => [row.policy_id, row]));

  const payinRows = filtered.map((policy) => {
    const insurer = relationName(policy.insurance_companies);
    const payin = payinMap.get(policy.id);
    return {
      "System Policy ID": policy.id,
      "Policy Number": policy.policy_no ?? "",
      "Insurance Company": insurer,
      "Projected Pay-In": money(payin?.total_projected_payin),
      "Projected TDS": money(payin?.tds_amount),
      "Projected Net Pay-In": money(payin?.payin_after_tds),
      "Bill Number": "",
      "Bill Amount": "",
      "Bill Date": "",
      "Actual TDS": "",
      "Amount Received": "",
      "Receipt Date": "",
      "UTR / Reference": "",
    };
  });

  const payoutRows = (payouts ?? []).map((payout) => {
    const policy = policyMap.get(payout.policy_id);
    return {
      "System Payout ID": payout.id,
      "System Policy ID": payout.policy_id,
      "Policy Number": policy?.policy_no ?? "",
      "Intermediary Type": payout.intermediary_type ?? policy?.intermediary_type ?? "",
      "Intermediary Code": payout.intermediary_code ?? policy?.intermediary_code ?? "",
      "Payout OD %": money(payout.od_payout_percent),
      "Payout TP %": money(payout.tp_payout_percent),
      "Projected Gross Payout": money(payout.gross_payout),
      "Projected Retention": money(payout.retention_amount),
      "Paid Amount": "",
      "Paid Date": "",
      "UTR / Reference": "",
    };
  });

  return workbookResponse(payinRows, payoutRows, filters.fromDate, filters.toDate);
}

function workbookResponse(
  payinRows: Array<Record<string, unknown>>,
  payoutRows: Array<Record<string, unknown>>,
  fromDate: string,
  toDate: string,
) {
  const workbook = XLSX.utils.book_new();

  const payinHeaders = [
    "System Policy ID",
    "Policy Number",
    "Insurance Company",
    "Projected Pay-In",
    "Projected TDS",
    "Projected Net Pay-In",
    "Bill Number",
    "Bill Amount",
    "Bill Date",
    "Actual TDS",
    "Amount Received",
    "Receipt Date",
    "UTR / Reference",
  ];
  const payinSheet = XLSX.utils.json_to_sheet(payinRows, { header: payinHeaders });
  payinSheet["!cols"] = [
    { wch: 38, hidden: true }, { wch: 24 }, { wch: 30 }, { wch: 17 }, { wch: 15 }, { wch: 19 },
    { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, payinSheet, "Pay-In");

  const payoutHeaders = [
    "System Payout ID",
    "System Policy ID",
    "Policy Number",
    "Intermediary Type",
    "Intermediary Code",
    "Payout OD %",
    "Payout TP %",
    "Projected Gross Payout",
    "Projected Retention",
    "Paid Amount",
    "Paid Date",
    "UTR / Reference",
  ];
  const payoutSheet = XLSX.utils.json_to_sheet(payoutRows, { header: payoutHeaders });
  payoutSheet["!cols"] = [
    { wch: 38, hidden: true }, { wch: 38, hidden: true }, { wch: 24 }, { wch: 20 }, { wch: 22 },
    { wch: 13 }, { wch: 13 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, payoutSheet, "Pay-Out");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["INSUREIT Accounts Reconciliation Workbook"],
    ["Period", `${fromDate} to ${toDate}`],
    [],
    ["Workbook structure", "Use Pay-In for insurer billing/receipts and Pay-Out for intermediary payments. Do not rename either sheet."],
    ["System columns", "System IDs, policy details, insurer/intermediary details, projected Pay-In, projected payout, payout percentages and retention are controlled by INSUREIT and must not be edited."],
    ["Pay-In input", "Bill Number, Bill Amount, Bill Date, Actual TDS, Amount Received, Receipt Date, UTR / Reference."],
    ["Pay-Out input", "Paid Amount, Paid Date, UTR / Reference."],
    ["Partial Pay-In", "If one policy receives multiple insurer installments, duplicate that policy row and enter a separate receipt amount/date/UTR for each installment. The policy itself is not duplicated in INSUREIT."],
    ["Partial Pay-Out", "If one policy payout is paid in multiple installments, duplicate that Pay-Out row and enter a separate payment amount/date/UTR for each installment."],
    ["Consolidated insurer bill", "Use the same Bill Number and Bill Date on every policy row included in that insurer bill. Bill Amount remains the policy-line amount for that policy."],
    ["Difference", "INSUREIT calculates differences and outstanding balances during validation; do not maintain a Difference column manually."],
    ["Duplicate protection", "Repeating a policy is allowed. Repeating the same transaction reference/UTR is validated separately and may be blocked as a duplicate."],
    ["Safety", "The current stage is validation preview only. Uploading this workbook does not write financial records."],
  ]);
  instructions["!cols"] = [{ wch: 32 }, { wch: 118 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  const name = `insureit-accounts-reconciliation-${fromDate}-to-${toDate}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${name}\"`,
      "Cache-Control": "no-store",
    },
  });
}

function relationName(value: PolicyRow["insurance_companies"]) {
  return Array.isArray(value) ? value[0]?.name ?? "" : value?.name ?? "";
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
