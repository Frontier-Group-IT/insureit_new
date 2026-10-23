import fs from 'node:fs';

const page = fs.readFileSync(new URL('../app/customer/(protected)/spot-intimation/page.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!page.includes('Back to Start Claim'), 'Back to Start Claim must be removed.');
assert(page.includes('Accident &amp; Spot Intimation Details'), 'Reference section title must be present.');
assert(page.includes('Accident Date &amp; Time'), 'Accident date/time must be grouped.');
assert(page.includes('Spot Intimation Date &amp; Time'), 'Spot intimation date/time must be grouped.');
assert(page.includes('Driver Number'), 'Driver Number label must match the reference.');
assert(page.includes('xl:grid-cols-[1.2fr_1.2fr_1.15fr_.8fr_1.35fr]'), 'Desktop section must use the five-column reference layout.');

console.log('Customer portal Spot Intimation reference layout regression checks passed.');
