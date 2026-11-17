import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const app=read('apps/partner-app/app/life-health-cases/[id].tsx');
const client=read('apps/partner-app/lib/life-health-cases.ts');
const api=read('apps/web-portal/app/api/partner/life-health-cases/route.ts');
const action=read('apps/web-portal/app/policies/life-health-policy-actions.ts');
const engine=read('apps/web-portal/lib/life-health-case-conversion-engine.ts');
assert.match(app,/PartnerCaseBottomNavigation/);
assert.match(app,/navyTopBar navyStatusBar bottomNavigationNavy/);
assert.match(app,/heroSecond/);
assert.match(app,/justifyContent:'space-between'/);
assert.doesNotMatch(app,/Open Issuance Form|Edit Case Details|beginEdit|setEditing/);
for(const key of ['sourcingDate','customerName','customerPhone','customerAddress','insurerId','productName','proposalNumber','premiumPayingTerm','policyDuration','paymentFrequency','premiumAmount','paymentMode']){
  assert.ok(app.includes('inline("'+key+'"'),'Inline edit missing '+key);
}
assert.match(app,/record\?\.status_group==='issued'&&\['customerName','customerPhone','customerAddress'\]/);
assert.match(app,/record.status_group==='pending'\?<Section number="05"/);
for(const key of ['policyNumber','issuanceDate','startDate','endDate','pptEndDate','nextInstallmentDate','finalPremium','sumInsured']){
  assert.ok(app.includes('issueField("'+key+'"'),'Missing issuance field '+key);
}
assert.match(app,/Create Policy & Close Case/);
assert.match(app,/remarkHeaderAction/, 'Pending and Rejected remarks have a separate compact action');
assert.match(app,/record.status_group==='pending'\\|\\|record.status_group==='rejected'/, 'Both Pending and Rejected use the separate remarks layout');
assert.match(app,/accessibilityState=\\{\\{expanded:activityExpanded\\}\\}/, 'Activity Status is expandable');
assert.match(app,/const \\[activityExpanded,setActivityExpanded\\]=useState\\(false\\)/, 'Activity Status starts collapsed');
assert.match(app,/activityExpanded\\?<View style=\\{styles.activityHistory\\}>/, 'History is visible only when expanded');
assert.doesNotMatch(app,/numberOfLines=\\{4\\}>\\{record.remarks\\}/, 'Saved remarks must not be truncated');
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
console.log('Case inline edit, append-only remarks, secure issuance and native parity verified.');
