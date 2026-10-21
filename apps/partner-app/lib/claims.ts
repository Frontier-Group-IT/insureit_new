import { supabase } from '@/lib/supabase';

export type PartnerClaimSummary = {
  total_claims: number;
  active_claims: number;
  completed_claims: number;
  assistance_requested: number;
};

export type PartnerClaimState = 'all' | 'active' | 'completed' | 'assistance';

export type PartnerClaimRow = {
  claim_id: string;
  claim_no: string | null;
  insurer_claim_no: string | null;
  current_status: string | null;
  claim_state: 'active' | 'completed';
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
  surveyor_name: string | null;
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

export type PartnerClaimDocument = { id: string; name: string; category: string | null };

export type PartnerClaimDetail = {
  /** Null means the scoped API has not supplied document inventory. */
  documents: PartnerClaimDocument[] | null;
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
    make?: string | null;
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

  // Documents must come from the same claim-authorized RPC, never a global storage listing.
  // Do not treat an absent inventory as an empty upload set.
  const payload = data as PartnerClaimDetail & { documents?: unknown };
  const documents: PartnerClaimDocument[] | null = Array.isArray(payload.documents)
    ? payload.documents.filter(item => Boolean(item) && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string')
      .map(item => ({ id: String(item.id), name: String(item.name), category: typeof item.category === 'string' ? item.category : null }))
    : null;
  const detail: PartnerClaimDetail = { ...payload, documents };
  try { detail.documents = await listPartnerClaimDocuments(claimId); }
  catch { /* Keep inventory unknown; scoped RPC may be unavailable before deployment. */ }
  if (!detail.vehicle?.id || !detail.customer?.id) return detail;

  const { data: customerDetail } = await supabase.rpc('partner_app_customer_detail', {
    p_customer_id: detail.customer.id,
  });

  const matchedVehicle = Array.isArray(customerDetail?.vehicles)
    ? customerDetail.vehicles.find((vehicle: { vehicle_id?: string | null }) => vehicle.vehicle_id === detail.vehicle.id)
    : null;

  return {
    ...detail,
    vehicle: {
      ...detail.vehicle,
      make: typeof matchedVehicle?.make === 'string' ? matchedVehicle.make : null,
    },
  };
}

/** Creates or resumes an authorized Partner claim draft. Authorization is enforced inside the RPC. */
export async function createPartnerClaim(customerId: string, vehicleId: string, policyId: string | null) {
  const { data, error } = await supabase.rpc('partner_app_create_claim', {
    p_customer_id: customerId,
    p_vehicle_id: vehicleId,
    p_policy_id: policyId,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Claim ID not returned');
  return data;
}

export async function savePartnerClaimSpot(claimId: string, incidentAt: string, spotAt: string, location: string, driver: string, phone: string) {
  const { data, error } = await supabase.rpc('partner_app_save_claim_spot', {
    p_claim_id: claimId, p_accident_at: incidentAt, p_spot_intimation_at: spotAt,
    p_location: location, p_driver_name: driver, p_driver_phone: phone,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Claim details were not saved');
}

export async function savePartnerStageDraft(claimId: string, stage: string, fields: Record<string, string>) {
  const { data, error } = await supabase.rpc('partner_app_save_claim_stage_draft', {
    p_claim_id: claimId, p_milestone_key: stage, p_fields: fields,
  });
  if (error) throw error;
  if (!data) throw new Error('Claim stage draft was not saved.');
  return data as string;
}

export async function listPartnerClaimDocuments(claimId: string): Promise<PartnerClaimDocument[]> {
  const { data, error } = await supabase.rpc('partner_app_claim_document_list',{p_claim_id:claimId});
  if(error) throw error;
  return Array.isArray(data) ? data.map((x:{id:string;name:string;category:string|null})=>({id:x.id,name:x.name,category:x.category})) : [];
}

export async function uploadPartnerClaimDocument(claimId: string, kind: string, asset: { uri: string; name: string; size?: number; mimeType?: string }, milestoneKey = 'spot_intimation') {
  const mime=asset.mimeType || (asset.name.toLowerCase().endsWith('.pdf')?'application/pdf':'');
  if(!mime||!asset.size||asset.size<=0) throw new Error('Document type or size is unavailable.');
  const meta={claim_id:claimId,kind,name:asset.name,size:asset.size,mime,milestone_key:milestoneKey};
  const {data:prepared,error:prepareError}=await supabase.functions.invoke('partner-claim-upload',{body:{...meta,action:'prepare'}});
  if(prepareError||!prepared?.path||!prepared?.token) throw new Error(prepared?.error || prepareError?.message || 'Unable to prepare upload');
  const response=await fetch(asset.uri);
  if(!response.ok)throw new Error('Could not read selected document');
  const content=await response.blob();
  const {error:uploadError}=await supabase.storage.from('claim-documents').uploadToSignedUrl(prepared.path,prepared.token,content,{contentType:mime});
  if(uploadError)throw uploadError;
  const {data:completed,error:finalizeError}=await supabase.functions.invoke('partner-claim-upload',{body:{...meta,action:'finalize',path:prepared.path}});
  if(finalizeError||!completed?.document_id)throw new Error(completed?.error || finalizeError?.message || 'File uploaded; record finalization pending.');
  return completed.document_id as string;
}

export async function openPartnerClaimDocument(claimId: string, documentId: string) {
  const { data, error } = await supabase.functions.invoke('partner-claim-upload',{
    body:{ action:'view', claim_id:claimId, document_id:documentId },
  });
  if(error || typeof data?.url!=='string' || !data.url.startsWith('https://')) {
    throw new Error(data?.error || error?.message || 'Could not open this claim document.');
  }
  return data.url as string;
}
