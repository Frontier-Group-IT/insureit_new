import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../app/customer/policy-detail.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(detail.includes("from('policy_documents')"), 'Internal policy details must load policy copies from policy_documents.');
assert(detail.includes("from('customer_documents')"), 'External policy details must load customer-uploaded policy copies.');
assert(detail.includes(".eq('document_type', 'policy_copy')"), 'Policy copy queries must be scoped to policy_copy documents.');
assert(detail.includes('createSignedUrl(document.storage_path, 10 * 60)'), 'Policy copies must use short-lived signed URLs.');
assert(detail.includes('Policy copy not uploaded'), 'Policy details must show an explicit empty policy-copy state.');
assert(detail.includes('accessibilityLabel="Policy copy preview"'), 'Available image policy copies must render an inline preview.');
assert(detail.includes('isImagePolicyCopy(policyCopy)'), 'Inline policy-copy previews must be limited to supported image formats.');
assert(!detail.includes('accessibilityLabel="View policy copy"'), 'Policy details must not require a separate View action for image policy copies.');

console.log('Customer policy copy section regression checks passed.');
