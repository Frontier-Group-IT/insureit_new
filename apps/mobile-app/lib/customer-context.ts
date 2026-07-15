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

export async function getAccessibleCustomerContexts(): Promise<CustomerAccountContext[]> {
  const { data, error } = await supabase.rpc('get_accessible_customer_contexts');
  if (error) throw error;
  return (data ?? []) as CustomerAccountContext[];
}

export async function getSelectedCustomerContext(): Promise<CustomerAccountContext | null> {
  const contexts = await getAccessibleCustomerContexts();
  if (!contexts.length) return null;

  const storedCustomerId = await AsyncStorage.getItem(selectedCustomerKey);
  const selected = contexts.find((context) => context.customer_id === storedCustomerId);
  if (selected) return selected;

  const directPrimary = contexts.find((context) => context.access_source === 'direct');
  const fallback = directPrimary ?? contexts[0];
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
