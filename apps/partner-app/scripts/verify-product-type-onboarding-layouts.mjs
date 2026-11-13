import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(p,'utf8');
const screen=read('apps/partner-app/app/policy-intakes/onboarding.tsx');
const date=read('apps/partner-app/components/policy-intakes/partner-policy-date-field.tsx');
const api=read('apps/web-portal/app/api/partner/policy-intakes/native-onboarding/route.ts');
const types=read('apps/partner-app/lib/policy-onboarding.ts');

for(const t of ['Motor','Life','Health','Non Motor']){
  assert.ok(screen.includes("'"+t+"'"), 'Missing type '+t);
}
assert.match(screen,/label:'Proposal date'/,'Use Proposal date rather than Motor-only issuance wording');
assert.doesNotMatch(screen,/label:'Policy issuance date'/);
assert.match(screen,/options:\['Motor','Life','Health','Non Motor'\]/);
assert.match(screen,/productType==='Non Motor'\?'Customer & policy':'Customer \/ Proposer'/);
assert.match(screen,/productType==='Non Motor'\?productSection\('03','Risk details'/);
assert.match(screen,/productSection\('03','Policy product & case details',lifeProduct\)/);
assert.match(screen,/productSection\('04',productType==='Non Motor'\?'Cover, premium & validity':'Premium & payment'/);
for(const label of ['PPT - Premium paying term','PD - Policy duration / term','Payment frequency','Premium amount (₹)','Payment mode','Case / proposal number','Address','Risk location','Sum insured / limit (₹)','Policy category']){
  assert.ok(screen.includes(label), 'Missing Operations field '+label);
}
for(const label of ['Proposal Form','Benefit Illustration','Premium Receipt','Other Document']){
  assert.ok(screen.includes(label), 'Missing transparent web-only document instruction '+label);
}
assert.match(date,/import DateTimePicker/,'Native date control must use installed calendar picker');
assert.match(date,/DD\/MM\/YYYY/,'Display Indian date format');
assert.match(date,/onChange\(toIso\(date\)\)/,'Persist ISO value');
assert.match(screen,/if\(\['issuanceDate','validFrom','validUpto','tpValidUpto','cpaValidUpto'\].includes\(f.key\)\)/,'Motor dates use calendar');
assert.match(screen,/if\(f.date\)return <PartnerPolicyDateField/,'NonMotor validity dates use calendar');
assert.match(types,/productDrafts\?: NativeProductDrafts/,'Product forms isolated by type');
assert.match(api,/const productDraftKeys = new Set/,'Server must whitelist product draft fields');
assert.match(api,/saveDraft.productDrafts=proposedProductDrafts/,'Drafts persist in scoped existing intake record');
assert.match(api,/if\(d.businessLine!=="Motor"\)return reply/,'NonMotor cannot book through Motor endpoint');
assert.match(screen,/isMotor\?<Pressable accessibilityRole="button" disabled=\{booking/,'Booking button only for Motor');
assert.match(screen,/Final case creation, documents, risk validation and permission-controlled commercials must be completed in the Operations Portal/);
assert.match(screen,/isMotor&&data\?\.commercialAccess/,'Motor financial entry still permission-gated');
assert.match(screen,/saveNativePolicyOnboarding\(id,data.revision,draft\)/,'Draft save remains functional');
console.log('Product-type layouts, date picker, scoped draft isolation and Motor-only booking guard verified.');
