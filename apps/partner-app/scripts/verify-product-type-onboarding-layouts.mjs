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
assert.match(screen,/label=\{f.key==='issuanceDate'\?'Policy issuance date'/, 'Date must use Operations issuance wording for every product.');
assert.match(screen,/options:\['Motor','Life','Health','Non Motor'\]/);
assert.match(screen,/productType==='Non Motor'\?nonMotorCustomerPolicySection/, 'Non-Motor Customer & policy must use the Operations-specific layout.');
assert.match(screen,/productType==='Non Motor'\?nonMotorRiskSection/, 'Non-Motor risk section must be category-aware.');
assert.match(screen,/productSection\('03','Policy product & case details',lifeProduct\)/);
assert.match(screen,/productSection\('04',productType==='Non Motor'\?'Cover, premium & validity':'Premium & payment'/);
for(const label of ['PPT - Premium paying term','PD - Policy duration / term','Payment frequency','Premium amount (₹)','Payment mode','Case / proposal number','Address','Risk location','Sum insured / limit (₹)','Non-Motor category']){
  assert.ok(screen.includes(label), 'Missing Operations field '+label);
}
assert.match(date,/import DateTimePicker/,'Native date control must use installed calendar picker');
assert.match(date,/DD\/MM\/YYYY/,'Display Indian date format');
assert.match(date,/onChange\(toIso\(date\)\)/,'Persist ISO value');
assert.match(screen,/if\(\['issuanceDate','validFrom','validUpto','tpValidUpto','cpaValidUpto'\].includes\(f.key\)\)/,'Motor dates use calendar');
assert.match(screen,/if\(f.date\)return <PartnerPolicyDateField/,'NonMotor validity dates use calendar');
assert.match(types,/productDrafts\?: NativeProductDrafts/,'Product forms isolated by type');
assert.match(api,/const productDraftKeys = new Set/,'Server must whitelist product draft fields');
assert.match(api,/saveDraft.productDrafts=Object.fromEntries/,'Scoped product drafts preserve pre-existing fields through server-side merging');
assert.match(api,/if\(d.businessLine!=="Motor"\)return reply/,'NonMotor cannot book through Motor endpoint');
assert.doesNotMatch(screen,/Final booking is completed in the Operations Portal|Draft saving is available for|Final case creation, documents, risk validation/, 'Remove redundant non-Motor booking and draft notices.');
assert.doesNotMatch(screen,/>In progress<\/Text>/, 'Remove In progress badge from onboarding summary.');
assert.match(screen,/saveNativePolicyOnboarding\(id,data.revision,draft\)/, 'Retain revision-checked draft saving.');
assert.doesNotMatch(screen,/<View style=\{styles.status\}>/, 'Remove top PIR and unsaved status card only; draft saving remains.');
assert.match(screen,/selected&&styles.choiceSelected/, 'Selected highlight applies to all shared picker options.');
assert.match(screen,/picker\.product\?updateProduct\(picker.key,item.value\):update\(picker.key as FieldKey,item.value\)/, 'Preserve non-business-line dropdown selection handlers.');
assert.match(screen,/setPicker\(null\);/, 'Picker can close after selection.');
assert.match(screen,/isMotor&&data\?\.commercialAccess\?<View style=\{styles.referenceCommercial\}/, 'Motor commercial cards must require authorised access.');
assert.match(screen,/!isMotor&&data\?\.commercialAccess\?<View style=\{styles.referenceCommercial\}/, 'Other policy types retain the permission gate.');
assert.match(screen,/saveNativePolicyOnboarding\(id,data.revision,draft\)/,'Draft save remains functional');
// Motor follows Operations structure; other product types retain draft-only screens.
assert.match(screen,/policy\.slice\(0,4\)\.map\(item/, 'Motor and non-Motor source sections use only four primary rows.');
assert.match(screen,/sourceMeta\('rmName','RM'\)/, 'Show RM beneath intermediary type in the matching source row.');
assert.match(screen,/item.key==='leadSource'\?<View style=\{styles.sourceLeadRow\}/, 'Align source ID and callable mobile below lead source.');
assert.match(screen,/sourceLeadRow:\{flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:8/, 'Render source ID, call icon and phone in one left-aligned compact row.');
assert.match(screen,/key==='intermediaryCode'&&verifiedSource/, 'Render matched source ID as compact text, not full-width input.');
assert.match(screen,/name="call-outline"/, 'Keep call-outline icon directly beside the verified source mobile.');
assert.match(screen,/sourcePhone:\{flexDirection:'row',alignItems:'center',gap:3/, 'Do not right-align the phone group away from the source ID.');
assert.match(screen,/f.key==='issuanceDate'\?'Policy issuance date'/, 'All policy types use issuance date label.');
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
assert.match(screen,/isMotor&&data\?\.commercialAccess\?<View style=\{styles.referenceCommercial\}/, 'Motor commercial cards must require authorised access.');
assert.match(screen,/!isMotor&&data\?\.commercialAccess\?<View style=\{styles.referenceCommercial\}/, 'Other policy types retain the permission gate.');
assert.match(screen,/const \[commercialModal,setCommercialModal\]=useState<'payin'\|'payout'\|null>\(null\)/, 'Separate commercial popup state required.');
assert.match(screen,/accessibilityLabel="Insurer Pay-In popup"/, 'Insurer Pay-In entry must open its own popup.');
assert.match(screen,/productValues.payinBasis==='FLAT'/, 'Non-Motor pay-in supports fixed and net premium basis.');
assert.match(screen,/productValues.partnerPayoutBasis==='FLAT'/, 'Non-Motor payout supports fixed and net premium basis.');
assert.match(screen,/summaryPayin\*\.9-summaryPayout/, 'Projected retention deducts TDS.');
assert.match(screen,/manufacturingYearOptions=Array\.from\(\{length:new Date\(\)\.getFullYear\(\)-1900\+1\}/, 'Motor year dropdown must match the Operations Portal 1900-to-current range.');
assert.match(screen,/f.key==='manufacturingYear'\?manufacturingYearOptions\.map/, 'Motor year uses a controlled dropdown, not a free text input.');
assert.match(screen,/f.key==='manufacturingYear'\?'Select year'/, 'Motor year uses the portal select-year hint.');
assert.match(screen,/referencePayinCard/, 'Motor insurer pay-in card must have its full clickable surface.');
assert.match(screen,/referencePayoutCard/, 'Motor partner payout card must have its full clickable surface.');
assert.match(screen,/Add projected insurer terms/, 'Motor pay-in card matches portal helper wording.');
assert.match(screen,/Add agreed partner payout/, 'Motor payout card matches portal helper wording.');
assert.match(screen,/payinEntered\?rupees\(summaryPayin\):'Not entered'/, 'Pay-in card retains true persisted status.');
assert.match(screen,/payoutEntered\?rupees\(summaryPayout\):'Not entered'/, 'Payout card retains true persisted status.');
assert.doesNotMatch(screen,/styles\.progressStatus|summaryStatusValue|filled>=100\?'Complete':'In progress'/, 'Summary status badge is removed while retaining actual progress.');

assert.match(screen,/premiumIcon/, 'Non-Motor premium label shows a rupee icon.');
assert.match(api,/productCommercialKeys/, 'Non-Motor commercial values must be controlled server-side.');
assert.match(api,/Commercial terms require financial access/, 'Unauthorized commercial writes must be rejected.');
assert.match(api,/Never disclose isolated Life\/Health\/Non Motor commercial terms/, 'Restricted commercial values must not be returned.');
assert.match(screen,/accessibilityLabel="Partner Payout popup"/, 'Partner Payout entry must open its own popup.');
assert.match(screen,/commercialModal==='payin'\?'Projected Insurer Pay-in':'Partner Payout'/, 'Each modal needs the correct heading.');
assert.match(screen,/insurerPayinFields\.map\(/, 'Pay-in popup must use scoped insurer fields.');
assert.match(screen,/partnerPayoutFields\.filter\(/, 'Payout popup must use scoped payout fields.');
assert.match(screen,/accessibilityLabel="Save and close commercial popup"/, 'Commercial popup needs a Save & Close action.');
assert.match(screen,/Boolean\(commercialModal\)&&Boolean\(data\?\.commercialAccess\)/, 'Commercial modals stay permission gated.');
assert.match(screen,/placeholder=\{hint\}/, 'All policy types display meaningful empty field placeholders.');
assert.match(screen,/f.key==='model'\?'Model \/ variant'/, 'Keep the reference Model placeholder.');
assert.match(screen,/displayed\|\|\(f.key==='manufacturingYear'\?'Select year':'Select '\+f.label.toLowerCase\(\)\)/, 'Dropdowns show a Select hint when empty.');
assert.doesNotMatch(screen,/hidePlaceholder=\{productType==='Non Motor'\}/, 'Date placeholders are visible for Non-Motor too.');
assert.match(date,/placeholder=\{hidePlaceholder/, 'Date input retains opt-in placeholder behavior for other pages.');
assert.match(date,/hidePlaceholder\?:boolean/, 'Date placeholder removal must be opt-in to avoid other screens.');
// Motor form layout and buttons must match the approved compact visual spec.
assert.doesNotMatch(screen,/summaryDocuments|Upload Forms|View submitted policy copy/, 'Remove document sections from onboarding only.');
assert.doesNotMatch(screen,/Form uploads are available in Operations Portal/, 'Remove redundant upload helper.');
assert.match(screen,/styles\.wideField,styles\.registrationBlock/, 'Registration number spans both columns.');
assert.match(screen,/\[styles\.field,styles\.wideField\]/, 'RTO spans both columns.');
assert.match(screen,/styles\.summaryProgressStack/, 'Onboarding summary retains its percentage ring.');
assert.match(screen,/accessibilityLabel="Create Active Policy"/, 'Shared create action is labelled as requested.');
assert.match(screen,/createPartnerPolicyIntakeBridgeUrl\(id,false,null\)/, 'Non-Motor active creation uses authorised web handoff.');
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


// Non-Motor Operations Portal parity, without enabling native Non-Motor booking.
for(const label of ['Customer record','Customer / organisation','Customer type','Insured / organisation name','Contact person','Mobile number','Email','Address','Policy number','Insurance company','Product / policy name','Non-Motor category','Policy status']){
  assert.ok(screen.includes(label), 'Missing Non-Motor customer / policy field '+label);
}
assert.match(screen,/nonMotorCustomerMode==='existing'/, 'Customer mode must control conditional fields.');
assert.match(screen,/setNonMotorCustomerMode/, 'Existing / New customer toggle is required.');
assert.match(screen,/searchNativeNonMotorCustomers\(id,customerSearch.trim\(\)\)/, 'Existing customer must use authorised intake lookup.');
assert.match(screen,/customerId:customer.id/, 'Existing selection must persist the real customer identifier.');
assert.match(api,/action==="customer_search"/, 'Customer lookup must be handled by the scoped native API.');
assert.match(api,/intake.assigned_to_profile_id!==user.id/, 'Customer lookup requires the assigned reviewer.');
assert.match(api,/operationsHeadPolicyFilter\(downline\)/, 'Head customer results must respect downline scope.');
for(const key of ['"customerMode"','"customerId"','"insuredName"','"phone"','"warranties"','"endorsements"']){
  assert.ok(api.includes(key), 'Non-Motor server must allow draft field '+key);
}
assert.match(screen,/productValues.category\?<View style=\{styles.fields\}>/, 'Risk inputs must be absent until category selection.');
assert.match(screen,/nonMotorAdditionalOpen/, 'Optional details must be collapsible.');
const documentApi=read('apps/web-portal/app/api/partner/policy-intakes/native-onboarding/documents/route.ts');
const intakeDocMigration=read('supabase/migrations/20261114170000_partner_onboarding_document_staging.sql');
const bridgeContinue=read('apps/web-portal/app/api/partner/policy-intakes/bridge/continue/route.ts');
const nonMotorPage=read('apps/web-portal/app/policies/new/non-motor/page.tsx');
const nonMotorAction=read('apps/web-portal/app/policies/non-motor-policy-actions.ts');
assert.match(screen,/onboardingDocumentsSection\('06'\)/,'Non Motor retains Section 06 documents.');
assert.match(screen,/onboardingDocumentsSection\('05'\)/,'Life and Health get Section 05 documents.');
for(const name of ['Policy Copy','Proposal Form','KYC','Other Document']){
  assert.ok(screen.includes(name),'Missing native document type '+name);
}
assert.match(screen,/DocumentPicker.getDocumentAsync/, 'Document rows open the installed native picker.');
assert.match(screen,/uploadNativeOnboardingDocument/, 'Attachments upload to authenticated intake storage.');
assert.match(screen,/deleteNativeOnboardingDocument/, 'Attachments may be removed.');
assert.match(screen,/listNativeOnboardingDocuments/, 'Saved attachments restore when reopening the intake.');
assert.match(screen,/Replace':'Add'/, 'Uploaded document may be replaced.');
assert.match(documentApi,/await context\(request,intakeId,line\)/, 'Uploads are reviewer scoped.');
assert.match(documentApi,/intake.assigned_to_profile_id!==user.id/, 'Only assigned reviewer can manage uploads.');
assert.match(documentApi,/file.size>MAX_BYTES/, 'Upload size enforced server-side.');
assert.match(documentApi,/MIMES.has\(file.type\)/, 'Upload MIME allowlist enforced.');
assert.match(documentApi,/export async function DELETE/, 'Documents support authorized removal.');
assert.match(intakeDocMigration,/enable row level security/, 'Document table requires RLS.');
assert.match(intakeDocMigration,/revoke all on public.policy_intake_onboarding_documents from public, anon, authenticated/, 'Client cannot bypass scoped endpoint.');
assert.match(api,/form.set\(field,new File\(\[bytes\]/, 'Life and Health staged files join existing case attachment workflow.');
assert.match(bridgeContinue,/draft\?\.draft_payload\?\.businessLine==="Non Motor"/, 'Non Motor handoff selects the matching web policy form.');
assert.match(nonMotorPage,/assigned_to_profile_id",profile.id/, 'Web draft restoration remains reviewer scoped.');
assert.match(nonMotorAction,/source_intake_id:sourceIntakeId/, 'Non Motor staged files attach to issued policy records.');
assert.match(nonMotorAction,/stagedDocuments.map\(doc=>/, 'Non Motor document linkage is explicit.');

assert.match(screen,/label:'Policy status',options:\['Active','Pending','Expired','Cancelled'\]/, 'Policy status choices match Operations.');
assert.match(screen,/label:'Policy expiry',value:productValues.endDate/, 'Summary must show saved expiry.');
assert.match(screen,/data\?\.insurers.find/, 'Summary must derive insurer label from master data.');
assert.doesNotMatch(screen,/productType==='Non Motor'\?''/, 'Non-Motor fields must no longer hide empty hints.');
assert.match(api,/if\(d.businessLine!=="Motor"\)return reply/, 'No native booking bypass for Non-Motor.');
assert.match(screen,/nonMotorAdditionalOpen\?<View style=\{styles.fields\}>/, 'Remarks appears in expanded Additional policy details.');
assert.match(screen,/accessibilityLabel="Remarks" multiline/, 'Inline full-width multiline Remarks input is available.');
assert.match(screen,/productExtras\.some\(item=>item\.key===f\.key\)\?'Optional'/, 'Optional additional policy details use portal-style hints.');
assert.match(screen,/f.key==='previousClaims'\?'Brief reference'/, 'Previous claims uses the portal brief-reference hint.');
assert.match(screen,/updateProduct\('remarks',value\)/, 'Inline remarks persist in the existing product draft.');
assert.match(screen,/productType!=='Non Motor'\?<View style=\{styles.section\}>/, 'Separate Remarks card is not shown for Non Motor.');
assert.match(screen,/accessibilityLabel="Cancel Policy Onboarding"/, 'Cancel button is available.');
assert.match(screen,/Discard unsaved changes\?/, 'Cancelling protects unsaved data.');
assert.match(screen,/accessibilityLabel="Create Active Policy"/, 'Create Active Policy replaces booking and draft actions.');
assert.match(screen,/accessibilityLabel="Create Policy"/, 'Life and Health use Create Policy.');
assert.match(screen,/productType==='Life'\|\|productType==='Health'/, 'Life and Health use identical action and border rules.');
assert.match(screen,/createNativeLifeHealthCase\(id,revision\)/, 'Life and Health perform authorized case creation.');
assert.match(api,/body.action==="create_life_health"/, 'Native creation is limited to a separate authorized endpoint.');
assert.match(api,/\["Insurance company",values.insurerId\]/, 'Life and Health selected insurer comes from product-specific draft.');
assert.match(screen,/styles\.referenceLifeHealthPayinRow/, 'Life and Health Pay-in has an outlined card.');
assert.match(screen,/styles\.referenceLifeHealthPayoutRow/, 'Life and Health Payout has an outlined card.');
assert.match(screen,/referenceLifeHealthPayinRow:\{borderWidth:1,borderColor:'#DCE6F1'/, 'Pay-in border stays light blue.');
assert.match(screen,/referenceLifeHealthPayoutRow:\{borderWidth:1,borderColor:'#E3DEF1'/, 'Payout border stays light violet.');
assert.match(screen,/if\(isMotor\)\{await completeBooking\(\);return;\}/, 'Motor retains authorized native booking.');
assert.match(screen,/createPartnerPolicyIntakeBridgeUrl\(id,false,null\)/, 'Non Motor retains secure Operations handoff for policy issuance.');
assert.match(screen,/Linking.openURL\(url\)/, 'Handoff opens the existing website booking flow.');
assert.doesNotMatch(screen,/pendingBusinessLine/, 'Policy type changes immediately without confirmation state.');
assert.match(screen,/if\(picker.key==='businessLine'\)/, 'Policy type dropdown retains direct selection handling.');
assert.match(screen,/if\(item.value!==draft\?\.businessLine\)update\('businessLine',item.value\)/, 'Policy type changes directly and preserves product draft objects.');
assert.doesNotMatch(screen,/pendingBusinessLine|Switch Policy Type\?/, 'No confirmation state or popup.');
assert.doesNotMatch(screen,/<View style=\{styles.status\}>/, 'Top PIR identity/status/progress card is removed.');
assert.match(screen,/styles.summaryProgressStack/, 'Onboarding summary progress remains visible.');
assert.match(screen,/item.key==='intermediaryType'\?<View style=\{styles.sourceOwnerRow\}/, 'RM name and RM ID share the intermediary metadata row.');
assert.match(screen,/verifiedSource\?\.rmCode/, 'RM ID comes from the matched source master.');
assert.match(screen,/verifiedSource\?\.mobile/, 'Lead source phone comes from the matched source master.');
assert.match(screen,/name="call-outline"/, 'Use a call icon instead of a text telephone glyph.');
assert.doesNotMatch(screen,/Source Mobile ·|RM Mobile ·|RM ID ·/, 'No duplicate verbose metadata labels.');
assert.match(screen,/const sourceSection=\(\)=> <View style=\{\[styles.section,styles.firstSection\]\}>/, 'First onboarding section uses its own header clearance.');
assert.match(screen,/firstSection:\{marginTop:14\}/, 'Keep a 14px gap between the navy header and Section 01.');
assert.doesNotMatch(screen,/sourceMonth|Month ·/, 'Do not display a derived Month row beneath the issuance date.');
assert.match(api,/\.select\("phone"\)\.eq\("id",owner\.id\)/, 'Existing scoped owner metadata backend remains.');
assert.match(types,/rmMobile:string/, 'Existing partner source metadata shape remains unchanged.');
console.log('Product-type layouts, direct policy type selection, portal source ownership alignment and PIR-card removal verified.');
