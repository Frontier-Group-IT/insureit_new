import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../app/customer/(protected)/', import.meta.url);
const pages = [
  'claims/page.tsx', 'vehicles/customer-vehicles-register.tsx',
  'policies/page.tsx', 'home/page.tsx', 'exchange/page.tsx',
  'support/page.tsx', 'insurance-quote/page.tsx', 'e-challan/page.tsx',
];
for (const page of pages) {
  const source = readFileSync(fileURLToPath(new URL(page, root)), 'utf8');
  assert.match(source, /absolute inset-0 bg-\[url|absolute inset-0 bg-cover bg-center/, page + ' hero must cover its container');
  assert.doesNotMatch(source, /absolute inset-y-0 right-0 w-\[(62|66|67|75)%\]/, page + ' must not restrict hero width');
  assert.match(source, /opacity-95/, page + ' must retain visible artwork');
}
console.log('Customer Portal full-width hero backgrounds regression passed');
