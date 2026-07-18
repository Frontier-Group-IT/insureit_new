import type { Policy, Vehicle } from './types';

export const RENEWAL_DUE_WINDOW_DAYS = 45;

export type ComplianceDocumentKey =
  | 'insurance_policy'
  | 'national_permit'
  | 'local_permit'
  | 'road_tax'
  | 'puc'
  | 'fitness'
  | 'dl';

export type ComplianceDocumentSummary = {
  key: ComplianceDocumentKey;
  title: string;
  due: number;
  expired: number;
  totalPending: number;
  tracked: boolean;
};

export type ComplianceRenewalItem = {
  id: string;
  key: ComplianceDocumentKey;
  title: string;
  vehicleId: string;
  vehicleNo: string;
  customerId: string;
  customerName: string;
  expiryDate: string;
  daysUntil: number;
  status: 'due' | 'expired';
  meta?: string;
};

type CustomerNameMap = Map<string, string>;

const trackedDocuments: Array<{
  key: ComplianceDocumentKey;
  title: string;
  getExpiry: (vehicle: Vehicle, latestPolicy?: Policy | null) => string | null | undefined;
  getMeta?: (vehicle: Vehicle, latestPolicy?: Policy | null) => string | undefined;
}> = [
  { key: 'insurance_policy', title: 'Insurance Policy', getExpiry: (_vehicle, policy) => policy?.end_date, getMeta: (_vehicle, policy) => policy?.policy_no ?? undefined },
  { key: 'national_permit', title: 'National permit', getExpiry: (vehicle) => vehicle.national_permit_expiry_date, getMeta: (vehicle) => vehicle.permit_no ?? undefined },
  { key: 'local_permit', title: 'Local permit', getExpiry: (vehicle) => vehicle.local_permit_expiry_date, getMeta: (vehicle) => vehicle.permit_no ?? undefined },
  { key: 'road_tax', title: 'Road tax', getExpiry: (vehicle) => vehicle.road_tax_expiry_date },
  { key: 'puc', title: 'PUC', getExpiry: (vehicle) => vehicle.puc_expiry_date },
  { key: 'fitness', title: 'Fitness', getExpiry: (vehicle) => vehicle.fitness_expiry_date },
];

const allDocuments: Array<{ key: ComplianceDocumentKey; title: string; tracked: boolean }> = [
  ...trackedDocuments.map((document) => ({ key: document.key, title: document.title, tracked: true })),
  { key: 'dl', title: "Driver's Licence", tracked: false },
];

export function buildComplianceRenewals(input: {
  vehicles: Vehicle[];
  policies: Policy[];
  customerNames?: CustomerNameMap;
  now?: Date;
}) {
  const now = startOfDay(input.now ?? new Date());
  const latestPolicies = latestPolicyByVehicle(input.policies);
  const items: ComplianceRenewalItem[] = [];
  const summaryMap = new Map<ComplianceDocumentKey, ComplianceDocumentSummary>();

  for (const document of allDocuments) {
    summaryMap.set(document.key, {
      key: document.key,
      title: document.title,
      due: 0,
      expired: 0,
      totalPending: 0,
      tracked: document.tracked,
    });
  }

  for (const vehicle of input.vehicles) {
    const latestPolicy = latestPolicies.get(vehicle.id);
    for (const document of trackedDocuments) {
      const expiryDate = document.getExpiry(vehicle, latestPolicy);
      if (!expiryDate) continue;
      const days = daysUntil(expiryDate, now);
      const status = days < 0 ? 'expired' : days <= RENEWAL_DUE_WINDOW_DAYS ? 'due' : null;
      if (!status) continue;
      const summary = summaryMap.get(document.key);
      if (!summary) continue;
      if (status === 'expired') summary.expired += 1;
      else summary.due += 1;
      summary.totalPending += 1;
      items.push({
        id: `${document.key}:${vehicle.id}:${expiryDate}`,
        key: document.key,
        title: document.title,
        vehicleId: vehicle.id,
        vehicleNo: vehicle.vehicle_no,
        customerId: vehicle.customer_id,
        customerName: input.customerNames?.get(vehicle.customer_id) ?? 'Customer account',
        expiryDate,
        daysUntil: days,
        status,
        meta: document.getMeta?.(vehicle, latestPolicy),
      });
    }
  }

  const summaries = allDocuments.map((document) => summaryMap.get(document.key)).filter((summary): summary is ComplianceDocumentSummary => Boolean(summary));
  return {
    summaries,
    items: items.sort((left, right) => left.daysUntil - right.daysUntil),
    totalPending: summaries.reduce((total, summary) => total + summary.totalPending, 0),
  };
}

function latestPolicyByVehicle(policies: Policy[]) {
  const result = new Map<string, Policy>();
  for (const policy of policies) {
    const current = result.get(policy.vehicle_id);
    if (!current || new Date(policy.end_date).getTime() > new Date(current.end_date).getTime()) {
      result.set(policy.vehicle_id, policy);
    }
  }
  return result;
}

function daysUntil(value: string, now: Date) {
  return Math.ceil((startOfDay(new Date(`${value}T00:00:00`)).getTime() - now.getTime()) / 86400000);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
