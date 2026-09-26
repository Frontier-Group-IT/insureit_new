import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label} missing: ${expected}`);
}

const migration = read('../../supabase/migrations/20260926130000_customer_app_existing_master_link.sql');
const mobileAuth = read('../mobile-app/lib/auth.ts');
const customerContext = read('../mobile-app/lib/customer-context.ts');
const vehiclesScreen = read('../mobile-app/app/customer/vehicles.tsx');

for (const expected of [
  'customer_login_mobile_key',
  'customer_login_name_key',
  'select phone into v_verified_phone',
  'public.customer_login_mobile_key(p_phone) is distinct from v_verified_phone_key',
  'Multiple customer records match this verified mobile and customer name',
  'link_customer_app_profile_to_existing_master',
  'merge_customer_app_duplicate_into_existing_master',
  "existing.creation_channel is distinct from 'direct_customer_onboarding'",
  "c.creation_channel = 'direct_customer_onboarding'",
  'candidate_count = 1',
  'update public.customers\n    set profile_id = signup_profile_id',
  'delete from public.customers where id = signup_row.id',
]) {
  assertIncludes(migration, expected, 'customer-app existing-master migration');
}

for (const expected of [
  "shouldCreateUser: true",
  "ensure_customer_signup_profile",
]) {
  assertIncludes(mobileAuth, expected, 'mobile auth contract');
}

assertIncludes(customerContext, "supabase.rpc('get_accessible_customer_contexts')", 'customer context contract');
assertIncludes(vehiclesScreen, ".in('customer_id', ids)", 'mobile vehicle ownership query');

if (migration.includes('customers_mobile_unique_idx')) {
  throw new Error('migration must not restore global mobile uniqueness');
}

console.log('customer app existing master link regression passed');
