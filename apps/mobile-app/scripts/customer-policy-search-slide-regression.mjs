import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const search = readFileSync(new URL('../components/customer-animated-search-input.tsx', import.meta.url), 'utf8');
const policies = readFileSync(new URL('../app/customer/policies.tsx', import.meta.url), 'utf8');

assert.match(policies, /<CustomerSearchBar[^>]*idleHints=\{\[/, 'Policies must opt into automatic placeholder hints');
for (const hint of ['Search vehicle, insurer or policy no.', 'Search by vehicle number', 'Search by insurer name', 'Search by policy number']) {
  assert.ok(policies.includes(hint), `Policy search hint missing: ${hint}`);
}
assert.match(search, /showIdleHints\s*=\s*Boolean\(hints && !focused && !hasValue && !reduceMotion\)/, 'Animate hints only when empty and unfocused, respecting reduced motion');
assert.match(search, /setInterval\(\(\) => \{[\s\S]*?Animated\.timing\(hintOffset/, 'Idle hint animation must run automatically');
assert.match(search, /translateY: hintOffset\.interpolate/, 'Idle hints must slide vertically');
assert.match(search, /clearInterval\(interval\)/, 'Idle hint timer must clean up');
assert.match(search, /onFocus=\{\(event\) => \{ setFocused\(true\); onFocus\?\.\(event\); \}\}/, 'Keep consumer focus handlers');
assert.match(search, /onBlur=\{\(event\) => \{ setFocused\(false\); onBlur\?\.\(event\); \}\}/, 'Keep consumer blur handlers');
assert.match(search, /onChangeText=\{onChangeText\}/, 'Preserve controlled query callback');
assert.match(search, /CUSTOMER_SEARCH_PLACEHOLDER_SIZE = 16/, 'Keep approved reference font size');
assert.match(search, /CUSTOMER_SEARCH_PLACEHOLDER_COLOR = '#7F8EA4'/, 'Keep approved reference colour');

console.log('Customer Policies idle search placeholder slide regression passed.');
