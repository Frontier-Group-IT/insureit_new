import { supabase } from '@/lib/supabase';

/** Policy documents use the same scoped Supabase RPC + signed storage URL pattern as Case Register. */
export type PartnerPolicyDocument = {
  id: string;
  source: 'policy' | 'life_health';
  type: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};
type DocumentStorageRef = { bucket: 'policy-documents' | 'customer-documents'; path: string };
export async function listPartnerPolicyDocuments(policyId: string): Promise<PartnerPolicyDocument[]> {
  const { data, error } = await supabase.rpc('partner_app_policy_documents', { p_policy_id: policyId });
  if (error) throw new Error(error.code === '42501' ? 'Policy documents are not available in your Partner account.' : 'Unable to load policy documents. Please retry.');
  if (!Array.isArray(data)) throw new Error('Policy document inventory is unavailable. Please retry.');
  return data.filter((item): item is PartnerPolicyDocument =>
    Boolean(item) && typeof item === 'object' && typeof item.id === 'string' &&
    (item.source === 'policy' || item.source === 'life_health') &&
    typeof item.type === 'string' && typeof item.name === 'string');
}

export async function openPartnerPolicyDocument(policyId: string, document: PartnerPolicyDocument, download = false): Promise<string> {
  const { data, error } = await supabase.rpc('partner_app_policy_document_preview_ref', {
    p_policy_id: policyId,
    p_document_id: document.id,
    p_source: document.source,
  });
  if (error) throw new Error('This document is not available in your Partner scope.');
  const ref = data as DocumentStorageRef | null;
  if (!ref || !['policy-documents', 'customer-documents'].includes(ref.bucket) ||
    typeof ref.path !== 'string' || !ref.path) throw new Error('A secure policy document reference is unavailable.');
  const { data: signed, error: signError } = await supabase.storage.from(ref.bucket).createSignedUrl(
    ref.path, 120, download ? { download: document.name } : {},
  );
  if (signError || !signed?.signedUrl) throw new Error('Unable to create a secure document link. Please retry.');
  return signed.signedUrl;
}
