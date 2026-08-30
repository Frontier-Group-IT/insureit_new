import * as SecureStore from 'expo-secure-store';

import { getCurrentSession } from '@/lib/partner-session';

export type PartnerPolicyIntakeDraft = {
  leadSourceId: string;
  customerMobile: string;
  updatedAt: string;
};

async function key() {
  const session = await getCurrentSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  return `insureit-partner:policy-intake-draft:${userId}`;
}

export async function loadPartnerPolicyIntakeDraft(): Promise<PartnerPolicyIntakeDraft | null> {
  const storageKey = await key();
  if (!storageKey) return null;
  const raw = await SecureStore.getItemAsync(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PartnerPolicyIntakeDraft;
  } catch {
    await SecureStore.deleteItemAsync(storageKey);
    return null;
  }
}

export async function savePartnerPolicyIntakeDraft(input: {
  leadSourceId: string;
  customerMobile: string;
}) {
  const storageKey = await key();
  if (!storageKey) return;
  const draft: PartnerPolicyIntakeDraft = {
    leadSourceId: input.leadSourceId,
    customerMobile: input.customerMobile,
    updatedAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(storageKey, JSON.stringify(draft));
}

export async function clearPartnerPolicyIntakeDraft() {
  const storageKey = await key();
  if (!storageKey) return;
  await SecureStore.deleteItemAsync(storageKey);
}
