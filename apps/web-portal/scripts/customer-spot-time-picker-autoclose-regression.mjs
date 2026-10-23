import fs from 'node:fs';

const page = fs.readFileSync(new URL('../app/customer/(protected)/spot-intimation/page.tsx', import.meta.url), 'utf8');
const input = fs.readFileSync(new URL('../components/customer-portal/auto-close-time-input.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('<AutoCloseTimeInput name="accidentTime"'), 'Accident time must use the auto-closing control.');
assert(page.includes('<AutoCloseTimeInput name="spotTime"'), 'Spot intimation time must use the auto-closing control.');
assert(input.includes('inputRef.current?.blur()'), 'Time control must blur after a valid selection.');
assert(input.includes('/^\\d{2}:\\d{2}$/.test(value)'), 'Time control must only auto-close after a complete HH:mm value.');
assert(input.includes('450'), 'Time control must use a short delay so hour/minute selection can complete.');

console.log('Customer Spot Intimation time-picker auto-close regression checks passed.');
