import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/customer/policy-detail.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/customer-motor-policy-detail-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(route.includes("CustomerMotorPolicyDetailScreen"), 'Policy detail route must include the dedicated Motor detail screen.');
assert(route.includes("setDetailKind('motor')"), 'Policy detail route must classify Motor policies explicitly.');
assert(route.includes(".from('external_policies')"), 'Policy detail route must classify external policies.');
assert(route.includes(".select('policy_type')"), 'External policy classification must only request columns present on external_policies.');
assert(!route.includes(".from('external_policies')\n            .select('policy_type,policy_product')"), 'External policy classification must not request missing policy_product.');
assert(detail.includes("Premium breakup"), 'Motor detail must include the Premium breakup section.');
assert(detail.includes("Policy validity"), 'Motor detail must include the Policy validity section.');
assert(detail.includes("Insured details"), 'Motor detail must include the Insured details section.');
assert(detail.includes("Remarks / activity note"), 'Motor detail must include Remarks / activity note.');
assert(detail.includes("Documents"), 'Motor detail must include Documents inside the main detail card.');
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
assert(detail.includes("policy.source === 'external' ? 'customer_documents' : 'policy_documents'"), 'Internal and external Motor policies must share the same document UI while using their customer-safe storage tables.');
assert(detail.includes(".eq('external_policy_id', next.id)"), 'External Motor policy documents must resolve by external_policy_id.');
assert(detail.includes("createSignedUrl(policyCopy.storage_path, 10 * 60)"), 'Motor policy copy must create a fresh short-lived URL when opened.');
assert(detail.includes('Linking.openURL(signed.data.signedUrl)'), 'Motor policy documents must open in the browser/system viewer.');
assert(detail.includes('accessibilityLabel="Open policy copy"'), 'Uploaded Motor policy copy must expose an open action.');
assert(!detail.includes('policyCopyExpanded'), 'Motor policy copy must not use an inline accordion preview.');
assert(!detail.includes('chevron-up') && !detail.includes('chevron-down'), 'Motor document rows must not show chevrons.');
assert(!detail.includes('documentsCard'), 'Motor Documents must not render in a separate card.');
assert(!detail.includes('Policy copy preview'), 'Motor policy copies must not render inline previews.');
assert(detail.includes("Linked vehicle"), 'Internal and external Motor policies must share the linked vehicle card.');
assert(detail.includes('const showRenewedPolicyAction = useMemo'), 'Motor detail must calculate renewal action visibility.');
assert(detail.includes('return days <= 30;'), 'Motor renewal action must show for due and expired policies.');
assert(detail.includes('accessibilityLabel="Add renewed policy"'), 'Motor detail must expose the Add renewed policy action.');
assert(detail.includes("pathname: '/customer/add-policy'"), 'Renewed Motor policy action must open the Add Policy flow.');
assert(detail.includes("params: { vehicleId: policy.vehicle_id }"), 'Renewed Motor policy action must carry the linked vehicle when available.');

console.log('Customer Motor policy detail regression checks passed.');
