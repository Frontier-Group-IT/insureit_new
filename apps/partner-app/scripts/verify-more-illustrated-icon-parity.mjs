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
const highResolution = new Map([
  ['policy-intake', '../assets/partner/actions/policy-checklist.png'],

]);
for (const [kind,title] of illustrated) {
  const source = kind === 'customers' ? '../assets/partner/quick-actions/add-partner.png'
    : highResolution.get(kind)
    ?? (kind === 'journey' ? '../assets/partner/icons/more-journey-3d-new.png' : `../assets/partner/icons/more-${kind}.png`);
  assert.ok(more.includes('title="'+title+'"'), 'Preserve menu action '+title);
  assert.ok(mapping.includes(source.replace('../', '../../')), 'Missing illustrated asset mapping '+kind);
  const png = readFileSync(new URL(source, import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a', 'Asset must be local PNG: '+kind);
  assert.ok(png.length > 500, 'Icon artwork missing content for '+kind);
  if (highResolution.has(kind) || kind === 'journey') {
    assert.equal(png.readUInt32BE(16), 256, 'Sharp menu illustration must be 256px wide: '+kind);
    assert.equal(png.readUInt32BE(20), 256, 'Sharp menu illustration must be 256px high: '+kind);
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
assert.match(mapping, /icons\/more-journey-3d-new\.png/, 'Use newly approved isolated 3D My Journey artwork');
assert.match(mapping, /quick-actions\/add-partner\.png/, 'Use the user-approved blue business-person icon with purple plus for Customers');
assert.doesNotMatch(icon, /scale: 1\.7/, 'Policy Intake must avoid magnifying low-resolution source artwork');
assert.doesNotMatch(icon, /scale: 1\.16/, 'Sharp My Journey art must not be magnified');
assert.match(more, /sectionRows/, 'More sections must retain their rounded menu groups');
console.log('Approved Customers and isolated 3D My Journey icons, Policy Intake artwork, and rounded More sections verified.');
