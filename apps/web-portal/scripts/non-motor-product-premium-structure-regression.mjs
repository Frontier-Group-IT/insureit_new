import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(`Non-Motor product premium structure regression failed: ${message}`);
  process.exit(1);
};
const expect = (condition, message) => { if (!condition) fail(message); };

const migration = read('supabase/migrations/20261005171000_add_non_motor_product_premium_structure.sql');
const schemaWorkflow = read('.github/workflows/apply-non-motor-product-premium-structure.yml');
const form = read('apps/web-portal/components/non-motor-policy-form.tsx');
const unified = read('apps/web-portal/components/non-motor-unified-mode.tsx');
const actions = read('apps/web-portal/app/policies/non-motor-policy-actions.ts');
const edit = read('apps/web-portal/app/policies/[id]/edit/policy-edit-standard.tsx');

expect(migration.includes('non_motor_product_configurations'), 'product configuration table migration is missing');
expect(migration.includes("premium_structure in ('standard', 'od_tp')"), 'premium structure constraint must allow only Standard and OD + TP');
expect(!migration.includes('with existing_products as'), 'existing products must remain implicitly Standard and configurable, not be permanently seeded as Standard');
expect(schemaWorkflow.includes('20261005171000_add_non_motor_product_premium_structure.sql'), 'dedicated schema workflow must map the migration');
expect(schemaWorkflow.includes('Verify exact current main'), 'schema workflow must preserve exact-main deployment safety');

for (const [name, source] of [['dedicated form', form], ['unified form', unified]]) {
  expect(source.includes('premiumStructure'), `${name} is missing Premium Structure state`);
  expect(source.includes('OD Premium'), `${name} is missing conditional OD Premium input`);
  expect(source.includes('TP Premium'), `${name} is missing conditional TP Premium input`);
  expect(source.includes('premiumStructure === "od_tp"'), `${name} does not condition OD/TP on product premium structure`);
}

expect(actions.includes('resolveNonMotorPremiumStructure'), 'server action must enforce saved product premium structure');
expect(actions.includes('od_premium:odPremium'), 'server action must persist the OD amount');
expect(actions.includes('tp_premium:tpPremium'), 'server action must persist the TP amount');
expect(actions.includes('premiumStructure'), 'server action must persist the product premium structure marker');

expect(edit.includes('premium?.od_premium'), 'Non-Motor edit must retain OD premium data');
expect(edit.includes('premium?.tp_premium'), 'Non-Motor edit must retain TP premium data');
expect(edit.includes('premium?.net_premium'), 'Non-Motor edit must retain net premium data');

console.log('Non-Motor product premium structure regression passed.');
