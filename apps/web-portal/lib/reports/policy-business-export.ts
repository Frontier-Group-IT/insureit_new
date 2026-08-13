import "server-only";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePolicyBusinessFilters, type PolicyBusinessQuery, type PolicyBusinessRow } from "@/lib/reports/policy-business";

type ViewerProfile = { id: string; role: string | null };

type RpcReport = {
  register?: {
    rows?: PolicyBusinessRow[];
    total_count?: number | string;
  };
};

const PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 10_000;

export async function loadPolicyBusinessExport(profile: ViewerProfile, query: PolicyBusinessQuery) {
  const filters = resolvePolicyBusinessFilters(query);
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_reports");
  if (customerIds !== null && customerIds.length === 0) return { rows: [] as PolicyBusinessRow[], truncated: false };

  const first = await fetchPage(customerIds, filters, 1);
  const total = Number(first.register?.total_count ?? 0);
  const cappedTotal = Math.min(total, MAX_EXPORT_ROWS);
  const pageCount = Math.max(1, Math.ceil(cappedTotal / PAGE_SIZE));
  const pages: RpcReport[] = [first];

  for (let page = 2; page <= pageCount; page += 1) {
    pages.push(await fetchPage(customerIds, filters, page));
  }

  const rows = pages.flatMap((page) => Array.isArray(page.register?.rows) ? page.register!.rows! : []).slice(0, MAX_EXPORT_ROWS);
  return { rows, truncated: total > MAX_EXPORT_ROWS };
}

async function fetchPage(
  customerIds: string[] | null,
  filters: ReturnType<typeof resolvePolicyBusinessFilters>,
  page: number,
): Promise<RpcReport> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_policy_business_report_v2", {
    p_customer_ids: customerIds,
    p_from_date: filters.fromDate,
    p_to_date: filters.toDate,
    p_insurer_id: filters.insurerId,
    p_rm_employee_id: filters.rmEmployeeId,
    p_intermediary_code: filters.intermediaryCode,
    p_page: page,
    p_page_size: PAGE_SIZE,
  });
  if (error) throw new Error(`Policy business export query failed: ${error.message}`);
  return (data && typeof data === "object" ? data : {}) as RpcReport;
}
