import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
const PAGE_SIZE=10;
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
  const [pageIndex,setPageIndex]=useState(0);
  const [page,setPage]=useState<AiStudioPage>({counts:{open:0,action:0,in_review:0,processing:0},rows:[]});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
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
  const [search,setSearch]=useState('');
  const [debouncedSearch,setDebouncedSearch]=useState('');
  const [searchRows,setSearchRows]=useState<AiStudioRow[]|null>(null);
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchRevision,setSearchRevision]=useState(0);
  const [searchError,setSearchError]=useState('');
  const searchGeneration=useRef(0);
  const [reduceMotion,setReduceMotion]=useState(true);
  const [tabsWidth,setTabsWidth]=useState(0);
  const ringProgress=useRef(new Animated.Value(0)).current;
  const tabProgress=useRef(new Animated.Value(0)).current;
  const refreshRotation=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    let live=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduceMotion(v);}).catch(()=>{});
    const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return ()=>{live=false;sub.remove();};
  },[]);
  useEffect(()=>{const t=setTimeout(()=>setDebouncedSearch(search.trim().toLowerCase()),300);return ()=>clearTimeout(t);},[search]);

  const reload=useCallback(async()=>{
    if(!allowed) return;
    const token=++sequence.current;
    setLoading(true);setError('');
    try {
      const next=await loadAiStudioPage(filter,pageIndex*PAGE_SIZE,PAGE_SIZE);
      if(token!==sequence.current)return;
      if(pageIndex>0 && next.counts[filter] <= pageIndex*PAGE_SIZE){
        setPageIndex(Math.max(0,Math.ceil(next.counts[filter]/PAGE_SIZE)-1));return;
      }
      setPage(next);
    } catch(e) {
      if(token===sequence.current) setError(e instanceof Error?e.message:'Could not load the queue.');
    } finally {
      if(token===sequence.current){setLoading(false);setRefreshing(false);}
    }
  },[allowed,filter,pageIndex]);
  useFocusEffect(useCallback(()=>{
    if(!debouncedSearch)void reload();
    return ()=>{sequence.current++;detailSequence.current++;};
  },[reload,debouncedSearch]));
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
  const reviewPercent=count('open')>0?Math.min(100,Math.round(100*count('in_review')/count('open'))):0;
  useEffect(()=>{
    ringProgress.stopAnimation();
    if(reduceMotion){ringProgress.setValue(reviewPercent/100);return;}
    ringProgress.setValue(0);
    const motion=Animated.timing(ringProgress,{toValue:reviewPercent/100,duration:1000,easing:Easing.out(Easing.cubic),useNativeDriver:true});
    motion.start();return ()=>motion.stop();
  },[ringProgress,reviewPercent,reduceMotion]);
  useEffect(()=>{
    const position=TABS.findIndex(t=>t.key===filter);
    const motion=Animated.timing(tabProgress,{toValue:position,duration:reduceMotion?0:280,easing:Easing.out(Easing.cubic),useNativeDriver:true});
    motion.start();return ()=>motion.stop();
  },[filter,reduceMotion,tabProgress]);
  useEffect(()=>{
    if(!refreshing){refreshRotation.stopAnimation();refreshRotation.setValue(0);return;}
    if(reduceMotion)return;
    const motion=Animated.loop(Animated.timing(refreshRotation,{toValue:1,duration:850,easing:Easing.linear,useNativeDriver:true}));
    motion.start();return ()=>motion.stop();
  },[refreshing,reduceMotion,refreshRotation]);
  useEffect(()=>{
    const token=++searchGeneration.current;
    if(!debouncedSearch){setSearchRows(null);setSearchLoading(false);setSearchError('');return;}
    if(!allowed)return;
    setSearchRows(null);setSearchLoading(true);setSearchError('');
    // The list RPC is permission-scoped and has no search argument. Read every
    // authorized page before searching; never silently search the first 10 or 25.
    void (async()=>{
      try{
        const first=await loadAiStudioPage(filter,0,25);
        if(token!==searchGeneration.current)return;
        const all=[...first.rows];let offset=all.length;
        while(offset<first.counts[filter]){
          const next=await loadAiStudioPage(filter,offset,25);
          if(token!==searchGeneration.current)return;
          if(!next.rows.length)throw new Error('Could not search every intake. Try again.');
          all.push(...next.rows);offset+=next.rows.length;
        }
        if(token!==searchGeneration.current)return;
        setSearchRows(all.filter(row=>[row.intake_number,row.lead_source_name,row.policy_type,row.status,row.queue_state].some(value=>value?.toLowerCase().includes(debouncedSearch))));
      }catch(e){if(token===searchGeneration.current)setSearchError(e instanceof Error?e.message:'Intake search could not be completed.');}
      finally{if(token===searchGeneration.current){setSearchLoading(false);setRefreshing(false);}}
    })();
    return ()=>{searchGeneration.current++;};
  },[debouncedSearch,filter,allowed,searchRevision]);
  const matchingCount=debouncedSearch?(searchRows?.length??0):count(filter);
  const totalPages=Math.max(1,Math.ceil(matchingCount/PAGE_SIZE));
  const displayedRows=debouncedSearch?(searchRows??[]).slice(pageIndex*PAGE_SIZE,(pageIndex+1)*PAGE_SIZE):page.rows;
  const changePage=(next:number)=>{
    if(next<0||next>=totalPages||next===pageIndex)return;
    if(!debouncedSearch)setLoading(true);
    setPageIndex(next);
  };
  const refresh=()=>{setRefreshing(true);if(debouncedSearch)setSearchRevision(v=>v+1);else void reload();};
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
      if(result.policy_booked){setFilter('open');setPageIndex(0);}else void reload();
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
    <SafeAreaView style={s.root} edges={[]}>
      <StatusBar style="light" backgroundColor="#071E49" />
      <View style={[s.headerShell,{paddingTop:insets.top}]}>
        <View style={s.top}>
          <Pressable onPress={()=>router.back()} accessibilityRole="button" accessibilityLabel="Back to More" style={s.headerAction}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF"/>
          </Pressable>
          <Image source={PartnerAssets.actions.policyChecklist} style={s.headerArtwork} resizeMode="contain" accessible={false}/>
          <Text style={s.topWord} numberOfLines={1}>AI Onboarding Studio</Text>
          <Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel="Refresh" style={s.headerAction}>
            <Animated.View style={{transform:[{rotate:refreshRotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}><Ionicons name="refresh-outline" size={22} color="#FFFFFF"/></Animated.View>
          </Pressable>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.screenContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.blue} onRefresh={refresh}/>}>
        <View style={s.summarySurface}>
          <View style={s.summaryTop}>
            <Image source={PartnerAssets.actions.policyChecklist} style={s.summaryArtwork} resizeMode="contain" accessible={false}/>
            <View style={s.summaryText}>
              <Text style={s.summaryOverline}>POLICY WORK QUEUE</Text>
              <Text style={s.summaryMain}>{count('open')} Open Intakes</Text>
              <Text style={s.summaryDescription}>Review, verify & convert policies</Text>
            </View>
            <View style={s.ringHolder} accessibilityLabel={reviewPercent+' percent of open intakes are in review'}>
              {Array.from({length:24},(_,i)=>{
                const angle=i*15;
                return <Animated.View key={i} style={[s.ringTick,{
                  backgroundColor: '#7757E5',
                  opacity:ringProgress.interpolate({inputRange:[Math.max(0,i/24),(i+1)/24],outputRange:[0.14,1],extrapolate:'clamp'}),
                  transform:[{rotate:angle+'deg'},{translateY:-18}],
                }]}/>;
              })}
              <Text style={s.ringText}>{reviewPercent}%</Text>
            </View>
          </View>
          <View style={s.summaryDivider}/>
          <View style={s.summaryMetrics}>
            {([
              {key:'processing',title:'Processing',image:PartnerAssets.status.policyPending},
              {key:'in_review',title:'In Review',image:PartnerAssets.actions.documentSearch},
              {key:'action',title:'Action',image:PartnerAssets.status.policyAttention},
            ] as const).map(metric=>(
              <View style={s.metric} key={metric.key}>
                <Image source={metric.image} style={s.metricArtwork} resizeMode="contain" accessible={false}/>
                <View style={s.metricCopy}>
                  <Text style={s.metricLabel}>{metric.title}</Text>
                  <Text style={s.metricValue}>{count(metric.key)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={s.listSection}>
          <View style={s.listHeading}>
            <Text style={s.listHeadingText}>Policy intakes</Text>
            <Text style={s.recordPill}>{searchLoading?'Searching…':`${matchingCount} ${matchingCount===1?"Record":"Records"}`}</Text>
          </View>
          <View style={s.intakePanel}>
            <View style={s.searchBar}>
              <Ionicons name="search-outline" size={16} color="#2274CF"/>
              <TextInput value={search} onChangeText={value=>{setSearch(value);setPageIndex(0);}} placeholder="Search customer or intake..."
                placeholderTextColor="#8899B2" style={s.searchInput} autoCapitalize="none"
                accessibilityLabel="Search intake or source across authorized records"
                returnKeyType="search"/>
              {search?<Pressable onPress={()=>{setSearch('');setPageIndex(0);}} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color="#91A1B3"/>
              </Pressable>:<Ionicons name="options-outline" size={17} color="#6F88AA"/>}
            </View>
            <View style={s.tabsRow} onLayout={event=>setTabsWidth(event.nativeEvent.layout.width)}>
              {TABS.map(tab=><Pressable key={tab.key} style={s.tabItem}
                accessibilityRole="tab" accessibilityState={{selected:filter===tab.key}}
                onPress={()=>{if(tab.key===filter)return;setFilter(tab.key);setPageIndex(0);setSearchRows(null);setLoading(true);}}>
                <Text style={[s.tabText,filter===tab.key&&s.tabTextActive]}>{tab.label==='All Open'?'All':tab.label}</Text>
              </Pressable>)}
              {tabsWidth>0?<Animated.View pointerEvents="none" style={[s.tabUnderline,{
                width:tabsWidth/4,
                transform:[{translateX:Animated.multiply(tabProgress,tabsWidth/4)}],
              }]}/>:null}
            </View>
            {(loading&&!debouncedSearch||searchLoading)?
              <View accessibilityRole="progressbar" accessibilityLabel="Loading policy intakes" style={s.rowsLoading}>
                {Array.from({length:Math.min(4,Math.max(0,count(filter)))},(_,i)=><View key={i} style={s.skeletonRow}>
                  <View style={s.skeletonIcon}/><View style={s.skeletonCopy}><View style={s.skeletonLineWide}/><View style={s.skeletonLineShort}/></View>
                </View>)}
              </View>:null}
            {error?<Pressable style={s.error} onPress={()=>void reload()} accessibilityRole="button">
              <Text style={s.errorText}>{error}</Text><Ionicons name="refresh" color="#A44935" size={18}/>
            </Pressable>:null}
            {searchError?<Text style={s.errorText}>{searchError}</Text>:null}
            {!loading&&!searchLoading&&!error&&!searchError&&displayedRows.length===0?
              <View style={s.compactEmpty}>
                <Image source={debouncedSearch?PartnerAssets.emptyStates.noSearchResults:PartnerAssets.emptyStates.noDocuments}
                  style={s.emptyArtwork} resizeMode="contain" accessible={false}/>
                <Text style={s.emptyHead}>{debouncedSearch?'No matching intakes':'No intakes found'}</Text>
                <Text style={s.emptyText}>{debouncedSearch?'Try another intake number or source.':'There are no intakes in this view.'}</Text>
              </View>:null}
            {!loading&&!searchLoading&&!error&&!searchError&&displayedRows.map((row,index)=>{
              const done=!!row.final_policy_id,flag=row.exception_codes.length>0;
              const status=done?'Completed':row.status==='in_review'?'In review':row.status==='processing'&&row.ocr_status!=='failed'?'Fetching details':'Action required';
              return <StudioRowEnter key={row.id} index={index} reduceMotion={reduceMotion}>
                <Pressable accessibilityRole="button" accessibilityLabel={'Open '+row.intake_number}
                  style={({pressed})=>[s.compactRow,pressed&&s.compactRowPressed]} onPress={()=>openDetail(row)}>
                  <View style={s.rowArtworkShell}>
                    <Image source={flag?PartnerAssets.status.policyAttention:done?PartnerAssets.status.verified:row.status==='in_review'?PartnerAssets.actions.documentSearch:row.status==='processing'?PartnerAssets.status.policyPending:PartnerAssets.actions.policyChecklist}
                      style={s.rowArtwork} resizeMode="contain" accessible={false}/>
                  </View>
                  <View style={s.rowMain}>
                    <Text numberOfLines={1} style={s.rowTitle}>{row.intake_number.replace('PIR-','')}</Text>
                    <Text numberOfLines={1} style={s.rowSub}>{row.lead_source_name||row.policy_type||'Policy intake'}</Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text numberOfLines={1} style={[s.rowStatus,{color:done?'#398562':flag?'#A5773A':'#5C78A8'}]}>{status}</Text>
                    <Text numberOfLines={1} style={s.rowChecks}>{row.checks_passed?String(row.checks_passed)+' checks':'Pending'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="#91A4B6"/>
                </Pressable>
              </StudioRowEnter>;
            })}
            {!loading&&!searchLoading&&!error&&!searchError?(
              <View style={s.paginationRow}>
                <Text style={s.paginationInfo}>{matchingCount===0?'0 records':`Showing ${pageIndex*PAGE_SIZE+1}–${Math.min((pageIndex+1)*PAGE_SIZE,matchingCount)} of ${matchingCount}`}</Text>
                <View style={s.paginationActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Previous page"
                    disabled={pageIndex===0} style={[s.paginationButton,pageIndex===0&&s.paginationDisabled]}
                    onPress={()=>changePage(pageIndex-1)}>
                    <Ionicons name="chevron-back" size={17} color="#1D5CAA"/>
                  </Pressable>
                  <Text style={s.paginationPage}>Page {pageIndex+1} of {totalPages}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Next page"
                    disabled={pageIndex>=totalPages-1} style={[s.paginationButton,pageIndex>=totalPages-1&&s.paginationDisabled]}
                    onPress={()=>changePage(pageIndex+1)}>
                    <Ionicons name="chevron-forward" size={17} color="#1D5CAA"/>
                  </Pressable>
                </View>
              </View>
            ):null}
          </View>
        </View>
      </ScrollView>
      <View style={[s.bottomNavigationShell,{paddingBottom:insets.bottom}]}>
        <PartnerCaseBottomNavigation activeTab="More" />
      </View>

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

function StudioRowEnter({children,index,reduceMotion}:{children:ReactNode;index:number;reduceMotion:boolean}){
  const opacity=useRef(new Animated.Value(1)).current;
  const rise=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(reduceMotion){opacity.setValue(1);rise.setValue(0);return;}
    opacity.setValue(0);rise.setValue(7);
    const animation=Animated.parallel([
      Animated.timing(opacity,{toValue:1,duration:340,delay:Math.min(index,8)*55,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.timing(rise,{toValue:0,duration:340,delay:Math.min(index,8)*55,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
    ]);
    animation.start();return ()=>animation.stop();
  },[opacity,rise,reduceMotion,index]);
  return <Animated.View style={{opacity,transform:[{translateY:rise}]}}>{children}</Animated.View>;
}

const s=StyleSheet.create({
  screenContent:{paddingBottom:24},
  summarySurface:{backgroundColor:'#FFFFFF',paddingHorizontal:11,paddingTop:10,paddingBottom:8},
  summaryTop:{flexDirection:'row',alignItems:'center',minHeight:76,gap:8},
  summaryArtwork:{width:43,height:45},
  summaryText:{flex:1,minWidth:0},
  summaryOverline:{fontSize:8,color:'#6245D2',fontWeight:'700',letterSpacing:0.6},
  summaryMain:{fontSize:19,color:'#10294D',fontWeight:'800',marginTop:2},
  summaryDescription:{fontSize:10,color:'#68798F',marginTop:3},
  summaryDivider:{height:StyleSheet.hairlineWidth,backgroundColor:'#DFE5EE',marginTop:5,marginBottom:8},
  ringHolder:{width:44,height:44,alignItems:'center',justifyContent:'center',marginLeft:4},
  ringTick:{position:'absolute',left:20,top:20,width:4,height:7,borderRadius:3},
  ringText:{fontSize:9,fontWeight:'800',color:'#6844D9'},
  summaryMetrics:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:47},
  metric:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,minWidth:0},
  metricArtwork:{width:33,height:33},
  metricCopy:{minWidth:0},
  metricLabel:{color:'#627089',fontSize:10},
  metricValue:{color:'#071D38',fontSize:16,fontWeight:'800'},
  listSection:{backgroundColor:'#F4F6FB',paddingHorizontal:10,paddingTop:10,paddingBottom:18,flex:1},
  listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},
  listHeadingText:{fontSize:14,fontWeight:'800',color:'#0C2342'},
  recordPill:{fontSize:9,color:'#6048C9',backgroundColor:'#EFE8FF',borderRadius:14,overflow:'hidden',paddingVertical:5,paddingHorizontal:10},
  intakePanel:{backgroundColor:'#FFFFFF',borderRadius:15,borderWidth:1,borderColor:'#DEE5EF',paddingHorizontal:10,paddingTop:10,paddingBottom:2,overflow:'hidden'},
  searchBar:{height:36,borderRadius:10,borderWidth:1,borderColor:'#DCE4ED',flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,marginBottom:7},
  searchInput:{flex:1,fontSize:10.5,color:'#1A365B',paddingVertical:0,minHeight:34},
  tabsRow:{flexDirection:'row',height:30,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DDE5EF',position:'relative'},
  tabItem:{flex:1,alignItems:'center',justifyContent:'center',minWidth:0},
  tabText:{fontSize:9,color:'#526784'},
  tabTextActive:{color:'#135CB9',fontWeight:'700'},
  tabUnderline:{position:'absolute',height:2,bottom:0,left:0,backgroundColor:'#2178EC'},
  compactRow:{minHeight:63,flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7ECF2',paddingVertical:7},
  compactRowPressed:{backgroundColor:'#F4F8FE'},
  rowArtworkShell:{width:33,height:35,borderRadius:7,alignItems:'center',justifyContent:'center'},
  rowArtwork:{width:32,height:33},
  rowsLoading:{gap:0},
  skeletonRow:{height:63,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5EBF2'},
  skeletonIcon:{width:28,height:32,borderRadius:7,backgroundColor:'#EDF2FA'},
  skeletonCopy:{flex:1,gap:7},
  skeletonLineWide:{height:9,width:'58%',borderRadius:5,backgroundColor:'#EDF2FA'},
  skeletonLineShort:{height:7,width:'74%',borderRadius:4,backgroundColor:'#EDF2FA'},
  compactEmpty:{minHeight:115,alignItems:'center',justifyContent:'center',gap:5,padding:12},
  emptyArtwork:{width:49,height:49},
  paginationRow:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E6ECF4',paddingTop:7,paddingBottom:5},
  paginationInfo:{color:'#78889A',fontSize:10,flexShrink:1},
  paginationActions:{flexDirection:'row',alignItems:'center',gap:7},
  paginationButton:{width:29,height:29,alignItems:'center',justifyContent:'center',borderRadius:8,borderWidth:1,borderColor:'#DFE8F2'},
  paginationDisabled:{opacity:0.35},
  paginationPage:{fontSize:10,fontWeight:'700',color:'#195BBA'},

  root:{flex:1,backgroundColor:C.paper},scroll:{flex:1},
  headerShell:{backgroundColor:'#071E49'},
  top:{minHeight:64,paddingHorizontal:14,backgroundColor:'#071E49',flexDirection:'row',alignItems:'center',gap:10},
  headerAction:{width:34,minHeight:44,alignItems:'center',justifyContent:'center'},
  headerArtwork:{width:36,height:36},
  bottomNavigationShell:{backgroundColor:'#071E49'},
  circle:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  topWord:{flex:1,flexShrink:1,color:'#FFFFFF',fontSize:18,fontWeight:'800'},
  eyebrow:{fontSize:10,color:'#87969C',fontWeight:'800',letterSpacing:1.5},
  titleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:16},
  subtitle:{fontSize:11.5,lineHeight:17,color:C.faint,marginTop:7,maxWidth:270},
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
  row:{minHeight:86,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},
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
