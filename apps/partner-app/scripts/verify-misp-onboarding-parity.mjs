import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../app/partner-new.tsx');
const form=read('../components/misp-partner-form.tsx');
const partnerNew=read('../app/partner-new.tsx');
const documents=read('../app/partner-documents.tsx');
const route=read('../app/_layout.tsx');
const permissions=read('../lib/partner-permissions.ts');
const api=read('../../web-portal/app/api/partner/onboarding/partner-only/route.ts');
const docsApi=read('../../web-portal/app/api/partner/onboarding/documents/route.ts');
const web=read('../../web-portal/app/customers/posp-misp/new/misp-modern-onboarding-form.tsx');
assert.match(app,/useState<"posp"\|"misp">\("posp"\)/,'POSP is selected by default');
assert.match(app,/styles.typeOption/,'50/50 category controls are present');
assert.match(app,/partnerType==="misp"\?<MispPartnerForm/,'MISP has independent screen content');
assert.match(app,/onDirtyChange=\{setMispDirty\}/,'MISP form warns about unsaved details');
for(const label of ['MISP details','Designated Person (DP)','Address','Bank & tax']){
  assert.ok(form.includes(label),'Missing native MISP section: '+label);
  assert.ok(web.includes(label),'Reference website section missing: '+label);
}
for(const field of [
  'document_received_at','oem_name','associate_employee_id','misp_name','pan_number',
  'dp_first_name','dp_middle_name','dp_last_name','date_of_birth','dp_phone','dp_email','dp_pan_number','aadhaar_number',
  'address','city','state','postal_code','bank_id','bank_account_number','bank_ifsc_code','gst_number',
]){
  assert.ok(form.includes("key:'"+field+"'"),'Missing MISP field '+field);
  assert.ok(web.includes('name="'+field+'"'),'Field not found on website MISP reference: '+field);
}
// Both Add Partner variants must share the reference-style centered, one-tap date calendar.
const sharedCalendar=read('../components/policy-intakes/partner-policy-calendar-dialog.tsx');
assert.match(app,/PartnerPolicyCalendarDialog/,'POSP uses the reference calendar');
assert.match(form,/PartnerPolicyCalendarDialog/,'MISP uses the same reference calendar');
assert.match(form,/visible=\{Boolean\(dateField\)\}/,'MISP calendar appears as a modal');
assert.match(form,/maximumDate=\{new Date\(\)\}/,'MISP cannot select future dates');
assert.match(form,/onConfirm=\{date => \{/,'MISP commits a selected day immediately');
assert.match(form,/setDateField\(null\)/,'MISP calendar closes after selection or dismissal');
assert.doesNotMatch(form,/DateTimePicker|display=\{Platform\.OS===/,'MISP must not open a bottom native date picker');
assert.match(sharedCalendar,/onPress=\{\(\) => onConfirm\(candidate\)\}/,'The shared calendar selects days without OK or Done');
// Native POSP and MISP now share Save Detail and the optional document popup.
assert.ok(form.includes('Save Detail'),'MISP uses the native Save Detail action');
assert.ok(form.includes('Upload Documents'),'MISP can open document-category popup after save');
assert.ok(form.includes('Not Now'),'MISP can save without document upload');
assert.match(form,/visible=\{documentsOpen\}/,'MISP categories render in a separate modal');
for(const label of ['Save & Exit','Upload Documents']){
  assert.ok(web.includes(label),'Website reference action missing: '+label);
}
assert.match(api,/input.partner_type === "misp" \? "misp" : "posp"/,'MISP is saved with true MISP type');
assert.match(api,/dp_aadhaar_number_encrypted:isMisp\?aadhaarEncrypted:null/,'DP Aadhaar encrypted separately');
assert.match(api,/isEmployeeWithinAccessScope/,'RM employee scope enforced');
assert.match(api,/brandRows/,'OEM master list comes from real manufacturer brands');
assert.match(api,/pendingMisps/,'Server retains saved MISP application records');
assert.doesNotMatch(app,/pendingMisps|setPendingMisps/,'New Partner screen must not request saved MISP list');
assert.doesNotMatch(form,/Continue saved MISP documents|pendingMisps/,'New MISP form must not display saved applications');
assert.ok(route.includes('name="partner-documents"'),'Document route is registered');
assert.match(permissions,/partner-new\|partner-documents/,'Native MISP document route requires Add Partner permission');
for(const type of ['aadhaar_front','aadhaar_back','pan_copy','cancelled_cheque','photograph','gst_copy',
  'education_10th_marksheet','signed_registration_form','custom_1','custom_2']){
  assert.ok(documents.includes("key:'"+type+"'"),'Missing MISP document slot '+type);
  assert.ok(docsApi.includes('"'+type+'"'),'Server must authorize document type '+type);
}
assert.match(documents,/expo-document-picker/,'Native document picker installed');
assert.match(documents,/partner\/onboarding\/documents/,'Use bearer-authorized document upload endpoint');
assert.match(docsApi,/partner_app_current_identity/,'Documents require verified employee identity');
assert.match(docsApi,/\.eq\("initiated_by",profile.id\)/,'Documents are restricted to initiating employee');
assert.match(docsApi,/\.eq\("requested_type","misp"\)/,'Document route cannot upload for POSP using MISP IDs');
assert.match(docsApi,/finalize_partner_activation_v2/,'Complete document stage uses same atomic activation');
assert.match(docsApi,/MAX_BYTES=10\*1024\*1024/,'10 MB file limit');
assert.match(docsApi,/verification_status:"pending"/,'Uploaded documents require review');
assert.doesNotMatch(form+documents,/EXPO_PUBLIC_SUPABASE_SERVICE_ROLE/,'Service role key never sent to mobile');
console.log('Partner POSP/MISP 50-50 selector, website MISP field parity and secure native document stage contracts passed.');
