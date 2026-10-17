import { supabase } from '@/lib/supabase';

export type PartnerWeeklyStory = {
  generated_at: string;
  week_start: string;
  week_end: string;
  policies_this_week: number;
  premium_this_week: number | string;
  policies_last_week: number;
  premium_last_week: number | string;
  premium_change_percent: number | string;
  customers_this_week: number;
  claims_progressed_this_week: number;
  renewals_next_week: number;
  renewal_premium_next_week: number | string;
};

export type PartnerRecognition = {
  generated_at: string;
  items: {
    code: string;
    title: string;
    body: string;
    tone: 'journey' | 'learn' | 'clear';
    icon: 'trail' | 'learn' | 'renewal';
    date?: string;
  }[];
  next_milestone: {
    kind: string;
    current: number;
    target: number;
    remaining: number;
    title: string;
  } | null;
};

export type PartnerSupport = {
  generated_at: string;
  relationship_contact: {
    employee_id: string;
    name: string;
    employee_code: string | null;
    designation: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  operations: {
    intakes_in_progress: number;
    intakes_need_attention: number;
    active_claims: number;
  };
};

export type PartnerActivityData = {
  generated_at: string;
  attention: {
    kind: string;
    title: string;
    subtitle: string;
    route: string;
    count: number;
  }[];
  items: {
    kind: 'policy' | 'claim' | 'intake' | 'learn';
    entity_id: string;
    event_at: string;
    title: string;
    subtitle: string;
    meta: string;
    route: string;
    tone: 'business' | 'service' | 'attention' | 'operations' | 'learn';
  }[];
};

export type PartnerActivityItem = PartnerActivityData['items'][number];

export function partnerActivityEventKey(item: PartnerActivityItem) {
  return [item.kind, item.entity_id, item.event_at].join(':');
}

export async function getPartnerActivityReadKeys(items: PartnerActivityItem[]) {
  const eventKeys = Array.from(new Set(items.map(partnerActivityEventKey)));
  if (!eventKeys.length) return new Set<string>();

  const { data, error } = await supabase
    .from('partner_activity_read_receipts')
    .select('event_key')
    .in('event_key', eventKeys);

  if (error) throw error;
  return new Set((data ?? []).map((row) => String(row.event_key)));
}

export async function markPartnerActivityRead(item: PartnerActivityItem) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) throw authError ?? new Error('Partner session is unavailable.');

  const { error } = await supabase
    .from('partner_activity_read_receipts')
    .upsert({
      auth_user_id: authData.user.id,
      event_key: partnerActivityEventKey(item),
      read_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id,event_key' });

  if (error) throw error;
}

export async function getPartnerUnreadActivityCount(limit = 100) {
  const activity = await getPartnerActivity(limit);
  if (!activity.items.length) return 0;
  const readKeys = await getPartnerActivityReadKeys(activity.items);
  return activity.items.reduce((count, item) => count + (readKeys.has(partnerActivityEventKey(item)) ? 0 : 1), 0);
}

export async function getPartnerWeeklyStory() {
  const { data, error } = await supabase.rpc('partner_app_weekly_story');
  if (error) throw error;
  return data as PartnerWeeklyStory;
}

export async function getPartnerRecognition() {
  const { data, error } = await supabase.rpc('partner_app_recognition');
  if (error) throw error;
  return data as PartnerRecognition;
}

export async function getPartnerSupport() {
  const { data, error } = await supabase.rpc('partner_app_support');
  if (error) throw error;
  return data as PartnerSupport;
}

export async function getPartnerActivity(limit = 40) {
  const { data, error } = await supabase.rpc('partner_app_activity', { p_limit: limit });
  if (error) throw error;
  return data as PartnerActivityData;
}
