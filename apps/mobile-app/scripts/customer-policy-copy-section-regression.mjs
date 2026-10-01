import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../components/customer-policy-detail-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(detail.includes("from('policy_documents')"), 'Internal policy details must load policy copies from policy_documents.');
assert(detail.includes("from('customer_documents')"), 'External policy details must load customer-uploaded policy copies.');
assert(detail.includes(".eq('document_type', 'policy_copy')") || detail.includes(".eq('document_type','policy_copy')"), 'Policy copy queries must be scoped to policy_copy documents.');
assert(detail.includes('createSignedUrl(document.storage_path, 10 * 60)'), 'Policy copies must use short-lived signed URLs.');
assert(detail.includes('Policy copy not uploaded'), 'Policy details must show an explicit empty policy-copy state.');
assert(detail.includes('const [policyCopyExpanded, setPolicyCopyExpanded] = useState(false)'), 'Policy copy must be collapsed by default.');
assert(detail.includes("'Expand policy copy'"), 'Collapsed policy copy must expose an expand action.');
assert(detail.includes("'Collapse policy copy'"), 'Expanded policy copy must expose a collapse action.');
assert(detail.includes('accessibilityState={{ expanded: policyCopyExpanded }}'), 'Policy copy accordion must expose its expanded accessibility state.');
assert(detail.includes('policyCopyExpanded ? ('), 'Policy copy preview must only render after expansion.');
assert(detail.includes('accessibilityLabel="Policy copy preview"'), 'Available image policy copies must render an inline preview when expanded.');
assert(detail.includes('isImagePolicyCopy(policyCopy)'), 'Inline policy-copy previews must be limited to supported image formats.');
assert(!detail.includes('accessibilityLabel="View policy copy"'), 'Policy details must not require a separate View action for image policy copies.');

console.log('Customer policy copy section regression checks passed.');
