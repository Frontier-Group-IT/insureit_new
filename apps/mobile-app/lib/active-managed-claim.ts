import { supabase } from '@/lib/supabase';

export type ActiveManagedClaim = {
  id: string;
  current_status?: string | null;
  created_at?: string | null;
};

const COMPLETED_MANAGED_CLAIM_STATUSES = new Set(['Settled', 'Closed', 'Claim Complete']);

export async function findActiveManagedClaim(policyId: string): Promise<ActiveManagedClaim | null> {
  const { data, error } = await (supabase as any)
    .from('claims')
    .select('id,current_status,created_at')
    .eq('policy_id', policyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const claims = (data ?? []) as ActiveManagedClaim[];
  return claims.find((claim) => !COMPLETED_MANAGED_CLAIM_STATUSES.has(claim.current_status ?? '')) ?? null;
}
