import { supabase } from '@/lib/supabase';

export type PartnerNetworkChild = {
  intermediary_id: string;
  type: 'posp' | 'misp';
  code: string | null;
  name: string;
};

export type PartnerNetworkRow = {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  partner_kind: string;
  owner: {
    employee_id: string | null;
    employee_code: string | null;
    name: string | null;
    designation: string | null;
  };
  group: {
    group_id: string;
    group_code: string;
    group_name: string;
  } | null;
  children: PartnerNetworkChild[];
  child_count: number;
  posp_count: number;
  misp_count: number;
  metrics: {
    premium_this_month: number | string;
    policies_this_month: number;
    total_policies: number;
    total_customers: number;
    renewals_30_days: number;
    active_claims: number;
  };
};

export type PartnerNetworkData = {
  generated_at: string;
  scope_mode: 'organization' | 'hierarchy' | 'self' | 'partner_family' | 'none';
  total_partners: number;
  total_groups: number;
  partners: PartnerNetworkRow[];
};

export async function getPartnerNetwork() {
  const { data, error } = await supabase.rpc('partner_app_network');
  if (error) throw error;
  if (!data) throw new Error('Commercial network is unavailable.');
  return data as PartnerNetworkData;
}
