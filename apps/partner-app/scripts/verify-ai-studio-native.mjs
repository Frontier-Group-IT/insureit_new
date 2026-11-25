import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const file = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const menu=file('../app/(tabs)/more.tsx');
const shell=file('../app/_layout.tsx');
const permissions=file('../lib/partner-permissions.ts');
const data=file('../lib/ai-studio.ts');
const screen=file('../app/ai-policy-studio.tsx');
const sql=file('../../../supabase/migrations/20261123154000_partner_native_ai_studio_read_rpc.sql');
assert(menu.includes('canPartnerUseAiStudio(context)') && menu.includes("router.push('/ai-policy-studio')"));
assert(shell.includes('name="ai-policy-studio"') && shell.includes("!canPartnerUseAiStudio(context)"));
assert(permissions.includes("['it_super_user', 'super_admin']") && permissions.includes("canPartnerAccess(context, 'manage_system', 'approve')"));
assert(data.includes("supabase.rpc('partner_app_ai_studio_list_v1'") && data.includes("supabase.rpc('partner_app_ai_studio_detail_v1'"));
assert(!data.includes('EXPO_PUBLIC_PORTAL_URL') && !data.includes('service_role') && !data.includes('supabase.from('));
assert(screen.includes("loadAiStudioPage(filter,pageIndex*PAGE_SIZE,PAGE_SIZE)") && screen.includes("loadAiStudioDetail(selected.id)"));
assert(screen.includes("All Open") && screen.includes("In Review") && screen.includes("Processing"));
assert(screen.includes("count('open')") && screen.includes("count('in_review')"));
assert(screen.includes("{key:'processing',title:'Processing'") && screen.includes("{key:'in_review',title:'In Review'") && screen.includes("{key:'action',title:'Action'"));
assert(screen.includes('{count(metric.key)}') && screen.includes("detail.processing_lane==='automation'"));
assert(screen.includes("count('in_review')/count('open')") && screen.includes('Math.round(100*'));
assert(screen.includes('loadAiStudioPage(filter,offset,25)') && screen.includes('setSearchRows(all.filter('));
assert(screen.includes('const PAGE_SIZE=10;') && screen.includes('const totalPages=Math.max(1,Math.ceil(matchingCount/PAGE_SIZE))'));
assert(screen.includes('Page {pageIndex+1} of {totalPages}') && screen.includes('Previous page') && screen.includes('Next page'));
// Keep the pager anchored to the full-height intake panel for empty and short buckets.
assert(screen.includes('screenContent:{flexGrow:1,paddingBottom:0}'));
assert(screen.includes("listSection:{backgroundColor:'#F4F6FB'") && screen.includes('paddingBottom:12,flexGrow:1}'));
assert(screen.includes("intakePanel:{backgroundColor:'#FFFFFF'") && screen.includes("overflow:'hidden',flexGrow:1}"));
assert(screen.includes('intakePageSpacer:{flexGrow:1,minHeight:0}'));
assert(screen.indexOf('<View style={s.intakePageSpacer}') < screen.indexOf('<View style={s.paginationRow}'));
assert(screen.includes('compactEmpty:{flexGrow:1,minHeight:115'));

