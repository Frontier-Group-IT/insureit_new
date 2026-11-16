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
  updated_at: string;
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
  insurance_company_id: string;
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
  return request<{ok:true;case:LifeHealthCaseDetail;documents:LifeHealthDocument[];activities:LifeHealthActivity[];insurers:{id:string;name:string}[]}>(
    new URLSearchParams({ id }),
  );
}

/** Canonical Operations route. No tokens, IDs beyond the requested case, or PII in the query string. */
export function operationsCaseUrl(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid case reference.');
  return `${portal}/policies/life-health-cases/${encodeURIComponent(id)}`;
}

/** Open the existing authenticated Operations policy editor, not an unscoped native policy record. */
export function operationsIssuedPolicyUrl(policyId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(policyId)) throw new Error('Invalid issued policy reference.');
  return `${portal}/policies/${encodeURIComponent(policyId)}/edit`;
}

export type LifeHealthCaseEdit = {
  id: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  productName?: string;
  proposalNumber?: string;
  premiumPayingTerm?: string;
  policyDuration?: string;
  paymentFrequency?: string;
  paymentMode?: string;
  premiumAmount?: number;
  sourcingDate?: string;
  insurerId?: string;
};

/** Saves only fields permitted for the current case state and signed-in actor. */
export async function saveLifeHealthCaseEdit(payload: LifeHealthCaseEdit): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Your session expired. Sign in again.');
  let response: Response;
  try {
    response = await fetch(`${portal}/api/partner/life-health-cases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Unable to connect to Case Register. Check your internet connection.');
  }
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !body?.ok) {
    if (response.status === 401 || response.status === 403) throw new Error(body?.error || 'Your edit permission is unavailable.');
    if (response.status === 404 || response.status === 405) throw new Error('Native editing is not available on the production portal yet.');
    throw new Error(body?.error || 'Unable to save case changes.');
  }
}


async function postCaseAction<T extends {ok:boolean;error?:string}>(path:string,payload:Record<string,unknown>):Promise<T>{
  const session=await getCurrentSession();
  if(!session?.access_token)throw new Error('Your session expired. Sign in again.');
  let response:Response;
  try{
    response=await fetch(portal+path,{method:'POST',cache:'no-store',
      headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify(payload)});
  }catch{throw new Error('Cannot contact Operations. Check your internet connection.');}
  const result=await response.json().catch(()=>null) as T|null;
  if(response.status===404||response.status===405)
    throw new Error('The required case service has not been deployed to the website yet.');
  if(!response.ok||!result?.ok)throw new Error(result?.error||'Could not complete this action. Reload the case before trying again.');
  return result;
}

export async function appendNativeLifeHealthRemark(caseId:string,newRemark:string){
  return postCaseAction<{ok:true;remarks:string}>('/api/partner/life-health-cases',{
    id:caseId,action:'append_remark',newRemark,
  });
}

export type LifeHealthIssueForm={
  caseId:string;policyNumber:string;issuanceDate:string;startDate:string;endDate:string;
  pptEndDate:string;nextInstallmentDate:string;finalPremium:string;sumInsured:string;approvalId:string;
};
export async function lifeHealthIssuanceAction(action:'approvers'|'request_approval'|'verify_approval'|'issue',
  input:Partial<LifeHealthIssueForm>&{caseId:string;policyNumber:string;issuanceDate:string;approverKey?:string;otp?:string},
){
  return postCaseAction<{ok:true;approvalRequired?:boolean;approvers?:{key:string;name:string}[];
    approvalId?:string;expiresAt?:string;policyId?:string;policyCode?:string}>(
    '/api/partner/life-health-cases/issue',{action,...input},
  );
}
