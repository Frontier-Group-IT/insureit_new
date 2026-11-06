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


// Every Customer search surface must opt into the shared animated component.
const pages = [
  ['../app/customer/claims.tsx', /<CustomerSearchBar[^>]*idleHints=\{\[/],
  ['../app/customer/vehicles.tsx', /<CustomerAnimatedSearchInput[\s\S]*?idleHints=\{\[/],
  ['../app/customer/start-claim.tsx', /<CustomerAnimatedSearchInput[\s\S]*?idleHints=\{\[/],
  ['../app/customer/add-policy.tsx', /<CustomerAnimatedSearchInput[\s\S]*?idleHints=\{\[/],
  ['../app/customer/support.tsx', /<CustomerAnimatedSearchInput[^>]*idleHints=\{\[/],
  ['../app/customer/help-faqs.tsx', /<CustomerAnimatedSearchInput[^>]*idleHints=\{\[/],
  ['../app/customer/exchange/search.tsx', /<CustomerAnimatedSearchInput[\s\S]*?idleHints=\{\[/],
  ['../components/exchange/ExchangeMarketplaceHome.tsx', /idleHints=\{\[/],
  ['../components/anchored-search-select.tsx', /idleHints=\{\[/],
];
for (const [page, pattern] of pages) {
  const contents = readFileSync(new URL(page, import.meta.url), 'utf8');
  assert.match(contents, pattern, `${page} must support slide-up idle search prompts`);
}
assert.match(search, /\[placeholder, 'Type to search\.\.\.'\]/, 'Future Customer search inputs must animate by default');
assert.match(search, /useNativeDriver: true/, 'Vertical slide animation should use the native driver');

console.log('Customer search idle placeholder slide regression passed across all search surfaces.');
