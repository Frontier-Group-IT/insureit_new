import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession, type PartnerCustomerRow } from "@/lib/partner-web";
import type { CustomerStatusFilter, CustomerTypeFilter } from "./customer-filters";

export async function listFilteredPartnerCustomers({
  limit = 25,
  offset = 0,
  search,
  status = "all",
  customerType = "all",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: CustomerStatusFilter;
  customerType?: CustomerTypeFilter;
} = {}): Promise<PartnerCustomerRow[]> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_list_customers_filtered", {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_status: status,
    p_customer_type: customerType,
  });

  if (error) throw error;
  return (data ?? []) as PartnerCustomerRow[];
}
