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
assert.match(form, /text: 'Upload Documents', onPress: \(\) => setUploadOpen\(true\)/);
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
assert.match(misp, /secondary:\{[^\n]*flex:1,minWidth:0\}/,
  'MISP Save & Exit should occupy half the available row');
assert.match(misp, /primary:\{[^\n]*flex:1,minWidth:0\}/,
  'MISP Upload Documents should occupy half the available row');

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
console.log('Add Partner-only native action, secure route and form verified.');
