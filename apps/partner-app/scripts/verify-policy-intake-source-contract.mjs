import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const service = fs.readFileSync(path.join(root, 'lib/policy-intakes.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'app/policy-intake-new.tsx'), 'utf8');
const detailScreen = fs.readFileSync(path.join(root, 'app/policy-intakes/[id].tsx'), 'utf8');
const manufacturerLogo = fs.readFileSync(path.join(root, 'components/ui/partner-manufacturer-logo.tsx'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../web-portal/app/api/partner/policy-intakes/route.ts'), 'utf8');

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

requireText(service, 'listPartnerPolicyIntakeSources()', 'Policy Intake service must expose a dedicated source loader.');
requireText(service, "'/api/partner/policy-intakes?view=sources'", 'Policy Intake source loader must call the dedicated ?view=sources endpoint.');
requireText(service, 'Array.isArray(result.sources) ? result.sources : []', 'Policy Intake source response must be normalized defensively.');
requireText(service, 'Array.isArray(page.intakes)', 'Each requested Policy Intake page must be validated as an array.');
requireText(service, 'export async function listPartnerPolicyIntakesPage(', 'Policy Intake list must load authorized pages independently.');
requireText(service, 'offset = 0,', 'Keep default offset at the first authorized page.');

requireText(screen, 'listPartnerPolicyIntakeSources()', 'New Policy Intake must load lead sources from the dedicated source endpoint.');
requireText(screen, 'const nextSources = Array.isArray(result) ? result : [];', 'New Policy Intake must normalize source data before array operations.');
if (screen.includes('listPartnerPolicyIntakes(),')) {
  throw new Error('New Policy Intake must not depend on the intake-list endpoint for lead sources.');
}
if (screen.includes('result.sources.some(') || screen.includes('result.sources.length')) {
  throw new Error('New Policy Intake must not dereference sources from the intake-list response.');
}

for (const required of [
  'submitPartnerPolicyIntake({',
  'loadPartnerPolicyIntakeDraft()',
  'savePartnerPolicyIntakeDraft({',
  'clearPartnerPolicyIntakeDraft()',
  "const [policyType, setPolicyType] = useState<PartnerPolicyType>('motor');",
  "value: 'life'",
  "value: 'health'",
  "proposalForm ? 'Proposal form (Optional)' : 'Policy copy'",
  'policyType,',
]) {
  requireText(screen, required, `New Policy Intake must preserve ${required}.`);
}

requireText(service, "export type PartnerPolicyType = 'motor' | 'non_motor' | 'life' | 'health';", 'Partner Policy Intake service must expose the four portal policy types.');
requireText(service, "action: 'submit_without_proposal'", 'Life/Health Policy Intake must support optional proposal submission.');
requireText(service, 'policy_type: input.policyType', 'Partner Policy Intake service must send policy_type to the portal API.');

requireText(api, 'policy_type: PolicyType', 'Partner Policy Intake API must accept policy_type on uploaded submissions.');
requireText(api, 'action: "submit_without_proposal"', 'Partner Policy Intake API must accept no-proposal Life/Health submissions.');
requireText(api, 'status: proposalForm ? "ready_for_review" : "processing"', 'Life/Health proposal submissions must bypass OCR and enter Operations review.');
requireText(api, 'if (!proposalForm) {', 'Partner Policy Intake API must gate OCR processing away from Life/Health proposals.');

for (const required of [
  'title="Policy Intake"',
  'artwork={PartnerAssets.actions.quickPolicyIntake}',
  'fullWidth',
  'source={PartnerAssets.actions.policyChecklist}',
  '"car-sport-outline"',
  '"shield-checkmark-outline"',
  'statusBadgeStyle(row)',
  'statusDate',
  'navyStatusBar',
  'bottomNavigation={<PolicyIntakeDetailNavigation',
]) {
  requireText(detailScreen, required, `Policy Intake detail redesign must preserve ${required}.`);
}
for (const removed of [
  'eyebrow="POLICY INTAKE"',
  'subtitle="Track Operations progress and respond when needed"',
  '<Text style={styles.statusLabel}>CURRENT STATUS</Text>',
  'Updated {formatDate(row.updated_at)}',
]) {
  if (detailScreen.includes(removed)) throw new Error(`Policy Intake detail must not restore removed UI: ${removed}`);
}
// Presentation-only cleanup: no numbered review blocks or OCR confidence suffixes.
for (const forbidden of ['number="02"', 'number="03"', ' · Review', '<ReviewPair label="Workflow"']) {
  if (detailScreen.includes(forbidden)) throw new Error('Policy Intake detail must not show redundant review labels: ' + forbidden);
}
for (const required of [
  'artwork={PartnerAssets.actions.quickPolicyIntake}',
  'source={PartnerAssets.actions.policyChecklist}',
  '<ReviewBlock title="Vehicle details">',
  '<ReviewBlock title="Policy & premium">',
  '<ReviewPair label="Detail fetch"',
  '<ReviewPair label="Reviewer"',
  'statusBadgeStyle(row)',
  'statusLabel(row)',
  'row.review_access.can_finalize',
]) requireText(detailScreen, required, 'Preserve intake information and actions: ' + required);
// Keep status and timestamp together in the top-right stack without losing summary data.
requireText(detailScreen, '<View style={styles.statusTitleRow}>', 'Policy Intake header must place status beside the title.');
requireText(detailScreen, "statusMeta: { flexShrink: 0, maxWidth: '47%', alignItems: 'flex-end', gap: 3 }", 'Status/date should remain compact and right aligned.');
requireText(detailScreen, '<Text style={styles.statusDate}>{formatDate(row.updated_at)}</Text>', 'Preserve the updated date and time.');
const summaryHeaderStart = detailScreen.indexOf('<View style={styles.statusTitleRow}>');
const identityStart = detailScreen.indexOf('<View style={styles.statusIdentity}>', summaryHeaderStart);
const summaryDetailsStart = detailScreen.indexOf('<View style={styles.intakeSummaryCompact}>', identityStart);
const headerStatusPosition = detailScreen.indexOf('<View style={[styles.statusMeta,', summaryHeaderStart);
if (!(summaryHeaderStart >= 0 && identityStart > summaryHeaderStart &&
      summaryDetailsStart > identityStart && headerStatusPosition > summaryDetailsStart)) {
  throw new Error('Identity details must follow the title directly, independent of the right-aligned status/date.');
}
requireText(detailScreen, "intakeSummaryCompact: { marginTop: 0, marginBottom: 0 }", 'Remove the empty space beneath the title.');
requireText(detailScreen, "intakeNumber: { color: partnerTheme.colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '500' }", 'Use compact medium-weight title on Android and iOS.');
requireText(detailScreen, "pairValue:{flex:1.4,textAlign:'right',fontSize:10.5,lineHeight:15,color:'#193659',fontWeight:'400'}", 'Preserve all OCR values with normal-weight typography.');
requireText(detailScreen, "sheetTitle:{fontSize:13,fontWeight:'500'", 'Use compact section headings on both platforms.');
if ((detailScreen.match(/<View style=\{\[styles.statusMeta,/g) || []).length !== 1) {
  throw new Error('Policy Intake summary must render status/date only once.');
}
requireText(manufacturerLogo, 'getPartnerManufacturerLogoSource(name)', 'Partner manufacturer logo must reuse the catalog mapping.');
requireText(manufacturerLogo, 'fallback ?? null', 'Partner manufacturer logo must preserve fallback artwork.');


// Website detail parity: keep populated authorized OCR fields and review notes
// visible, but do not render empty placeholder rows for sparse OCR results.
for (const required of [
  'const vehicleReviewKeys:',
  'const policyReviewKeys:',
  "'vehicle_chassis_number'",
  "'vehicle_engine_number'",
  "'vehicle_rto_name'",
  "'vehicle_fuel_type'",
  "'vehicle_manufacturing_year'",
  "'vehicle_capacity'",
  "'cpa_opted'",
  "'cpa_premium'",
  "'tax_amount'",
  "'gross_premium'",
  'row.ocr_warnings',
  'row.submitted_by_name',
  'getPartnerPolicyIntakeDocumentUrl(row.id)',
  'View policy copy',
  'Review status',
  'Review notes',
  'row.review_access.can_review',
  'row.review_access.can_finalize',
  'Review & Finalize',
]) requireText(detailScreen, required, `Partner Intake detail must preserve website parity: ${required}`);
for (const required of [
  'vehicleReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim()))',
  'vehicleReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map',
  'policyReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim()))',
  'policyReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map',
  'No vehicle details were fetched from the saved policy copy.',
  'No policy or premium details were fetched from the saved policy copy.',
  'Fetching vehicle details from the policy copy…',
  'Fetching policy and premium details…',
]) requireText(detailScreen, required, `Sparse OCR must preserve compact extracted-only review behavior: ${required}`);
if (detailScreen.includes('vehicleReviewKeys.map(([key, label]) =>') ||
    detailScreen.includes('policyReviewKeys.map(([key, label]) =>')) {
  throw new Error('Non-duplicate review must not render all OCR labels as empty dashes.');
}
// Review Notes is the final section for every status, including Duplicate,
// Action Required, In Review, Processing, Completed and Rejected.
const statusPosition = detailScreen.indexOf('style={reviewStyles.reviewStatus}');
const operationsNotePosition = detailScreen.indexOf('<Text style={reviewStyles.operationsNoteHeading}>Operations Note</Text>');
const requestPosition = detailScreen.indexOf('accessibilityLabel="Request information from submitter"');
const rejectPosition = detailScreen.indexOf('accessibilityLabel="Reject policy intake"');
const reviewNotesPosition = detailScreen.indexOf("{row.ocr_warnings?.length ? (");
const sheetEndPosition = detailScreen.indexOf('      <Modal', reviewNotesPosition);
if (!(statusPosition >= 0 && operationsNotePosition > statusPosition &&
      requestPosition > operationsNotePosition && rejectPosition > requestPosition &&
      reviewNotesPosition > rejectPosition && sheetEndPosition > reviewNotesPosition)) {
  throw new Error('Review Notes must be last, below all sections and Operations actions.');
}
if ((detailScreen.match(/<Text style=\{reviewStyles.warningHeading\}>Review notes<\/Text>/g) || []).length !== 1) {
  throw new Error('Review Notes must render exactly once across all intake statuses.');
}
if (detailScreen.includes("row.status === 'duplicate' && row.ocr_warnings?.length") ||
    detailScreen.includes("row.status !== 'duplicate' && row.ocr_warnings?.length")) {
  throw new Error('Review Notes must not use different placement by intake status.');
}
requireText(detailScreen, 'row.ocr_warnings.map((warning, index)', 'Preserve all OCR warning messages.');
requireText(service, '/api/partner/policy-intakes/${encodeURIComponent(id)}/document', 'Partner document viewer must use existing scoped signed URL endpoint.');
requireText(api, 'ocr_fields,ocr_warnings,attention_reason', 'Detail API must include OCR review notes.');
requireText(api, 'resolveIntakeSubmitterNames(admin, [intake])', 'Detail API must resolve the actual authorized submitter rather than guessing lead source.');
if (detailScreen.includes('Fetched policy details (OCR)')) throw new Error('Remove duplicate unstructured OCR review dump.');

// Native policy onboarding layout: preserve actual Motor booking capability and
// all persisted draft inputs while adopting compact reference-style sections.
const nativeOnboarding = fs.readFileSync(path.join(root, 'app/policy-intakes/onboarding.tsx'), 'utf8');
const nativeApi = fs.readFileSync(path.resolve(root, '../web-portal/app/api/partner/policy-intakes/native-onboarding/route.ts'), 'utf8');
for (const expected of [
  "const sourceSection=()=> <View style={styles.section}>",
  "isMotor?motorVehicleSection",
  "motorProductSection=section('03','Policy product, premium & validity',motorProductFields)",
  "styles.registrationToggle",
  "styles.registrationRow",
  "Onboarding summary",
]) {
  requireText(nativeOnboarding, expected, 'Native onboarding missing approved section: ' + expected);
}
requireText(nativeOnboarding, "fields:{padding:12,flexDirection:'row',flexWrap:'wrap'", 'Native onboarding uses responsive two-column fields.');
requireText(nativeOnboarding, "field:{width:'48%'", 'Each native form field fits its column.');
for (const fragment of ["sourceCell:{width:'48%'", "sourcePrimary:{width:'100%'",
  "policy.slice(0,4).map(item", "field(item,true)", "sourceMeta('rmName','RM')", "sourceMeta('intermediaryCode','ID')",
  "key:'ppt',label:'PPT - Premium paying term'", "key:'pd',label:'PD - Policy duration / term'",
  "dirty?'Unsaved changes':'Draft'", "{current}", "items.map(item=>field(item))"]) {
  requireText(nativeOnboarding, fragment, 'Compact onboarding parity missing: '+fragment);
}
requireText(nativeOnboarding, "placeholder={productType==='Non Motor'?'':hint}", 'Non-Motor fields are blank by default while Motor retains contextual hints.');
requireText(nativeOnboarding, "'Pending after RTO registration'", 'Unregistered registration number must show a pending hint.');
const dateField = fs.readFileSync(path.join(root, 'components/policy-intakes/partner-policy-date-field.tsx'), 'utf8');
requireText(dateField, 'fullWidth=false', 'Source date must fit its compact source cell.');
requireText(dateField, "{value?displayIndianDate(value):hidePlaceholder?'':'DD/MM/YYYY'}", 'Date hints must reappear unless expressly suppressed.');
requireText(dateField, 'placeholder={hidePlaceholder?', 'The calendar input supports a DD/MM/YYYY placeholder.');

requireText(nativeOnboarding, 'useState(false)', 'Commercial section initializes collapsed.');
requireText(nativeOnboarding, 'styles.referenceCommercial', 'Commercial summary uses the requested reference layout.');
if (nativeOnboarding.includes('OD + TP + Add-on + CPA')) throw new Error('Hide old OD + TP summary breakdown.');
for (const key of ['insuredName','phoneNo','registrationNo','vehicleClass','make','model','policyProduct','policyNo','insurerId','idv','od','tp','cpa','validFrom','validUpto']) {
  if (!nativeOnboarding.includes("key:'" + key + "'")) throw new Error('A persisted Motor field was removed from the form: ' + key);
}
for (const safeguard of ['saveNativePolicyOnboarding(id,data.revision,draft)', 'bookNativePolicyOnboarding(id,revision,resolution,verifiedApprovalId)', 'lookupNativePolicyRc(id,draft.registrationNo)']) {
  requireText(nativeOnboarding, safeguard, 'Preserve existing save, booking, RC lookup and document access: ' + safeguard);
}
requireText(nativeApi, 'if(d.businessLine!=="Motor")', 'Do not misrepresent Motor-only native booking as Life/Health parity.');

for(const fragment of [
  "editable={draft?.registrationMode==='registered'}",
  "disabled={draft?.registrationMode!=='registered'||lookingUpRc||!registrationValid}",
  "field(motorVehicleFields[9])",
  "motorVehicleFields.slice(7,9).map(item=>field(item))",
  "editable={draft?.vehicleClass!=='CPM'}",
  "(f.key==='capacity'&&!draft.vehicleClass)",
  "(f.key==='policyProduct'&&!draft.vehicleClass)",
  "draft.policyProduct==='Third Party'",
  "matchedSource?.rmCode",
  "matchedSource?.mobile",
  "payinSummaryExpanded",
  "Actual receipt history is not provided for this intake draft.",
  "TOTAL AGREED PAYOUT",
  "PROJECTED TOTAL PAY-IN",
]) requireText(nativeOnboarding, fragment, 'Motor Operations parity regression: '+fragment);
for(const fragment of [
  "import { loadPospMispAssociates }",
  '.eq("intermediary_code",intake.lead_source_code)',
  'item.intermediary_type===intake.lead_source_type',
  'sourceMeta={name:selected.display_name.trim()',
]) requireText(nativeApi,fragment,'Scoped source metadata regression: '+fragment);
requireText(nativeOnboarding, '[styles.field,styles.wideField,styles.registrationBlock]', 'Registration field must fill the whole mobile row.');
requireText(nativeOnboarding, '[styles.field,styles.wideField]', 'RTO must occupy a full-width row.');
requireText(nativeOnboarding, 'summaryProgressStack', 'Stack reduced progress circle above In progress badge.');
requireText(nativeOnboarding, 'accessibilityLabel="Book Active Policy"', 'Preserve Motor booking beside Save and return.');
if(nativeOnboarding.includes('summaryDocuments')||nativeOnboarding.includes('Upload Forms')||nativeOnboarding.includes('Form uploads are available in Operations Portal.')) throw new Error('Remove onboarding document blocks and redundant upload helper copy.');
if(nativeOnboarding.includes('View submitted policy copy')) throw new Error('Remove document action from onboarding; register/details flows remain separate.');
console.log('Partner Policy Intake source, policy-type and detail presentation contracts verified.');
