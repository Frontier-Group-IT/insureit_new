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

export type PolicyIntakeReviewAccess = { can_review: boolean; can_finalize: boolean };

export type PartnerPolicyIntake = {
  id: string;
  intake_number: string;
  status: string;
  policy_type: PartnerPolicyType | null;
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

export type PartnerIntakeFilter = 'action_required' | 'in_review' | 'processing' | 'completed' | 'duplicate' | 'rejected' | 'all';
export type PartnerIntakeCounts = Record<PartnerIntakeFilter, number>;

type IntakeListResponse = {
  ok: true;
  intakes: PartnerPolicyIntake[];
  total: number;
  counts?: PartnerIntakeCounts;
};

type IntakeSourcesResponse = {
  ok: true;
  sources: PartnerPolicyIntakeSource[];
};

type PreparedUpload = {
  ok: true;
  id: string;
  number: string;
  storage_path: string;
  signed_url: string;
};

export type PartnerPolicyType = 'motor' | 'non_motor' | 'life' | 'health';

export type PartnerPolicyIntakeUploadProgress = {
  stage: 'preparing' | 'uploading' | 'submitting';
  percent?: number;
};

export const POLICY_INTAKE_PAGE_SIZE = 10;

/** Read a single permission-scoped page. Never block initial rendering on older pages. */
export async function listPartnerPolicyIntakesPage(
  offset = 0,
  filter: PartnerIntakeFilter = 'all',
  search = '',
  includeCounts = offset === 0 && filter === 'all' && !search,
): Promise<IntakeListResponse> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid Policy Intake page offset.');
  const params = new URLSearchParams({
    view: 'mobile_list',
    filter,
    limit: String(POLICY_INTAKE_PAGE_SIZE),
    offset: String(offset),
  });
  if (search.trim()) params.set('search', search.trim().slice(0, 120));
  if (includeCounts) params.set('include_counts', 'true');
  const page = await apiRequest<IntakeListResponse>(`/api/partner/policy-intakes?${params.toString()}`);
  if (!Array.isArray(page.intakes) || typeof page.total !== 'number' || !Number.isFinite(page.total) || page.total < 0) {
    throw new Error('Policy Intake response was incomplete. Please retry.');
  }
  if (includeCounts && (!page.counts || !(['all', 'action_required', 'in_review', 'processing', 'completed', 'duplicate', 'rejected'] as const)
    .every((key) => typeof page.counts?.[key] === 'number' && Number.isFinite(page.counts?.[key]) && (page.counts?.[key] ?? -1) >= 0))) {
    throw new Error('Policy Intake status counts could not be loaded. Please retry.');
  }
  return page;
}

/** Fetch the selected authorized intake directly; details must never require the entire list. */
export async function getPartnerPolicyIntake(id: string): Promise<PartnerPolicyIntake & { review_access: PolicyIntakeReviewAccess }> {
  if (!id) throw new Error('Policy Intake reference is missing.');
  const result = await apiRequest<{ ok: true; intake: PartnerPolicyIntake; review_access: PolicyIntakeReviewAccess }>(
    `/api/partner/policy-intakes?id=${encodeURIComponent(id)}`,
  );
  return { ...result.intake, review_access: result.review_access ?? { can_review: false, can_finalize: false } };
}

/** Same Operations notes and transition statuses, guarded by server-side reviewer permission. */
export async function updatePartnerPolicyIntakeReview(
  id: string,
  status: 'needs_attention' | 'rejected',
  reason: string,
): Promise<void> {
  await apiRequest<{ ok: true }>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({ action: 'review_status', id, status, reason }),
  });
}

/** Opens the canonical Operations Review/Onboarding flow without passing auth credentials in the URL. */
export function partnerPolicyIntakeReviewUrl(id: string): string {
  return `${portalUrl}/policy-intakes/${encodeURIComponent(id)}`;
}

export async function listPartnerPolicyIntakeSources(): Promise<PartnerPolicyIntakeSource[]> {
  const result = await apiRequest<IntakeSourcesResponse>('/api/partner/policy-intakes?view=sources');
  return Array.isArray(result.sources) ? result.sources : [];
}

export async function submitPartnerPolicyIntake(input: {
  leadSourceId?: string;
  policyType: PartnerPolicyType;
  customerMobile: string;
  file?: DocumentPickerAsset | null;
  onProgress?: (progress: PartnerPolicyIntakeUploadProgress) => void;
}) {
  const proposalForm = input.policyType === 'life' || input.policyType === 'health';

  if (!input.file) {
    if (!proposalForm) throw new Error('Upload the policy PDF or image.');
    input.onProgress?.({ stage: 'submitting' });
    return apiRequest<{ ok: true; id: string; number: string; status: 'ready_for_review' }>('/api/partner/policy-intakes', {
      method: 'POST',
      body: JSON.stringify({
        action: 'submit_without_proposal',
        lead_source_id: input.leadSourceId,
        policy_type: input.policyType,
        customer_mobile: input.customerMobile,
      }),
    });
  }

  const meta = fileMeta(input.file);
  input.onProgress?.({ stage: 'preparing' });

  const prepared = await apiRequest<PreparedUpload>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({
      action: 'prepare',
      lead_source_id: input.leadSourceId,
      policy_type: input.policyType,
      customer_mobile: input.customerMobile,
      file: meta,
    }),
  });

  input.onProgress?.({ stage: 'uploading', percent: 0 });
  await uploadSigned(prepared.signed_url, input.file, (percent) => {
    input.onProgress?.({ stage: 'uploading', percent });
  });

  input.onProgress?.({ stage: 'submitting' });
  return apiRequest<{ ok: true; id: string; number: string; status: 'processing' | 'ready_for_review' }>('/api/partner/policy-intakes', {
    method: 'POST',
    body: JSON.stringify({
      action: 'complete',
      id: prepared.id,
      number: prepared.number,
      lead_source_id: input.leadSourceId,
      policy_type: input.policyType,
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
  return apiRequest<{ ok: true; id: string; number: string; status: 'processing' | 'ready_for_review' }>('/api/partner/policy-intakes', {
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

  let response: Response;
  try {
    response = await fetch(`${portalUrl}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Network connection failed. Check your internet and try again.');
  }

  const payload = await response.json().catch(() => null) as ({ ok?: boolean; error?: string } & Partial<T>) | null;
  if (!response.ok || !payload?.ok) {
    // Keep diagnostics free of tokens, phone numbers, customer data and URL parameters.
    if (path.startsWith('/api/partner/policy-intakes?')) {
      const offset = new URLSearchParams(path.split('?')[1] ?? '').get('offset') ?? '0';
      console.warn('[partner-policy-intakes] read failed', { status: response.status, offset, category: !response.ok ? 'http' : 'invalid-response' });
    }
    if (response.status === 401 || response.status === 403) throw new Error('Your Partner session or access needs refreshing. Sign in again.');
    if (response.status === 429) throw new Error('Too many requests. Please retry shortly.');
    if (response.status >= 500) throw new Error('Policy Intake server is temporarily unavailable. Please retry.');
    throw new Error(payload?.error || `Policy Intake request failed (HTTP ${response.status}).`);
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
