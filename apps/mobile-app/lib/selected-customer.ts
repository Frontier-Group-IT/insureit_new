import { getSelectedCustomerContext, type CustomerAccountContext } from './customer-context';
import { supabase } from './supabase';
import type { Customer } from './types';

export type SelectedCustomerRecord = {
  context: CustomerAccountContext;
  customer: Customer;
};

export async function getSelectedCustomerRecord(): Promise<SelectedCustomerRecord | null> {
  const context = await getSelectedCustomerContext();
  if (!context) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', context.customer_id)
    .maybeSingle<Customer>();

  if (error) throw error;
  if (!data) return null;
  return { context, customer: data };
}

export function selectedAccountScreenTitle(context: CustomerAccountContext | null, fallback: string) {
  if (!context) return fallback;
  if (context.partner_type === 'group') return `Group ${fallback.replace(/^My\s+/i, '')}`;
  return fallback;
}
