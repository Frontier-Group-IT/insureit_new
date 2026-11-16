import { getCurrentSession } from '@/lib/partner-session';

const portal = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');

export type LifeHealthStatus = 'pending' | 'rejected' | 'issued' | 'all';
export type LifeHealthCaseSummary = {
  id: string;
  case_number: string;
  business_line: string;
  status_group: Exclude<LifeHealthStatus, 'all'>;
  customer_name: string;
  customer_phone: string;
  insurer_name: string;
  product_name: string;
  proposal_number: string;
  sourcing_date: string;
  rm_name: string;
  lead_source: string;
  premium_amount: number;
  created_at: string;
  final_policy_id: string | null;
};
export type LifeHealthCaseDetail = LifeHealthCaseSummary & {
  status: string;
  premium_paying_term: string | null;
  policy_duration: string | null;
  payment_frequency: string;
  payment_mode: string;
  intermediary_type: string | null;
  intermediary_code: string | null;
  intermediary_mobile: string | null;
  rm_code: string | null;
  remarks: string | null;
  converted_at: string | null;
  customer_address: string;
  policy_no: string | null;
  rejection_reason: string;
};
export type LifeHealthDocument = { id: string; document_type: string; file_name: string; created_at: string };
export type LifeHealthActivity = { id: string; action: string; created_at: string };
export type CaseCounts = Record<LifeHealthStatus,number>;

async function request<T>(params: URLSearchParams): Promise<T> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Your session expired. Sign in again.');
  let response: Response;
  try {
    response = await fetch(`${portal}/api/partner/life-health-cases?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Unable to connect to Case Register. Check your internet connection.');
  }
  const body = await response.json().catch(() => null) as ({ ok?: boolean; error?: string } & Partial<T>) | null;
  if (!response.ok || !body?.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Your Case Register permissions need refreshing. Sign in again.');
    throw new Error(body?.error || 'Case Register could not be loaded.');
  }
  return body as T;
}

export async function listLifeHealthCases(args: {
  status: LifeHealthStatus;
  search: string;
  offset: number;
  limit?: number;
}) {
  const params = new URLSearchParams({
    status: args.status, search: args.search.slice(0,120),
    offset: String(args.offset),limit: String(args.limit ?? 10),
  });
  return request<{ok:true;cases:LifeHealthCaseSummary[];counts:CaseCounts;total:number}>(params);
}

export async function getLifeHealthCase(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid case reference.');
  return request<{ok:true;case:LifeHealthCaseDetail;documents:LifeHealthDocument[];activities:LifeHealthActivity[]}>(
    new URLSearchParams({ id }),
  );
}

/** Canonical Operations route. No tokens, IDs beyond the requested case, or PII in the query string. */
export function operationsCaseUrl(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid case reference.');
  return `${portal}/policies/life-health-cases/${encodeURIComponent(id)}`;
}
