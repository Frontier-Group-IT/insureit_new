import { supabase } from '@/lib/supabase';

export type PartnerBusinessPerformance = {
  generated_at: string;
  scope_mode: 'organization' | 'hierarchy' | 'self' | 'partner_family' | 'none';
  current_month: string;
  premium_this_month: number | string;
  premium_last_month: number | string;
  policies_this_month: number;
  policies_last_month: number;
  total_policies: number;
  total_customers: number;
  lifetime_gross_premium: number | string;
  premium_change_percent: number | string;
  trend: {
    month: string;
    premium: number | string;
    policies: number;
  }[];
  business_mix: {
    label: string;
    policies: number;
    premium: number | string;
  }[];
};

export async function getPartnerBusinessPerformance() {
  const { data, error } = await supabase.rpc('partner_app_business_performance');
  if (error) throw error;
  if (!data) throw new Error('Business performance is unavailable.');
  return data as PartnerBusinessPerformance;
}
