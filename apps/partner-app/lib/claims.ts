import { supabase } from '@/lib/supabase';

export type PartnerClaimSummary = {
  total_claims: number;
  active_claims: number;
  completed_claims: number;
  assistance_requested: number;
};

export type PartnerClaimState = 'all' | 'active' | 'completed';

export type PartnerClaimRow = {
  claim_id: string;
  claim_no: string | null;
  insurer_claim_no: string | null;
  current_status: string | null;
  claim_state: Exclude<PartnerClaimState, 'all'>;
  claim_service_mode: string | null;
  assistance_status: string | null;
  customer_id: string;
  customer_name: string;
  vehicle_id: string | null;
  vehicle_no: string | null;
  policy_no: string | null;
  insurer_name: string | null;
  accident_at: string | null;
  estimated_loss: number | string | null;
  approved_amount: number | string | null;
  settlement_amount: number | string | null;
  created_at: string;
  total_count: number;
};

export async function getPartnerClaimSummary() {
  const { data, error } = await supabase.rpc('partner_app_claim_summary');
  if (error) throw error;
  if (!data) throw new Error('Claim summary is unavailable.');
  return data as PartnerClaimSummary;
}

export async function listPartnerClaims({
  limit = 25,
  offset = 0,
  search,
  state = 'all',
}: {
  limit?: number;
  offset?: number;
  search?: string;
  state?: PartnerClaimState;
} = {}) {
  const { data, error } = await supabase.rpc('partner_app_list_claims', {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_state: state,
  });
  if (error) throw error;
  return (data ?? []) as PartnerClaimRow[];
}


export type PartnerClaimDetail = {
  claim: {
    id: string;
    claim_no: string | null;
    insurer_claim_no: string | null;
    current_status: string | null;
    claim_service_mode: string | null;
    assistance_status: string | null;
    accident_at: string | null;
    accident_location: string | null;
    estimated_loss: number | string | null;
    approved_amount: number | string | null;
    settlement_amount: number | string | null;
    created_at: string;
    updated_at: string;
  };
  customer: {
    id: string;
    name: string;
    customer_code: string | null;
  };
  vehicle: {
    id: string | null;
    vehicle_no: string | null;
  };
  policy: {
    policy_no: string | null;
  };
  insurer: {
    name: string | null;
  };
  status_history: {
    id: string;
    from_status: string | null;
    to_status: string | null;
    created_at: string;
  }[];
  stages: {
    id: string;
    stage: string;
    created_at: string;
  }[];
};

export async function getPartnerClaimDetail(claimId: string) {
  const { data, error } = await supabase.rpc('partner_app_claim_detail', {
    p_claim_id: claimId,
  });
  if (error) throw error;
  if (!data) throw new Error('Claim detail is unavailable.');
  return data as PartnerClaimDetail;
}
