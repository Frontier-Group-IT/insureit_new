import { getCurrentSession } from '@/lib/partner-session';
import { supabase } from '@/lib/supabase';
export type AccountDeletionRequest = { id: string; status: 'requested' | 'under_review' | 'fulfilling' | 'fulfilled' | 'declined'; requested_at: string; completed_at?: string | null };
async function call(method: 'GET' | 'POST') {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Sign in again to request account deletion.');
  const { data, error } = await supabase.functions.invoke('partner-account-deletion', {
    method,
    ...(method === 'POST' ? { body: { confirmation: 'DELETE MY ACCOUNT' } } : {}),
  });
  if (error) {
    throw new Error('Account deletion service is unavailable. Check your connection and try again.');
  }
  const body = data as { request?: AccountDeletionRequest | null; error?: string } | null;
  if (body?.error) throw new Error(body.error);
  return body.request ?? null;
}
export const getAccountDeletionRequest = () => call('GET');
export const submitAccountDeletionRequest = () => call('POST');
