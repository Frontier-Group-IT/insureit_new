import { requirePartnerWritePermission } from '@/lib/partner-permissions';
import { supabase } from '@/lib/supabase';

export type PartnerCustomerSummary = {
  total_customers: number;
  active_customers: number;
  with_phone: number;
  with_email: number;
};

export type PartnerCustomerRow = {
  customer_id: string;
  customer_code: string | null;
  customer_name: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  customer_type: string | null;
  fleet_size_band: string | null;
  customer_status: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  created_at: string;
  total_count: number;
};

export async function getPartnerCustomerSummary() {
  const { data, error } = await supabase.rpc('partner_app_customer_summary');
  if (error) throw error;
  if (!data) throw new Error('Customer summary is unavailable.');
  return data as PartnerCustomerSummary;
}

export type PartnerCustomerStatusFilter = 'all' | 'active' | 'inactive';

export async function listPartnerCustomers({
  limit = 25,
  offset = 0,
  search,
  status = 'all',
}: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: PartnerCustomerStatusFilter;
} = {}) {
  const { data, error } = await supabase.rpc('partner_app_list_customers_v2', {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_status: status === 'all' ? null : status,
  });
  if (error) throw error;
  return (data ?? []) as PartnerCustomerRow[];
}

export type PartnerCustomerDetail = {
  customer: {
    id: string;
    customer_code: string | null;
    customer_name: string;
    company_name: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    customer_type: string | null;
    fleet_size_band: string | null;
    status: string | null;
    created_at: string;
    intermediary_type: string | null;
    intermediary_code: string | null;
  };
  summary: {
    policies: number;
    vehicles: number;
    claims: number;
    renewals_30_days: number;
  };
  policies: {
    policy_id: string;
    vehicle_id: string | null;
    policy_no: string | null;
    policy_code: string | null;
    policy_type: string | null;
    policy_product: string | null;
    end_date: string | null;
    premium_amount: number | string | null;
    insurer_name: string | null;
    vehicle_no: string | null;
  }[];
  vehicles: {
    vehicle_id: string;
    vehicle_no: string | null;
    vehicle_type: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    gvw_kg: number | string | null;
    registration_date: string | null;
    chassis_no: string | null;
    engine_no: string | null;
    permit_no: string | null;
    fitness_expiry_date: string | null;
    puc_expiry_date: string | null;
    road_tax_expiry_date: string | null;
    national_permit_expiry_date: string | null;
    local_permit_expiry_date: string | null;
  }[];
  claims: {
    claim_id: string;
    vehicle_id: string | null;
    policy_id: string | null;
    external_policy_id?: string | null;
    claim_no: string | null;
    current_status: string | null;
    created_at: string;
    vehicle_no: string | null;
    insurer_name: string | null;
  }[];
};

export async function getPartnerCustomerDetail(customerId: string) {
  const { data, error } = await supabase.rpc('partner_app_customer_detail', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  if (!data) throw new Error('Customer detail is unavailable.');
  const detail = data as PartnerCustomerDetail;
  // The customer RPC currently exposes internal policy_id only. Fetch scoped external
  // links separately so a valid external-policy claim is not mislabeled unlinked.
  if (!detail.claims.some((claim) => !claim.policy_id)) return detail;
  const { data: links, error: linksError } = await supabase.rpc('partner_app_customer_external_claim_links', {
    p_customer_id: customerId,
  });
  if (linksError) throw linksError;
  const externalByClaim = new Map<string, string>(
    ((links ?? []) as { claim_id: string; external_policy_id: string }[]).map((link) => [link.claim_id, link.external_policy_id]),
  );
  return {
    ...detail,
    claims: detail.claims.map((claim) => ({
      ...claim,
      external_policy_id: externalByClaim.get(claim.claim_id) ?? null,
    })),
  };
}

/** Partner registration request. The RPC must derive ownership from auth.uid(), never input. */
export type NewPartnerCustomer = {
  customer_name: string; mobile: string; email: string; street: string; locality: string;
  city: string; state: string; pin_code: string; pan_number: string; aadhaar_number: string;
  legal_trade_name: string; gst_registered: boolean; gst_number: string;
};
export type PartnerCustomerDocument = {
  type: 'pan_copy' | 'aadhaar_front' | 'aadhaar_back' | 'gst_copy';
  uri: string; name: string; mimeType: string; size: number;
};
async function partnerCustomerRequest(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke('partner-customer-create',{body});
  const result=data as {ok?:boolean;customerId?:string;error?:string;path?:string;token?:string;alreadySaved?:boolean}|null;
  if(error||!result?.ok){
    throw new Error(result?.error||'Customer service is unavailable. Check your list before retrying.');
  }
  return result;
}

export async function createPartnerCustomer(input: NewPartnerCustomer, requestId: string): Promise<string> {
  await requirePartnerWritePermission('create_customers');
  const result = await partnerCustomerRequest({ ...input, requestId, action:'create' });
  if (!result.customerId) throw new Error('Customer creation was not confirmed. Check customer list before retrying.');
  return result.customerId;
}

export async function uploadPartnerCustomerDocument(customerId:string, document:PartnerCustomerDocument):Promise<void>{
  await requirePartnerWritePermission('create_customers');
  let bytes:ArrayBuffer;
  try{
    const file=await fetch(document.uri);
    if(!file.ok)throw new Error('Document could not be read');
    bytes=await file.arrayBuffer();
  }catch{throw new Error('The selected document could not be read. Select it again.');}
  if(bytes.byteLength!==document.size||bytes.byteLength<1||bytes.byteLength>4*1024*1024)
    throw new Error('Selected document is invalid or exceeds the 4 MB limit.');
  const details={customerId,type:document.type,name:document.name,
    mimeType:document.mimeType,size:document.size};
  const prepared=await partnerCustomerRequest({action:'prepare_document',...details});
  if(prepared.alreadySaved)return;
  if(!prepared.path||!prepared.token)throw new Error('Secure customer document token is unavailable.');
  const {error:uploadError}=await supabase.storage.from('customer-documents')
    .uploadToSignedUrl(prepared.path,prepared.token,bytes,{contentType:document.mimeType,upsert:false});
  if(uploadError)throw new Error('Customer document upload failed: '+uploadError.message);
  await partnerCustomerRequest({action:'finalize_document',...details,path:prepared.path});
}
