import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/customer/policy-detail.tsx', import.meta.url), 'utf8');
const lifeHealthDetail = fs.readFileSync(new URL('../components/customer-life-health-policy-detail-screen.tsx', import.meta.url), 'utf8');
const motorDetail = fs.readFileSync(new URL('../components/customer-policy-detail-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(route.includes("/\\b(life|health)\\b/i.test"), 'Policy detail route must detect both Life and Health policies.');
assert(route.includes('<CustomerLifeHealthPolicyDetailScreen />'), 'Life and Health policies must use the dedicated full detail screen.');
assert(route.includes('<CustomerPolicyDetailScreen />'), 'Non-Life/Health policies must preserve the existing detail screen.');

for (const label of [
  'Policy information',
  'Policy term & payment',
  'Policy dates & premium',
  'Remarks / activity note',
  'Documents',
]) {
  assert(lifeHealthDetail.includes(label), `Life/Health detail must include the ${label} section.`);
}

for (const label of [
  'Insurer',
  'Policy product',
  'Policy number',
  'Proposal number',
  'PPT',
  'Policy duration / term',
  'Payment frequency',
  'Payment mode',
  'Issuance date',
  'Policy start date',
  'Policy end / maturity date',
  'Final premium',
]) {
  assert(lifeHealthDetail.includes(`label=\"${label}\"`), `Life/Health detail must show ${label}.`);
}

assert(lifeHealthDetail.includes(".from('life_health_policy_details')"), 'Life/Health detail must read issued-policy detail fields from life_health_policy_details.');
assert(!lifeHealthDetail.includes(".from('life_health_cases')"), 'Customer detail must not read private life_health_cases.');
assert(!lifeHealthDetail.includes(".from('life_health_case_documents')"), 'Customer detail must not read private life_health_case_documents.');
assert(lifeHealthDetail.includes(".from('policy_documents')"), 'Internal Life/Health documents must use customer-readable policy_documents.');
assert(lifeHealthDetail.includes(".from('customer_documents')"), 'External Life/Health documents must use customer-readable customer_documents.');
assert(lifeHealthDetail.includes("['policy_copy', 'Policy copy'"), 'Documents must include Policy copy.');
assert(lifeHealthDetail.includes("['proposal_form', 'Proposal form'"), 'Documents must include Proposal form.');
assert(lifeHealthDetail.includes("['illustration_form', 'Illustration form'"), 'Documents must include Illustration form.');
assert(lifeHealthDetail.includes("['payment_receipt', 'Payment receipt'"), 'Documents must include Payment receipt.');
assert(lifeHealthDetail.includes("['other_form', 'Other form'"), 'Documents must include Other form.');
assert(lifeHealthDetail.includes('const [policyCopyExpanded, setPolicyCopyExpanded] = useState(false);'), 'Policy copy must remain collapsed by default.');
assert(lifeHealthDetail.includes('createSignedUrl(document.storage_path, 10 * 60)'), 'Policy copy expansion must create a fresh short-lived signed URL.');
assert(lifeHealthDetail.includes("width: '50%'"), 'Life/Health details must preserve the two-column Vehicle Details grid layout.');

assert(motorDetail.includes('label="OD Premium"'), 'Motor policy detail must retain OD Premium.');
assert(motorDetail.includes('label="TP Premium"'), 'Motor policy detail must retain TP Premium.');
assert(motorDetail.includes('label="CPA Amount"'), 'Motor policy detail must retain CPA Amount.');
assert(motorDetail.includes('financialLabel="IDV"'), 'Motor policy detail must retain IDV.');

console.log('Customer Life/Health policy detail regression checks passed.');
