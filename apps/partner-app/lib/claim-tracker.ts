import type { PartnerClaimDetail } from '@/lib/claims';

export const CLAIM_STAGES = [
  { key: 'spot_intimation', label: 'Spot Intimation' },
  { key: 'spot_status', label: 'Spot Status' },
  { key: 'claim_intimation', label: 'Claim Intimation' },
  { key: 'work_approval', label: 'Work Approval' },
  { key: 'repair_ri', label: 'Repair & RI' },
  { key: 'billing', label: 'Billing' },
  { key: 'delivery_order', label: 'Delivery Order' },
  { key: 'vehicle_delivery', label: 'Vehicle Delivery' },
  { key: 'payment_encashment', label: 'Payment Encashment' },
] as const;

export type ClaimStageKey = (typeof CLAIM_STAGES)[number]['key'];
const normalize = (value: string | null | undefined) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function getClaimTrackerState(data: PartnerClaimDetail) {
  const status = normalize(data.claim.current_status);
  // Existing Partner RPC contains broker status history, not the customer milestone table.
  // Project only recognized statuses. Never equate the number of history events with completed stages.
  const rules: Array<[RegExp, number]> = [
    [/claim complete|settled|closed/, 9],
    [/payment stage|payment encashment|claim completion in progress/, 8],
    [/vehicle deliver/, 7],
    [/delivery order/, 6],
    [/billing|invoice/, 5],
    [/repair|ri stage/, 4],
    [/work approval/, 3],
    [/claim intimation|final document|final survey/, 2],
    [/spot status|surveyor|spot survey|spot deputation/, 1],
    [/spot intimation|initial document|accident reported|draft/, 0],
  ];
  const matched = rules.find(([pattern]) => pattern.test(status));
  const completed = matched?.[1] ?? 0;
  const index = Math.min(completed, 8);
  return { index, current: CLAIM_STAGES[index], progress: Math.round(completed / 9 * 100), substage: data.claim.current_status || 'Status pending', completed };
}

export function formatClaimDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function getStageHistory(data: PartnerClaimDetail, key: ClaimStageKey) {
  const aliases: Record<ClaimStageKey, RegExp> = {
    spot_intimation: /spot intimation|initial document|accident reported|draft/,
    spot_status: /spot status|surveyor|spot survey|spot deputation/,
    claim_intimation: /claim intimation|final document|final survey/,
    work_approval: /work approval/,
    repair_ri: /repair|ri stage/,
    billing: /billing|invoice/,
    delivery_order: /delivery order/,
    vehicle_delivery: /vehicle deliver/,
    payment_encashment: /payment|settled|claim complete/,
  };
  const match = aliases[key];
  return [
    ...data.stages.map(item => ({ id: `stage-${item.id}`, label: item.stage, date: item.created_at })),
    ...data.status_history.map(item => ({ id: `status-${item.id}`, label: item.to_status || '', date: item.created_at })),
  ].filter(item => match.test(normalize(item.label))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
