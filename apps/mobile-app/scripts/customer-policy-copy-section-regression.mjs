import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../app/customer/policy-detail.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(detail.includes("from('policy_documents')"), 'Internal policy details must load policy copies from policy_documents.');
assert(detail.includes("from('customer_documents')"), 'External policy details must load customer-uploaded policy copies.');
assert(detail.includes(".eq('document_type','policy_copy')") || detail.includes(".eq('document_type', 'policy_copy')"), 'Policy copy queries must be scoped to policy_copy documents.');
assert(detail.includes('createSignedUrl(document.storage_path, 10 * 60)'), 'Policy copies must use short-lived signed URLs.');
assert(detail.includes('Policy copy not uploaded'), 'Policy details must show an explicit empty policy-copy state.');
assert(detail.includes('accessibilityLabel="View policy copy"'), 'Uploaded policy copies must expose a View action.');
assert(detail.includes('Linking.openURL(policyCopyUrl)'), 'The View action must open the signed policy-copy URL.');
assert(!detail.includes('accessibilityLabel="Policy copy preview"'), 'Uploaded policy copies must remain collapsed instead of rendering an inline preview.');
assert(!detail.includes('isImagePolicyCopy(policyCopy)'), 'Collapsed policy-copy cards must not branch into inline image previews.');

console.log('Customer policy copy section regression checks passed.');
