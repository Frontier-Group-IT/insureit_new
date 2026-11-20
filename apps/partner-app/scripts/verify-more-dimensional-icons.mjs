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
// Search and Case Register use title-only menu rows with no subtitle.
assert.match(more, /iconKind="search" title="Search all business" onPress=/);
assert.match(more, /iconKind="case-register" title="Case Register" onPress=/);
assert.doesNotMatch(more, /title="Search all business" helper=/);
assert.doesNotMatch(more, /title="Case Register" helper=/);
for (const kind of ['search','policy-intake','renewals','customers','week',
  'impact','journey','activity','learn','recognition','stories','profile',
  'support','settings']) {
  assert.ok(icons.includes(kind+': {') || icons.includes("'"+kind+"': {"),
    '3D palette missing for '+kind);
}
assert.match(more, /<View style=\{styles\.sectionRows\}>\{children\}<\/View>/, 'Every More section must share a rounded white card container');
assert.match(more, /sectionRows: \{[\s\S]*?overflow: 'hidden',[\s\S]*?borderRadius: 16,[\s\S]*?backgroundColor: partnerTheme\.colors\.surface,[\s\S]*?borderWidth: 1,[\s\S]*?borderColor: partnerTheme\.colors\.line,[\s\S]*?\.\.\.partnerTheme\.shadowSoft/, 'More section cards must have a clipped rounded white surface, light border and soft shadow');
assert.match(more, /paddingHorizontal: 13,/, 'Rows must have inset horizontal padding inside the rounded cards');
assert.match(more, /menuRow: \{[\s\S]*?minHeight: 62,[\s\S]*?paddingVertical: 5,/, 'Compact menu rows must retain a consistent usable height and inset');
assert.match(more, /section: \{\s*marginTop: 10,/, 'Compact More sections must reduce vertical gaps');
assert.match(more, /!last && styles\.menuRowDivider/, 'Dividers must separate adjacent menu items');
assert.match(more, /borderBottomWidth: 1/, 'Dividers must be clearly visible, not hairline-faded');
assert.match(more, /borderBottomColor: '#E6EAF0'/, 'Dividers must use subtle reference-style light gray');
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
