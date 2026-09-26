import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../app/customer/policy-detail.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(detail.includes("from('policy_documents')"), 'Internal policy details must load policy copies from policy_documents.');
assert(detail.includes("from('customer_documents')"), 'External policy details must load customer-uploaded policy copies.');
assert(detail.includes(".eq('document_type', 'policy_copy')"), 'Policy copy queries must be scoped to policy_copy documents.');
assert(detail.includes('createSignedUrl(nextPolicyCopy.storage_path, 10 * 60)'), 'Policy copies must use short-lived signed URLs.');
assert(detail.includes('Policy copy not uploaded'), 'Policy details must show an explicit empty policy-copy state.');
assert(detail.includes('accessibilityLabel="View policy copy"'), 'Available policy copies must expose a view action.');

console.log('Customer policy copy section regression checks passed.');
