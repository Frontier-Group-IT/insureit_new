import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import type { PartnerType } from './types';

const selectedCustomerKeyPrefix = 'insureit:selected-customer-id';

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
  if (!isPortfolioOwnerPartnerType(selected.partner_type)) return [selected];

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

  const storageKey = await selectedCustomerStorageKey();
  const storedCustomerId = storageKey ? await AsyncStorage.getItem(storageKey) : null;
  const selected = contexts.find((context) => context.customer_id === storedCustomerId);
  const directPortfolioAccount = bestDirectPortfolioContext(contexts);

  if (selected) {
    if (isPortfolioCustomerContext(selected) || !directPortfolioAccount) {
      return selected;
    }

    if (storageKey) await AsyncStorage.setItem(storageKey, directPortfolioAccount.customer_id);
    return directPortfolioAccount;
  }

  const directPrimary = contexts.find((context) => context.access_source === 'direct');
  const fallback = directPortfolioAccount ?? directPrimary ?? contexts[0];
  if (storageKey) await AsyncStorage.setItem(storageKey, fallback.customer_id);
  return fallback;
}

export async function selectCustomerContext(customerId: string): Promise<CustomerAccountContext> {
  const contexts = await getAccessibleCustomerContexts();
  const selected = contexts.find((context) => context.customer_id === customerId);
  if (!selected) throw new Error('This customer account is not available to the signed-in user.');
  const storageKey = await selectedCustomerStorageKey();
  if (storageKey) await AsyncStorage.setItem(storageKey, selected.customer_id);
  return selected;
}

export async function clearSelectedCustomerContext() {
  const keys = await AsyncStorage.getAllKeys();
  const selectedKeys = keys.filter((key) => key === selectedCustomerKeyPrefix || key.startsWith(`${selectedCustomerKeyPrefix}:`));
  if (selectedKeys.length) await AsyncStorage.multiRemove(selectedKeys);
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

export function isPortfolioCustomerContext(context?: CustomerAccountContext | null) {
  return Boolean(context && (context.access_source === 'group_child' || isPortfolioOwnerPartnerType(context.partner_type)));
}

export function isPortfolioOwnerPartnerType(partnerType?: PartnerType | null) {
  return partnerType === 'group' || partnerType === 'corporate' || partnerType === 'dealership';
}

function bestDirectPortfolioContext(contexts: CustomerAccountContext[]) {
  return contexts
    .filter((context) => context.access_source === 'direct' && isPortfolioOwnerPartnerType(context.partner_type))
    .sort((left, right) => portfolioPriority(left.partner_type) - portfolioPriority(right.partner_type))[0] ?? null;
}

function portfolioPriority(partnerType: PartnerType) {
  switch (partnerType) {
    case 'group': return 0;
    case 'dealership': return 1;
    case 'corporate': return 2;
    default: return 3;
  }
}

async function selectedCustomerStorageKey() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return null;
  await AsyncStorage.removeItem(selectedCustomerKeyPrefix);
  return `${selectedCustomerKeyPrefix}:${userId}`;
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
