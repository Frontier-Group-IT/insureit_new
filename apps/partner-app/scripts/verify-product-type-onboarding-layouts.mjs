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
assert.match(screen,/Form uploads are available in Operations Portal/, 'Keep an accurate short Motor document limitation.');
assert.match(screen,/Form uploads and final booking require Operations Portal/, 'Keep an accurate non-Motor document limitation.');
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
// Motor follows Operations structure; other product types retain draft-only screens.
assert.match(screen,/isMotor\?policy.slice\(0,4\):policy/, 'Do not add duplicate source-code and RM form rows in Motor.');
assert.match(screen,/isMotor&&f.key==='intermediaryType'&&draft.rmName/, 'Show RM beneath intermediary type.');
assert.match(screen,/isMotor&&f.key==='leadSource'&&draft.intermediaryCode/, 'Show source code beneath lead source.');
assert.match(screen,/isMotor&&f.key==='issuanceDate'\?'Policy issuance date'/, 'Motor uses policy issuance label.');
assert.match(screen,/motorVehicleSection/, 'Motor requires a combined insured-and-vehicle card.');
assert.match(screen,/styles.registrationToggle/, 'Registration mode buttons belong in the heading.');
assert.match(screen,/accessibilityState=\{\{selected:draft\?\.registrationMode===mode\}\}/, 'Registration mode state must be accessible.');
assert.match(screen,/styles.registrationRow/, 'Registration number is full width with an inline RC action.');
assert.match(screen,/accessibilityLabel="Fetch RC details"/, 'Keep authorized RC lookup.');
assert.match(screen,/disabled=\{lookingUpRc\|\|!registrationValid\}/, 'Do not fetch an empty or invalid registration.');
assert.match(screen,/motorVehicleFields.slice\(0,7\)\.map\(field\)/, 'Keep Motor fields in paired columns.');
assert.match(screen,/motorProductSection=section\('03','Policy product, premium & validity'/, 'Combine Motor policy and premium details into Operations section 03.');
assert.match(screen,/label:'GST',value:gst/, 'Motor summary includes GST.');
assert.match(screen,/label:'Gross premium',value:gross/, 'Motor summary includes gross.');
assert.match(screen,/isMotor&&data\?\.commercialAccess/, 'Commercial information stays permission-gated.');
assert.match(screen,/const \[commercialModal,setCommercialModal\]=useState<'payin'\|'payout'\|null>\(null\)/, 'Separate commercial popup state required.');
assert.match(screen,/accessibilityLabel="Insurer Pay-In popup"/, 'Insurer Pay-In entry must open its own popup.');
assert.match(screen,/accessibilityLabel="Partner Payout popup"/, 'Partner Payout entry must open its own popup.');
assert.match(screen,/commercialModal==='payin'\?'Projected Insurer Pay-in':'Partner Payout'/, 'Each modal needs the correct heading.');
assert.match(screen,/insurerPayinFields\.map\(/, 'Pay-in popup must use scoped insurer fields.');
assert.match(screen,/partnerPayoutFields\.filter\(/, 'Payout popup must use scoped payout fields.');
assert.match(screen,/accessibilityLabel="Save and close commercial popup"/, 'Commercial popup needs a Save & Close action.');
assert.match(screen,/Boolean\(commercialModal\)&&isMotor&&Boolean\(data\?\.commercialAccess\)/, 'Commercial modals must be strictly Motor and permission gated.');
assert.doesNotMatch(screen,/\bplaceholder\s*=/, 'Onboarding text inputs and dropdowns must have no placeholder props.');
assert.doesNotMatch(screen,/placeholder=\{'Enter '\+f\.label\.toLowerCase\(\)\}/, 'Remove all generated input placeholder copy.');
assert.doesNotMatch(screen,/displayed\|\|'Select '/, 'Do not show synthetic select placeholders.');
assert.match(screen,/hidePlaceholder/, 'Onboarding dates must keep the existing opt-out compatibility prop.');
assert.doesNotMatch(date,/\bplaceholder\s*=/, 'Native date field must not display placeholder hints.');
assert.match(date,/hidePlaceholder\?:boolean/, 'Date placeholder removal must be opt-in to avoid other screens.');
console.log('Product-type layouts, Motor Operations compact layout, separated financial popups, empty input placeholders and Motor-only booking guard verified.');
