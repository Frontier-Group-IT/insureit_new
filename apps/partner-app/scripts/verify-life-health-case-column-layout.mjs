import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const screen=read('apps/partner-app/app/life-health-cases/[id].tsx');
const api=read('apps/partner-app/lib/life-health-cases.ts');
const web=read('apps/web-portal/components/life-health-case-detail.tsx');
for(const [number,title] of [
  ['01','Policy source & ownership'],['02','Customer / proposer'],
  ['03','Policy product & case details'],['04','Premium & payment'],
  ['05','Mark Policy Issued'],['06','Documents'],['07','Activity status & remarks'],
]){
  assert.ok(screen.includes('number="'+number+'" title="'+title+'"'),title+' matches web section order');
  assert.ok(web.includes('number="'+number+'" title="'+title+'"')||['Documents','Activity status & remarks'].includes(title),title+' is sourced from Operations form');
}
for(const label of ['Proposal date','Policy type','Intermediary type','Lead source',
  'Client / proposer name','Client mobile number','Address','Insurance company','Product name',
  'Case / proposal number','PPT · Premium Paying Term','PD · Policy Duration / Term',
  'Payment frequency','Premium amount','Payment mode']){
  assert.ok(screen.includes('label="'+label+'"'),'Missing field '+label);
}
assert.match(screen,/styles\.grid/,'Short fields use mobile columns');
assert.match(screen,/fieldWide:\{width:'100%'\}/,'Long fields span full width');
assert.match(screen,/field:\{width:'48%'/,'Native two-column width is defined');
assert.match(screen,/fieldLabel:/,'Field labels appear above boxed values');
assert.match(screen,/dateLabel\(record\.sourcing_date\)/,'Dates show the Operations DD/MM/YYYY convention');
assert.match(screen,/record\.status_group==='pending'\?<Section number="05"/,'Issuance section only for pending cases');
assert.match(screen,/onPress=\{\(\)=>void openOperations\(\)\}/,'Issuance delegates to authorized Operations workflow');
assert.match(screen,/canPartnerAccessCaseRegister\(context\)/,'Existing Case Register permission remains enforced');
assert.match(screen,/getLifeHealthCase\(id\)/,'Scoped read-only case API is preserved');
assert.match(api,/operationsCaseUrl\(id: string\)/,'Operations link is canonical');
assert.match(screen,/documents\.length>0\?<Section number="06"/,'Documents section only renders real files');
assert.match(screen,/documents\.map\(doc=>/,'Document entries come only from case API');
assert.match(screen,/\{doc\.file_name\}/,'Only real file name is shown');
assert.doesNotMatch(screen,/No documents recorded|Document viewing, uploads and deletion|For case editing, adding remarks|You may need to sign in/,'No footer explanations or empty document placeholders');
assert.doesNotMatch(screen,/function Item\(/,'Old label-value stacking is removed');
assert.doesNotMatch(screen,/uploadLifeHealthCaseDocument|convertLifeHealthCaseToPolicy|deleteLifeHealthCaseDocument|rejectLifeHealthCase/,'No unapproved native mutations');
console.log('Partner Life/Health case details: numbered, read-only two-column layout and actual-only documents verified.');
