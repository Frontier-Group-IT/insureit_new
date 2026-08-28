import { supabase } from '@/lib/supabase';

export type PartnerCustomerSummary = {
  total_customers: number;
  active_customers: number;
  with_phone: number;
  with_email: number;
};

export type PartnerCustomerRow = {
  customer_id: string;
  customer_code: string | null;
  customer_name: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  customer_type: string | null;
  fleet_size_band: string | null;
  customer_status: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  created_at: string;
  total_count: number;
};

export async function getPartnerCustomerSummary() {
  const { data, error } = await supabase.rpc('partner_app_customer_summary');
  if (error) throw error;
  if (!data) throw new Error('Customer summary is unavailable.');
  return data as PartnerCustomerSummary;
}

export async function listPartnerCustomers({
  limit = 25,
  offset = 0,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}) {
  const { data, error } = await supabase.rpc('partner_app_list_customers', {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as PartnerCustomerRow[];
}
