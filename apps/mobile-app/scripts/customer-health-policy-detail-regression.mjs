import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../components/customer-policy-detail-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(detail.includes('const healthPolicy = isHealthPolicy(policy.policy_type);'), 'Policy detail must detect Health policies explicitly.');
assert(detail.includes("return /health/i.test(value?.trim() ?? '');"), 'Health policy detection must be case-insensitive.');
assert(detail.includes('healthPolicy ? ('), 'Health policies must render a dedicated compact summary branch.');
assert(detail.includes('label="Start date"'), 'Health policy detail must show the start date.');
assert(detail.includes('label="End date"'), 'Health policy detail must show the end date.');
assert(detail.includes('label="Premium"'), 'Health policy detail must show premium.');
assert(detail.includes('label="Policy product"'), 'Health policy detail must retain policy product.');
assert(detail.includes('label="OD Premium"'), 'Motor policy detail must retain OD Premium in the non-Health branch.');
assert(detail.includes('label="TP Premium"'), 'Motor policy detail must retain TP Premium in the non-Health branch.');
assert(detail.includes('label="CPA Amount"'), 'Motor policy detail must retain CPA Amount in the non-Health branch.');
assert(detail.includes('financialLabel="IDV"'), 'Motor policy detail must retain IDV in the non-Health branch.');

const healthBranchStart = detail.indexOf('{healthPolicy ? (');
const healthBranchEnd = detail.indexOf(') : (', healthBranchStart);
const healthBranch = detail.slice(healthBranchStart, healthBranchEnd);
assert(!healthBranch.includes('OD Premium'), 'Health policy summary must not show OD Premium.');
assert(!healthBranch.includes('TP Premium'), 'Health policy summary must not show TP Premium.');
assert(!healthBranch.includes('CPA Amount'), 'Health policy summary must not show CPA Amount.');
assert(!healthBranch.includes('IDV'), 'Health policy summary must not show IDV.');

console.log('Customer Health policy detail regression checks passed.');
