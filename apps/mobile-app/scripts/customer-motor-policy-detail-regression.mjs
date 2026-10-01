import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/customer/policy-detail.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/customer-motor-policy-detail-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(route.includes("CustomerMotorPolicyDetailScreen"), 'Policy detail route must include the dedicated Motor detail screen.');
assert(route.includes("setDetailKind('motor')"), 'Policy detail route must classify Motor policies explicitly.');
assert(detail.includes("Premium breakup"), 'Motor detail must include the Premium breakup section.');
assert(detail.includes("Policy validity"), 'Motor detail must include the Policy validity section.');
assert(detail.includes("Insured details"), 'Motor detail must include the Insured details section.');
assert(detail.includes("Remarks / activity note"), 'Motor detail must include Remarks / activity note.');
assert(detail.includes("label=\"Policy product\""), 'Motor detail must show Policy product.');
assert(detail.includes("label=\"Insurance company\""), 'Motor detail must show Insurance company.');
assert(detail.includes("label=\"Policy number\""), 'Motor detail must show Policy number.');
assert(detail.includes("label=\"IDV\""), 'Motor detail must show IDV.');
assert(detail.includes("label=\"OD premium\""), 'Motor detail must show OD premium.');
assert(detail.includes("label=\"TP premium\""), 'Motor detail must show TP premium.');
assert(detail.includes("label=\"CPA amount\""), 'Motor detail must show CPA amount.');
assert(detail.includes("label=\"Net premium\""), 'Motor detail must show Net premium.');
assert(detail.includes("label=\"GST\""), 'Motor detail must show GST.');
assert(detail.includes("label=\"Gross premium\""), 'Motor detail must show Gross premium.');
assert(detail.includes("label=\"Policy start date\""), 'Motor detail must show Policy start date.');
assert(detail.includes("label=\"Policy end date\""), 'Motor detail must show Policy end date.');
assert(detail.includes("label=\"Issuance date\""), 'Motor detail must show Issuance date.');
assert(detail.includes("label=\"Policy term\""), 'Motor detail must show Policy term.');
assert(detail.includes("label=\"Insured name\""), 'Motor detail must show Insured name.');
assert(detail.includes("label=\"Phone number\""), 'Motor detail must show Phone number.');
assert(detail.includes(".select('od_premium,tp_premium,cpa_amount,net_premium,gst_amount,gross_premium')"), 'Motor detail must fetch the complete premium breakup.');
assert(detail.includes(".select('company_name,contact_name,phone')"), 'Motor detail must fetch customer insured identity fields.');
assert(detail.includes("accessibilityState={{ expanded: policyCopyExpanded }}"), 'Policy copy must retain explicit collapsed/expanded accessibility state.');
assert(detail.includes("createSignedUrl(policyCopy.storage_path, 10 * 60)"), 'Policy copy must refresh its short-lived signed URL on expansion.');

console.log('Customer Motor policy detail regression checks passed.');
