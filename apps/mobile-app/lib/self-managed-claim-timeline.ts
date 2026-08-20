import { SELF_MANAGED_MILESTONES, type ClaimMilestone, type ClaimMilestoneKey } from '@/lib/claim-service-mode';

export type TimelineMilestone = Pick<ClaimMilestone, 'milestone_key' | 'milestone_status' | 'details' | 'completed_at'>;

const DATE_FIELD_BY_STAGE: Partial<Record<ClaimMilestoneKey, string>> = {
  spot_status: 'spot_survey_done_date',
  claim_intimation: 'claim_intimation_date',
  work_approval: 'approval_received_date',
  billing: 'bill_date',
  delivery_order: 'do_date',
  vehicle_delivery: 'vehicle_received_date',
  payment_encashment: 'payment_received_date',
};

const AMOUNT_FIELD_BY_STAGE: Partial<Record<ClaimMilestoneKey, string>> = {
  claim_intimation: 'estimate_amount',
  billing: 'bill_amount',
  delivery_order: 'do_amount',
  payment_encashment: 'payment_received_amount',
};

export const STAGE_DATE_LABELS: Record<ClaimMilestoneKey, string> = {
  spot_intimation: 'Intimated',
  spot_status: 'Survey completed',
  claim_intimation: 'Claim intimated',
  work_approval: 'Approval received',
  repair_ri: 'Repair / RI completed',
  billing: 'Bill dated',
  delivery_order: 'DO issued',
  vehicle_delivery: 'Vehicle received',
  payment_encashment: 'Payment received',
};

export function stageBusinessDateValue(milestone: TimelineMilestone | null | undefined): string | null {
  if (!milestone) return null;
  const details = detailRecord(milestone.details);
  if (milestone.milestone_key === 'spot_intimation') return stringValue(details.spot_intimation_at);
  if (milestone.milestone_key === 'repair_ri') {
    return stringValue(details.ri_required) === 'yes' && stringValue(details.ri_done_date)
      ? stringValue(details.ri_done_date)
      : stringValue(details.repair_complete_date);
  }
  const field = DATE_FIELD_BY_STAGE[milestone.milestone_key];
  return field ? stringValue(details[field]) : null;
}

export function stageBusinessDateOnly(milestone: TimelineMilestone | null | undefined): string | null {
  const value = stageBusinessDateValue(milestone);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return localIsoDate(date);
}

export function stageMainAmount(milestone: TimelineMilestone | null | undefined): number | null {
  if (!milestone) return null;
  const field = AMOUNT_FIELD_BY_STAGE[milestone.milestone_key];
  if (!field) return null;
  const raw = detailRecord(milestone.details)[field];
  const amount = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

export function formatJourneyDate(milestone: TimelineMilestone | null | undefined): string {
  const value = stageBusinessDateValue(milestone);
  if (!value) return 'Date not recorded';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateOnly(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }).replace(',', ' ·');
}

export function formatJourneyAmount(amount: number | null): string | null {
  if (amount === null) return null;
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function validateStageChronology(
  key: ClaimMilestoneKey,
  candidateDate: string | null,
  milestones: TimelineMilestone[],
): string | null {
  if (!candidateDate) return null;
  const index = SELF_MANAGED_MILESTONES.findIndex((stage) => stage.key === key);
  if (index < 0) return null;

  const candidate = dateComparable(candidateDate);
  if (!candidate) return 'Enter a valid stage date.';

  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const previousMilestone = milestones.find((item) => item.milestone_key === SELF_MANAGED_MILESTONES[previous].key);
    const previousDate = stageBusinessDateOnly(previousMilestone);
    if (!previousDate) continue;
    if (candidate < previousDate) return `${SELF_MANAGED_MILESTONES[index].label} cannot be earlier than ${SELF_MANAGED_MILESTONES[previous].label}.`;
    break;
  }

  for (let next = index + 1; next < SELF_MANAGED_MILESTONES.length; next += 1) {
    const nextMilestone = milestones.find((item) => item.milestone_key === SELF_MANAGED_MILESTONES[next].key);
    const nextDate = stageBusinessDateOnly(nextMilestone);
    if (!nextDate) continue;
    if (candidate > nextDate) return `${SELF_MANAGED_MILESTONES[index].label} cannot be later than the recorded ${SELF_MANAGED_MILESTONES[next].label} date.`;
    break;
  }
  return null;
}

export function detailRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function localIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateComparable(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localIsoDate(date);
}
