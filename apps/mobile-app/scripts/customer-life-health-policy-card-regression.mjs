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
  policiesScreen.includes("type PolicyCategoryFilter = 'All' | 'Motor' | 'Non-Motor' | 'Health' | 'Life';"),
  'Customer Policies must expose All, Motor, Non-Motor, Health, and Life category filters.',
);
assert(
  policiesScreen.includes("const POLICY_CATEGORY_OPTIONS: PolicyCategoryFilter[] = ['All', 'Motor', 'Non-Motor', 'Health', 'Life'];"),
  'Customer Policies must retain exactly the five requested policy category choices.',
);
assert(
  policiesScreen.includes("const [categoryFilter, setCategoryFilter] = useState<PolicyCategoryFilter>('All');"),
  'Customer policy category filtering must default to All.',
);
assert(
  policiesScreen.includes('const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);'),
  'Customer Policies must manage the compact category dropdown state.',
);
assert(
  !policiesScreen.includes('categorySegmentedControl') && !policiesScreen.includes('categorySegmentDivider'),
  'Customer Policies must not render the old separate/joined category KPI strip above search.',
);
assert(
  policiesScreen.includes('{categoryFilter} ({countForCategory(categoryFilter, policies)})') &&
    policiesScreen.includes("name={categoryMenuOpen ? 'chevron-up' : 'chevron-down'}"),
  'The former All status control must show the selected category, its count, and dropdown chevron.',
);
assert(
  policiesScreen.includes('POLICY_CATEGORY_OPTIONS.map((item) => (') &&
    policiesScreen.includes('setCategoryFilter(item);') &&
    policiesScreen.includes("setFilter('All');") &&
    policiesScreen.includes('setCategoryMenuOpen(false);'),
  'Choosing a category must filter policies, restore the all-status view, and close the dropdown.',
);
assert(
  policiesScreen.includes("(['Active', 'Renewal Due', 'Expired'] as PolicyFilter[]).map"),
  'Active, Renewal Due, and Expired must remain as the separate status chips beside the category dropdown.',
);
assert(
  !policiesScreen.includes("(['All', 'Active', 'Renewal Due', 'Expired'] as PolicyFilter[]).map"),
  'The old standalone All status chip must not remain after All becomes the category dropdown trigger.',
);
assert(
  policiesScreen.includes("const matchesCategory = categoryFilter === 'All' || getPolicyCategory(policy) === categoryFilter;"),
  'Customer policy category dropdown selection must filter the visible policy list.',
);
assert(
  policiesScreen.includes('life_health_policy_details!life_health_policy_details_policy_id_fkey(premium_paying_term,policy_duration,payment_frequency)'),
  'Life/Health cards must load PPT, policy duration, and payment frequency from customer-readable policy details.',
);
assert(
  policiesScreen.includes('<Text style={styles.lifeHealthTypeText}>{lifeHealthKind.toUpperCase()}</Text>') &&
    policiesScreen.includes('lifeHealthTypePill: { borderRadius: 999, backgroundColor: palette.navy'),
  'Life/Health cards must show the compact LIFE / HEALTH badge in navy.',
);
assert(
  policiesScreen.includes('label="Premium Amount"') && policiesScreen.includes('label="PPT - Premium Paying Term"'),
  'Life/Health upper-right summary must show Premium Amount and PPT - Premium Paying Term.',
);
assert(
  !policiesScreen.includes('label="PPT - Premium Payment Term"'),
  'Life/Health card must not retain the old Premium Payment Term label.',
);
assert(
  policiesScreen.includes('label="Product Name"') &&
    policiesScreen.includes('label="Payment Frequency"') &&
    policiesScreen.includes('label="PD - Policy Duration"'),
  'Life/Health compact metric row must show Product Name, Payment Frequency, and expanded PD label.',
);
assert(
  !policiesScreen.includes('styles.lifeHealthDefaultIcon'),
  'Life/Health upper-right summary must not render the old default heart/shield icon.',
);
assert(
  policiesScreen.includes("kind === 'Health' ? 'Stay protected. Stay healthy.' : 'Protecting what matters most.'"),
  'Life/Health cards must retain the compact protection strip copy.',
);
assert(
  policiesScreen.includes('size={25} color="#D7262E"'),
  'Life/Health protection strip heart must render in red.',
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