import { supabase } from '@/lib/supabase';

export type PartnerHomeData = {
  generated_at: string;
  business: {
    premium_this_month: number | string;
    premium_last_month: number | string;
    premium_change_percent: number | string;
    policies_this_month: number;
    active_policies: number;
    total_customers: number;
    customers_this_month: number;
    renewals_7_days: number;
    renewals_30_days: number;
    overdue_policies: number;
    renewal_premium_7_days: number | string;
    renewal_premium_30_days: number | string;
  };
  service: {
    active_claims: number;
    claims_need_attention: number;
    claims_updated_today: number;
    intakes_need_attention: number;
    intakes_in_progress: number;
  };
  impact: {
    active_vehicles: number;
    customers_served: number;
    claims_assisted: number;
    claim_settlement_value: number | string;
    active_motor_idv: number | string;
  };
  pulse: {
    business_momentum: 'rising' | 'steady' | 'slower';
    renewal_readiness: 'clear' | 'attention';
    service_status: 'steady' | 'attention';
    action_status: 'clear' | 'attention';
  };
  today: {
    kind: 'intake_attention' | 'renewal' | 'claim';
    title: string;
    subtitle: string;
    count: number;
    route: string;
  }[];
};

export async function getPartnerHome() {
  const { data, error } = await supabase.rpc('partner_app_home');
  if (error) throw error;
  if (!data) throw new Error('Partner Home is unavailable.');
  return data as PartnerHomeData;
}

export type PartnerBusinessRangeSummary = {
  generated_at: string;
  from_date: string;
  to_date: string;
  premium: number | string;
  gross_premium: number | string;
  net_premium: number | string;
  premium_previous_period: number | string;
  premium_change_percent: number | string;
  policies: number;
  commission_available?: boolean;
  commission_earned?: number | string | null;
  projected_retention?: number | string | null;
  scoped_payout?: number | string | null;
  customers: number;
  renewals: number;
  claims: number;
};

// The scoped payout RPC enforces a maximum 366-day window. Split long
// ranges without changing database permissions or removing that safeguard.
function payoutWindows(fromDate: string, toDate: string) {
  const windows: Array<{ from: string; to: string }> = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const last = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= last) {
    const from = cursor.toISOString().slice(0, 10);
    const end = new Date(cursor.getTime());
    end.setUTCDate(end.getUTCDate() + 365);
    if (end > last) end.setTime(last.getTime());
    windows.push({ from, to: end.toISOString().slice(0, 10) });
    cursor.setTime(end.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return windows;
}

async function getScopedPayout(fromDate: string, toDate: string) {
  const windows = payoutWindows(fromDate, toDate);
  // Limit concurrent authenticated RPCs to avoid a burst for All history.
  let total = 0;
  for (let index = 0; index < windows.length; index += 4) {
    const batch = await Promise.all(windows.slice(index, index + 4).map(async (window) => {
      const { data, error } = await supabase.rpc('partner_app_scoped_payout_range', {
        p_from_date: window.from,
        p_to_date: window.to,
      });
      if (error) throw error;
      return data == null ? null : Number(data);
    }));
    if (batch.every((value) => value === null)) return null;
    total += batch.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  }
  return total;
}

export async function getPartnerBusinessRange(fromDate: string, toDate: string) {
  const { data, error } = await supabase.rpc('partner_app_business_range_v2', {
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  if (!data) throw new Error('Business summary is unavailable for this date range.');
  const summary = data as PartnerBusinessRangeSummary;
  // Optional commercial metrics must never hide valid premium/policy totals.
  const [payoutResult, retentionResult] = await Promise.allSettled([
    summary.commission_available ? getScopedPayout(fromDate, toDate) : Promise.resolve(null),
    supabase.rpc('partner_app_projected_retention_range', {
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  ]);
  const retention = retentionResult.status === 'fulfilled' && !retentionResult.value.error
    ? retentionResult.value.data : null;
  return {
    ...summary,
    projected_retention: retention as number | string | null,
    scoped_payout: payoutResult.status === 'fulfilled' ? payoutResult.value : null,
  };
}
