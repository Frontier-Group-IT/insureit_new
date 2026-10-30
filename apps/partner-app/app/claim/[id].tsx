import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { getPartnerClaimDetail, savePartnerInsurerClaimNumber, type PartnerClaimDetail } from '@/lib/claims';
import { PartnerAssets } from '@/lib/partner-assets';
import { PartnerClaimDocuments } from '@/components/partner-claim-documents';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { CLAIM_STAGES, getClaimTrackerState, formatClaimDate } from '@/lib/claim-tracker';


const MILESTONE_ARTWORK = {
  spot_intimation: require('../../mobile-app/assets/claims/claim-intimation.png'),
  spot_status: require('../../mobile-app/assets/claims/claim-survey.png'),
  claim_intimation: require('../../mobile-app/assets/claims/claim-intimation.png'),
  work_approval: require('../../mobile-app/assets/claims/claim-approval.png'),
  repair_ri: require('../../mobile-app/assets/claims/repair-ri-stage-icon.png'),
  billing: require('../../mobile-app/assets/claims/accounts-finance.png'),
  delivery_order: require('../../mobile-app/assets/claims/claim-assessment.png'),
  vehicle_delivery: require('../../mobile-app/assets/claims/fleet-vehicle.png'),
  payment_encashment: require('../../mobile-app/assets/claims/claim-settlement.png'),
} as const;

