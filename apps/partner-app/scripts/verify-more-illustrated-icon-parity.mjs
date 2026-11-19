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
for (const [kind,title] of illustrated) {
  assert.ok(more.includes('title="'+title+'"'), 'Preserve menu action '+title);
  assert.ok(mapping.includes("more-"+kind+".png"), 'Missing illustrated asset mapping '+kind);
  const png=readFileSync(new URL('../assets/partner/icons/more-'+kind+'.png',import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a', 'Asset must be local PNG: '+kind);
  assert.ok(png.length>1000,'Icon artwork missing content for '+kind);
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
assert.match(more,/PartnerProfileMenuIcon kind=\{iconKind\} size=\{38\}/);
console.log('Six illustrated 3D More icons and nine untouched approved icons verified.');
