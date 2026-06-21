import { supabase } from '@/lib/supabase';
import type { ClaimStatus } from '@/lib/types';

type ClaimEventInput = {
  claimId: string;
  customerId: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  notes: string;
  changedBy: string;
  title?: string;
};

export async function recordClaimEvent({ claimId, fromStatus, toStatus, notes, changedBy }: ClaimEventInput) {
  const historyResult = await supabase.from('claim_status_history').insert({
    claim_id: claimId,
    from_status: fromStatus,
    to_status: toStatus,
    notes,
    changed_by: changedBy,
  });

  if (historyResult.error) {
    throw historyResult.error;
  }
}