const STAGE_DESCRIPTIONS: Record<string, string> = {
  spot_intimation: 'Insurer informed', spot_status: 'Survey completed',
  claim_intimation: 'Claim registered', work_approval: 'Approval received',
  repair_ri: 'Repair / RI completed', billing: 'Bill recorded',
  delivery_order: 'DO issued', vehicle_delivery: 'Vehicle received',
  payment_encashment: 'Payment received',
};
const CURRENT_STAGE_HINTS: Record<string, string> = {
  spot_intimation: 'Record the incident and inform the insurer.',
  spot_status: 'Record when the spot survey is completed.',
  claim_intimation: 'Record claim registration and estimate details.',
  work_approval: 'Record approval and surveyor details.',
  repair_ri: 'Record repair and re-inspection progress.',
  billing: 'Record the final bill details.',
  delivery_order: 'Record delivery order details.',
  vehicle_delivery: 'Record vehicle delivery.',
  payment_encashment: 'Record the payment received.',
};
const STAGE_DATE_FIELDS: Record<string, string[]> = {
  spot_status: ['spot_survey_done_date'], claim_intimation: ['claim_intimation_date'],
  work_approval: ['approval_received_date'], repair_ri: ['ri_done_date','repair_complete_date'],
  billing: ['bill_date'], delivery_order: ['do_date'], vehicle_delivery: ['vehicle_received_date'],
  payment_encashment: ['payment_received_date'],
};
const STAGE_AMOUNTS: Record<string, string> = {
  claim_intimation: 'estimate_amount', billing: 'bill_amount',
  delivery_order: 'do_amount', payment_encashment: 'payment_received_amount',
};
function recordedStage(data: PartnerClaimDetail, key: string) {
  return [...data.stages].reverse().find(item => item.details?.milestone_key === key);
}
function stageDate(data: PartnerClaimDetail, key: string): string | null {
  if (key === 'spot_intimation') return data.claim.spot_intimation_at || null;
  const stage = recordedStage(data, key);
  for (const field of STAGE_DATE_FIELDS[key] ?? []) {
    const value = stage?.details?.[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  // Stage record creation is not evidence of the actual milestone date.
  return null;
}
function stageMoney(data: PartnerClaimDetail, key: string): number | null {
  const field = STAGE_AMOUNTS[key];
  const raw = field ? recordedStage(data,key)?.details?.[field] : null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const value = Number(String(raw).replace(/[,₹\s]/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function formatRupees(value: number | null) {
  return value === null ? '—' : '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function formattedStageDate(value: string | null, includeTime = false) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const date = new Intl.DateTimeFormat('en-IN', { day:'2-digit',month:'short',year:'numeric' }).format(parsed);
  return includeTime && /T\d{2}:\d{2}/.test(value || '') ? `${date} · ${new Intl.DateTimeFormat('en-IN', { hour:'numeric',minute:'2-digit',hour12:true }).format(parsed).toLowerCase()}` : date;
}

export default function ClaimTrackerScreen() {
  const router = useRouter();
  const mainScrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => {
    const reset = () => mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, []));
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PartnerClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [claimNumberOpen, setClaimNumberOpen] = useState(false);
  const [claimNumber, setClaimNumber] = useState('');
  const [claimNumberSaving, setClaimNumberSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setError('Claim ID is missing.'); setLoading(false); return; }
    setLoading(true);
    try { setData(await getPartnerClaimDetail(id)); setError(''); }
    catch { setError('This claim could not be loaded in your Partner scope.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const tracker = data ? getClaimTrackerState(data) : null;
  const openClaimNumber = () => { setClaimNumber(data?.claim.insurer_claim_no || ''); setClaimNumberOpen(true); };
  const saveClaimNumber = async () => {
    if (!data || claimNumberSaving) return;
    const value = claimNumber.trim();
    if (!value || value.length > 80) { Alert.alert('Action required', 'Enter a valid insurer claim number (up to 80 characters).'); return; }
    setClaimNumberSaving(true);
    try {
      await savePartnerInsurerClaimNumber(data.claim.id, value);
      setData(await getPartnerClaimDetail(data.claim.id));
      setClaimNumberOpen(false);
      Alert.alert('Saved', 'Insurer claim number updated successfully.');
    } catch (error) { Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setClaimNumberSaving(false); }
  };
  const openStage = (key: string) => router.push({ pathname: '/claim/stage', params: { id, key } } as never);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.8 }]}>
          <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerIcon}><Image source={PartnerAssets.actions.quickClaims} style={styles.headerIconImage} resizeMode="contain" /></View>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Claim Tracker</Text></View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.trackerTitleRow}>
          <Text style={styles.trackerTitle}>Claim Tracker</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Get Assistance" onPress={() => router.push('/support' as never)} style={styles.assistanceButton}>
            <Ionicons name="call-outline" size={22} color="#168268"/>
            <Text style={styles.assistanceText}>Get Assistance</Text>
          </Pressable>
        </View>
        {loading ? <PartnerStateView state="loading" title="Loading claim tracker" /> : error || !data || !tracker
          ? <PartnerStateView state="error" title="Claim unavailable" message={error || 'Please retry.'} actionLabel="Retry" onAction={() => void load()} />
          : <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} style={styles.logoImage} resizeMode="contain" /></View>
                <View style={styles.heroMain}><Text style={styles.stageEyebrow}>{tracker.progress === 100 ? 'CLAIM COMPLETE' : tracker.current.label}</Text><Text numberOfLines={1} style={styles.vehicle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text style={styles.heroControl}>{data.claim.claim_no || 'Control number pending'}</Text></View>
                <View style={styles.ring}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.ringText}>{tracker.progress}%</Text></View>
              </View>
              <View style={styles.heroDivider}/>
              <View style={styles.heroMiddle}><View><Text style={styles.heroMinor}>INCIDENT</Text><Text style={styles.heroDate}>{formatClaimDate(data.claim.accident_at)}</Text></View><Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(v => !v)} style={styles.toggle}><Text style={styles.toggleText}>Claim details</Text><Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#FFF"/></Pressable></View>
              {detailsOpen && <View style={styles.details}>
                <Field label="Control No." value={data.claim.claim_no}/>
                <Field label="Claim No." value={data.claim.insurer_claim_no}/>
                <Field label="Manufacturer" value={data.vehicle.make}/>
                <Field label="Insured Person" value={data.customer.name}/>
                <Field label="Policy" value={data.policy.policy_no}/>
                <Field label="Insurer" value={data.insurer.name}/>
                <Field label="Service Mode" value={data.claim.claim_service_mode?.replaceAll('_', ' ')}/>
                <Field label="Current Status" value={data.claim.current_status}/>
                <Field label="Accident Location" value={data.claim.accident_location}/>
                <Field label="Assistance" value={data.claim.assistance_status?.replaceAll('_', ' ')}/>
              </View>}
            </View>
            {tracker.progress < 100 ? <Pressable accessibilityRole="button" accessibilityLabel={`Open current milestone: ${tracker.current.label}`} onPress={() => openStage(tracker.current.key)} style={styles.currentMilestoneCard}>
              <View style={styles.currentMilestoneIcon}><Image source={MILESTONE_ARTWORK[tracker.current.key]} resizeMode="contain" style={styles.currentMilestoneArtwork} accessibilityLabel={`${tracker.current.label} milestone`} /></View>
              <View style={styles.currentMilestoneCopy}>
                <Text style={styles.currentMilestoneEyebrow}>CURRENT MILESTONE</Text>
                <Text style={styles.currentMilestoneTitle}>{tracker.current.label}</Text>
                <Text style={styles.currentMilestoneDescription}>{CURRENT_STAGE_HINTS[tracker.current.key]}</Text>
              </View>
              <Ionicons name="chevron-forward" color="#1459A3" size={21}/>
            </Pressable> : null}
            <View style={styles.panel}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: journeyOpen }} onPress={() => setJourneyOpen(v => !v)} style={styles.panelHeader}>
                <View style={styles.insurerJourneyLogo}><PartnerInsurerLogo name={data.insurer.name} style={styles.insurerJourneyImage} fallback={PartnerAssets.actions.quickClaims}/></View>
                <View style={styles.panelCopy}><Text style={styles.panelTitle}>Claim Journey</Text><Text style={styles.panelSubtitle}>{tracker.progress}% complete • {tracker.current.label}</Text></View>
                <Ionicons name={journeyOpen ? 'chevron-up' : 'chevron-down'} color="#526987" size={17}/>
              </Pressable>
              {journeyOpen && <View style={styles.stageList}>{CLAIM_STAGES.map((stage, index) => {
                const done = tracker.completedKeys.has(stage.key), current = !done && index === tracker.index;
                const date = done ? formattedStageDate(stageDate(data, stage.key), stage.key === 'spot_intimation') || 'Date not recorded' : 'Pending';
                const amount = done ? stageMoney(data, stage.key) : null;
                return <Pressable key={stage.key} accessibilityRole="button" accessibilityLabel={`Open ${stage.label} details`} onPress={() => openStage(stage.key)} style={[styles.stageRow,current && styles.currentRow]}>
                  <View style={styles.rail}><View style={[styles.dot,done && styles.doneDot,current && styles.currentDot]}>{done ? <Ionicons name="checkmark" size={10} color="#FFF"/> : current ? <View style={styles.innerDot}/> : <Ionicons name="eye-outline" size={11} color="#A8B2C1"/>}</View>{index<8 && <View style={styles.line}/>}</View>
                  <View style={styles.stageCopy}><Text style={styles.stageName}>{stage.label}</Text><Text style={[styles.stageStatus,done && styles.doneStatus,current && styles.currentStatus]}>{done ? STAGE_DESCRIPTIONS[stage.key] : current ? tracker.substage : 'Upcoming'}</Text></View>
                  <View style={styles.stageMeta}>
                    <Text style={styles.stageDate}>{date}</Text>
                    {amount !== null ? <Text style={styles.stageAmount}>{formatRupees(amount)}</Text> : null}
                    {done ? <Ionicons name="chevron-forward" color="#607C9E" size={14}/> : null}
                  </View>
                </Pressable>;
              })}</View>}
            </View>
            <View style={styles.financeCard}>
              <View style={styles.financeHeader}><Image source={require("../../mobile-app/assets/claims/accounts-finance.png")} resizeMode="contain" style={styles.financeArtwork} accessibilityLabel="Financial progress" /><View><Text style={styles.financeTitle}>FINANCIAL PROGRESS</Text><Text style={styles.financeSub}>Claim value movement</Text></View></View>
              {([{ label:'Estimate', key:'claim_intimation' },{label:'Bill',key:'billing'},{label:'DO',key:'delivery_order'},{label:'Received',key:'payment_encashment'}] as const).map(item => <View key={item.key} style={styles.financeRow}><Text style={styles.financeLabel}>{item.label}</Text><Text style={styles.financeValue}>{formatRupees(stageMoney(data,item.key))}</Text></View>)}
            </View>
            <View style={styles.panel}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: documentsOpen }} onPress={() => setDocumentsOpen(v => !v)} style={styles.panelHeader}>
                <Image source={PartnerAssets.actions.claimDocumentsFolder} resizeMode="contain" style={styles.documentsIcon}/>
                <View style={styles.panelCopy}><Text style={styles.panelTitle}>Documents</Text><Text style={styles.panelSubtitle}>{data.documents === null ? 'Documents unavailable' : `${data.documents.length} document${data.documents.length === 1 ? '' : 's'}`}</Text></View>
                <Ionicons name={documentsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#526987"/>
              </Pressable>
              {documentsOpen && <View style={styles.documentBody}><PartnerClaimDocuments documents={data.documents} claimId={data.claim.id} /></View>}
            </View>
          </>}
      </ScrollView>
      <Modal transparent visible={claimNumberOpen} animationType="fade" onRequestClose={() => { if (!claimNumberSaving) setClaimNumberOpen(false); }}>
        <View style={styles.claimModalBackdrop}>
          <View style={styles.claimModalCard}>
            <View style={styles.claimModalIcon}><Ionicons name="shield-checkmark-outline" size={29} color="#0B347A" /></View>
            <Text style={styles.claimModalTitle}>{data?.claim.insurer_claim_no ? 'Edit insurer claim number?' : 'Add insurer claim number?'}</Text>
            <View style={styles.claimInputRow}><Ionicons name="document-text-outline" size={20} color="#0B347A"/><TextInput accessibilityLabel="Enter claim number" style={styles.claimNumberInput} placeholder="Enter claim number" placeholderTextColor="#75839A" value={claimNumber} onChangeText={setClaimNumber} autoCapitalize="characters" maxLength={80} editable={!claimNumberSaving} returnKeyType="done" /></View>
            <View style={styles.claimModalActions}>
              <Pressable accessibilityRole="button" disabled={claimNumberSaving} onPress={() => setClaimNumberOpen(false)} style={styles.claimCancel}><Text style={styles.claimCancelText}>Not now</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={claimNumberSaving} onPress={() => void saveClaimNumber()} style={styles.claimContinue}>{claimNumberSaving ? <ActivityIndicator color="#FFF"/> : <><Text style={styles.claimContinueText}>Continue</Text><Ionicons name="arrow-forward" size={19} color="#FFF"/></>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.nav}>
        <Nav label="Home" icon="home" onPress={() => router.push('/(tabs)' as never)}/>
        <Nav label="Business" icon="briefcase-outline" onPress={() => router.push('/(tabs)/business' as never)}/>
        <Nav label="Policies" icon="document-text-outline" onPress={() => router.push('/(tabs)/policies' as never)}/>
        <Nav label="Claims" icon="shield-checkmark" active onPress={() => router.push('/(tabs)/claims' as never)}/>
        <Nav label="More" icon="grid-outline" onPress={() => router.push('/(tabs)/more' as never)}/>
      </View>
    </SafeAreaView>
  );
}
function Field({ label, value }: { label: string; value: string | null | undefined }) {return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value || 'Not recorded'}</Text></View>}
function Nav({label,icon,onPress,active=false}:{label:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void;active?:boolean}) {return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.navItem}><View style={[styles.navIcon,active && styles.navActive]}><Ionicons name={icon} size={19} color={active?'#102F6C':'#7386A4'}/></View><Text style={[styles.navText,active && styles.navTextActive]}>{label}</Text></Pressable>}
const styles=StyleSheet.create({
root:{flex:1,backgroundColor:'#EDF6FE'},  header: { height: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#081F4C' },
  backButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  headerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: 'transparent' },
  headerIconImage: { width: 22, height: 22 },
  headerCopy: { flex: 1, justifyContent: 'center' }, headerTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '800' },
claimNumberButton:{marginTop:14,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#D2E2F4',minHeight:45,flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:9},claimNumberIcon:{width:28,height:28,borderRadius:9,backgroundColor:'#E8F1FF',alignItems:'center',justifyContent:'center'},claimNumberButtonText:{flex:1,fontSize:11,fontWeight:'800',color:'#0B347A'},claimModalBackdrop:{flex:1,backgroundColor:'rgba(6,24,58,0.65)',justifyContent:'center',paddingHorizontal:25},claimModalCard:{backgroundColor:'#FFFFFF',borderRadius:25,padding:20,alignItems:'center',gap:20},claimModalIcon:{height:60,width:60,borderRadius:18,backgroundColor:'#EEF5FF',alignItems:'center',justifyContent:'center'},claimModalTitle:{fontSize:18,fontWeight:'900',color:'#0B244C',textAlign:'center'},claimInputRow:{width:'100%',height:62,borderWidth:1.5,borderColor:'#0D459D',borderRadius:15,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16},claimNumberInput:{flex:1,color:'#10284B',fontSize:14,fontWeight:'700'},claimModalActions:{flexDirection:'row',gap:12,width:'100%'},claimCancel:{flex:1,borderWidth:1.5,borderColor:'#0D459D',borderRadius:14,minHeight:56,alignItems:'center',justifyContent:'center'},claimCancelText:{color:'#0D459D',fontSize:13,fontWeight:'800'},claimContinue:{flex:1.15,borderRadius:14,minHeight:56,backgroundColor:'#0D459D',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},claimContinueText:{color:'#FFF',fontSize:13,fontWeight:'800'},
scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:12,paddingBottom:30,gap:12},trackerTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,minHeight:70},trackerTitle:{fontSize:21,fontWeight:'900',color:'#10284B'},assistanceButton:{alignItems:'center',justifyContent:'center',gap:3,backgroundColor:'#EEFAF5',borderWidth:1,borderColor:'#B7E6D4',borderRadius:14,minWidth:83,minHeight:65,padding:6},assistanceText:{fontSize:8,fontWeight:'800',color:'#168268'},title:{color:'#0D2857',fontSize:24,fontWeight:'900',marginBottom:5},hero:{backgroundColor:'#07347E',borderRadius:18,padding:12,shadowColor:'#142E58',shadowOpacity:.18,shadowRadius:6,elevation:4},heroTop:{flexDirection:'row',alignItems:'center',gap:8},logo:{width:43,height:43,borderRadius:9,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},logoImage:{width:36,height:36},heroMain:{flex:1},stageEyebrow:{color:'#BCD1EF',fontSize:9,fontWeight:'700'},vehicle:{color:'#FFF',fontSize:21,fontWeight:'900',marginTop:2},heroControl:{color:'#D9E7FA',fontSize:10,fontWeight:'700'},ring:{width:45,height:45,borderRadius:25,borderWidth:4,borderColor:'#527BAC',justifyContent:'center',alignItems:'center'},ringText:{color:'#FFF',fontWeight:'800',fontSize:12,textAlign:'center',includeFontPadding:false},heroDivider:{height:1,backgroundColor:'#6481AF',marginVertical:12},heroMiddle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroMinor:{fontSize:9,color:'#B8C9E5',fontWeight:'700'},heroDate:{color:'#FFF',fontSize:11,fontWeight:'800',marginTop:3},toggle:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#2E528C',borderRadius:10,borderWidth:1,borderColor:'#6483B0',padding:10},toggleText:{color:'#FFF',fontSize:10,fontWeight:'700'},details:{marginTop:10,backgroundColor:'#FFF',borderRadius:13,padding:11,flexDirection:'row',flexWrap:'wrap',rowGap:10},field:{width:'50%',paddingHorizontal:2},fieldLabel:{fontSize:9,color:'#7B889E',fontWeight:'600'},fieldValue:{fontSize:10.5,color:'#162C50',fontWeight:'800',marginTop:3},
currentMilestoneCard:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#F7FAFF',borderWidth:1,borderColor:'#C8D9EB',borderLeftWidth:4,borderLeftColor:'#1459A3',borderRadius:17,paddingVertical:12,paddingHorizontal:12,minHeight:76},currentMilestoneIcon:{width:43,height:43,borderRadius:11,backgroundColor:'#E5F1FF',justifyContent:'center',alignItems:'center'},currentMilestoneArtwork:{width:37,height:37},currentMilestoneCopy:{flex:1,gap:3},currentMilestoneEyebrow:{fontSize:9,fontWeight:'900',color:'#1459A3'},currentMilestoneTitle:{fontSize:14,fontWeight:'900',color:'#10284B'},currentMilestoneDescription:{fontSize:10,color:'#7C8A9F',fontWeight:'700'},panel:{borderRadius:18,borderColor:'#CFDDEC',borderWidth:1,overflow:'hidden',backgroundColor:'#F7FAFF'},panelHeader:{minHeight:62,flexDirection:'row',gap:11,paddingHorizontal:13,paddingVertical:10,alignItems:'center'},panelCopy:{flex:1},panelTitle:{fontSize:13,fontWeight:'900',color:'#10294D'},panelSubtitle:{fontSize:9,color:'#8793A4',fontWeight:'600',marginTop:3},stageList:{backgroundColor:'#FFF',paddingHorizontal:6,paddingBottom:4},stageRow:{minHeight:52,flexDirection:'row',alignItems:'center',paddingRight:10,borderBottomWidth:1,borderBottomColor:'#ECF1F6',gap:8},currentRow:{backgroundColor:'#EBF5FE',borderWidth:1,borderColor:'#D5E4F5',borderRadius:9},rail:{alignItems:'center',width:20,height:48,justifyContent:'flex-start',paddingTop:15},dot:{width:18,height:18,borderRadius:10,borderWidth:1,borderColor:'#E0E6EE',backgroundColor:'#F4F6F9',alignItems:'center',justifyContent:'center'},doneDot:{backgroundColor:'#20A56B',borderColor:'#20A56B'},currentDot:{backgroundColor:'#1455B0',borderColor:'#1455B0'},innerDot:{backgroundColor:'#FFF',height:7,width:7,borderRadius:4},line:{width:1,height:19,backgroundColor:'#E3E8EE',marginTop:3},stageCopy:{flex:1,minWidth:0},stageMeta:{minWidth:75,maxWidth:115,alignItems:'flex-end',gap:3},stageDate:{fontSize:8,color:'#50627D',fontWeight:'700',textAlign:'right'},stageAmount:{fontSize:9,color:'#0A376E',fontWeight:'800',textAlign:'right'},stageName:{fontSize:11,fontWeight:'900',color:'#10284B'},stageStatus:{fontSize:9,fontWeight:'700',color:'#8D99A9',marginTop:3},doneStatus:{color:'#8D99A9'},currentStatus:{color:'#1153A2'},insurerJourneyLogo:{width:39,height:39,borderRadius:10,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",overflow:"hidden"},insurerJourneyImage:{width:33,height:33},financeCard:{backgroundColor:'#0A326E',borderRadius:16,paddingHorizontal:14,paddingVertical:13},financeHeader:{flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:'#335783',paddingBottom:10},financeArtwork:{width:34,height:34},financeTitle:{color:'#FFFFFF',fontSize:10,fontWeight:'900'},financeSub:{color:'#BFCFE7',fontSize:9,marginTop:3},financeRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#335783'},financeLabel:{fontSize:11,color:'#FFFFFF',fontWeight:'700'},financeValue:{fontSize:11,color:'#FFFFFF',fontWeight:'900'},documentsIcon:{width:43,height:43},documentBody:{padding:15,borderTopWidth:1,borderColor:'#D6E1EF'},documentNote:{fontSize:11,lineHeight:17,color:'#61748D'},nav:{height:61,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:7,borderTopLeftRadius:18,borderTopRightRadius:18},navItem:{alignItems:'center',flex:1,gap:2},navIcon:{width:35,height:33,borderRadius:12,backgroundColor:'#183461',justifyContent:'center',alignItems:'center'},navActive:{backgroundColor:'#FFF'},navText:{color:'#CEDAEE',fontSize:9,fontWeight:'700'},navTextActive:{color:'#FFF'}
});
