import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const screen=read('apps/partner-app/app/life-health-cases/[id].tsx');
const api=read('apps/partner-app/lib/life-health-cases.ts');
const web=read('apps/web-portal/components/life-health-case-detail.tsx');
for(const [number,title] of [
  ['01','Policy source & ownership'],['02','Customer / proposer'],
  ['03','Policy product & case details'],['04','Premium & payment'],
  ['05','Mark Policy Issued'],['06','Documents'],
]){
  assert.ok(screen.includes('number="'+number+'" title="'+title+'"'),title+' matches web section order');
  assert.ok(web.includes('number="'+number+'" title="'+title+'"')||['Documents','Activity status & remarks'].includes(title),title+' is sourced from Operations form');
}
for(const label of ['Proposal date','Policy type','Intermediary type','Lead source',
  'Client / proposer name','Client mobile number','Address','Insurance company','Product name',
  'Case / proposal number','PPT · Premium Paying Term','PD · Policy Duration / Term',
  'Payment frequency','Premium amount','Payment mode']){
  assert.ok(screen.includes('label="'+label+'"')||screen.includes(',"'+label+'"'),'Missing field '+label);
}
assert.match(screen,/styles\.grid/,'Short fields use mobile columns');
assert.match(screen,/fieldWide:\{width:'100%'\}/,'Long fields span full width');
assert.match(screen,/field:\{width:'48%'/,'Native two-column width is defined');
assert.match(screen,/fieldLabel:/,'Field labels appear above boxed values');
assert.match(screen,/dateLabel\(record\.sourcing_date\)/,'Dates show the Operations DD/MM/YYYY convention');
assert.match(screen,/record\.status_group==='pending'\?<Section number="05" title="Mark Policy Issued" highlight/,'Highlighted issuance section only for pending cases');
assert.match(screen,/issueLifeHealthPolicy\(record.id,data\)/,'Native issuance uses the verified Operations conversion endpoint');
assert.match(screen,/canPartnerAccessCaseRegister\(context\)/,'Existing Case Register permission remains enforced');
assert.match(screen,/getLifeHealthCase\(id\)/,'Scoped read-only case API is preserved');
assert.match(api,/operationsCaseUrl\(id: string\)/,'Operations link is canonical');
assert.match(screen,/<Section number="06" title="Documents">/,'Documents section includes upload actions for missing files');
assert.match(screen,/documents\.map\(doc=>/,'Document entries come only from case API');
assert.match(screen,/\{caseDocumentDisplayName\(doc\.file_name\)\}/,'Only real document filename is shown, with encoded characters decoded for display');
assert.doesNotMatch(screen,/Document viewing, uploads and deletion|For case editing, adding remarks|You may need to sign in/,'No legacy footer explanations');
assert.doesNotMatch(screen,/function Item\(/,'Old label-value stacking is removed');
assert.doesNotMatch(screen,/uploadLifeHealthCaseDocument|convertLifeHealthCaseToPolicy|deleteLifeHealthCaseDocument\(/,'No direct unauthenticated web server-action calls');
assert.doesNotMatch(screen,/<Section number="07" title="Activity status & remarks">/,'Activity Status heading is removed');
assert.match(screen,/styles\.activityCard/,'Activity Status and Remarks retain tabs without numbered header');
for(const title of ['Edit case details','Cancel editing case','Reject case','Save Case Details','Create Policy']){
  assert.ok(screen.includes('accessibilityLabel="'+title+'"'),'Missing action: '+title);
}
const actionStart=screen.indexOf("record.status_group==='pending'?<View style={styles.caseActions}>");
const actionBar=screen.slice(actionStart,screen.indexOf('</View>:null}',actionStart));
assert.ok(actionStart>0,'Pending case action bar exists');
const reject=actionBar.indexOf('accessibilityLabel="Reject case"');
const cancel=actionBar.indexOf('accessibilityLabel="Cancel editing case"');
const save=actionBar.indexOf('accessibilityLabel="Save Case Details"');
const create=actionBar.indexOf('accessibilityLabel="Create Policy"');
assert.ok(reject>=0&&reject<cancel&&cancel<save&&save<create,'Reject stays first, while edit mode offers Cancel Edit and Save, and view mode offers Create Policy');
assert.match(actionBar,/editMode\?<><Pressable/,'Case edit buttons are shown only after tapping the pencil');
assert.match(actionBar,/\:<Pressable accessibilityRole="button" accessibilityLabel="Create Policy"/,'Create Policy remains a separate view-mode action');
assert.match(screen,/const \[editMode,setEditMode\]=useState\(false\)/,'Case details start view-only');
assert.match(screen,/const editable=editMode&&canEditCase&&/,'Case fields require explicit pencil edit mode');
assert.doesNotMatch(actionBar,/accessibilityLabel="Cancel case edits"/,'Legacy navigation Cancel is not an edit-mode action');
assert.match(screen,/caseActionMiddle:\{flexDirection:'row',gap:7,width:'100%'/,'Three action buttons share one row');
assert.match(screen,/actionReject:\{width:'100%'/,'Reject is full width');
assert.match(screen,/actionSave:\{flex:1,/,'Save occupies one slot in three-column row');
assert.match(screen,/actionIssue:\{flex:1\.15,/,'Create Policy fits in compact three-column row');
assert.match(actionBar,/numberOfLines=\{1\}/,'Action labels are kept to one line');
assert.match(actionBar,/Create Policy<\/Text>/,'Policy button label is shortened');
assert.doesNotMatch(actionBar,/Complete the policy creation process|Create Policy & Close Case|<Ionicons/,'No subtitle, icons, or long policy label');
assert.match(screen,/caseActions:\{gap:8\}/,'No outer action card or background');
assert.match(screen,/getLifeHealthDocumentUrl/,'Documents can be opened through scoped URL');
assert.match(screen,/mutateLifeHealthDocument/,'Documents have an authenticated delete action');
assert.match(screen,/uploadLifeHealthDocument/,'Documents have an authenticated replace and upload action');
assert.match(screen,/documentBusy/,'Document mutations block concurrent submissions');
assert.match(screen,/documentList:\{width:'100%',gap:8\}/,'Document list occupies full available width');
assert.match(screen,/document:\{width:'100%',flexDirection:'row'/,'Each existing document occupies a full-width row');
assert.match(screen,/documentUploadGrid:\{width:'100%',flexDirection:'column'/,'Upload actions stack in one column');
assert.match(screen,/uploadButton:\{width:'100%',minHeight:45/,'Every missing-document upload action fills the row');
assert.match(screen,/numberOfLines=\{2\} ellipsizeMode="middle"/,'Long document names can use two lines without crowding actions');
console.log('Partner Life/Health case details: compact columns, four actions, document controls and tab parity verified.');
