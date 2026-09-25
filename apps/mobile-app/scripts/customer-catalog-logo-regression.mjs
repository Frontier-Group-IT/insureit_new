import fs from 'node:fs';

const catalog = fs.readFileSync(new URL('../lib/catalog-logos.ts', import.meta.url), 'utf8');

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

console.log('Customer catalog logo regression checks passed.');
