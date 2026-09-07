import { getCurrentSession } from '@/lib/auth';

export type CustomerRcLookupDetails = {
  registrationNumber: string;
  registrationDate: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturingYear: string | null;
  vehicleClass: string | null;
  fuelType: string | null;
  engineCapacityCc: string | null;
  seatingCapacity: string | null;
  gvwKg: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  fitnessExpiryDate: string | null;
  pucExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  nationalPermitExpiryDate: string | null;
  localPermitExpiryDate: string | null;
};

type CustomerRcLookupResponse = {
  status?: 'success';
  provider?: 'authbridge';
  source?: 'local_cache' | 'authbridge';
  isStale?: boolean;
  transactionId?: string | null;
  lookedUpAt?: string | null;
  details?: CustomerRcLookupDetails;
  error?: string;
};

type CustomerRcLookupSuccessResponse = Omit<CustomerRcLookupResponse, 'status' | 'details'> & {
  status: 'success';
  details: CustomerRcLookupDetails;
};

export async function lookupCustomerRc(registrationNumber: string): Promise<CustomerRcLookupSuccessResponse> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Please sign in again to fetch vehicle details.');

  const portalUrl = String(process.env.EXPO_PUBLIC_PORTAL_URL ?? 'https://portal.insureit.in').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);

  try {
    const response = await fetch(`${portalUrl}/api/customer/rc-lookup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ registrationNumber }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as CustomerRcLookupResponse;
    if (!response.ok || payload.status !== 'success' || !payload.details) {
      throw new Error(payload.error || 'We could not fetch the vehicle details. You can continue manually.');
    }

    return {
      ...payload,
      status: 'success',
      details: payload.details,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Vehicle details are taking longer than usual. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
