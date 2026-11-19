import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const more = load('../app/(tabs)/more.tsx');
const icons = load('../components/ui/partner-profile-menu-icon.tsx');

// Keep one background-free icon renderer and preserve permissions and navigation.
assert.ok(more.includes("iconKind === 'policy-intake' ? 48 : iconKind === 'journey' ? 46 : 42"), 'More enlarges Policy Intake and Journey');
assert.match(more, /accessibilityLabel=\{helper \? \x60\$\{title\}\. \$\{helper\}\x60 : title\}/);
for (const title of ['Search all business', 'Policy Intake', 'Case Register',
  'Renewals', 'Customers', 'Your Week', 'My Impact', 'My Journey',
  'Activity', '60-Second Learn', 'Recognition', 'INSUREIT Stories',
  'Profile & registration', 'Support', 'Settings & app info']) {
  assert.ok(more.includes('title="' + title + '"'), 'Preserve More action ' + title);
}
for (const kind of ['search','policy-intake','case-register','renewals','customers','week',
  'impact','journey','activity','learn','recognition','stories','profile',
  'support','settings']) {
  assert.ok(icons.includes(kind + ': {') || icons.includes("'" + kind + "': {"),
    'Clean icon mapping missing for ' + kind);
}
assert.match(icons, /<Ionicons name=\{config\.icon\} size=\{size\} color=\{config\.color\} \/>/);
assert.match(icons, /accessibilityElementsHidden/);
assert.match(icons, /importantForAccessibility="no-hide-descendants"/);
assert.doesNotMatch(icons, /backgroundColor|styles\.tile|styles\.badgeShine|styles\.upperLight|resizeMode=|fetch\(|https?:\/\//,
  'More menu icons must not reintroduce tiles, badges, remote images or background fills');
console.log('Partner More clean icon, permissions and navigation contract passed.');
