import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const popup = readFileSync(fileURLToPath(new URL('../components/vehicle-created-action-popup.tsx', import.meta.url)), 'utf8');
assert.match(popup, /window\.location\.assign\("\/vehicles\?success=vehicle_created"\)/, 'OK must perform a full navigation to the vehicle register');
assert.match(popup, /type="button"/, 'OK must not submit the underlying form');
assert.match(popup, /href=\{\x60\/policies\/new\?customer_id=/, 'Add Policy link must remain intact');
console.log('Vehicle creation confirmation navigation regression passed');
