import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/claim/select-vehicle.tsx', import.meta.url), 'utf8');
const start = source.indexOf('function getPolicyExpiryStatus(');
const end = source.indexOf('\nconst styles =', start);
assert.ok(start !== -1 && end > start, 'Policy expiry helper must exist');
const helper = source.slice(start, end);
assert.ok(helper.includes('/^\\d{4}-\\d{2}-\\d{2}$/'), 'Must match YYYY-MM-DD dates with real regex digit escapes');
assert.ok(!helper.includes('/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/'), 'Must not use double-escaped digit classes');
const iso = /^\d{4}-\d{2}-\d{2}$/;
assert.ok(iso.test('2027-08-28'));
assert.ok(!iso.test('not-a-date'));
console.log('Partner claim policy expiry date regex regression OK');
