import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { canPartnerUseAiStudio } from '@/lib/partner-permissions';
import { aiStudioActionsEnabled, performAiStudioAction, type StudioAction } from '@/lib/ai-studio-actions';
import { usePartnerSession } from '@/providers/partner-session-provider';
import { loadAiStudioDetail, loadAiStudioPage, type AiStudioBucket, type AiStudioDetail, type AiStudioPage, type AiStudioRow } from '@/lib/ai-studio';

const C = { ink:'#182C38', faint:'#71828C', paper:'#F4F7FD', line:'#E3EAF4', navy:'#122A49', blue:'#3158CF', mint:'#B9EAD0' };
const TABS: Array<{key:AiStudioBucket;label:string}> = [
  {key:'review',label:'Review'}, {key:'processing',label:'Running'}, {key:'done',label:'Done'},
];
const humanize = (value:string) => value.replace(/_/g,' ').replace(/\b\w/g,s=>s.toUpperCase());
const fieldName = (key:string) => ({
  insured_name:'Insured',policy_number:'Policy',policy_issuance_date:'Issued',
  policy_start_date:'Starts',policy_end_date:'Ends',vehicle_registration_number:'Registration',
  vehicle_make:'Make',vehicle_model:'Model',vehicle_capacity:'Capacity',
  vehicle_chassis_number:'Chassis',vehicle_engine_number:'Engine',
  vehicle_rto_name:'RTO',vehicle_rto_state:'State',insurer_name:'Insurer',
  od_premium:'Own damage',tp_premium:'Third party',
} as Record<string,string>)[key] || humanize(key);

