import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync('apps/partner-app/' + name, 'utf8');
const screen = read('components/partner-screen.tsx');
const home = read('app/(tabs)/index.tsx');
const business = read('app/(tabs)/business.tsx');
const policies = read('app/(tabs)/policies.tsx');
const claims = read('app/(tabs)/claims.tsx');
assert.match(screen, /edges=\{\['top'\]\}/, 'Safe-area handling must remain');
assert.match(screen, /scrollLinkedHeader\?: boolean/, 'Shared screen needs explicit opt-in');
assert.match(screen, /!scrollLinkedHeader && fixedHeaderActive/, 'Other pages must retain original header behavior');
assert.match(home, /<PartnerScreen\s+scrollLinkedHeader/, 'Home header must scroll with page');
assert.match(business, /<PartnerScreen\s+scrollLinkedHeader/, 'Business header must scroll with page');
assert.match(business, /stickyHeading="Business"/, 'Business heading retained');
assert.match(screen, /homeStickySearchWrap:[\s\S]*?backgroundColor: "#1760C1"/, 'Home search has blue background');
assert.match(business, /backgroundColor: '#1760C1', paddingHorizontal: 8/, 'Business search has blue background');
assert.match(policies, /const searchSticky = false/, 'Policies search must not dock');
assert.match(policies, /backgroundColor: '#1760C1', paddingBottom: 12/, 'Policies search has blue background');
assert.match(claims, /const showStickyControls = false/, 'Claims search must not dock');
assert.match(claims, /backgroundColor: '#1760C1', marginHorizontal: -10/, 'Claims search has blue background');
for (const [page, value] of [['Business', business], ['Policies', policies], ['Claims', claims]]) {
  assert.match(value, /filterText: \{[^\n]*fontWeight: '400'/, page + ' filter text must be regular');
}
console.log('Four tab scroll-linked blue headings/search contracts passed');
