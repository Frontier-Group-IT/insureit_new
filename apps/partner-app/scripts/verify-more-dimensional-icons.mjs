import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const more = load('../app/(tabs)/more.tsx');
const icons = load('../components/ui/partner-profile-menu-icon.tsx');

// Use the one shared icon renderer throughout the More menu; do not change
// destinations, permissions, accessible row names, or sticky bottom tabs.
assert.match(more, /PartnerProfileMenuIcon kind=\{iconKind\} size=\{iconKind === 'policy-intake' \? 48 : 42\}/);
assert.match(more, /accessibilityLabel=\{helper \? \x60\$\{title\}\. \$\{helper\}\x60 : title\}/);
for (const title of ['Search all business', 'Policy Intake', 'Case Register',
  'Renewals', 'Customers', 'Your Week', 'My Impact', 'My Journey',
  'Activity', '60-Second Learn', 'Recognition', 'INSUREIT Stories',
  'Profile & registration', 'Support', 'Settings & app info']) {
  assert.ok(more.includes('title="'+title+'"'), 'Preserve More action '+title);
}
for (const kind of ['search','policy-intake','renewals','customers','week',
  'impact','journey','activity','learn','recognition','stories','profile',
  'support','settings']) {
  assert.ok(icons.includes(kind+': {') || icons.includes("'"+kind+"': {"),
    '3D palette missing for '+kind);
}
assert.match(more, /sectionRows/, 'More groups should not have rounded card containers');
assert.match(more, /!last && styles\.menuRowDivider/, 'Dividers must separate adjacent menu items');
assert.match(more, /borderBottomWidth: 1/, 'Dividers must be clearly visible, not hairline-faded');
assert.match(more, /borderBottomColor: '#8B9DB8'/, 'Dividers must use a visible slate color');
assert.match(more, /width: 52/, 'Enlarged icons need a sufficient layout slot');
assert.match(icons, /styles\.glyphDepth/);
assert.match(icons, /styles\.glyphEdge/);
assert.match(icons, /styles\.glyphFace/);
assert.match(icons, /styles\.glyphRim/);
assert.match(icons, /styles\.upperLight/);
assert.match(icons, /styles\.lowerShade/);
assert.match(icons, /styles\.badgeShine/);
assert.match(icons, /accessibilityElementsHidden/);
assert.match(icons, /importantForAccessibility="no-hide-descendants"/);
assert.doesNotMatch(icons, /fetch\(|https?:\/\//, 'Menu icons must render without network requests');
console.log('Partner More dimensional icons, permissions and navigation contract passed.');
