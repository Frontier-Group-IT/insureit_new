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


export type PartnerCustomerDetail = {
  customer: {
    id: string;
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
    status: string | null;
    created_at: string;
    intermediary_type: string | null;
    intermediary_code: string | null;
  };
  summary: {
    policies: number;
    vehicles: number;
    claims: number;
    renewals_30_days: number;
  };
  policies: {
    policy_id: string;
    policy_no: string | null;
    policy_code: string | null;
    policy_type: string | null;
    policy_product: string | null;
    end_date: string | null;
    premium_amount: number | string | null;
    insurer_name: string | null;
    vehicle_no: string | null;
  }[];
  vehicles: {
    vehicle_id: string;
    vehicle_no: string | null;
    vehicle_type: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    fitness_expiry_date: string | null;
    puc_expiry_date: string | null;
    road_tax_expiry_date: string | null;
    national_permit_expiry_date: string | null;
    local_permit_expiry_date: string | null;
  }[];
  claims: {
    claim_id: string;
    claim_no: string | null;
    current_status: string | null;
    created_at: string;
    vehicle_no: string | null;
    insurer_name: string | null;
  }[];
};

export async function getPartnerCustomerDetail(customerId: string) {
  const { data, error } = await supabase.rpc('partner_app_customer_detail', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  if (!data) throw new Error('Customer detail is unavailable.');
  return data as PartnerCustomerDetail;
}