export default function AiPolicyStudioScreen() {
  const router=useRouter();
  const insets=useSafeAreaInsets();
  const {context}=usePartnerSession();
  const allowed=canPartnerUseAiStudio(context);
  const [filter,setFilter]=useState<AiStudioBucket>('review');
  const [page,setPage]=useState<AiStudioPage>({counts:{review:0,processing:0,done:0},rows:[]});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [moreLoading,setMoreLoading]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<AiStudioRow|null>(null);
  const [detail,setDetail]=useState<AiStudioDetail|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState('');
  const [pendingAction,setPendingAction]=useState<StudioAction|null>(null);
  const [actionBusy,setActionBusy]=useState(false);
  const [actionError,setActionError]=useState('');
  const [resultUncertain,setResultUncertain]=useState(false);
  const [fieldExpanded,setFieldExpanded]=useState(false);
  const sequence=useRef(0);
  const detailSequence=useRef(0);

  const reload=useCallback(async(offset=0)=>{
    if(!allowed) return;
    const token=++sequence.current;
    if(offset===0){setLoading(true);setError('');}else setMoreLoading(true);
    try {
      const next=await loadAiStudioPage(filter,offset);
      if(token!==sequence.current)return;
      setPage(old=>offset===0?next:{counts:next.counts,rows:[...old.rows,...next.rows.filter(row=>!old.rows.some(x=>x.id===row.id))]});
    } catch(e) {
      if(token===sequence.current) setError(e instanceof Error?e.message:'Could not load the queue.');
    } finally {
      if(token===sequence.current){setLoading(false);setRefreshing(false);setMoreLoading(false);}
    }
  },[allowed,filter]);
  useFocusEffect(useCallback(()=>{
    void reload();
    return ()=>{sequence.current++;detailSequence.current++;};
  },[reload]));
  useEffect(()=>{
    if(!selected||!allowed){setDetail(null);return;}
    const token=++detailSequence.current;
    setDetail(null);setDetailError('');setDetailLoading(true);
    void loadAiStudioDetail(selected.id).then(x=>{
      if(token===detailSequence.current)setDetail(x);
    }).catch(e=>{
      if(token===detailSequence.current)setDetailError(e instanceof Error?e.message:'Could not load intake.');
    }).finally(()=>{if(token===detailSequence.current)setDetailLoading(false);});
    return ()=>{detailSequence.current++;};
  },[selected,allowed]);
  const count=(key:AiStudioBucket)=>page.counts[key]||0;
  const refresh=()=>{setRefreshing(true);void reload();};
  const closeDetail=()=>{if(actionBusy)return;setSelected(null);setPendingAction(null);setActionError('');setResultUncertain(false);setFieldExpanded(false);};
  const openDetail=(row:AiStudioRow)=>{setSelected(row);setFieldExpanded(false);setActionError('');setResultUncertain(false);};
  const reloadSelected=async()=>{
    if(!selected||actionBusy)return;
    const intakeId=selected.id;
    setDetailLoading(true);setDetailError('');setActionError('');setPendingAction(null);
    try{const updated=await loadAiStudioDetail(intakeId);setDetail(updated);setResultUncertain(false);void reload();}
    catch(e){setDetailError(e instanceof Error?e.message:'Could not refresh intake.');}
    finally{setDetailLoading(false);}
  };
  async function commitAction(){
    if(!selected||!pendingAction||actionBusy||resultUncertain)return;
    setActionBusy(true);setActionError('');
    try {
      const result=await performAiStudioAction(selected.id,pendingAction);
      if(!result.ok){
        setActionError(result.issues?.[0]?.message||result.error);
        if(result.error.includes('outcome_unknown')||result.error.includes('result_unknown'))setResultUncertain(true);
        setPendingAction(null);
        return;
      }
      setPendingAction(null);setSelected(null);
      if(result.policy_booked)setFilter('done');else void reload();
    }catch(e){
      const message=e instanceof Error?e.message:'The operation could not be confirmed.';
      setActionError(message);
      if(message.includes('unknown')||message.includes('confirm'))setResultUncertain(true);
      setPendingAction(null);
    }finally{setActionBusy(false);}
  }

  if(!allowed)return(
    <SafeAreaView style={s.root}>
      <Pressable style={s.circle} onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="arrow-back" color={C.ink} size={20}/>
      </Pressable>
      <View style={s.center}><Ionicons name="lock-closed-outline" color={C.faint} size={28}/>
        <Text style={s.emptyHead}>Private workspace</Text>
        <Text style={s.emptyText}>For authorized IT reviewers.</Text>
      </View>
    </SafeAreaView>
  );
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.top}>
        <Pressable onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Back to More" style={s.circle}>
          <Ionicons name="arrow-back" size={20} color={C.ink}/>
        </Pressable>
        <Text style={s.topWord}>INSUREIT  /  OPERATIONS</Text>
        <Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel="Refresh" style={s.circle}>
          <Ionicons name="refresh-outline" size={20} color={C.ink}/>
        </Pressable>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={{paddingHorizontal:22,paddingTop:13,paddingBottom:insets.bottom+36}}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.blue} onRefresh={refresh}/>}>
        <View style={s.titleRow}>
          <View style={{flex:1}}><Text style={s.eyebrow}>POLICY OPERATIONS</Text><Text style={s.title}>AI Onboarding <Text style={{color:C.blue}}>Studio</Text></Text><Text style={s.subtitle}>Review PDFs, repair drafts and securely register policies.</Text></View>
          <View style={s.sparkle}><Ionicons name="sparkles" color={C.blue} size={22}/></View>
        </View>
        <View style={s.hero}>
          <View style={s.heroMain}>
            <Text style={s.heroOverline}>AWAITING ATTENTION</Text>
            <Text style={s.heroNumber}>{count('review')}</Text>
            <Text style={s.heroHint}>●  Live policy queue</Text>
          </View>
          <View style={s.heroAside}>
            <Text style={s.heroMini}>{count('processing')}</Text><Text style={s.heroAsideLabel}>Processing</Text>
            <View style={s.heroDivider}/>
            <Text style={s.heroMini}>{count('done')}</Text><Text style={s.heroAsideLabel}>Completed</Text>
          </View>
          <View style={s.heroRing}/>
        </View>
        <View style={s.quickGuide}><View style={s.guideIcon}><Ionicons name="flash-outline" size={18} color={C.blue}/></View><View style={{flex:1}}><Text style={s.guideTitle}>Your workflow</Text><Text style={s.guideText}>Open an intake → Reparse if needed → Verify & Convert</Text></View><Ionicons name="shield-checkmark-outline" size={20} color="#2D8065"/></View>
        <View style={s.segment}>
          {TABS.map(tab=><Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{selected:filter===tab.key}}
            style={[s.segmentItem,filter===tab.key&&s.segmentActive]}
            onPress={()=>{setFilter(tab.key);setPage(p=>({...p,rows:[]}));}}>
            <Text style={[s.segmentLabel,filter===tab.key&&s.activeLabel]}>{tab.label}</Text>
            <Text style={[s.segmentCount,filter===tab.key&&s.activeLabel]}>{count(tab.key)}</Text>
          </Pressable>)}
        </View>
        <View style={s.sectionHead}><Text style={s.sectionTitle}>{filter==='review'?'Needs your eye':filter==='processing'?'In the pipeline':'Finished'}</Text>
          <Text style={s.meta}>{count(filter)} records</Text></View>
        {loading&&page.rows.length===0?<View style={s.center}><ActivityIndicator color={C.blue}/></View>:null}
        {error?<Pressable style={s.error} onPress={()=>void reload()} accessibilityRole="button">
          <Text style={s.errorText}>{error}</Text><Ionicons name="refresh" color="#A44935" size={18}/>
        </Pressable>:null}
        {!loading&&!error&&!page.rows.length?<View style={s.center}>
          <Ionicons name="checkmark-circle-outline" color="#7DAB96" size={28}/>
          <Text style={s.emptyHead}>All clear here</Text><Text style={s.emptyText}>No intakes in this view.</Text>
        </View>:null}
        {page.rows.length>0?<View style={s.list}>
          {page.rows.map(row=>{
            const done=!!row.final_policy_id,flag=row.exception_codes.length>0;
            const status=done?'Completed':row.bucket==='review'?(flag?'Needs review':'Ready'):(flag?'Attention':'In progress');
            return <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={'Open '+row.intake_number}
              style={({pressed})=>[s.row,pressed&&{backgroundColor:'#F2F6F4'}]} onPress={()=>openDetail(row)}>
              <View style={[s.mark,{backgroundColor:done?'#54A983':flag?'#D7A662':'#8B9EDB'}]}/>
              <View style={s.rowMain}><Text numberOfLines={1} style={s.rowTitle}>{row.intake_number.replace('PIR-','')}</Text>
                <Text numberOfLines={1} style={s.rowSub}>{row.lead_source_name||row.policy_type||'Policy intake'}</Text></View>
              <View style={s.rowRight}><Text style={[s.rowStatus,{color:done?'#398562':flag?'#A5773A':'#5C78A8'}]}>{status}</Text>
                <Text style={s.rowChecks}>{row.checks_passed?String(row.checks_passed)+' checks':'Pending'}</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#9DADAF"/>
            </Pressable>;
          })}
        </View>:null}
        {!loading&&page.rows.length<count(filter)?<Pressable style={s.showMore} disabled={moreLoading}
          onPress={()=>void reload(page.rows.length)} accessibilityRole="button">
          {moreLoading?<ActivityIndicator color={C.ink} size="small"/>:<Text style={s.showMoreText}>Show more</Text>}
        </Pressable>:null}
        <Text style={s.footer}>SECURED BY INSUREIT · SUPABASE</Text>
      </ScrollView>

      <Modal visible={Boolean(selected)} presentationStyle="pageSheet" animationType="slide" onRequestClose={closeDetail}>
        <SafeAreaView style={s.sheet}>
          <View style={s.sheetTop}>
            <View><Text style={s.eyebrow}>VERIFIED INTAKE</Text>
              <Text style={s.sheetTitle}>{selected?.intake_number.replace('PIR-','')}</Text></View>
            <Pressable style={s.circle} onPress={closeDetail} disabled={actionBusy} accessibilityRole="button" accessibilityLabel="Close details">
              <Ionicons name="close" color={C.ink} size={21}/>
            </Pressable>
          </View>
          {detailLoading?<View style={s.center}><ActivityIndicator color={C.blue}/></View>:null}
          {detailError?<View style={s.center}><Text style={s.errorText}>{detailError}</Text></View>:null}
          {detail?<ScrollView contentContainerStyle={s.sheetContent}>
            <View style={s.detailHero}>
              <Text style={s.detailEyebrow}>{humanize(detail.queue_state)}</Text>
              <Text style={s.detailName}>{detail.fields.find(x=>x.key==='insured_name')?.value||detail.lead_source_name||'Policy intake'}</Text>
              <Text style={s.detailMeta}>{detail.checks_passed} verified checks · {detail.policy_type||'Motor'}</Text><View style={s.detailSteps}><Ionicons name="document-text-outline" color={C.mint} size={16}/><Text style={s.stepLabel}>PDF</Text><Ionicons name="chevron-forward" size={13} color="#B9C9D0"/><Ionicons name="scan-outline" size={16} color={C.mint}/><Text style={s.stepLabel}>Extracted</Text><Ionicons name="chevron-forward" size={13} color="#B9C9D0"/><Ionicons name="shield-checkmark-outline" size={16} color={C.mint}/><Text style={s.stepLabel}>Review</Text></View>
            </View>
            {detail.last_error_code||detail.exception_codes.length?<View style={s.issue}>
              <Ionicons name="information-circle-outline" size={18} color="#996A33"/>
              <Text style={s.issueText}>{humanize(detail.last_error_code||detail.exception_codes.join(', '))}</Text>
            </View>:null}
            <Pressable style={s.fieldsHeader} accessibilityRole="button" onPress={()=>setFieldExpanded(v=>!v)}><View style={s.fieldsIcon}><Ionicons name="document-text-outline" color={C.blue} size={20}/></View><View style={{flex:1}}><Text style={s.sectionTitle}>Extracted policy details</Text><Text style={s.meta}>{detail.fields.length} PDF fields</Text></View><Text style={s.fieldsToggle}>{fieldExpanded?'Show less':'View all'}</Text><Ionicons name={fieldExpanded?'chevron-up':'chevron-down'} size={17} color={C.blue}/></Pressable>
            <View style={s.detailList}>
              {(fieldExpanded?detail.fields:detail.fields.slice(0,8)).map((f,index)=><View key={f.key+String(index)} style={s.detailField}>
                <Text style={s.fieldLabel}>{fieldName(f.key)}</Text>
                <Text selectable style={s.fieldValue}>{f.value}</Text>
              </View>)}
            </View>

            {!fieldExpanded&&detail.fields.length>8?<Pressable accessibilityRole="button" style={s.moreFields} onPress={()=>setFieldExpanded(true)}><Text style={s.moreFieldsText}>View {detail.fields.length-8} more fields</Text><Ionicons name="chevron-down" size={14} color={C.blue}/></Pressable>:null}
            {!aiStudioActionsEnabled&&!detail.final_policy_id?<View style={s.disabledNotice}><Ionicons name="lock-closed-outline" size={20} color="#8F7033"/><View style={{flex:1}}><Text style={s.disabledTitle}>Secure actions awaiting activation</Text><Text style={s.disabledText}>Reparse and Verify & Convert will unlock after backend verification. No unsafe booking shortcuts.</Text></View></View>:null}
            {aiStudioActionsEnabled&&!detail.final_policy_id?<View style={s.actionsWrap}>
              {actionError?<Text style={s.actionError}>{actionError}</Text>:null}
              {resultUncertain?<View style={s.uncertain}><Ionicons name="warning-outline" size={18} color="#966126"/><Text style={s.uncertainText}>Result uncertain. Refresh and inspect booking status before retrying.</Text></View>:null}
              {resultUncertain?<Pressable style={s.refreshRecord} accessibilityRole="button" onPress={()=>void reloadSelected()}><Ionicons name="refresh" size={17} color={C.blue}/><Text style={s.refreshRecordText}>Refresh intake status</Text></Pressable>:null}
              {!pendingAction&&!resultUncertain?<View style={s.actionsRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Reparse current PDF and replace draft"
                  style={s.reparseButton} onPress={()=>setPendingAction('reparse')} disabled={actionBusy}>
                  <Ionicons name="refresh-outline" color={C.blue} size={22}/><Text style={s.reparseLabel}>Reparse PDF</Text><Text style={s.actionSub}>Replace extracted draft</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Verify PDF and convert to policy"
                  style={s.convertButton} onPress={()=>setPendingAction('convert')} disabled={actionBusy}>
                  <Ionicons name="shield-checkmark-outline" color="#FFFFFF" size={22}/><Text style={s.convertLabel}>Verify & Convert</Text><Text style={s.convertSub}>Secure policy booking</Text>
                </Pressable>
              </View>:null}
              {pendingAction?<View style={s.confirmPanel}>
                <View style={s.confirmHeading}><Ionicons name={pendingAction==='reparse'?'refresh-circle-outline':'shield-checkmark-outline'} size={24} color={C.blue}/><Text style={s.confirmTitle}>{pendingAction==='reparse'?'Replace saved draft?':'Verify and register this policy?'}</Text></View>
                <Text style={s.confirmDescription}>{pendingAction==='reparse'
                  ?'The current PDF will replace all OCR-generated draft details. No policy is booked.'
                  :'The server will independently verify the current PDF and all policy, customer, vehicle and duplicate checks before booking.'}</Text>
                <View style={s.confirmActions}>
                  <Pressable disabled={actionBusy} accessibilityRole="button" style={s.cancel}
                    onPress={()=>setPendingAction(null)}><Text style={s.cancelText}>Cancel</Text></Pressable>
                  <Pressable disabled={actionBusy} accessibilityRole="button" style={s.confirm}
                    onPress={()=>void commitAction()}>
                    {actionBusy?<ActivityIndicator color="#FFFFFF" size="small"/>:<Text style={s.confirmText}>{pendingAction==='reparse'?'Reparse now':'Verify & Convert'}</Text>}
                  </Pressable>
                </View>
              </View>:null}
            </View>:null}
            <View style={s.safetyRow}><Ionicons name="shield-checkmark" color="#2D8065" size={16}/><Text style={s.safetyText}>PDF extraction is not booking approval. Final registration always uses the protected onboarding service.</Text></View>
          </ScrollView>:null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.paper},scroll:{flex:1},
  top:{height:58,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  circle:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  topWord:{fontSize:10,letterSpacing:1.4,color:C.faint,fontWeight:'700'},
  eyebrow:{fontSize:10,color:'#87969C',fontWeight:'800',letterSpacing:1.5},
  titleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:22},
  title:{fontSize:36,fontWeight:'800',letterSpacing:-1.7,color:C.ink,marginTop:5},
  sparkle:{height:49,width:49,borderRadius:25,alignItems:'center',justifyContent:'center',backgroundColor:C.mint},
  hero:{height:174,backgroundColor:C.navy,borderRadius:26,flexDirection:'row',overflow:'hidden',marginBottom:21},
  heroMain:{flex:1,paddingLeft:24,paddingTop:23,zIndex:1},
  heroOverline:{fontSize:10,fontWeight:'700',color:'#A7C6D1',letterSpacing:1.2},
  heroNumber:{fontSize:63,fontWeight:'700',color:'#FFFFFF',letterSpacing:-3,marginTop:2},
  heroHint:{fontSize:11,color:C.mint,marginTop:-1},
  heroAside:{width:113,alignSelf:'center',borderLeftWidth:1,borderLeftColor:'#375262',paddingLeft:18,zIndex:1},
  heroMini:{fontSize:22,fontWeight:'800',color:'#FFFFFF'},
  heroAsideLabel:{fontSize:10,color:'#B8CBD1',marginBottom:5},
  heroDivider:{backgroundColor:'#375262',height:1,marginVertical:7,marginRight:13},
  heroRing:{position:'absolute',width:220,height:220,borderRadius:110,borderWidth:1,borderColor:'#305060',top:-100,left:-100},
  segment:{flexDirection:'row',backgroundColor:'#E9EFED',borderRadius:17,padding:4,marginBottom:24},
  segmentItem:{flex:1,minHeight:43,borderRadius:13,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},
  segmentActive:{backgroundColor:'#FFFFFF'},
  segmentLabel:{fontSize:12,fontWeight:'600',color:C.faint},
  segmentCount:{fontSize:10,fontWeight:'700',color:'#92A19F'},
  activeLabel:{color:C.ink,fontWeight:'800'},
  sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10,marginTop:2},
  sectionTitle:{fontSize:15,color:C.ink,fontWeight:'800',letterSpacing:-.3},
  meta:{fontSize:11,fontWeight:'600',color:C.faint},
  list:{backgroundColor:'#FFFFFF',borderRadius:22,borderWidth:1,borderColor:C.line,overflow:'hidden'},
  row:{minHeight:80,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},
  mark:{width:4,height:34,borderRadius:3},
  rowMain:{flex:1,minWidth:0},
  rowTitle:{fontSize:13,fontWeight:'800',color:C.ink},
  rowSub:{fontSize:10.5,marginTop:5,color:C.faint},
  rowRight:{gap:5,alignItems:'flex-end'},
  rowStatus:{fontSize:10,fontWeight:'700'},
  rowChecks:{fontSize:10,color:'#91A0A5'},
  center:{minHeight:160,alignItems:'center',justifyContent:'center',gap:10,padding:32},
  emptyHead:{fontSize:15,fontWeight:'800',color:C.ink},
  emptyText:{fontSize:11,color:C.faint},
  error:{padding:15,borderRadius:15,backgroundColor:'#FFF0EA',flexDirection:'row',gap:12,marginBottom:12,alignItems:'center'},
  errorText:{flex:1,fontSize:12,color:'#A44935'},
  showMore:{height:48,alignItems:'center',justifyContent:'center'},
  showMoreText:{fontWeight:'800',fontSize:12,color:C.blue},
  footer:{fontSize:9,letterSpacing:1.2,color:'#99A6A4',textAlign:'center',marginTop:23},
  sheet:{flex:1,backgroundColor:C.paper},
  sheetTop:{minHeight:90,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sheetTitle:{fontSize:24,fontWeight:'800',color:C.ink,letterSpacing:-.9,marginTop:4},
  sheetContent:{paddingHorizontal:22,paddingTop:5,paddingBottom:48},
  detailHero:{backgroundColor:C.navy,borderRadius:23,padding:22,marginBottom:15},
  detailEyebrow:{fontSize:10,letterSpacing:1.4,fontWeight:'800',color:C.mint},
  detailName:{fontSize:22,color:'#FFFFFF',fontWeight:'800',marginTop:12,letterSpacing:-.5},
  detailMeta:{fontSize:11,color:'#B9C9D0',marginTop:8},
  issue:{backgroundColor:'#FFF4E7',padding:14,borderRadius:14,flexDirection:'row',gap:9,marginBottom:16},
  issueText:{flex:1,fontSize:12,lineHeight:17,color:'#94652D',fontWeight:'600'},
  detailList:{backgroundColor:'#FFFFFF',borderRadius:19,borderWidth:1,borderColor:C.line,paddingHorizontal:16},
  detailField:{paddingVertical:14,minHeight:54,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,flexDirection:'row',alignItems:'center',gap:14},
  fieldLabel:{flex:.38,fontSize:11,color:C.faint},
  fieldValue:{flex:.62,fontSize:11.5,color:C.ink,fontWeight:'700',textAlign:'right'},
  note:{fontSize:10.5,lineHeight:17,color:C.faint,marginTop:19,textAlign:'center'},
  actionsWrap:{marginTop:18},
  actionsRow:{flexDirection:'row',gap:10},
  reparseButton:{height:48,borderRadius:15,borderWidth:1,borderColor:C.line,backgroundColor:'#FFFFFF',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:7},
  reparseLabel:{fontSize:11,fontWeight:'800',color:C.ink},
  convertButton:{flex:1,height:48,borderRadius:15,backgroundColor:C.blue,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10},
  convertLabel:{fontSize:12,fontWeight:'800',color:'#FFFFFF'},
  actionError:{color:'#B04A3B',fontSize:11,lineHeight:16,marginBottom:10},
  confirmPanel:{borderRadius:17,borderColor:C.line,borderWidth:1,padding:16,backgroundColor:'#FFFFFF'},
  confirmTitle:{fontSize:14,fontWeight:'800',color:C.ink},
  confirmDescription:{fontSize:11,color:C.faint,lineHeight:16,marginTop:7},
  confirmActions:{flexDirection:'row',gap:10,marginTop:16},
  cancel:{flex:1,height:43,borderRadius:12,justifyContent:'center',alignItems:'center',backgroundColor:'#EDF1F0'},
  cancelText:{fontSize:12,fontWeight:'800',color:C.ink},
  confirm:{flex:1,height:43,borderRadius:12,justifyContent:'center',alignItems:'center',backgroundColor:C.blue},
  confirmText:{fontSize:12,fontWeight:'800',color:'#FFFFFF'},
});
