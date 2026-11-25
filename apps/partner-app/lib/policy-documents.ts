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
  const url = BASE + '/api/partner/policies/' + encodeURIComponent(policyId) + '/documents' + (params.toString() ? '?' + params.toString() : '');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + session.access_token, Accept: 'application/json' },
    });
  } catch {
    throw new Error('Unable to reach the policy document service. Check your connection and retry.');
  }
  // The portal deliberately requires a separate manual Vercel deployment.
  // An older deployment can return an HTML 404/login page for this new route.
  // Never parse HTML as JSON, and never surface its content to Partners.
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    if (response.status === 401) throw new Error('Your Partner session has expired. Sign in again.');
    if (response.status === 403) throw new Error('You do not have access to these policy documents.');
    throw new Error('The policy document service is not available yet. Please contact your administrator.');
  }
  let result: (T & { ok?: boolean; error?: string }) | null = null;
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      result = parsed as T & { ok?: boolean; error?: string };
    }
  } catch {
    throw new Error('The document service returned an invalid response. Please retry later.');
  }
  if (!result || !response.ok || result.ok !== true) {
    const message = typeof result?.error === 'string' && result.error.trim() ? result.error : null;
    if (response.status === 401) throw new Error(message || 'Your Partner session has expired. Sign in again.');
    if (response.status === 403) throw new Error(message || 'You do not have access to these policy documents.');
    if (response.status === 404) throw new Error(message || 'The policy document service is not available yet.');
    throw new Error(message || 'Policy documents could not be loaded. Please retry.');
  }
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
