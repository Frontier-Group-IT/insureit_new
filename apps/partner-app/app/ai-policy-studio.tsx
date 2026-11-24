import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerAssets } from '@/lib/partner-assets';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { canPartnerUseAiStudio } from '@/lib/partner-permissions';
import { aiStudioActionsEnabled, performAiStudioAction, type StudioAction } from '@/lib/ai-studio-actions';
import { usePartnerSession } from '@/providers/partner-session-provider';
import { loadAiStudioDetail, loadAiStudioPage, type AiStudioBucket, type AiStudioDetail, type AiStudioPage, type AiStudioRow } from '@/lib/ai-studio';

const C = { ink:'#182C38', faint:'#71828C', paper:'#F4F7FD', line:'#E3EAF4', navy:'#122A49', blue:'#3158CF', mint:'#B9EAD0' };
const TABS: Array<{key:AiStudioBucket;label:string}> = [
  {key:'open',label:'All Open'}, {key:'action',label:'Action'}, {key:'in_review',label:'In Review'}, {key:'processing',label:'Processing'},
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
  const [filter,setFilter]=useState<AiStudioBucket>('open');
  const [query,setQuery]=useState('');
  const [tabWidth,setTabWidth]=useState(0);
  const motion=useStudioMotion();
  const tabPosition=useRef(new Animated.Value(0)).current;
  const refreshTurn=useRef(new Animated.Value(0)).current;
  const [page,setPage]=useState<AiStudioPage>({counts:{open:0,action:0,in_review:0,processing:0},rows:[]});
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
    if(offset===0){setLoading(true);setError('');setMoreLoading(false);}else setMoreLoading(true);
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
  const refresh=()=>{if(loading||refreshing)return;setRefreshing(true);void reload();};
  const searchTerm=query.trim().toLowerCase();
  const visibleRows=useMemo(()=>page.rows.filter(row=>!searchTerm||[row.intake_number,row.lead_source_name,row.policy_type].some(value=>value?.toLowerCase().includes(searchTerm))),[page.rows,searchTerm]);
  const reviewShare=count('open')>0?Math.max(0,Math.min(1,count('in_review')/count('open'))):0;
  useEffect(()=>{const a=Animated.timing(tabPosition,{toValue:TABS.findIndex(t=>t.key===filter),duration:motion?240:0,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'});a.start();return()=>a.stop();},[filter,motion,tabPosition]);
  useEffect(()=>{refreshTurn.setValue(0);if(!motion||!refreshing)return;const a=Animated.loop(Animated.timing(refreshTurn,{toValue:1,duration:850,easing:Easing.linear,useNativeDriver:Platform.OS!=='web',isInteraction:false}));a.start();return()=>{a.stop();refreshTurn.setValue(0);};},[refreshing,motion,refreshTurn]);
  const selectFilter=(next:AiStudioBucket)=>{if(next===filter)return;sequence.current++;setLoading(true);setError('');setMoreLoading(false);setFilter(next);setPage(p=>({...p,rows:[]}));if(Platform.OS!=='web')void Haptics.selectionAsync().catch(()=>{});};
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
      if(result.policy_booked)setFilter('open');void reload();
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
    <SafeAreaView style={s.studioRoot} edges={['top']}>
      <StatusBar style="light" backgroundColor="#071E49"/>
      <View style={s.studioTop}>
        <Pressable onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Back to More" style={s.headerButton}>
          <Ionicons name="arrow-back" size={23} color="#FFFFFF"/>
        </Pressable>
        <Image source={PartnerAssets.actions.quickPolicyIntake} style={s.headerArt} resizeMode="contain" accessible={false}/>
        <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit>AI Onboarding Studio</Text>
        <Pressable onPress={refresh} disabled={loading||refreshing} accessibilityRole="button" accessibilityLabel="Refresh" accessibilityState={{disabled:loading||refreshing,busy:refreshing}} style={s.headerButton}>
          <Animated.View style={{transform:[{rotate:refreshTurn.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}><Ionicons name="refresh-outline" size={23} color="#FFFFFF"/></Animated.View>
        </Pressable>
      </View>
      <ScrollView style={s.studioCanvas} keyboardShouldPersistTaps="handled" contentContainerStyle={s.studioContent}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.blue} colors={[C.blue]} onRefresh={refresh}/>}>
        <View style={s.summaryPanel}>
          <StudioEntrance motion={motion} delay={0}>
            <View style={s.summaryHeadline}>
              <Image source={PartnerAssets.actions.quickPolicyIntake} style={s.summaryArt} resizeMode="contain" accessible={false}/>
              <View style={s.summaryAccent}/>
              <View style={s.summaryCopy}>
                <Text style={s.summaryEyebrow}>POLICY WORK QUEUE</Text>
                <Text style={s.summaryTitle} numberOfLines={1} adjustsFontSizeToFit>{loading&&!page.rows.length&&count('open')===0?'Loading queue':count('open').toLocaleString('en-IN')+' Open Intakes'}</Text>
                <Text style={s.summarySubtitle}>Review, verify & convert policies</Text>
              </View>
              <View style={s.ringColumn}>
                <StudioReviewRing value={reviewShare} motion={motion}/>
                <Text style={s.ringLabel}>In review share</Text>
              </View>
            </View>
          </StudioEntrance>
          <View style={s.summaryRule}/>
          <View style={s.metricRow}>
            <StudioMetric label="Processing" value={count('processing')} artwork={PartnerAssets.status.documentUpload} motion={motion} delay={80}/>
            <View style={s.metricDivider}/>
            <StudioMetric label="In Review" value={count('in_review')} artwork={PartnerAssets.status.pendingReview} motion={motion} delay={145}/>
            <View style={s.metricDivider}/>
            <StudioMetric label="Action" value={count('action')} artwork={PartnerAssets.status.policyAttention} motion={motion} delay={210}/>
          </View>
        </View>
        <View style={s.queueSection}>
          <View style={s.sectionHead}>
            <Text style={s.queueTitle}>Policy intakes</Text>
            <View style={s.recordPill}><Text style={s.recordPillText}>{count(filter).toLocaleString('en-IN')} Records</Text></View>
          </View>
          <View style={s.queueCard}>
            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={20} color="#1675CF"/>
              <TextInput accessibilityLabel="Search loaded intakes by intake number, lead source or policy type" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" placeholder="Search intake or lead source..." placeholderTextColor="#8792A5" style={s.searchInput}/>
              {query?<Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={()=>setQuery('')}><Ionicons name="close-circle-outline" size={19} color="#71828C"/></Pressable>:null}
            </View>
            <View style={s.queueTabs} onLayout={e=>setTabWidth(e.nativeEvent.layout.width)}>
              {TABS.map((tab,i)=><Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{selected:filter===tab.key}} accessibilityLabel={tab.label+' '+count(tab.key)}
                style={[s.queueTab,i>0&&s.queueTabDivider]} onPress={()=>selectFilter(tab.key)}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[s.queueTabText,filter===tab.key&&s.activeLabel]}>{tab.label}</Text>
                <Text style={[s.segmentCount,filter===tab.key&&s.activeLabel]}>{count(tab.key)}</Text>
              </Pressable>)}
              {tabWidth>0?<Animated.View pointerEvents="none" style={[s.queueUnderline,{width:tabWidth/TABS.length,transform:[{translateX:Animated.multiply(tabPosition,tabWidth/TABS.length)}]}]}/>:null}
            </View>
            {searchTerm?<Text style={s.searchHint}>{visibleRows.length} matching loaded records · {page.rows.length} of {count(filter)} loaded</Text>:null}
            {loading&&page.rows.length===0?<StudioSkeleton motion={motion}/>:null}
            {error?<Pressable style={s.error} onPress={()=>void reload()} accessibilityRole="button">
              <Text style={s.errorText}>{error}</Text><Ionicons name="refresh" color="#A44935" size={18}/>
            </Pressable>:null}
            {!loading&&!error&&!visibleRows.length?<View style={s.center}>
              <Image source={searchTerm?PartnerAssets.emptyStates.noSearchResults:PartnerAssets.emptyStates.noPolicies} style={s.emptyArt} resizeMode="contain" accessible={false}/>
              <Text style={s.emptyHead}>{searchTerm?'No matching loaded intakes':'All clear here'}</Text><Text style={s.emptyText}>{searchTerm?'Try another search or load more records.':'No intakes in this view.'}</Text>
            </View>:null}
            {visibleRows.map((row,index)=>{
              const done=!!row.final_policy_id,flag=row.exception_codes.length>0;
              const status=done?'Completed':row.status==='in_review'?'In review':row.status==='processing'&&row.ocr_status!=='failed'?'Fetching details':'Action required';
              const color=done?'#398562':status==='Action required'?'#B54738':status==='Fetching details'?'#94611C':'#6842B7';
              return <StudioEntrance key={row.id} motion={motion} delay={Math.min(index,6)*35}>
                <Pressable accessibilityRole="button" accessibilityLabel={'Open '+row.intake_number} style={({pressed})=>[s.row,pressed&&{backgroundColor:'#F0F5FF'}]} onPress={()=>openDetail(row)}>
                  <Image source={PartnerAssets.actions.quickPolicyIntake} style={s.rowArt} resizeMode="contain" accessible={false}/>
                  <View style={s.rowMain}><Text numberOfLines={1} style={s.rowTitle}>{row.intake_number.replace('PIR-','')}</Text>
                    <Text numberOfLines={1} style={s.rowSub}>{row.lead_source_name||row.policy_type||'Policy intake'}</Text></View>
                  <View style={s.rowRight}><Text style={[s.rowStatus,{color}]}>{status}</Text>
                    <Text style={s.rowChecks}>{row.checks_passed?String(row.checks_passed)+' checks':'Pending'}</Text>
                    {flag&&status!=='Action required'?<Text style={s.rowFlag}>Exceptions</Text>:null}</View>
                  <Ionicons name="chevron-forward" size={15} color="#9DADAF"/>
                </Pressable>
              </StudioEntrance>;
            })}
            {!loading&&page.rows.length<count(filter)?<Pressable style={s.showMore} disabled={moreLoading}
              onPress={()=>void reload(page.rows.length)} accessibilityRole="button">
              {moreLoading?<ActivityIndicator color={C.ink} size="small"/>:<Text style={s.showMoreText}>Show more</Text>}
            </Pressable>:null}
          </View>
          <Text style={s.footer}>SECURED BY INSUREIT · SUPABASE</Text>
        </View>
      </ScrollView>
      <View style={{backgroundColor:"#071E49",paddingBottom:insets.bottom}}><PartnerCaseBottomNavigation activeTab="More" /></View>

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
            {(!aiStudioActionsEnabled||detail.processing_lane!=='automation')&&!detail.final_policy_id?<View style={s.actionsWrap}>
              <View style={s.actionsRow}>
                <View style={[s.reparseButton,s.disabledAction]}><Ionicons name="refresh-outline" color="#7F8EAB" size={22}/><Text style={s.reparseLabel}>Reparse PDF</Text><Text style={s.actionSub}>Awaiting activation</Text></View>
                <View style={[s.convertButton,s.disabledConvert]}><Ionicons name="lock-closed-outline" color="#FFFFFF" size={22}/><Text style={s.convertLabel}>Verify & Convert</Text><Text style={s.convertSub}>Awaiting activation</Text></View>
              </View>
              <View style={s.disabledNotice}><Ionicons name="lock-closed-outline" size={20} color="#8F7033"/><View style={{flex:1}}><Text style={s.disabledTitle}>Secure actions awaiting activation</Text><Text style={s.disabledText}>{detail.processing_lane==='manual'?'This intake uses the website’s manual onboarding lane. Secure AI conversion is restricted to eligible automation intakes.':'These buttons unlock after the backend passes authenticated booking checks. Your current intakes are unchanged.'}</Text></View></View>
            </View>:null}
            {aiStudioActionsEnabled&&detail.processing_lane==='automation'&&!detail.final_policy_id?<View style={s.actionsWrap}>
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

            <Pressable style={s.fieldsHeader} accessibilityRole="button" onPress={()=>setFieldExpanded(v=>!v)}><View style={s.fieldsIcon}><Ionicons name="document-text-outline" color={C.blue} size={20}/></View><View style={{flex:1}}><Text style={s.sectionTitle}>Extracted policy details</Text><Text style={s.meta}>{detail.fields.length} PDF fields</Text></View><Text style={s.fieldsToggle}>{fieldExpanded?'Show less':'View all'}</Text><Ionicons name={fieldExpanded?'chevron-up':'chevron-down'} size={17} color={C.blue}/></Pressable>
            <View style={s.detailList}>
              {(fieldExpanded?detail.fields:detail.fields.slice(0,8)).map((f,index)=><View key={f.key+String(index)} style={s.detailField}>
                <Text style={s.fieldLabel}>{fieldName(f.key)}</Text>
                <Text selectable style={s.fieldValue}>{f.value}</Text>
              </View>)}
            </View>

            {!fieldExpanded&&detail.fields.length>8?<Pressable accessibilityRole="button" style={s.moreFields} onPress={()=>setFieldExpanded(true)}><Text style={s.moreFieldsText}>View {detail.fields.length-8} more fields</Text><Ionicons name="chevron-down" size={14} color={C.blue}/></Pressable>:null}
            <View style={s.safetyRow}><Ionicons name="shield-checkmark" color="#2D8065" size={16}/><Text style={s.safetyText}>PDF extraction is not booking approval. Final registration always uses the protected onboarding service.</Text></View>
          </ScrollView>:null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function useStudioMotion(){
  const focused=useIsFocused();
  const [foreground,setForeground]=useState(AppState.currentState==null||AppState.currentState==='active');
  const [reduced,setReduced]=useState(true);
  useEffect(()=>{let alive=true,changed=false;const app=AppState.addEventListener('change',state=>setForeground(state==='active'));const pref=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{changed=true;setReduced(value);});void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive&&!changed)setReduced(value);}).catch(()=>{});return()=>{alive=false;app.remove();pref.remove();};},[]);
  return focused&&foreground&&!reduced;
}
function StudioEntrance({children,motion,delay=0}:{children:ReactNode;motion:boolean;delay?:number}){
  const value=useRef(new Animated.Value(1)).current;
  const played=useRef(false);
  useEffect(()=>{if(!motion){value.setValue(1);return;}if(played.current)return;played.current=true;value.setValue(0);const a=Animated.timing(value,{toValue:1,duration:280,delay,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web',isInteraction:false});a.start();return()=>{a.stop();value.setValue(1);};},[motion,delay,value]);
  return <Animated.View style={{opacity:value,transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[5,0]})}]}}>{children}</Animated.View>;
}
function useStudioCount(value:number,motion:boolean,delay=0){
  const [shown,setShown]=useState(value);
  const previous=useRef<number|null>(null);
  useEffect(()=>{if(!motion){setShown(value);return;}if(previous.current===value)return;const start=previous.current??0;previous.current=value;const counter=new Animated.Value(start);const id=counter.addListener(({value:v})=>setShown(v));const a=Animated.timing(counter,{toValue:value,duration:650,delay,easing:Easing.out(Easing.cubic),useNativeDriver:false,isInteraction:false});a.start(({finished})=>{if(finished)setShown(value);});return()=>{counter.removeListener(id);a.stop();setShown(value);};},[value,motion,delay]);
  return motion?shown:value;
}
function StudioMetric({label,value,artwork,motion,delay}:{label:string;value:number;artwork:number;motion:boolean;delay:number}){
  const shown=useStudioCount(value,motion,delay);
  return <View style={s.metricCell}><Image source={artwork} style={s.metricArt} resizeMode="contain" accessible={false}/><View style={s.metricCopy}><Text style={s.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text><Text style={s.metricValue} accessibilityLabel={label+' '+value} numberOfLines={1} adjustsFontSizeToFit>{Math.round(shown).toLocaleString('en-IN')}</Text></View></View>;
}
const REVIEW_SEGMENTS=48;
function StudioReviewRing({value,motion}:{value:number;motion:boolean}){
  const shown=useStudioCount(value,motion);
  return <View style={s.reviewRing} accessible accessibilityRole="progressbar" accessibilityLabel="Share of open intakes in review, not booking completion" accessibilityValue={{min:0,max:100,now:Math.round(value*100)}}>{Array.from({length:REVIEW_SEGMENTS},(_,i)=>{const a=i*Math.PI*2/REVIEW_SEGMENTS;return <View key={i} style={[s.ringSegment,{left:24+Math.sin(a)*19-1,top:24-Math.cos(a)*19-2,transform:[{rotate:(i*360/REVIEW_SEGMENTS)+'deg'}],backgroundColor:i<Math.round(shown*REVIEW_SEGMENTS)?'#7956D1':'#E6DEFA'}]}/>;})}<Text style={s.ringValue}>{Math.round(shown*100)}%</Text></View>;
}
function StudioSkeleton({motion}:{motion:boolean}){
  const value=useRef(new Animated.Value(1)).current;
  useEffect(()=>{if(!motion){value.setValue(1);return;}const a=Animated.loop(Animated.sequence([Animated.timing(value,{toValue:.55,duration:850,useNativeDriver:Platform.OS!=='web',isInteraction:false}),Animated.timing(value,{toValue:1,duration:850,useNativeDriver:Platform.OS!=='web',isInteraction:false})]));a.start();return()=>{a.stop();value.setValue(1);};},[motion,value]);
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel="Loading policy intakes" style={{opacity:value}}>{Array.from({length:3},(_,i)=><View key={i} style={s.row}><View style={s.skeletonIcon}/><View style={s.rowMain}><View style={s.skeletonLine}/><View style={[s.skeletonLine,{width:'80%',marginTop:7}]}/></View><View style={[s.skeletonLine,{width:65}]}/></View>)}</Animated.View>;
}

const s=StyleSheet.create({
  studioRoot:{flex:1,backgroundColor:'#071E49'},
  studioTop:{minHeight:64,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#071E49'},
  headerButton:{width:36,minHeight:44,alignItems:'center',justifyContent:'center'},
  headerArt:{width:34,height:34},
  headerTitle:{flex:1,minWidth:0,color:'#FFFFFF',fontSize:18,fontWeight:'800'},
  studioCanvas:{flex:1,backgroundColor:'#F4F5F9'},
  studioContent:{paddingBottom:20},
  summaryPanel:{backgroundColor:'#FFFFFF',paddingHorizontal:12,paddingTop:13,paddingBottom:11,borderBottomWidth:1,borderBottomColor:'#D7DFEB'},
  summaryHeadline:{flexDirection:'row',alignItems:'center',gap:7,minHeight:70},
  summaryArt:{width:40,height:40},
  summaryAccent:{width:2,height:43,backgroundColor:'#A78DEB'},
  summaryCopy:{flex:1,minWidth:0,gap:3},
  summaryEyebrow:{color:'#7654CE',fontSize:10,fontWeight:'800',letterSpacing:.4},
  summaryTitle:{color:'#17233A',fontSize:18,fontWeight:'800'},
  summarySubtitle:{color:'#667085',fontSize:10.5,fontWeight:'600'},
  ringColumn:{alignItems:'center',width:78,gap:3},
  reviewRing:{width:48,height:48,alignItems:'center',justifyContent:'center'},
  ringSegment:{position:'absolute',width:2,height:4,borderRadius:1},
  ringValue:{color:'#7956D1',fontSize:11,fontWeight:'800'},
  ringLabel:{color:'#7654CE',fontSize:9,textAlign:'center'},
  summaryRule:{height:1,backgroundColor:'#E3E7EE',marginVertical:11},
  metricRow:{flexDirection:'row',alignItems:'center'},
  metricCell:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:3},
  metricArt:{width:28,height:28},
  metricCopy:{flexShrink:1,minWidth:0},
  metricDivider:{width:1,height:36,backgroundColor:'#CDD6E4'},
  metricLabel:{color:'#667085',fontSize:10,fontWeight:'600'},
  metricValue:{color:'#17233A',fontSize:17,fontWeight:'800',fontVariant:['tabular-nums']},
  queueSection:{paddingHorizontal:14,paddingTop:14},
  queueTitle:{color:'#17233A',fontSize:17,fontWeight:'800'},
  recordPill:{backgroundColor:'#E9E1FA',borderRadius:14,paddingHorizontal:10,paddingVertical:5},
  recordPillText:{color:'#6942B9',fontSize:10,fontWeight:'700'},
  queueCard:{backgroundColor:'#FFFFFF',borderRadius:17,borderWidth:1,borderColor:C.line,paddingHorizontal:10,paddingTop:10,overflow:'hidden'},
  searchBox:{minHeight:42,flexDirection:'row',alignItems:'center',gap:8,borderWidth:1,borderColor:'#D8E0EB',borderRadius:12,paddingHorizontal:10},
  searchInput:{flex:1,minWidth:0,color:C.ink,fontSize:12,paddingVertical:8},
  queueTabs:{flexDirection:'row',position:'relative',marginTop:12,marginBottom:7,borderBottomWidth:1,borderBottomColor:'#E3E7EE'},
  queueTab:{flex:1,minWidth:0,minHeight:43,alignItems:'center',justifyContent:'center',paddingHorizontal:2,gap:3},
  queueTabDivider:{borderLeftWidth:StyleSheet.hairlineWidth,borderLeftColor:'#D1D9E6'},
  queueTabText:{color:'#667085',fontSize:10.5,fontWeight:'600'},
  queueUnderline:{position:'absolute',bottom:0,left:0,height:3,backgroundColor:'#2387ED'},
  searchHint:{fontSize:10,color:C.faint,paddingVertical:8},
  rowArt:{width:32,height:32},
  rowFlag:{color:'#94611C',fontSize:9},
  emptyArt:{width:64,height:64},
  skeletonIcon:{width:32,height:32,borderRadius:8,backgroundColor:'#E9EDF4'},
  skeletonLine:{height:8,width:'60%',borderRadius:4,backgroundColor:'#E9EDF4'},
  root:{flex:1,backgroundColor:C.paper},scroll:{flex:1},
  top:{height:58,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  circle:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  topWord:{fontSize:10,letterSpacing:1.4,color:C.faint,fontWeight:'700'},
  eyebrow:{fontSize:10,color:'#87969C',fontWeight:'800',letterSpacing:1.5},
  titleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:16},
  subtitle:{fontSize:11.5,lineHeight:17,color:C.faint,marginTop:7,maxWidth:270},
  title:{fontSize:28,fontWeight:'800',letterSpacing:-1.1,color:C.ink,marginTop:5},
  sparkle:{height:46,width:46,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'#E7EEFF'},
  hero:{height:158,backgroundColor:C.navy,borderRadius:22,flexDirection:'row',overflow:'hidden',marginBottom:15},
  heroMain:{flex:1,paddingLeft:24,paddingTop:23,zIndex:1},
  heroOverline:{fontSize:10,fontWeight:'700',color:'#A7C6D1',letterSpacing:1.2},
  heroNumber:{fontSize:63,fontWeight:'700',color:'#FFFFFF',letterSpacing:-3,marginTop:2},
  heroHint:{fontSize:11,color:C.mint,marginTop:-1},
  heroAside:{width:113,alignSelf:'center',borderLeftWidth:1,borderLeftColor:'#375262',paddingLeft:18,zIndex:1},
  heroMini:{fontSize:22,fontWeight:'800',color:'#FFFFFF'},
  heroAsideLabel:{fontSize:10,color:'#B8CBD1',marginBottom:5},
  heroDivider:{backgroundColor:'#375262',height:1,marginVertical:7,marginRight:13},
  heroRing:{position:'absolute',width:220,height:220,borderRadius:110,borderWidth:1,borderColor:'#305060',top:-100,left:-100},
  quickGuide:{flexDirection:'row',alignItems:'center',gap:10,padding:13,borderRadius:17,backgroundColor:'#FFFFFF',borderColor:'#DFE8F5',borderWidth:1,marginBottom:16},
  guideIcon:{width:39,height:39,borderRadius:12,backgroundColor:'#EAF0FF',justifyContent:'center',alignItems:'center'},
  guideTitle:{fontSize:12,fontWeight:'800',color:C.ink},guideText:{fontSize:10.5,lineHeight:15,color:C.faint,marginTop:4},
  tabScroller:{flexGrow:0,marginBottom:20},
  segment:{flexDirection:'row',backgroundColor:'#E9EFFA',borderRadius:17,padding:4,gap:2},
  segmentItem:{minWidth:100,minHeight:43,paddingHorizontal:8,borderRadius:13,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:5},
  segmentActive:{backgroundColor:'#FFFFFF'},
  segmentLabel:{fontSize:12,fontWeight:'600',color:C.faint},
  segmentCount:{fontSize:10,fontWeight:'700',color:'#92A19F'},
  activeLabel:{color:C.ink,fontWeight:'800'},
  sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10,marginTop:2},
  sectionTitle:{fontSize:15,color:C.ink,fontWeight:'800',letterSpacing:-.3},
  meta:{fontSize:11,fontWeight:'600',color:C.faint},
  list:{backgroundColor:'#FFFFFF',borderRadius:22,borderWidth:1,borderColor:C.line,overflow:'hidden'},
  row:{minHeight:66,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:2,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},
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
  sheetContent:{paddingHorizontal:18,paddingTop:5,paddingBottom:48},
  detailHero:{backgroundColor:C.navy,borderRadius:21,padding:20,marginBottom:15},
  detailEyebrow:{fontSize:10,letterSpacing:1.4,fontWeight:'800',color:C.mint},
  detailName:{fontSize:22,color:'#FFFFFF',fontWeight:'800',marginTop:12,letterSpacing:-.5},
  detailMeta:{fontSize:11,color:'#B9C9D0',marginTop:8},
  detailSteps:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:7,marginTop:17},stepLabel:{fontSize:10,fontWeight:'700',color:'#D5E5F2'},
  fieldsHeader:{minHeight:65,padding:13,flexDirection:'row',alignItems:'center',gap:10,borderRadius:16,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,marginBottom:9},
  fieldsIcon:{width:39,height:39,borderRadius:12,backgroundColor:'#ECF1FF',alignItems:'center',justifyContent:'center'},
  fieldsToggle:{fontSize:11,color:C.blue,fontWeight:'800'},moreFields:{height:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  moreFieldsText:{fontSize:11,fontWeight:'700',color:C.blue},
  disabledAction:{opacity:.68},disabledConvert:{backgroundColor:'#8297C8'},
  disabledNotice:{flexDirection:'row',gap:10,marginTop:18,padding:15,borderRadius:16,backgroundColor:'#FFF7EA',borderWidth:1,borderColor:'#F0E4C9'},
  disabledTitle:{fontSize:12,color:'#795820',fontWeight:'800'},disabledText:{fontSize:11,lineHeight:17,color:'#926E3A',marginTop:4},
  uncertain:{flexDirection:'row',gap:8,borderRadius:12,backgroundColor:'#FFF1DE',padding:12,marginBottom:10},
  uncertainText:{flex:1,fontSize:11,lineHeight:17,color:'#925A25'},
  refreshRecord:{height:45,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,borderRadius:12,marginBottom:8},
  refreshRecordText:{fontWeight:'800',fontSize:12,color:C.blue},
  safetyRow:{flexDirection:'row',gap:8,paddingHorizontal:5,marginTop:17,alignItems:'flex-start'},safetyText:{flex:1,fontSize:10.5,lineHeight:16,color:C.faint},
  issue:{backgroundColor:'#FFF4E7',padding:14,borderRadius:14,flexDirection:'row',gap:9,marginBottom:16},
  issueText:{flex:1,fontSize:12,lineHeight:17,color:'#94652D',fontWeight:'600'},
  detailList:{backgroundColor:'#FFFFFF',borderRadius:19,borderWidth:1,borderColor:C.line,paddingHorizontal:16},
  detailField:{paddingVertical:14,minHeight:54,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line,flexDirection:'row',alignItems:'center',gap:14},
  fieldLabel:{flex:.38,fontSize:11,color:C.faint},
  fieldValue:{flex:.62,fontSize:11.5,color:C.ink,fontWeight:'700',textAlign:'right'},
  note:{fontSize:10.5,lineHeight:17,color:C.faint,marginTop:19,textAlign:'center'},
  actionsWrap:{marginTop:18},
  actionsRow:{flexDirection:'row',gap:10},
  reparseButton:{flex:1,minHeight:108,borderRadius:17,borderWidth:1,borderColor:'#C8D8F5',backgroundColor:'#FFFFFF',padding:13,alignItems:'flex-start',justifyContent:'center'},
  reparseLabel:{fontSize:12,fontWeight:'800',color:C.ink,marginTop:7},actionSub:{fontSize:10,color:C.faint,marginTop:3},
  convertButton:{flex:1,minHeight:108,borderRadius:17,backgroundColor:C.blue,padding:13,alignItems:'flex-start',justifyContent:'center'},
  convertLabel:{fontSize:12,fontWeight:'800',color:'#FFFFFF',marginTop:7},convertSub:{fontSize:10,color:'#DCE6FF',marginTop:3},
  actionError:{color:'#B04A3B',fontSize:11,lineHeight:16,marginBottom:10},
  confirmPanel:{borderRadius:17,borderColor:'#C8D8F5',borderWidth:1,padding:16,backgroundColor:'#FFFFFF'},
  confirmHeading:{flexDirection:'row',alignItems:'center',gap:8},
  confirmTitle:{fontSize:14,fontWeight:'800',color:C.ink},
  confirmDescription:{fontSize:11,color:C.faint,lineHeight:16,marginTop:7},
  confirmActions:{flexDirection:'row',gap:10,marginTop:16},
  cancel:{flex:1,height:43,borderRadius:12,justifyContent:'center',alignItems:'center',backgroundColor:'#EDF1F0'},
  cancelText:{fontSize:12,fontWeight:'800',color:C.ink},
  confirm:{flex:1,height:43,borderRadius:12,justifyContent:'center',alignItems:'center',backgroundColor:C.blue},
  confirmText:{fontSize:12,fontWeight:'800',color:'#FFFFFF'},
});
