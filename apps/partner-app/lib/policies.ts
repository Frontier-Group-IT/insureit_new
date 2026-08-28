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
