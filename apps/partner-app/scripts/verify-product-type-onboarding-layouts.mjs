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
assert.match(date,/import DateTimePicker/,'Native date control must use installed calendar picker');
assert.match(date,/DD\/MM\/YYYY/,'Display Indian date format');
assert.match(date,/onChange\(toIso\(date\)\)/,'Persist ISO value');
assert.match(screen,/if\(\['issuanceDate','validFrom','validUpto','tpValidUpto','cpaValidUpto'\].includes\(f.key\)\)/,'Motor dates use calendar');
assert.match(screen,/if\(f.date\)return <PartnerPolicyDateField/,'NonMotor validity dates use calendar');
assert.match(types,/productDrafts\?: NativeProductDrafts/,'Product forms isolated by type');
assert.match(api,/const productDraftKeys = new Set/,'Server must whitelist product draft fields');
assert.match(api,/saveDraft.productDrafts=proposedProductDrafts/,'Drafts persist in scoped existing intake record');
assert.match(api,/if\(d.businessLine!=="Motor"\)return reply/,'NonMotor cannot book through Motor endpoint');
assert.match(screen,/Final case creation, documents, risk validation and permission-controlled commercials must be completed in the Operations Portal/);
assert.match(screen,/isMotor&&data\?\.commercialAccess/,'Motor financial entry still permission-gated');
assert.match(screen,/saveNativePolicyOnboarding\(id,data.revision,draft\)/,'Draft save remains functional');
// Motor follows Operations structure; other product types retain draft-only screens.
assert.match(screen,/policy\.slice\(0,4\)\.map\(item/, 'Motor and non-Motor source sections use only four primary rows.');
assert.match(screen,/f.key==='intermediaryType'&&\(draft.rmName\|\|matchedSource\?\.rmName\)/, 'Show matching-source RM beneath intermediary type.');
assert.match(screen,/f.key==='leadSource'\?<View style=\{styles.sourceOwnerDetails\}/, 'Show matched source and RM details beneath lead source.');
assert.match(screen,/isMotor&&f.key==='issuanceDate'\?'Policy issuance date'/, 'Motor uses policy issuance label.');
assert.match(screen,/motorVehicleSection/, 'Motor requires a combined insured-and-vehicle card.');
assert.match(screen,/styles.registrationToggle/, 'Registration mode buttons belong in the heading.');
assert.match(screen,/accessibilityState=\{\{selected:draft\?\.registrationMode===mode\}\}/, 'Registration mode state must be accessible.');
assert.match(screen,/styles.registrationRow/, 'Registration number is full width with an inline RC action.');
assert.match(screen,/accessibilityLabel="Fetch RC details"/, 'Keep authorized RC lookup.');
assert.match(screen,/disabled=\{draft\?\.registrationMode!=='registered'\|\|lookingUpRc\|\|!registrationValid\}/, 'Disable RC for unregistered, invalid or busy states.');
assert.match(screen,/motorVehicleFields\.slice\(0,7\)\.map\(item=>field\(item\)\)/, 'Keep Motor fields in paired columns without accidental width overrides.');
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
assert.match(screen,/placeholder=\{hint\}/, 'Onboarding text inputs have concise context-sensitive placeholders.');
assert.match(screen,/f.key==='model'\?'Model \/ variant'/, 'Keep the reference Model placeholder.');
assert.match(screen,/displayed\|\|\('Select '\+f.label.toLowerCase\(\)\)/, 'Empty dropdowns display a Select prompt.');
assert.doesNotMatch(screen,/<PartnerPolicyDateField[^>]*hidePlaceholder/, 'Onboarding dates show a DD/MM/YYYY placeholder.');
assert.match(date,/placeholder=\{hidePlaceholder/, 'Date input retains opt-in placeholder behavior for other pages.');
assert.match(date,/hidePlaceholder\?:boolean/, 'Date placeholder removal must be opt-in to avoid other screens.');
// Motor form layout and buttons must match the approved compact visual spec.
assert.doesNotMatch(screen,/summaryDocuments|Upload Forms|View submitted policy copy/, 'Remove document sections from onboarding only.');
assert.doesNotMatch(screen,/Form uploads are available in Operations Portal/, 'Remove redundant upload helper.');
assert.match(screen,/styles\.wideField,styles\.registrationBlock/, 'Registration number spans both columns.');
assert.match(screen,/\[styles\.field,styles\.wideField\]/, 'RTO spans both columns.');
assert.match(screen,/styles\.summaryProgressStack/, 'Progress indicator stacks over in-progress badge.');
assert.match(screen,/\{isMotor\?<Pressable accessibilityRole="button" accessibilityLabel="Book Active Policy"/, 'Book replaces Motor Save Draft in the action row.');
assert.match(screen,/<\/Pressable>:<Pressable accessibilityRole="button" disabled=\{saving\|\|!dirty\}/, 'Non-Motor Save Draft stays available.');
assert.match(screen,/disabled=\{booking\|\|saving\|\|!data\}/, 'Booking remains gated by loading and saving.');

// Remarks must be reachable from header, saved through the revision-checked API,
// and shown without replacing/truncating earlier remarks.
assert.match(screen,/visible=\{remarkOpen\}/, 'Add Remark must open a native popup.');
assert.match(screen,/accessibilityLabel="Save Remark"/, 'Remark popup has its own save action.');
assert.match(screen,/async function addRemark\(\)/, 'Remark save handler is present.');
assert.match(screen,/previous\?previous\+'\\n\\n'\+note:note/, 'New remarks append instead of replacing history.');
assert.match(screen,/saveNativePolicyOnboarding\(id,data.revision,updated\)/, 'Remark save persists via the revision-checked API.');
assert.match(screen,/setRemarkOpen\(false\)/, 'Successful save closes the remark popup.');
assert.match(screen,/setRemarkError\(/, 'Remark save failures are reported inside the popup.');
assert.match(screen,/styles.remarkHeading/, 'Remarks heading reserves width for a top-right Add button.');
assert.match(screen,/\.split\(\/\\n\\s\*\\n\/\)/, 'Previously added remarks are visible as separate entries.');
assert.doesNotMatch(screen,/numberOfLines=\{3\}/, 'Do not truncate remarks to three lines.');
assert.match(screen,/disabled=\{saving\|\|booking\|\|!remarkText.trim\(\)\}/, 'Prevent duplicate or blank remarks while saving.');

assert.match(screen,/pendingBusinessLine/, 'Switching policy type requires an explicit confirmation.');
assert.match(screen,/if\(picker.key==='businessLine'\)/, 'Route policy type selections through confirmation.');
assert.match(screen,/setPicker\(null\);\s*if\(item.value!==draft\?\.businessLine\)setPendingBusinessLine/, 'Close choice list and skip confirmation when already selected.');
assert.match(screen,/accessibilityLabel="Cancel Policy Type switch"/, 'Cancel must preserve existing policy type.');
assert.match(screen,/accessibilityLabel="Confirm Policy Type switch"/, 'Switch must be explicit.');
assert.match(screen,/update\('businessLine',pendingBusinessLine\)/, 'Confirmed selection updates only the business line.');
assert.match(screen,/selected&&styles.choiceSelected/, 'Selected option must be highlighted.');
assert.match(screen,/choiceSelected:\{backgroundColor:'#17365D'\}/, 'Selected option uses navy blue.');
assert.match(screen,/choiceTextSelected:\{color:'#FFFFFF'/, 'Selected option uses white text.');
assert.match(screen,/matchedSource\?\.rmCode/, 'Show authenticated RM ID.');
assert.match(screen,/matchedSource\?\.rmMobile/, 'Show assigned RM phone, not lead-source phone.');
assert.match(api,/\.select\("phone"\)\.eq\("id",owner\.id\)/, 'Read only the matched assigned RM phone.');
assert.match(api,/rmMobile/, 'Expose RM phone only from scoped source metadata.');
assert.match(types,/rmMobile:string/, 'Client type includes scoped RM phone.');
console.log('Product-type layouts, policy type switch confirmation, selected option highlight and assigned RM metadata verified.');
