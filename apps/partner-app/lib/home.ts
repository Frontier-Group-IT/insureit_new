import { supabase } from '@/lib/supabase';

export type PartnerHomeData = {
  generated_at: string;
  business: {
    premium_this_month: number | string;
    premium_last_month: number | string;
    premium_change_percent: number | string;
    policies_this_month: number;
    active_policies: number;
    total_customers: number;
    customers_this_month: number;
    renewals_7_days: number;
    renewals_30_days: number;
    overdue_policies: number;
    renewal_premium_7_days: number | string;
    renewal_premium_30_days: number | string;
  };
  service: {
    active_claims: number;
    claims_need_attention: number;
    claims_updated_today: number;
    intakes_need_attention: number;
    intakes_in_progress: number;
  };
  impact: {
    active_vehicles: number;
    customers_served: number;
    claims_assisted: number;
    claim_settlement_value: number | string;
    active_motor_idv: number | string;
  };
  pulse: {
    business_momentum: 'rising' | 'steady' | 'slower';
    renewal_readiness: 'clear' | 'attention';
    service_status: 'steady' | 'attention';
    action_status: 'clear' | 'attention';
  };
  today: {
    kind: 'intake_attention' | 'renewal' | 'claim';
    title: string;
    subtitle: string;
    count: number;
    route: string;
  }[];
};

export async function getPartnerHome() {
  const { data, error } = await supabase.rpc('partner_app_home');
  if (error) throw error;
  if (!data) throw new Error('Partner Home is unavailable.');
  return data as PartnerHomeData;
}


export type PartnerBusinessRangeSummary = {
  generated_at: string;
  from_date: string;
  to_date: string;
  premium: number | string;
  premium_previous_period: number | string;
  premium_change_percent: number | string;
  policies: number;
  customers: number;
  renewals: number;
  claims: number;
};

export async function getPartnerBusinessRange(fromDate: string, toDate: string) {
  const { data, error } = await supabase.rpc('partner_app_business_range', {
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  if (!data) throw new Error('Business summary is unavailable for this date range.');
  return data as PartnerBusinessRangeSummary;
}
