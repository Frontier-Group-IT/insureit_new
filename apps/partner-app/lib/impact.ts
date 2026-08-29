import { supabase } from '@/lib/supabase';

export type PartnerImpactData = {
  generated_at: string;
  month: string;
  lifetime_policies: number;
  policies_this_month: number;
  lifetime_gross_premium: number | string;
  gross_premium_this_month: number | string;
  active_vehicles: number;
  active_motor_idv: number | string;
  customers_served: number;
  customers_this_month: number;
  claims_assisted: number;
  claims_completed: number;
  claim_settlement_value: number | string;
};

export async function getPartnerImpact() {
  const { data, error } = await supabase.rpc('partner_app_impact');
  if (error) throw error;
  if (!data) throw new Error('Impact data is unavailable.');
  return data as PartnerImpactData;
}
