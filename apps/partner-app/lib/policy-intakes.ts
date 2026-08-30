import type { DocumentPickerAsset } from 'expo-document-picker';
import { Platform } from 'react-native';

import { getCurrentSession } from '@/lib/partner-session';

const portalUrl = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');

export type PartnerPolicyIntakeSource = {
  id: string;
  intermediary_type: 'partner' | 'posp' | 'misp';
  display_name: string;
  intermediary_code: string | null;
  account_status: string;
};

export type PartnerPolicyIntake = {
  id: string;
  intake_number: string;
  status: string;
  lead_source_name: string;
  lead_source_type: string;
  lead_source_code: string | null;
  customer_mobile: string;
  file_name: string;
  ocr_status: string;
  ocr_fields: Array<{ key: string; label: string; value: string; confidence?: number | null }>;
  attention_reason: string | null;
  created_at: string;
  updated_at: string;
  final_policy_id: string | null;
};

type IntakeListResponse = {
  ok: true;
  intakes: PartnerPolicyIntake[];
  sources: PartnerPolicyIntakeSource[];
};

type PreparedUpload = {
  ok: true;
  id: string;
  number: string;
  storage_path: string;
  signed_url: string;
};

export type PartnerPolicyIntakeUploadProgress = {
  stage: 'preparing' | 'uploading' | 'submitting';
  percent?: number;
};

export async function listPartnerPolicyIntakes(): Promise<IntakeListResponse> {
  return apiRequest<IntakeListResponse>('/api/partner/policy-intakes');
}

export async function submitPartnerPolicyIntake(input: {
  leadSourceId?: string;
  customerMobile: string;
  file: DocumentPickerAsset;
  onProgress?: (progress: PartnerPolicyIntakeUploadProgress) => void;
}) {
  const meta = fileMeta(input.file);
  input.onProgress?.({ stage: 'preparing' });

  const prepared = await apiRequest<PreparedUpload>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({
      action: 'prepare',
      lead_source_id: input.leadSourceId,
      customer_mobile: input.customerMobile,
      file: meta,
    }),
  });

  input.onProgress?.({ stage: 'uploading', percent: 0 });
  await uploadSigned(prepared.signed_url, input.file, (percent) => {
    input.onProgress?.({ stage: 'uploading', percent });
  });

  input.onProgress?.({ stage: 'submitting' });
  return apiRequest<{ ok: true; id: string; number: string; status: 'processing' }>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({
      action: 'complete',
      id: prepared.id,
      number: prepared.number,
      lead_source_id: input.leadSourceId,
      customer_mobile: input.customerMobile,
      storage_path: prepared.storage_path,
      file: meta,
    }),
  });
}

export async function submitPartnerPolicyIntakeReplacement(input: {
  intakeId: string;
  file: DocumentPickerAsset;
  onProgress?: (progress: PartnerPolicyIntakeUploadProgress) => void;
}) {
  const meta = fileMeta(input.file);
  input.onProgress?.({ stage: 'preparing' });

  const prepared = await apiRequest<PreparedUpload>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({
      action: 'prepare_response',
      id: input.intakeId,
      file: meta,
    }),
  });

  input.onProgress?.({ stage: 'uploading', percent: 0 });
  await uploadSigned(prepared.signed_url, input.file, (percent) => {
    input.onProgress?.({ stage: 'uploading', percent });
  });

  input.onProgress?.({ stage: 'submitting' });
  return apiRequest<{ ok: true; id: string; number: string; status: 'processing' }>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({
      action: 'complete_response',
      id: input.intakeId,
      storage_path: prepared.storage_path,
      file: meta,
    }),
  });
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

  const response = await fetch(`${portalUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null) as ({ ok?: boolean; error?: string } & Partial<T>) | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Policy Intake request failed.');
  }
  return payload as T;
}

function fileMeta(file: DocumentPickerAsset) {
  return {
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
    size: file.size || 0,
  };
}

async function uploadSigned(
  signedUrl: string,
  file: DocumentPickerAsset,
  onProgress?: (percent: number) => void,
) {
  const formData = new FormData();
  formData.append('cacheControl', '3600');

  const webFile = (file as DocumentPickerAsset & { file?: File }).file;
  if (Platform.OS === 'web' && webFile) {
    formData.append('', webFile);
  } else {
    formData.append('', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', signedUrl);
    request.setRequestHeader('x-upsert', 'false');

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress?.(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
    };

    request.onerror = () => reject(new Error('The policy copy could not be uploaded. Check your connection and try again.'));
    request.ontimeout = () => reject(new Error('The policy copy upload timed out. Please try again.'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error('The policy copy could not be uploaded.'));
      }
    };

    request.timeout = 120000;
    request.send(formData);
  });
}
