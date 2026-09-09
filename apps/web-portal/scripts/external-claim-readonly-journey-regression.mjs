import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const viewerPath = path.join(root, 'components/claims/assistance-intake-panel.tsx');
const loaderPath = path.join(root, 'app/claims/external-claim-readonly-actions.ts');
const pagePath = path.join(root, 'app/claims/[id]/page.tsx');

const viewer = fs.readFileSync(viewerPath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

const stageKeys = [
  'spot_intimation',
  'spot_status',
  'claim_intimation',
  'work_approval',
  'repair_ri',
  'billing',
  'delivery_order',
  'vehicle_delivery',
  'payment_encashment',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let lastStageIndex = -1;
for (const stageKey of stageKeys) {
  const nextIndex = viewer.indexOf(`key: "${stageKey}"`);
  assert(nextIndex > lastStageIndex, `External read-only journey must keep canonical stage order; missing/out-of-order: ${stageKey}`);
  lastStageIndex = nextIndex;
}

assert(viewer.includes('View only'), 'External claim viewer must visibly identify its read-only state.');
assert(viewer.includes('loadExternalClaimReadonlyJourney'), 'External claim viewer must load customer-managed milestone evidence through the read-only loader.');
assert(viewer.includes('Document evidence'), 'External claim viewer must expose document evidence in view-only mode.');
assert(!viewer.includes('resolveAssistanceIntake'), 'External claim viewer must not import the assistance mutation action.');
assert(!viewer.includes('<form'), 'External claim viewer must not render mutation forms.');
assert(!viewer.includes('type="submit"'), 'External claim viewer must not render submit controls.');
assert(!viewer.includes('Accept assistance'), 'External claim viewer must not expose assistance acceptance controls.');
assert(!viewer.includes('Decline assistance'), 'External claim viewer must not expose assistance decline controls.');

for (const mutator of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(']) {
  assert(!loader.includes(mutator), `Read-only external claim loader must not contain mutation call ${mutator}`);
}
assert(loader.includes('requireCapability("view_claims")'), 'Read-only loader must require view_claims capability.');
assert(loader.includes('canAccessCustomer'), 'Read-only loader must preserve customer-scope authorization.');
assert(loader.includes('claim.claim_service_mode !== "self_managed"'), 'Read-only loader must reject non-self-managed claims.');
assert(loader.includes('.from("claim_milestones")'), 'Read-only loader must use claim_milestones as the external journey source.');

assert(page.includes('if (claim.claim_service_mode === "self_managed")'), 'Claim detail route must keep self-managed claims on the external branch.');
assert(page.includes('<AssistanceIntakePanel'), 'Self-managed claim route must render the isolated external read-only viewer component.');

console.log('External claim read-only nine-stage regression passed.');
