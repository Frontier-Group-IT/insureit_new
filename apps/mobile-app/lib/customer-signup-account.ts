import { selectCustomerContext } from './customer-context';
import { supabase } from './supabase';

export type ExistingCustomerSignupAccount = {
  customer_id: string;
  customer_code: string;
  account_name: string;
  city: string | null;
  state: string | null;
  vehicle_count: number;
  policy_count: number;
  claim_count: number;
  is_current_profile_customer: boolean;
};

export async function findExistingCustomerSignupAccounts(): Promise<ExistingCustomerSignupAccount[]> {
  const { data, error } = await (supabase.rpc as any)('get_existing_customer_accounts_for_signup');
  if (error) throw error;
  return ((data ?? []) as ExistingCustomerSignupAccount[])
    .map((account) => ({
      ...account,
      vehicle_count: Number(account.vehicle_count ?? 0),
      policy_count: Number(account.policy_count ?? 0),
      claim_count: Number(account.claim_count ?? 0),
      is_current_profile_customer: Boolean(account.is_current_profile_customer),
    }))
    .sort((left, right) => {
      const rightActivity = right.vehicle_count + right.policy_count + right.claim_count;
      const leftActivity = left.vehicle_count + left.policy_count + left.claim_count;
      if (rightActivity !== leftActivity) return rightActivity - leftActivity;
      return left.account_name.localeCompare(right.account_name);
    });
}

export async function linkExistingCustomerSignupAccount(customerId: string) {
  const { error } = await (supabase.rpc as any)('link_existing_customer_account', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  await selectCustomerContext(customerId);
}
