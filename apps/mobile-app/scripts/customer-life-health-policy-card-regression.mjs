import fs from 'node:fs';

const policiesScreen = fs.readFileSync(new URL('../app/customer/policies.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  policiesScreen.includes("type LifeHealthKind = 'Life' | 'Health';"),
  'Customer Policies must distinguish Life and Health card variants.',
);
assert(
  policiesScreen.includes('life_health_policy_details!life_health_policy_details_policy_id_fkey(premium_paying_term,policy_duration,payment_frequency)'),
  'Life/Health cards must load PPT, policy duration, and payment frequency from canonical policy details.',
);
assert(
  policiesScreen.includes('<Text style={styles.lifeHealthTypeText}>{lifeHealthKind.toUpperCase()}</Text>'),
  'Life/Health cards must show the compact LIFE / HEALTH badge in the header.',
);
assert(
  policiesScreen.includes('label="Policy No."') && policiesScreen.includes('label="PPT"'),
  'Life/Health upper-right summary must show Policy No. and PPT.',
);
assert(
  policiesScreen.includes('label="Product Name"') &&
    policiesScreen.includes('label="Payment Frequency"') &&
    policiesScreen.includes('label="PD"'),
  'Life/Health compact metric row must show Product Name, Payment Frequency, and PD.',
);
assert(
  policiesScreen.includes("kind === 'Health' ? 'Stay protected. Stay healthy.' : 'Protecting what matters most.'"),
  'Life/Health cards must retain the compact protection strip copy.',
);
assert(
  policiesScreen.includes("const groupingKey = policy.vehicle_id ? `vehicle:${policy.vehicle_id}` : `policy:${policy.source}:${policy.id}`;"),
  'Policies without vehicles must remain individually visible instead of collapsing into one null-vehicle group.',
);
assert(
  policiesScreen.includes("primaryValue={vehicle?.vehicle_no ?? 'Vehicle unavailable'}"),
  'Motor policy cards must preserve the existing vehicle summary fallback.',
);
assert(
  policiesScreen.includes("{lifeHealthKind ? (") && policiesScreen.includes('<LifeHealthPolicyBody'),
  'Life/Health rendering must branch away from the Motor vehicle layout.',
);

console.log('Customer Life/Health policy card regression checks passed.');
