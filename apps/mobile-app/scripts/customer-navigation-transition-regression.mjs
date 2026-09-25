import fs from 'node:fs';

const rootLayout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const customerLayout = fs.readFileSync(new URL('../app/customer/_layout.tsx', import.meta.url), 'utf8');
const kycLayout = fs.readFileSync(new URL('../app/customer/kyc/_layout.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(customerLayout.includes("animation: 'slide_from_bottom'"), 'Customer navigator must apply bottom-up transitions globally.');
assert(customerLayout.includes('headerShown: false'), 'Customer navigator must preserve hidden native headers.');
assert(!rootLayout.includes('customer/add-vehicle'), 'Add Vehicle must not keep a one-off root transition override.');
assert(kycLayout.includes("animation: 'slide_from_bottom'"), 'Customer KYC sub-pages must use the same bottom-up transition.');
assert(!kycLayout.includes("animation: 'none'"), 'Customer KYC must not disable page transitions.');

console.log('Customer global navigation transition regression checks passed.');
