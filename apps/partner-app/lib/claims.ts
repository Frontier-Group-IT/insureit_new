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
    spot_intimation_at?: string | null;
    accident_location: string | null;
    accident_description?: string | null;
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
    details?: Record<string, unknown> | null;
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

/** Secure, claim-scoped save; the database validates Partner access and milestone completion. */
export async function savePartnerInsurerClaimNumber(claimId: string, claimNumber: string) {
  const number = claimNumber.trim();
  if (!number || number.length > 100) throw new Error('Enter a valid insurer claim number.');
  const { data, error } = await supabase.rpc('partner_app_save_insurer_claim_number', {
    p_claim_id: claimId,
    p_insurer_claim_no: number,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Claim number could not be saved.');
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


export type PartnerClaimStageKey =
  | 'spot_status'
  | 'claim_intimation'
  | 'work_approval'
  | 'repair_ri'
  | 'billing'
  | 'delivery_order'
  | 'vehicle_delivery'
  | 'payment_encashment';

export async function savePartnerClaimStage(
  claimId: string,
  milestoneKey: PartnerClaimStageKey,
  details: Record<string, string | number | boolean>,
  advance = true,
) {
  const { data, error } = await supabase.rpc('partner_app_save_claim_stage', {
    p_claim_id: claimId,
    p_milestone_key: milestoneKey,
    p_details: details,
    p_advance: advance,
  });
  if (error) throw error;
  if (!data || data.ok !== true) throw new Error('Claim stage was not saved.');
  return data as { ok: true; current_status: string };
}

export async function attachPartnerClaimDocument(input: {
  claimId: string;
  documentType: string;
  fileName: string;
  storagePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  milestoneKey?: string | null;
}) {
  const { data, error } = await supabase.rpc('partner_app_attach_claim_document', {
    p_claim_id: input.claimId,
    p_document_type: input.documentType,
    p_file_name: input.fileName,
    p_storage_path: input.storagePath,
    p_mime_type: input.mimeType ?? null,
    p_file_size: input.fileSize ?? null,
    p_milestone_key: input.milestoneKey ?? null,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Claim document was not attached.');
  return data;
}

/** Delete only an authorized claim document; the database RPC verifies claim scope and uploader. */
export async function removePartnerClaimDocument(claimId: string, documentId: string) {
  const { data, error } = await supabase.rpc('partner_app_remove_claim_document', {
    p_claim_id: claimId,
    p_document_id: documentId,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Document deletion was not confirmed.');
  // The server removes the metadata first. Storage cleanup is best-effort;
  // failure must not restore an already-deleted document to the UI.
  const result = await supabase.storage.from('claim-documents').remove([data]);
  if (result.error) console.warn('Claim document storage cleanup could not finish', result.error.message);
}