assert(screen.includes('Math.min(4,Math.max(0,count(filter)))') && screen.includes('No intakes found'));
const artwork=file('../lib/partner-assets.ts');
for(const asset of ['aiStudioVerified','aiStudioProcessing','aiStudioReview','aiStudioAction','aiStudioEmpty','aiStudioHeader','aiStudioOpen']){
  assert(artwork.includes(asset+': require('), 'Bundled 3D asset must be registered: '+asset);
  assert(screen.includes('PartnerAssets.actions.'+asset), 'AI Studio must display the '+asset+' artwork');
}
// Run the actual presentation helper against representative statuses, including
// exception-bearing rows. The queue and conversion behavior are not modified.
const start=screen.indexOf('const STUDIO_STATUS_ART =');
const end=screen.indexOf('const humanize',start);
assert(start>=0 && end>start);
const stubAssets=Object.fromEntries(['aiStudioProcessing','aiStudioReview','aiStudioAction','aiStudioVerified'].map(name=>[name,name]));
const context={PartnerAssets:{actions:stubAssets}};
vm.runInNewContext(ts.transpileModule(screen.slice(start,end)+'\nthis.visual=studioRowVisual;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
for(const [row,expected] of [
  [{status:'processing',ocr_status:'pending',exception_codes:['warning']},'aiStudioProcessing'],
  [{status:'in_review',ocr_status:'failed',exception_codes:['warning']},'aiStudioReview'],
  [{status:'processing',ocr_status:'failed'},'aiStudioAction'],
  [{status:'ready_for_review'},'aiStudioAction'],
  [{status:'needs_attention'},'aiStudioAction'],
  [{status:'processing',final_policy_id:'booked'},'aiStudioVerified'],
]) assert.equal(context.visual(row).image,expected);
for(const key of ['processing','in_review','action']) assert(screen.includes('image:STUDIO_STATUS_ART.'+key+'.image'));
assert(screen.includes('source={visual.image}') && screen.includes('{visual.label}'));
assert(!screen.includes('flag?PartnerAssets.actions.aiStudioAction'));
for(const name of ['header','processing','review','action']){
  const bytes=readFileSync(new URL('../assets/partner/actions/ai-studio-'+name+'-premium.webp',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
}
assert(screen.includes("metricDivider:{width:1,height:39,backgroundColor:'#D5DFEC'"));
assert(screen.includes("{index<2?<View style={s.metricDivider} accessible={false}/>:null}"));
assert(screen.includes("summaryDivider:{height:1,backgroundColor:'#CFD9E6'"));
assert(screen.includes('onPress={()=>openDetail(row)}'));
assert(!screen.includes('<Ionicons name="chevron-forward" size={15} color="#91A4B6"/>'));
assert(data.includes('p_limit: Math.max(1, Math.min(25, Math.trunc(limit)))'));
assert(screen.includes('setSearchRevision(v=>v+1)') && screen.includes('setSearchRows(all.filter('));
assert(screen.includes('<PartnerCaseBottomNavigation activeTab="More" />'));
const openSql=file('../../../supabase/migrations/20261124121000_partner_ai_studio_open_intake_parity.sql');
assert(openSql.includes("p_filter text default 'open'"));
assert(openSql.includes("where p_filter in ('open','review') or bucket=p_filter"));
assert(openSql.includes("when c.status='in_review' then 'in_review'"));
assert(openSql.includes("c.status='processing' and c.ocr_status='failed'"));
assert(openSql.includes("exists(select 1 from public.policies p where p.policy_no_normalized=c.policy_no)"));
assert(openSql.includes("exists(select 1 from first_intake f where f.policy_no=c.policy_no and f.id<>c.id)"));
assert(!openSql.includes("where i.processing_lane='automation'"));
assert(openSql.includes("'processing_lane',i.processing_lane"));
const actionsRoute=file('../../web-portal/app/api/partner/ai-policy-studio/actions/route.ts');
assert(actionsRoute.includes('permission.data.processing_lane!=="automation"'));
assert(!screen.includes('WebView') && !screen.includes('onboardPolicy(') && !screen.includes('convertVerifiedAiIntake('));
assert(sql.includes("security definer") && sql.includes("partner_app_effective_permissions()"));
assert(sql.includes("'it_super_user','super_admin'"));
assert(sql.includes("grant execute on function public.partner_app_ai_studio_detail_v1(uuid) to authenticated,service_role"));
assert(!sql.includes('insert into public.policy_intake_requests') && !sql.includes('update public.policy_intake_requests'));
// Only display client-side actions behind the release flag and preserve
// independent server-side permission and verification checks.
const actionFile=file('../lib/ai-studio-actions.ts');
assert(screen.includes("Reparse PDF") && screen.includes("Verify & Convert"));
assert(screen.includes("setPendingAction('reparse')") && screen.includes("setPendingAction('convert')"));
assert(screen.includes("performAiStudioAction(selected.id,pendingAction)"));
assert(screen.includes('resultUncertain') && screen.includes('Refresh intake status'));
assert(screen.includes("aiStudioActionsEnabled&&detail.processing_lane==='automation'&&!detail.final_policy_id"));
assert(screen.includes("(!aiStudioActionsEnabled||detail.processing_lane!=='automation')&&!detail.final_policy_id"));
assert(screen.includes('fieldExpanded?detail.fields:detail.fields.slice(0,8)'));
assert(screen.indexOf("setPendingAction('convert')") < screen.indexOf('Extracted policy details'));
assert(actionFile.includes("EXPO_PUBLIC_AI_STUDIO_ACTIONS_ENABLED === 'true'"));
assert(actionFile.includes("url.hostname==='studio.nishant.uk'"));
assert(actionFile.includes("'authorization':'Bearer '+auth.session.access_token"));
assert(actionFile.includes("body:JSON.stringify({intake_id:intakeId,action,confirm:true})"));

const stageStart=screen.indexOf('function intakeStage(');
const stageEnd=screen.indexOf('function IntakeStepper(',stageStart);
assert(stageStart>=0 && stageEnd>stageStart);
const stageContext={};
vm.runInNewContext(ts.transpileModule(screen.slice(stageStart,stageEnd)+'\nthis.stage=intakeStage;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,stageContext);
for(const [row,expected] of [
  [{status:'processing',fields:[],ocr_status:'pending'},0],
  [{status:'in_review',fields:[],ocr_status:'pending'},0],
  [{status:'processing',fields:[{}],ocr_status:'failed'},0],
  [{status:'processing',fields:[{}],ocr_status:'completed'},1],
  [{status:'in_review',fields:[{}],ocr_status:'completed'},2],
]) assert.equal(stageContext.stage(row),expected);
for(const marker of ['presentationStyle="fullScreen"','<StatusBar style="dark"','Clipboard.setString','accessibilityLabel="More intake options"','<IntakeStepper detail={detail}/>','style={s.detailHeroArtwork}','style={s.fieldsPill}','style={s.footerWaves}','accessibilityState={{disabled:true}}','Secure actions awaiting activation']) assert(screen.includes(marker), 'Intake details reference and safety contract: '+marker);

console.log('Partner native AI Studio read-only, auth and Vercel-independence contracts passed');
