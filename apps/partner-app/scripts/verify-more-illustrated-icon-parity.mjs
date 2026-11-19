import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const more = read('../app/(tabs)/more.tsx');
const icon = read('../components/ui/partner-profile-menu-icon.tsx');

const items = [
  ['search', 'Search all business'],
  ['policy-intake', 'Policy Intake'],
  ['case-register', 'Case Register'],
  ['renewals', 'Renewals'],
  ['customers', 'Customers'],
  ['week', 'Your Week'],
  ['impact', 'My Impact'],
  ['journey', 'My Journey'],
  ['activity', 'Activity'],
  ['learn', '60-Second Learn'],
  ['recognition', 'Recognition'],
  ['stories', 'INSUREIT Stories'],
  ['profile', 'Profile & registration'],
  ['support', 'Support'],
  ['settings', 'Settings & app info'],
];

for (const [kind, title] of items) {
  assert.ok(more.includes('iconKind="' + kind + '" title="' + title + '"'), 'Preserve menu action ' + title);
  assert.ok(icon.includes(kind.includes('-') ? "  '" + kind + "': {" : '  ' + kind + ': {'), 'Missing background-free glyph mapping ' + kind);
}
assert.match(icon, /const MENU_ICONS: Record<PartnerProfileMenuIconKind, MenuIconConfig>/);
assert.match(icon, /<Ionicons name=\{config\.icon\} size=\{size\} color=\{config\.color\} \/>/);
assert.match(more, /iconKind === 'policy-intake' \? 48 : iconKind === 'journey' \? 46 : 42/);
assert.match(more, /rowIcon: \{[\s\S]*?width: 50,[\s\S]*?height: 50,/);
assert.doesNotMatch(icon, /ILLUSTRATED_ICONS|styles\.tile|backgroundColor|shadowOpacity|borderWidth|resizeMode=/, 'More menu icons must not use background tiles or illustrated PNGs');
assert.match(more, /onPress=\{\(\) => router\.push\('\/life-health-cases'\)\}/);
assert.match(more, /canPartnerAccessCaseRegister\(context\)/);
assert.match(more, /canPartnerAccess\(context, 'view_policy_intakes'\)/);
console.log('Background-free More icons and larger Policy Intake/Journey sizes verified.');
