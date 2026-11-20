import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const policies = read('../app/(tabs)/policies.tsx');
const form = read('../app/partner-new.tsx');
const permissions = read('../lib/partner-permissions.ts');
const stack = read('../app/_layout.tsx');
assert.match(policies, /identity\.actor_kind === 'employee' && canPartnerAccess\(context, 'create_intermediary_application', 'edit'\)/);
assert.match(policies, /route: '\/partner-new' as const/);
assert.match(policies, /onPress=\{\(\) => router\.push\(action\.route\)\}/);
assert.match(policies, /Add Partner/);
assert.match(stack, /name="partner-new"/);
assert.match(permissions, /partner-new\|partner-documents/, "Both Partner forms are capability-gated");
assert.match(permissions, /create_intermediary_application', minimum: 'edit'/);
assert.doesNotMatch(form, /Partner category|Individual Partner|Business Partner/, 'No category selection');
for (const heading of ['Identity & contact','Address','Bank & tax']) assert.ok(form.includes(heading));
for (const field of ['document_received_at','associate_employee_id','pos_first_name','pos_middle_name','pos_last_name','pan_number','aadhaar_number','date_of_birth','mobile','email','address','city','state','postal_code','bank_id','bank_account_number','bank_ifsc_code','gst_number']) assert.ok(form.includes(field), 'Missing field: '+field);
assert.match(form, /authenticatedRequest\('GET'\)/);
assert.match(form, /Save Detail/);
assert.doesNotMatch(form, /<Text style=\{styles.sectionTitle\}>Documents<\/Text>/,'No inline Documents section after Bank & tax');
assert.match(form, /visible=\{uploadOpen\}/, 'Document categories open inside a separate modal');
assert.match(form, /<Text style=\{styles.modalTitle\}>Upload Documents<\/Text>/);
assert.match(form, /Would you like to upload documents now\?/);
assert.match(form, /text: 'Not Now'.*router\.replace\('\/\(tabs\)\/policies'\)/);
assert.match(form, /text: 'Upload Documents', singleLineNormalLabel: true, onPress: \(\) => setUploadOpen\(true\)/, 'Add Partner Upload Documents uses one-line normal-weight label while preserving upload action');
assert.match(form, /const savedId = applicationId;/, 'Upload requires an existing saved application');
assert.doesNotMatch(form, /applicationId \|\| await savePartner\(/, 'Upload cannot create application implicitly');
const scrollStart=form.search(/<ScrollView\b[^>]*keyboardShouldPersistTaps="handled"[^>]*contentContainerStyle=\{styles\.content\}[^>]*>/);
const footer=form.indexOf('<View style={styles.actionFooter}>');
const scrollEnd=form.indexOf('</ScrollView>',scrollStart);
assert.ok(scrollStart>=0 && footer>scrollStart && footer<scrollEnd,
  'Cancel and Save Detail should be inside the scrollable form');
assert.ok(form.indexOf('style={styles.documentList}')>scrollEnd,
  'Document categories must appear inside the modal, not inline with the main form');
assert.match(form, /actionFooter: \{ backgroundColor: '#E7EEFC'/,
  'POSP actions should sit in a dedicated light background panel');
assert.match(form, /actionButton: \{ flex: 1, minWidth: 0/,
  'POSP Cancel and Save Detail should share equal available width');
assert.match(form, /requiredStar: \{ color: '#DC2626' \}/,
  'POSP required field markers should be red');
const misp = read('../components/misp-partner-form.tsx');
assert.match(misp, /requiredStar:\{color:'#DC2626'\}/, 'MISP required field markers should be red');
assert.match(misp, /actions:\{flexDirection:'row',gap:8,padding:10,marginTop:4,backgroundColor:'#E7EEFC'/,
  'MISP action buttons should have matching dedicated background');
assert.match(misp, /secondary:\{[^\n]*flex:1,minWidth:0\}/,'MISP Cancel should occupy half the row');
assert.match(misp, /primary:\{[^\n]*flex:1,minWidth:0\}/,'MISP Save Detail should occupy half the row');
assert.match(misp, /Save Detail/,'MISP uses the same Save Detail label as POSP');
assert.match(misp, /Would you like to upload documents now\?/,'MISP uses the same short confirmation message');
assert.match(misp, /text:'Not Now'/,'MISP can save without uploading');
assert.match(misp, /text:'Upload Documents'/,'MISP offers document popup after save');
assert.match(misp, /visible=\{documentsOpen\}/,'MISP uses a category modal');
assert.match(misp, /await authorizedDocs\('DELETE',applicationId/,'MISP deletion uses authorized endpoint');
assert.match(misp, /await authorizedDocs\('POST',applicationId,payload\)/,'MISP upload uses authorized endpoint');
assert.match(misp, /await refreshDocuments\(applicationId\)/,'MISP refreshed saved file records');
assert.match(misp, /educationOptions/,'MISP retains education category variants');
assert.match(misp, /customNames/,'MISP retains custom document labels');
assert.match(misp, /maxHeight:Math\.min\(366,Math\.max\(190,windowHeight-220\)\)/,
  'MISP document popup must show approximately six rows while allowing all documents to scroll');
assert.match(misp, /documentSlots\.map\(slot=>/,
  'All MISP document rows remain in one continuous list');
assert.match(misp, /slot\.required\?<Text style=\{styles\.requiredStar\}> \*<\/Text>:null/,
  'MISP backend-required documents display red asterisks');
assert.match(misp, /key:'gst_copy',label:'GST Certificate',required:true/,
  'MISP GST certificate remains marked mandatory according to backend rules');
assert.match(misp, /accessibilityLabel="Select education category"/,
  'Education Marksheet uses a category dropdown instead of four chips');
assert.match(misp, /onPress=\{\(\)=>\{setEducationType\(option\.key\);setEducationOpen\(false\);\}\}/,
  'Education dropdown selection closes the menu and preserves the selected category');
assert.doesNotMatch(misp, /styles\.educationPill|styles\.educationOptions/,
  'Old horizontally wrapped education chips must be removed');
const mispScrollPosition=misp.indexOf('<ScrollView style={[styles.documentScroll');
const mispDonePosition=misp.indexOf('accessibilityLabel="Done uploading MISP documents"');
assert.ok(mispScrollPosition>=0&&mispDonePosition>misp.indexOf('</ScrollView>',mispScrollPosition),
  'MISP modal Done button stays fixed outside the document scrolling viewport');

assert.doesNotMatch(misp, /submit\('documents'\)/,'MISP does not create duplicate application on upload');
const mispRoute=read('../../web-portal/app/api/partner/onboarding/documents/route.ts');
assert.match(mispRoute,/export async function DELETE\(request:Request\)/);
assert.match(mispRoute,/const result=await authorize\(request,applicationId\)/,'MISP document delete reuses ownership and role checks');
assert.match(mispRoute,/\.eq\("document_type",type\)/,'MISP document delete targets one category');
assert.match(mispRoute,/\.eq\("storage_path",document.storage_path\)/,'MISP deletion matches stored object path');

assert.doesNotMatch(form, /Submit Partner application/);
assert.match(form, /onPress=\{\(\)=>void savePartner\(\)\}/);
assert.match(form, /showSavedChoice\(\);/, 'Successful Partner save opens optional document confirmation');
assert.match(form, /if \(applicationId\) \{[\s\S]*?showSavedChoice\(\);/, 'Revisiting saved form does not duplicate application');
assert.match(form, /Cancel Add Partner/);
assert.match(form, /Replace \$\{slot.label\}/);
assert.match(form, /Delete \$\{slot.label\}/);
assert.match(form, /onPress=\{\(\)=>deleteDocument\(slot.type\)\}/);
assert.match(form, /method: 'DELETE'/,'Delete uses authenticated endpoint');
assert.match(form, /setUploaded\(previous => \{ const next = \{ ...previous \}; delete next\[type\]; return next; \}\)/);
assert.match(form, /if \(!savedId\) \{/, 'Document upload is blocked until application exists');
const route = read('../../web-portal/app/api/partner/onboarding/partner-only/documents/route.ts');
assert.match(route, /export async function DELETE\(request: Request\)/);
assert.match(route, /application.initiated_by !== profile.id/,'Backend deletion checks owner');
assert.match(route, /getEffectivePermissionAccessMap\(profile\)/,'Backend deletion checks access');
assert.match(route, /\.eq\("document_type", documentType\)/,'Deletion only targets selected category');
assert.match(route, /\.eq\("storage_path", document.storage_path\)/,'Delete is scoped to the recorded storage path');

assert.match(form, /person-add-outline/);
assert.ok(form.includes('/api/partner/onboarding/partner-only/documents'), 'Missing Partner documents endpoint');
assert.match(form, /api\/partner\/onboarding\/partner-only/);
assert.doesNotMatch(form, /Add POSP|Add MISP|Create POSP|Create MISP/);
assert.match(form, /canPartnerAccess\(context, 'create_intermediary_application', 'edit'\)/);
assert.doesNotMatch(form, /partnerAlert\('Uploaded'/, 'A successful upload must not open the centered modal');
assert.match(form, /setUploadSuccessToken\(previous => previous \+ 1\)/, 'Only a confirmed upload triggers the Uploaded badge');
assert.match(form, /setTimeout\(\(\) => setShowUploadBadge\(false\), 1000\)/, 'Uploaded badge disappears after one second');
assert.match(form, /showUploadBadge \? <View pointerEvents="none"/, 'Uploaded badge overlays the document modal at the top-right');
assert.match(form, /styles\.uploadSuccessOverlay,\{top:Math\.max\(12,safeAreaInsets\.top\+8\)\}/, 'Badge respects the top safe area');
assert.match(form, /const \[validationAlert, setValidationAlert\]/, 'Form maintains an explicit validation-dialog state');
assert.match(form, /setValidationAlert\(\{field:firstInvalid,message:errors\[firstInvalid\]!\}\)/, 'Submit displays the actual first invalid field reason');
assert.match(form, /<PartnerConfirmDialog[\s\S]*?title="Action required"[\s\S]*?kind="error"/, 'Validation reuses the same centered alert design with red error icon');
assert.match(form, /if\(invalidField\)revealFirstError\(invalidField\)/, 'After acknowledgement, the invalid field is revealed');
assert.match(form, /const highlightedField = !loading && !applicationId/, 'Only active unsaved POSP form fields can be highlighted');
assert.match(form, /validationOrder\.find\(key => validatePartnerField\(key, form\) !== null\)/, 'Guide only the first missing or invalid field');
assert.match(form, /highlightedField === 'associate_employee_id' && styles\.invalidControl/, 'RM highlights red when not selected');
assert.match(form, /highlightedField === field\.key && styles\.invalidControl/, 'Only the guided date or text field highlights red');
assert.match(form, /highlightedField === 'bank_id' && styles\.invalidControl/, 'Bank selector follows the same single-field rule');
assert.doesNotMatch(form, /fieldErrors\[/, 'Do not highlight every invalid POSP field at the same time');
const order = form.match(/const validationOrder: Field\[\] = \[([\s\S]*?)\];/)?.[1];
assert.ok(order, 'POSP validation order exists');
assert.ok(order.indexOf("'associate_employee_id'") < order.indexOf("'pos_first_name'"), 'RM must be first');
assert.ok(order.indexOf("'pos_first_name'") < order.indexOf("'pan_number'"), 'Next highlight moves from First Name to PAN');
assert.ok(order.indexOf("'pan_number'") < order.indexOf("'aadhaar_number'"), 'Next highlight moves from PAN to Aadhaar');
assert.ok(order.indexOf("'bank_ifsc_code'") < order.indexOf("'document_received_at'"), 'Optional fields do not interrupt required fields');
assert.match(form, /const errors = validatePartner\(form\);/, 'Save Detail continues validating all fields');
assert.match(form, /const firstInvalid = validationOrder\.find\(key => errors\[key\]\)/, 'Save blocks the first invalid field');
assert.doesNotMatch(form, /<Text style=\{styles\.fieldError\}/, 'No duplicate inline error text beneath input fields');

// Mobile Partner completion remains explicit; the New Partner screen must not expose other saved applications.
const partnerOnlyRoute=read('../../web-portal/app/api/partner/onboarding/partner-only/route.ts');
assert.match(partnerOnlyRoute,/pendingPartners:/,'Server retains scoped saved Partner records for existing onboarding access');
assert.match(partnerOnlyRoute,/\.eq\("initiated_by",profile\.id\)/,'Saved applications remain scoped to the employee');
assert.doesNotMatch(form,/Resume saved Partner documents/,'New Partner form must be creation-only');
assert.doesNotMatch(form,/pendingPartners|resumePartner/,'New Partner form must not fetch or render the saved Partner list');
assert.match(form,/const loadSavedDocuments = async/);
assert.match(form,/method: 'PATCH'/,'Complete Partner action invokes explicit finalization');
assert.match(form,/Complete & Issue Partner ID/);
assert.match(form,/missingDocuments\.length > 0/,'Incomplete applications cannot be finalized from the app');
const partnerDocumentsRoute=read('../../web-portal/app/api/partner/onboarding/partner-only/documents/route.ts');
assert.match(partnerDocumentsRoute,/export async function GET\(request: Request\)/);
assert.match(partnerDocumentsRoute,/export async function PATCH\(request: Request\)/);
assert.match(partnerDocumentsRoute,/application\.initiated_by/,'Owner checked before retrieving or finalizing documents');
assert.match(partnerDocumentsRoute,/mobile_partner_only/,'Only app-created Partner records may be finalized here');
assert.match(partnerDocumentsRoute,/getEffectivePermissionAccessMap\(profile\)/);
assert.match(partnerDocumentsRoute,/PARTNER_REQUIRED_DOCUMENTS/);
assert.match(partnerDocumentsRoute,/finalize_partner_activation_v2/,'Use existing atomic issuance, never manually create an ID');

console.log('Add Partner-only native action, secure route and form verified.');
