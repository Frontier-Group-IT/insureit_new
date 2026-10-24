import { supabase } from '@/lib/supabase';

export type PartnerClaimVehicleChoice = {
  customer_id: string;
  customer_name: string;
  vehicle_id: string;
  vehicle_no: string | null;
  make: string | null;
  model: string | null;
  policy_id: string | null;
  policy_no: string | null;
  insurer_name: string | null;
  policy_end_date: string | null;
  total_count: number;
};

export async function listPartnerClaimVehicleChoices({
  search = '',
  limit = 50,
  offset = 0,
}: { search?: string; limit?: number; offset?: number } = {}): Promise<PartnerClaimVehicleChoice[]> {
  const { data, error } = await supabase.rpc('partner_app_claim_vehicle_choices', {
    p_limit: limit,
    p_offset: offset,
    p_search: search.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as PartnerClaimVehicleChoice[];
}
