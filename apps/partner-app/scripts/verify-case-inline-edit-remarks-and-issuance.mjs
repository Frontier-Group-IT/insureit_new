import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const app=read('apps/partner-app/app/life-health-cases/[id].tsx');
const client=read('apps/partner-app/lib/life-health-cases.ts');
const api=read('apps/web-portal/app/api/partner/life-health-cases/route.ts');
const action=read('apps/web-portal/app/policies/life-health-policy-actions.ts');
const engine=read('apps/web-portal/lib/life-health-case-conversion-engine.ts');
for(const [key,hint] of Object.entries({
 customerName:'Enter name',customerPhone:'Enter mobile',customerAddress:'Enter address',
 insurerId:'Select insurer',productName:'Enter product',proposalNumber:'Enter proposal no.',
 premiumPayingTerm:'Select PPT',policyDuration:'Select PD',paymentFrequency:'Select frequency',
 paymentMode:'Select mode',premiumAmount:'Enter amount'
})){
 assert.ok(app.includes(key+":'"+hint+"'"),'Missing compact case placeholder '+key);
}
for(const [key,hint] of Object.entries({
 policyNumber:'Enter policy no.',finalPremium:'Enter premium',sumInsured:'Enter sum assured'
})){
 assert.ok(app.includes(key+":'"+hint+"'"),'Missing issuance placeholder '+key);
}
assert.match(app,/placeholder=\{CASE_FIELD_PLACEHOLDERS\[key\]\}/,'Inline text field uses mapped prompt');
assert.match(app,/ISSUE_FIELD_PLACEHOLDERS\[key as keyof typeof ISSUE_FIELD_PLACEHOLDERS\]/,'Issuance field uses mapped prompt');
assert.match(app,/numberOfLines=\{1\} ellipsizeMode="tail"/,'Selected long values stay within compact columns');
assert.match(app,/!form\[key\]&&styles\.datePlaceholder/,'Unselected dropdown prompt uses muted placeholder styling');
assert.match(app,/PartnerCaseBottomNavigation/);
assert.match(app,/navyTopBar navyStatusBar bottomNavigationNavy/);
assert.match(app,/heroSecond/);
assert.match(app,/justifyContent:'space-between'/);
assert.doesNotMatch(app,/Open Issuance Form|Edit Case Details|beginEdit|setEditing/);
for(const key of ['sourcingDate','customerName','customerPhone','customerAddress','insurerId','productName','proposalNumber','premiumPayingTerm','policyDuration','paymentFrequency','premiumAmount','paymentMode']){
  assert.ok(app.includes('inline("'+key+'"'),'Inline edit missing '+key);
}
assert.match(app,/record\?\.status_group==='issued'&&\['customerName','customerPhone','customerAddress'\]/);
assert.match(app,/record.status_group==='pending'\?<Section number="05" title="Mark Policy Issued" highlight/);
for(const key of ['policyNumber','issuanceDate','startDate','endDate','pptEndDate','nextInstallmentDate','finalPremium','sumInsured']){
  assert.ok(app.includes('issueField("'+key+'"'),'Missing issuance field '+key);
}
assert.ok(app.includes('>Create Policy</Text>'),'Pending case issuance button uses compact label');
assert.ok(app.includes("if(JSON.stringify(form)===JSON.stringify(initialForm(record)))"), 'Save Case detects unchanged forms without a database write');
assert.ok(app.includes("partnerAlert('No changes to save','Case details are already up to date.')"), 'No-change Save Case shows informational feedback');
assert.ok(app.includes("disabled={saving||issuing||documentBusy||rejectBusy}"), 'Save Case only disables during conflicting operations');
assert.ok(!app.includes("disabled={saving||issuing||documentBusy||rejectBusy||!caseDirty}"), 'Save Case is clickable when form has no changes');
assert.ok(app.includes("style={[styles.caseAction,styles.actionSave]}"), 'Save Case styling does not depend on dirty state');
assert.ok(app.includes("actionSave:{flex:1,borderColor:'#1765C1',borderWidth:1,backgroundColor:'#1765C1'}"), 'Save Case has visible blue active styling');

