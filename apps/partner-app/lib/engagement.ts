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
  unread_count: number;
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
    event_key: string;
    is_read: boolean;
    title: string;
    subtitle: string;
    meta: string;
    route: string;
    tone: 'business' | 'service' | 'attention' | 'operations' | 'learn';
  }[];
};

export type PartnerActivityItem = PartnerActivityData['items'][number];

export function partnerActivityEventKey(item: PartnerActivityItem) {
  return item.event_key || [item.kind, item.entity_id, item.event_at].join(':');
}

export async function getPartnerActivityReadKeys(items: PartnerActivityItem[]) {
  return new Set(items.filter((item) => item.is_read).map(partnerActivityEventKey));
}

export async function markPartnerActivityRead(item: PartnerActivityItem) {
  const { error } = await supabase.rpc('partner_app_mark_activity_read', {
    p_event_key: partnerActivityEventKey(item),
  });
  if (error) throw error;
}

export async function getPartnerUnreadActivityCount(limit = 100) {
  const activity = await getPartnerActivity(limit);
  return Math.max(0, Number(activity.unread_count || 0));
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
