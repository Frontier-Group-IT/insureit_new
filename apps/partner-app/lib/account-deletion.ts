import { getCurrentSession } from '@/lib/partner-session';
const portalUrl = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
export type AccountDeletionRequest = { id: string; status: 'requested' | 'under_review' | 'fulfilled' | 'declined'; requested_at: string; completed_at?: string | null };
async function call(method: 'GET' | 'POST') {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Sign in again to request account deletion.');
  const response = await fetch(`${portalUrl}/api/partner/account-deletion`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ confirmation: 'DELETE MY ACCOUNT' }) } : {}),
  });
  const body = await response.json() as { request?: AccountDeletionRequest | null; error?: string };
  if (!response.ok) throw new Error(body.error || 'Account deletion request unavailable.');
  return body.request ?? null;
}
export const getAccountDeletionRequest = () => call('GET');
export const submitAccountDeletionRequest = () => call('POST');