assert.match(app,/const showCreatePolicyError=\(message:string\)=>/, 'Create Policy failures must use shared feedback handling');
assert.match(app,/visible=\{Boolean\(createPolicyError\)\}/, 'Create Policy failure renders a custom dialog');
assert.match(app,/title="Unable to Create Policy"/, 'Error dialog identifies failed action');
assert.match(app,/actions=\{\[\{label:'OK',onPress:\(\)=>setCreatePolicyError\(''\)\}\]\}/, 'Create Policy error dialog has an OK dismissal');
for(const cause of ['Enter a valid policy number', 'Enter a valid DD/MM/YYYY date', 'Save your case edits before issuing the policy.']){
 assert.ok(app.includes('showCreatePolicyError(\''+cause), 'Create Policy failure should be shown in popup: '+cause);
}
assert.match(app,/catch\(e\)\{showCreatePolicyError\(e instanceof Error\?e.message:/,'Backend issuance failures use the custom popup');
assert.doesNotMatch(app,/\{issueError\?<Text style=\{styles.saveError\}>\{issueError\}<\/Text>:null\}\s*<\/Section>:null\}/,'No hidden inline error remains in Section 05');

assert.match(app,/onPress=\{\(\)=>void submitIssue\(\)\}/,'Create Policy retains verified issuance handler');
assert.ok(app.includes('remarkSection'), 'Remarks use a standalone section');
assert.ok(app.includes('styles.sectionHighlight') && app.includes('styles.sectionHeaderHighlight'), 'Section 05 has its Operations-style highlight');
assert.ok(app.includes('styles.centeredModalBackdrop') && app.includes("justifyContent:'center'"), 'Remarks and Reject use centered modal positioning');
assert.ok(app.includes('styles.centeredModalKeyboardAvoid') && app.includes('style={styles.remarkKeyboardAvoid}'), 'Centered dialogs accommodate keyboard');
assert.ok(app.includes("record.remarks.trim().split(/\\n\\s*\\n/)"), 'Separate saved remarks receive activity-style dividers');
assert.ok(app.includes('style={styles.activity}><Text style={styles.paragraph} selectable>{remark}</Text>'), 'Each saved remark has a divider');
const section3=app.slice(app.indexOf('<Section number="03"'),app.indexOf('<Section number="04"'));
assert.ok(section3.indexOf('inline("proposalNumber"')<section3.indexOf('inline("paymentFrequency"'), 'Payment frequency follows case/proposal number');
assert.ok(section3.includes('inline("proposalNumber","Case / proposal number",record.proposal_number,true)'), 'Case number uses half width');
const premiumSection=app.slice(app.indexOf('<Section number="04" title="Premium & payment">'),app.indexOf('<Section number="05" title="Mark Policy Issued" highlight>'));
assert.ok(premiumSection.includes('</Section>') && premiumSection.includes('styles.remarkSection'), 'Separate Remarks card follows premium section');
assert.ok(app.includes("(record.status_group==='pending'||record.status_group==='rejected')?<View style={styles.remarkSection}>"), 'Remarks section remains visible for pending and rejected cases');
assert.ok(app.includes("disabled={record.status_group==='rejected'}"), 'Rejected cases cannot activate Add Remark');
assert.ok(app.includes("accessibilityState={{disabled:record.status_group==='rejected'}}"), 'Rejected Add Remark is accessibility-disabled');
assert.ok(app.includes("if(record.status_group!=='pending')return;setRemarkError('');setRemarkOpen(true);"), 'Remark popup opens only on pending cases');
assert.ok(app.includes("if(!record||record.status_group!=='pending'||remarkSaving||!remarkDraft.trim())return;"), 'Remark submit guard prevents rejected writes from the app');
assert.ok(app.includes("remarkHeaderActionDisabled") && app.includes("remarkHeaderTextDisabled"), 'Rejected Add Remark appears visibly disabled');
assert.ok(app.includes("record.status_group==='rejected'?'lock-closed-outline':'add-circle-outline'"), 'Rejected Add Remark shows lock status');
assert.ok(app.includes('record.remarks?.trim()'), 'Remarks history remains visible in the record');
assert.ok(app.includes("const [expandedCaseTab,setExpandedCaseTab]=useState<'activity'|'remarks'|null>(null)"), 'Both tabs start collapsed');
assert.ok(app.includes('setExpandedCaseTab(previous=>previous===tab?null:tab)'), 'Tapping active tab collapses and switching opens only one');
assert.ok(app.includes("expandedCaseTab==='remarks'"), 'Remarks history appears only when remarks tab expands');
assert.ok(app.includes("expandedCaseTab==='activity'"), 'Activity history appears only when activity tab expands');
assert.equal((app.match(/style=\{styles\.activityRow\}/g)||[]).length,2,'Pending/rejected and issued Activity tabs both show right-aligned timestamps');
assert.equal((app.match(/style=\{styles\.activityTimestamp\}/g)||[]).length,2,'Every case activity timestamp uses the right-aligned style');
assert.ok(app.includes("activityRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8}"),'Case activity uses a horizontal status and timestamp row');
assert.ok(app.includes("activityDetails:{flex:1,minWidth:0,gap:4}") && app.includes("textAlign:'right',width:130"),'Activity actor and title remain on the left while date/time stays readable on the right');

assert.ok(app.includes("setExpandedCaseTab(null)"), 'Tab state resets on screen focus');
assert.ok(app.includes("KeyboardAvoidingView") && app.includes("Platform.OS==='ios'?'padding':'height'"), 'Remark modal avoids iOS and Android keyboards');
assert.ok(app.includes('keyboardShouldPersistTaps="handled"'), 'Remark modal scrolling supports keyboard interaction');
assert.ok(app.includes('accessibilityLabel="Close remark popup"'), 'Remark popup has an accessible close control');
assert.ok(app.includes('placeholder="Write a remark"'), 'Remark textarea matches reference');
assert.ok(app.includes('scrollEnabled style={styles.remarkTextArea}'), 'Long remark text remains scrollable');
assert.ok(app.includes('appendLifeHealthCaseRemark(record.id,remarkDraft)'), 'Append-only save remains connected');
assert.ok(app.includes('issueSchedule(value,form)'), 'Policy start date recalculates issuance dates');
assert.ok(app.includes('issueSchedule(issue.startDate,nextForm)'), 'Term changes recalculate issuance dates');
assert.ok(app.includes('dateOverrides.endDate'), 'Manual date overrides survive term changes');
assert.match(app,/Not applicable · Single Pay/, 'Single Pay does not request PPT end date');
assert.match(app,/Not applicable · One Time/, 'One-time payment does not request another installment');
assert.ok(!app.includes('numberOfLines={4}>{record.remarks}'), 'Saved remarks must not be truncated');
assert.match(app,/appendLifeHealthCaseRemark/);
assert.match(api,/input\?\.operation==="append_remark"/);
assert.match(api,/input\?\.operation==="issue_approval_request"/);
assert.match(api,/verifyPolicyDateApprovalForVerifiedActor/);
assert.match(api,/convertLifeHealthCaseForVerifiedActor\(form,profile\)/);
assert.match(api,/canAccessOperationsHeadCase\(profile.id,id\)/);
assert.match(api,/hasEffectiveCapability\(profile,"create_policies","edit"\)/);
assert.match(api,/\.eq\("updated_at",expected\)/);
assert.match(client,/issueLifeHealthPolicy/);
assert.match(action,/return convertLifeHealthCaseForVerifiedActor\(formData,profile\)/);
assert.match(engine,/consumePolicyDateApproval/);
assert.match(engine,/policy_no_normalized/);
assert.match(engine,/final_policy_id",null/);
assert.ok(app.includes("const darkLabel=['insurerId','productName','proposalNumber','paymentFrequency','premiumPayingTerm','policyDuration','premiumAmount','paymentMode'].includes(key)"), 'Section 03 and 04 labels use scoped high contrast');
assert.ok(app.includes("fieldLabel:{fontSize:9,color:'#000000'"), 'All Case Register field headings use black text');
assert.ok(app.includes("darkFieldLabel:{color:'#000000'}"), 'Scoped Life/Health headings use black text');
assert.ok(app.includes('darkLabel={darkLabel}'), 'Read-only Case Details fields retain high contrast in Sections 03 and 04');
assert.ok(app.includes('<Field label="PPT end date" value="Not applicable · Single Pay" darkLabel/>'), 'PPT fallback keeps black heading');
assert.ok(app.includes('<Field label="Next installment date" value="Not applicable · One Time" darkLabel/>'), 'Next installment fallback keeps black heading');
assert.ok(app.includes('name="calendar-outline" size={15} color="#000000"'), 'Issuance date picker icons are black');

assert.ok(app.includes("disabled={rejectBusy||!rejectReason.trim()}"), 'Confirm Reject is disabled while busy or when reason is blank.');
assert.ok(app.includes("rejectReason.trim()&& !rejectBusy?styles.confirmRejectButtonActive:styles.confirmRejectButton"), 'Confirm Reject becomes dark red with a nonblank reason.');
assert.ok(app.includes("confirmRejectButton:{backgroundColor:'#D98D93'}"), 'Empty or busy rejection shows light pink.');
assert.ok(app.includes("confirmRejectButtonActive:{backgroundColor:'#B4232D'}"), 'Entered rejection reason displays dark red.');
assert.ok(app.includes("rejectBusy?'Rejecting…':'Confirm Reject'"), 'Submitting feedback remains in place.');
assert.match(app, /const caseDocumentDisplayName=/, 'Encoded document filename is decoded for display only');
assert.match(app, /decodeURIComponent\(fileName\)/, 'Friendly filename uses safe URI decoding');
assert.match(app, /caseDocumentDisplayName\(doc\.file_name\)/, 'Document list displays a readable filename');
assert.match(app, /<PartnerConfirmDialog[\s\S]*?visible=\{Boolean\(deleteTarget\)\}/, 'Document removal uses shared Partner popup directly');
assert.match(app, /kind="delete"/, 'Document confirmation uses destructive visual treatment');
assert.match(app, /documentBusy[\s\S]*?setDeleteTarget\(null\)/, 'Document confirmation respects busy state');
assert.match(app, /await mutateLifeHealthDocument\(record\.id,documentId,'delete_document'\)/, 'Document deletion keeps existing authorized backend operation');
assert.doesNotMatch(app, /partnerAlert\('Delete document\?'/, 'Document delete must not fall back to a native/system alert bridge');
assert.ok(app.includes('const load=useCallback(async(silent=false):Promise<boolean>=>'), 'Life/Health refresh supports non-blocking background reloads.');
assert.ok(app.includes("if(!silent){setLoading(true);setError('');}"), 'Silent refresh does not activate full-page loading state.');
assert.ok(app.includes('finally{if(!silent)setLoading(false);}'), 'Silent refresh cannot unmount the case view.');
assert.ok(app.includes('const refreshed=await load(true);'), 'Remark and Reject both refresh without hiding the page.');
assert.equal((app.match(/const refreshed=await load\(true\);/g)||[]).length,2, 'Both Remark and Reject use silent refresh.');
assert.ok(!app.includes("setRemarkOpen(false);setRemarkDraft('');setExpandedCaseTab('remarks');"), 'Remark save must not expand panels and shift scroll.');
assert.ok(app.includes("partnerAlert('Remark saved'") && app.includes("partnerAlert('Case rejected'"), 'Saved actions report refresh failures separately from mutation failures.');
console.log('Case inline edit, append-only remarks, secure issuance and native parity verified.');
