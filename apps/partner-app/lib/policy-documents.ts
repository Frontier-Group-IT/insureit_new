import { getCurrentSession } from '@/lib/partner-session';

const BASE = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
export type PartnerPolicyDocument = {
  id: string;
  source: 'policy' | 'life_health';
  type: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};
async function get<T>(policyId: string, params: URLSearchParams = new URLSearchParams()): Promise<T> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Sign in again to view policy documents.');
  const url = BASE + '/api/partner/policies/' + encodeURIComponent(policyId) + '/documents' + (params.size ? '?' + params.toString() : '');
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + session.access_token, Accept: 'application/json' } });
  const result = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || 'Policy documents could not be loaded.');
  return result;
}
export async function listPartnerPolicyDocuments(policyId: string): Promise<PartnerPolicyDocument[]> {
  const result = await get<{ ok: true; documents: PartnerPolicyDocument[] }>(policyId);
  return Array.isArray(result.documents) ? result.documents : [];
}
export async function openPartnerPolicyDocument(policyId: string, document: PartnerPolicyDocument, download = false): Promise<string> {
  const params = new URLSearchParams({ document: document.id, source: document.source });
  if (download) params.set('download', 'true');
  const result = await get<{ ok: true; url: string }>(policyId, params);
  if (!/^https:\/\//i.test(result.url)) throw new Error('A secure document link is unavailable.');
  return result.url;
}
