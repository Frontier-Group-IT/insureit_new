import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const more = read('../app/(tabs)/more.tsx');
const icon = read('../components/ui/partner-profile-menu-icon.tsx');
const illustrated = [
  ['policy-intake','Policy Intake'],
  ['case-register','Case Register'],
  ['renewals','Renewals'],
  ['customers','Customers'],
  ['impact','My Impact'],
  ['journey','My Journey'],
];
const untouched = ['search','week','activity','learn','recognition','stories','profile','support','settings'];

assert.match(more, /iconKind="case-register" title="Case Register"/);
assert.match(more, /iconKind="policy-intake" title="Policy Intake"/);
const mapping = icon.slice(icon.indexOf('const ILLUSTRATED_ICONS:'),icon.indexOf('const CONFIG:'));
assert.ok(mapping.startsWith('const ILLUSTRATED_ICONS:'), 'Illustrated icons must be centrally mapped');
const redesigned = new Set(['policy-intake']);
for (const [kind,title] of illustrated) {
  const file = kind === 'customers' ? 'more-customers-3d.png' : kind === 'journey' ? 'journey.png' : `more-${kind}${redesigned.has(kind) ? '-3d' : ''}.png`;
  assert.ok(more.includes('title="'+title+'"'), 'Preserve menu action '+title);
  assert.ok(mapping.includes(file), 'Missing illustrated asset mapping '+kind);
  assert.ok(mapping.includes(kind === 'journey' ? "assets/partner/status/journey.png" : `assets/partner/icons/${file}`), 'Incorrect asset directory for '+kind);
  const png=readFileSync(new URL((kind === 'journey' ? '../assets/partner/status/' : '../assets/partner/icons/')+file,import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a', 'Asset must be local PNG: '+kind);
  assert.ok(png.length > 500,'Icon artwork missing content for '+kind);
  if (redesigned.has(kind)) {
    assert.equal(png.readUInt32BE(16), 64, 'Updated icon must be 64px wide: '+kind);
    assert.equal(png.readUInt32BE(20), 64, 'Updated icon must be 64px high: '+kind);
  }
}
for (const kind of untouched) {
  assert.doesNotMatch(mapping,new RegExp("^(?:\\s*['\\\"]?"+kind+"['\\\"]?)\\s*:",'m'),
    'Approved icon must not be replaced: '+kind);
  assert.ok(icon.includes('  '+kind+': {') || icon.includes("  '"+kind+"': {"),
    'Approved vector palette must remain for '+kind);
}
assert.match(icon,/const config = CONFIG\[kind as Exclude<PartnerProfileMenuIconKind, 'case-register'>\]/);
assert.match(icon,/if \(artwork\) \{/);
assert.match(icon,/resizeMode="contain"/);
assert.match(more,/onPress=\{\(\) => router\.push\('\/life-health-cases'\)\}/);
assert.match(more,/canPartnerAccessCaseRegister\(context\)/);
assert.match(more,/canPartnerAccess\(context, 'view_policy_intakes'\)/);
assert.match(more,/PartnerProfileMenuIcon kind=\{iconKind\} size=\{iconKind === 'policy-intake' \? 48 : 42\}/);
assert.match(mapping, /status\/journey\.png/, 'Use existing valid Journey artwork');
assert.match(mapping, /more-customers-3d\.png/, 'Use the existing transparent Customers icon');
assert.match(icon, /scale: 1\.7/, 'Policy Intake artwork must enlarge visibly');
assert.match(icon, /scale: 1\.16/, 'Original My Journey art must render more clearly');
assert.match(more, /sectionRows/, 'More sections should display flat rows');
console.log('Existing transparent Customers icon, valid Journey art, enlarged Intake and subtle More dividers verified.');
