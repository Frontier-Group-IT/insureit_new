import { getCurrentSession } from '@/lib/auth';

export type CustomerRcPolicyDetails = {
  insuranceCompany: string | null;
  policyNumber: string | null;
  policyEndDate: string | null;
};

type CustomerRcPolicyResponse = {
  status?: 'success';
  source?: 'local_cache';
  isStale?: boolean;
  lookedUpAt?: string | null;
  details?: CustomerRcPolicyDetails;
  error?: string;
};

export async function lookupCustomerRcPolicyDetails(registrationNumber: string): Promise<CustomerRcPolicyResponse & { status: 'success'; details: CustomerRcPolicyDetails }> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Please sign in again to fetch insurance details.');

  const portalUrl = String(process.env.EXPO_PUBLIC_PORTAL_URL ?? 'https://portal.insureit.in').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${portalUrl}/api/customer/rc-policy-details`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ registrationNumber }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as CustomerRcPolicyResponse;
    if (!response.ok || payload.status !== 'success' || !payload.details) {
      throw new Error(payload.error || 'Insurance details could not be loaded.');
    }

    return { ...payload, status: 'success', details: payload.details };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Insurance details are taking longer than usual.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
