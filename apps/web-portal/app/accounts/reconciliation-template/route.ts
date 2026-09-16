import * as XLSX from "xlsx";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAccountsDashboardFilters } from "@/lib/accounts-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  if (customerIds !== null && customerIds.length === 0) return workbookResponse([], filters.fromDate, filters.toDate);

  const db = createSupabaseAdminClient();
  let query = db
    .from("policies")
    .select("id,policy_no,customer_id,insurance_company_id,issuance_date,start_date,created_at,insurance_companies(name)")
    .limit(5000);
  if (customerIds !== null) query = query.in("customer_id", customerIds);
  if (filters.insurerId) query = query.eq("insurance_company_id", filters.insurerId);

  const { data: policies, error } = await query;
  if (error) return new Response("Unable to generate reconciliation template.", { status: 500 });

  const filtered = (policies ?? []).filter((row) => {
    const businessDate = row.issuance_date || row.start_date || String(row.created_at ?? "").slice(0, 10);
    return businessDate >= filters.fromDate && businessDate <= filters.toDate;
  });
  const ids = filtered.map((row) => row.id);
  const { data: payins, error: payinError } = ids.length
    ? await db.from("policy_payin_details").select("policy_id,payin_after_tds").in("policy_id", ids)
    : { data: [], error: null };
  if (payinError) return new Response("Unable to generate reconciliation template.", { status: 500 });
  const payinMap = new Map((payins ?? []).map((row) => [row.policy_id, money(row.payin_after_tds)]));

  const rows = filtered.map((policy) => {
    const relation = policy.insurance_companies as { name?: string | null } | Array<{ name?: string | null }> | null | undefined;
    const insurer = Array.isArray(relation) ? relation[0]?.name ?? "" : relation?.name ?? "";
    return {
      "Reconciliation ID": policy.id,
      "Policy Number": policy.policy_no ?? "",
      "Insurance Company": insurer,
      "Expected Pay-in": payinMap.get(policy.id) ?? 0,
      "Bill Number": "",
      "Bill Amount": "",
      "Bill Date": "",
      "Paid Amount": "",
      "Paid Date": "",
      "UTR Details": "",
    };
  });

  return workbookResponse(rows, filters.fromDate, filters.toDate);
}

function workbookResponse(rows: Array<Record<string, unknown>>, fromDate: string, toDate: string) {
  const workbook = XLSX.utils.book_new();
  const headers = ["Reconciliation ID", "Policy Number", "Insurance Company", "Expected Pay-in", "Bill Number", "Bill Amount", "Bill Date", "Paid Amount", "Paid Date", "UTR Details"];
  const uploadSheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  uploadSheet["!cols"] = [
    { wch: 38 }, { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 20 },
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, uploadSheet, "Reconciliation Upload");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["INSUREIT Accounts Reconciliation Template"],
    ["Period", `${fromDate} to ${toDate}`],
    [],
    ["System columns — do not edit", "Reconciliation ID, Policy Number, Insurance Company, Expected Pay-in"],
    ["Accounts input columns", "Bill Number, Bill Amount, Bill Date, Paid Amount, Paid Date, UTR Details"],
    ["Bill rule", "If Bill Amount is entered, Bill Number and Bill Date are required."],
    ["Payment rule", "If Paid Amount is entered, Paid Date and UTR Details are required."],
    ["Difference", "Calculated by INSUREIT during preview as Expected Pay-in minus Bill Amount. Do not add or maintain a Difference column manually."],
    ["Safety", "Uploading this workbook currently creates a preview only. It does not update financial records."],
  ]);
  instructions["!cols"] = [{ wch: 30 }, { wch: 95 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  const name = `insureit-reconciliation-${fromDate}-to-${toDate}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${name}\"`,
      "Cache-Control": "no-store",
    },
  });
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
