import type { SupabaseClient } from '@supabase/supabase-js';
import { getCustomerIdentity } from './customer-identity';

/**
 * The Customer App uses either its existing Supabase Auth session or a
 * Firebase bearer-token Supabase data client. Never manufacture a Supabase
 * Auth session from a Firebase token or return the unscoped singleton when
 * a Firebase identity is expected but unavailable.
 */
export async function requireCustomerDataClient(): Promise<SupabaseClient> {
  const identity = await getCustomerIdentity();
  if (!identity) throw new Error('Customer session unavailable. Please sign in again.');
  return identity.data;
}
