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
assert.match(form, /Save & Exit/);
assert.match(form, /Upload Documents/);
const scrollStart=form.search(/<ScrollView\b[^>]*keyboardShouldPersistTaps="handled"[^>]*contentContainerStyle=\{styles\.content\}[^>]*>/);
const footer=form.indexOf('<View style={styles.actionFooter}>');
const scrollEnd=form.indexOf('</ScrollView>',scrollStart);
assert.ok(scrollStart>=0 && footer>scrollStart && footer<scrollEnd,
  'Save & Exit and Upload Documents must scroll with Add Partner form instead of staying in a fixed footer');
assert.ok(form.indexOf("sections.map((section, index)")<footer,
  'Save actions must appear after all Add Partner form sections');
assert.match(form, /actionFooter: \{ backgroundColor: '#E7EEFC'/,
  'POSP actions should sit in a dedicated light background panel');
assert.match(form, /actionButton: \{ flex: 1, minWidth: 0/,
  'POSP Save & Exit and Upload Documents should share equal available width');
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
assert.match(form, /savePartner\('exit'\)/);
assert.match(form, /savePartner\('upload'\)/);
assert.match(form, /person-add-outline/);
assert.ok(form.includes('/api/partner/onboarding/partner-only/documents'), 'Missing Partner documents endpoint');
assert.match(form, /api\/partner\/onboarding\/partner-only/);
assert.doesNotMatch(form, /Add POSP|Add MISP|Create POSP|Create MISP/);
assert.match(form, /canPartnerAccess\(context, 'create_intermediary_application', 'edit'\)/);
console.log('Add Partner-only native action, secure route and form verified.');
