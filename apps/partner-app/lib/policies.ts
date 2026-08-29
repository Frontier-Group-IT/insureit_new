import { supabase } from '@/lib/supabase';

export type PartnerPolicySummary = {
  total_policies: number;
  in_force_policies: number;
  expiring_30_days: number;
  expired_policies: number;
  upcoming_policies: number;
  total_premium: number | string;
  motor_policies: number;
};

export type PartnerPolicyLifecycle = 'all' | 'in_force' | 'expiring' | 'expired' | 'upcoming';

export type PartnerPolicyRow = {
  policy_id: string;
  policy_code: string | null;
  policy_no: string | null;
  policy_type: string | null;
  policy_product: string | null;
  business_line: string | null;
  business_type: string | null;
  start_date: string | null;
  end_date: string | null;
  issuance_date: string | null;
  premium_amount: number | string | null;
  policy_status: string | null;
  lifecycle_status: Exclude<PartnerPolicyLifecycle, 'all'>;
  customer_id: string | null;
  customer_name: string;
  vehicle_id: string | null;
  vehicle_no: string | null;
  insurer_name: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  rm_name: string | null;
  intermediary_group_code: string | null;
  intermediary_group_name: string | null;
  total_count: number;
};

export async function getPartnerPolicySummary() {
  const { data, error } = await supabase.rpc('partner_app_policy_summary');
  if (error) throw error;
  if (!data) throw new Error('Policy summary is unavailable.');
  return data as PartnerPolicySummary;
}

export async function listPartnerPolicies({
  limit = 25,
  offset = 0,
  search,
  lifecycle = 'all',
}: {
  limit?: number;
  offset?: number;
  search?: string;
  lifecycle?: PartnerPolicyLifecycle;
} = {}) {
  const { data, error } = await supabase.rpc('partner_app_list_policies', {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_lifecycle: lifecycle,
  });
  if (error) throw error;
  return (data ?? []) as PartnerPolicyRow[];
}


export type PartnerRenewalSummary = {
  overdue_count: number;
  overdue_premium: number | string;
  due_0_7_count: number;
  due_0_7_premium: number | string;
  due_8_15_count: number;
  due_8_15_premium: number | string;
  due_16_30_count: number;
  due_16_30_premium: number | string;
  due_30_count: number;
  due_30_premium: number | string;
};

export type PartnerPolicyDetail = {
  policy: {
    id: string;
    policy_code: string | null;
    policy_no: string | null;
    policy_type: string | null;
    policy_product: string | null;
    business_line: string | null;
    business_type: string | null;
    start_date: string | null;
    end_date: string | null;
    issuance_date: string | null;
    status: string | null;
    insured_declared_value: number | string | null;
    lifecycle_status: Exclude<PartnerPolicyLifecycle, 'all'>;
  };
  premium: {
    gross_premium: number | string | null;
    net_premium: number | string | null;
    od_premium: number | string | null;
    tp_premium: number | string | null;
    cpa_opted: boolean | null;
    cpa_amount: number | string | null;
    gst_amount: number | string | null;
  };
  customer: {
    id: string | null;
    name: string;
    customer_code: string | null;
  };
  vehicle: {
    id: string;
    vehicle_no: string | null;
    vehicle_type: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    vehicle_category: string | null;
    is_commercial: boolean | null;
  } | null;
  insurer: {
    id: string | null;
    name: string | null;
  };
  commercial: {
    intermediary_type: string | null;
    intermediary_code: string | null;
    rm_name: string | null;
    group_code: string | null;
    group_name: string | null;
  };
};

export async function getPartnerRenewalSummary() {
  const { data, error } = await supabase.rpc('partner_app_renewal_summary');
  if (error) throw error;
  if (!data) throw new Error('Renewal summary is unavailable.');
  return data as PartnerRenewalSummary;
}

export async function getPartnerPolicyDetail(policyId: string) {
  const { data, error } = await supabase.rpc('partner_app_policy_detail', {
    p_policy_id: policyId,
  });
  if (error) throw error;
  if (!data) throw new Error('Policy detail is unavailable.');
  return data as PartnerPolicyDetail;
}
