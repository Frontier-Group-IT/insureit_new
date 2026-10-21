import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';

export type PartnerClaimUploadCategory =
  | 'RC Copy' | 'Insurance Copy' | 'Driver Licence' | 'GR / Load Bill'
  | 'Accident Photo' | 'Accident Video' | 'Incident Voice Note'
  | 'Spot Report' | 'Claim Form' | 'Estimate Copy' | 'Other';

export async function pickAndUploadPartnerClaimDocument(claimId: string, category: PartnerClaimUploadCategory) {
  const selection=await DocumentPicker.getDocumentAsync({
    type:category==='Accident Video'?'video/*':category==='Incident Voice Note'?'audio/*':category==='Accident Photo'?'image/*':['application/pdf','image/*'],
    copyToCacheDirectory:true,
    multiple:false,
  });
  if(selection.canceled||!selection.assets?.[0]) return null;
  const file=selection.assets[0];
  const mime=file.mimeType||'application/octet-stream';
  const max=category==='Accident Video'?20*1024*1024:5*1024*1024;
  if(file.size && file.size>max) throw new Error('Selected file exceeds the upload size limit.');
  const form=new FormData();
  form.append('claim_id',claimId);
  form.append('category',category);
  // React Native FormData file parts require a URI rather than browser File.
  form.append('file',{uri:file.uri,name:file.name||'attachment',type:mime} as unknown as Blob);
  const {data,error}=await supabase.functions.invoke('partner-claim-document',{body:form});
  if(error) throw error;
  if(!data?.ok||!data?.id) throw new Error(typeof data?.error==='string'?data.error:'Document upload failed.');
  return String(data.id);
}

export async function getPartnerClaimDocumentUrl(documentId: string): Promise<string> {
  const {data,error}=await supabase.functions.invoke('partner-claim-document',{body:{action:'signed_url',document_id:documentId}});
  if(error) throw error;
  if(typeof data?.url!=='string'||!data.url.startsWith('https://')) throw new Error('Document link unavailable');
  return data.url;
}
