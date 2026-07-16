import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import type { PartnerType } from './types';

const selectedCustomerKey = 'insureit:selected-customer-id';

export type CustomerAccountContext = {
  customer_id: string;
  customer_code: string;
  partner_type: PartnerType;
  company_name: string | null;
  contact_name: string;
  membership_id: string;
  membership_role: string;
  access_source: 'direct' | 'group_child';
  group_customer_id: string | null;
  group_name: string | null;
};

export type GroupChildAccountOverview = {
  row_id: string;
  customer_id: string | null;
  application_id: string | null;
  customer_code: string | null;
  partner_type: PartnerType;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  onboarding_status: string;
  application_status: string | null;
  account_source: 'linked_customer' | 'onboarding_application';
  created_at: string | null;
  updated_at: string | null;
};

export type GroupAssociatedAccountDetail = {
  account_source: 'linked_customer' | 'onboarding_application';
  customer_id: string | null;
  application_id: string | null;
  partner_type: PartnerType;
  account_title: string;
  onboarding_status: string;
  application_status: string | null;
  details: Record<string, unknown>;
  contacts: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  vehicle_count: number;
  active_policy_count: number;
  open_claim_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export async function getAccessibleCustomerContexts(): Promise<CustomerAccountContext[]> {
  const { data, error } = await supabase.rpc('get_accessible_customer_contexts');
  if (error) throw error;
  return (data ?? []) as CustomerAccountContext[];
}

export async function getGroupChildAccountOverview(groupCustomerId: string): Promise<GroupChildAccountOverview[]> {
  const { data, error } = await (supabase.rpc as any)('get_group_child_account_overview', { p_group_customer_id: groupCustomerId });
  if (error) throw error;
  return (data ?? []) as GroupChildAccountOverview[];
}

export async function getGroupAssociatedAccountDetail(input: {
  groupCustomerId: string;
  customerId?: string | null;
  applicationId?: string | null;
}): Promise<GroupAssociatedAccountDetail | null> {
  const { data, error } = await (supabase.rpc as any)('get_group_associated_account_detail', {
    p_group_customer_id: input.groupCustomerId,
    p_customer_id: input.customerId ?? null,
    p_application_id: input.applicationId ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    ...row,
    details: isRecord(row.details) ? row.details : {},
    contacts: Array.isArray(row.contacts) ? row.contacts : [],
    documents: Array.isArray(row.documents) ? row.documents : [],
    vehicle_count: Number(row.vehicle_count ?? 0),
    active_policy_count: Number(row.active_policy_count ?? 0),
    open_claim_count: Number(row.open_claim_count ?? 0),
  } as GroupAssociatedAccountDetail;
}

export async function getOperationalCustomerContexts(): Promise<CustomerAccountContext[]> {
  const selected = await getSelectedCustomerContext();
  if (!selected) return [];
  if (selected.partner_type !== 'group') return [selected];

  const contexts = await getAccessibleCustomerContexts();
  const children = contexts.filter((context) => context.customer_id !== selected.customer_id && context.group_customer_id === selected.customer_id);
  return [selected, ...children];
}

export function groupChildAccountTitle(account: Pick<GroupChildAccountOverview, 'company_name' | 'contact_name'>) {
  return account.company_name?.trim() || account.contact_name?.trim() || 'Pending customer';
}

export async function getSelectedCustomerContext(): Promise<CustomerAccountContext | null> {
  const contexts = await getAccessibleCustomerContexts();
  if (!contexts.length) return null;

  const storedCustomerId = await AsyncStorage.getItem(selectedCustomerKey);
  const selected = contexts.find((context) => context.customer_id === storedCustomerId);
  const directGroup = contexts.find((context) => context.access_source === 'direct' && context.partner_type === 'group');

  if (selected) {
    if (selected.access_source === 'group_child' || selected.partner_type === 'group' || !directGroup) {
      return selected;
    }

    await AsyncStorage.setItem(selectedCustomerKey, directGroup.customer_id);
    return directGroup;
  }

  const directPrimary = contexts.find((context) => context.access_source === 'direct');
  const fallback = directGroup ?? directPrimary ?? contexts[0];
  await AsyncStorage.setItem(selectedCustomerKey, fallback.customer_id);
  return fallback;
}

export async function selectCustomerContext(customerId: string): Promise<CustomerAccountContext> {
  const contexts = await getAccessibleCustomerContexts();
  const selected = contexts.find((context) => context.customer_id === customerId);
  if (!selected) throw new Error('This customer account is not available to the signed-in user.');
  await AsyncStorage.setItem(selectedCustomerKey, selected.customer_id);
  return selected;
}

export async function clearSelectedCustomerContext() {
  await AsyncStorage.removeItem(selectedCustomerKey);
}

export function customerAccountTitle(context: CustomerAccountContext) {
  if (context.partner_type === 'individual_proprietor') {
    return context.company_name?.trim() || context.contact_name;
  }
  return context.company_name?.trim() || context.contact_name;
}

export function partnerTypeLabel(partnerType: PartnerType) {
  switch (partnerType) {
    case 'corporate': return 'Corporate';
    case 'dealership': return 'Dealership';
    case 'group': return 'Group';
    default: return 'Individual / Proprietor';
  }
}

export function membershipRoleLabel(role: string) {
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
