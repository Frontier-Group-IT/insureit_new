import fs from 'node:fs';

const catalog = fs.readFileSync(new URL('../lib/catalog-logos.ts', import.meta.url), 'utf8');
const policies = fs.readFileSync(new URL('../app/customer/policies.tsx', import.meta.url), 'utf8');
const customerHdfcLogo = fs.readFileSync(new URL('../assets/catalog/insurers/hdfc-ergo.png', import.meta.url));
const partnerHdfcLogo = fs.readFileSync(new URL('../../partner-app/assets/catalog/insurers/hdfc-ergo.png', import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(catalog.includes("tata: require('../assets/catalog/vehicle-brands/tata.png')"), 'Tata logo must be bundled for the Customer App.');
assert(catalog.includes("toyota: require('../assets/catalog/vehicle-brands/toyota.png')"), 'Toyota logo must be bundled for the Customer App.');
assert(catalog.includes("tatamotors: 'tata'"), 'Tata Motors aliases must resolve to the Tata logo.');
assert(catalog.includes("toyotakirloskarmotor: 'toyota'"), 'Toyota Kirloskar aliases must resolve to the Toyota logo.');
assert(catalog.includes("hdfcergo: require('../assets/catalog/insurers/hdfc-ergo.png')"), 'HDFC ERGO logo must remain bundled.');
assert(catalog.includes("hdfcergogeneralinsurancecompanylimited: 'hdfcergo'"), 'HDFC ERGO full legal name must resolve to the HDFC ERGO logo.');
assert(catalog.includes("hdfcergogeneralinsurancecoltd: 'hdfcergo'"), 'HDFC ERGO Co. Ltd. variant must resolve to the HDFC ERGO logo.');
assert(customerHdfcLogo.equals(partnerHdfcLogo), 'Customer App HDFC ERGO asset must match the known-good Partner App asset.');
assert(policies.includes('onError={() => setImageFailed(true)}'), 'Customer policy cards must fall back when a bundled catalog image fails to render.');

console.log('Customer catalog logo regression checks passed.');
