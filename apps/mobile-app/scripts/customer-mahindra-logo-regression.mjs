import fs from 'node:fs';

const catalog = fs.readFileSync(new URL('../lib/catalog-logos.ts', import.meta.url), 'utf8');
const policies = fs.readFileSync(new URL('../app/customer/policies.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const alias of ['mahindra', 'mahindraandmahindra', 'mahindraandmahindralimited', 'mahindramahindra']) {
  assert(
    catalog.includes(`${alias}: 'mahindra'`),
    `Missing Mahindra alias mapping: ${alias}`,
  );
}

assert(
  catalog.includes("mahindra: '/assets/vehicle-brands/mahindra.svg'"),
  'Mahindra aliases must resolve to the existing master SVG path.',
);
assert(
  policies.includes("getVehicleBrandSvgAssetPath(vehicle?.make)"),
  'Customer Policies must resolve SVG vehicle-brand assets.',
);
assert(
  policies.includes('<SvgUri'),
  'Customer Policies must render SVG manufacturer logos natively.',
);

console.log('Customer Mahindra logo alias regression checks passed.');
