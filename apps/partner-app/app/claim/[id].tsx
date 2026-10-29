import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [numberModalOpen, setNumberModalOpen] = useState(false);
  const [numberDraft, setNumberDraft] = useState('');
  const [savingNumber, setSavingNumber] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setError('Claim ID is missing.'); setLoading(false); return; }
    setLoading(true);
    try { setData(await getPartnerClaimDetail(id)); setError(''); }
    catch { setError('This claim could not be loaded in your Partner scope.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const tracker = data ? getClaimTrackerState(data) : null;
  const openStage = (key: string) => router.push({ pathname: '/claim/stage', params: { id, key } } as never);
  const openClaimNumber = () => { setNumberDraft(data?.claim.insurer_claim_no ?? ''); setNumberModalOpen(true); };
  const saveClaimNumber = async () => {
    if (!data || savingNumber) return;
    if (!numberDraft.trim() || numberDraft.trim().length > 100) {
      Alert.alert('Claim number required', 'Enter a valid insurer claim number.'); return;
    }
    setSavingNumber(true);
    try {
      await savePartnerInsurerClaimNumber(data.claim.id, numberDraft);
      setData(await getPartnerClaimDetail(data.claim.id));
      setNumberModalOpen(false);
    } catch (e) { Alert.alert('Unable to save', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setSavingNumber(false); }
  };
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.8 }]}>
          <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerIcon}><Image source={PartnerAssets.actions.quickClaims} style={styles.headerIconImage} resizeMode="contain" /></View>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Claim Details</Text></View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? <PartnerStateView state="loading" title="Loading claim tracker" /> : error || !data || !tracker
          ? <PartnerStateView state="error" title="Claim unavailable" message={error || 'Please retry.'} actionLabel="Retry" onAction={() => void load()} />
          : <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.logo}><Image source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims} style={styles.logoImage} resizeMode="contain" /></View>
                <View style={styles.heroMain}><Text style={styles.stageEyebrow}>{tracker.current.label}</Text><Text numberOfLines={1} style={styles.vehicle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'}</Text><Text style={styles.heroControl}>{data.claim.claim_no || 'Control number pending'}</Text></View>
                <View style={styles.ring}><Text style={styles.ringText}>{tracker.progress}%</Text></View>
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
            {tracker.completedKeys.has('claim_intimation') ? (
              <Pressable accessibilityRole="button" onPress={openClaimNumber} style={styles.addNumber}>
                <View style={styles.addNumberIcon}><Ionicons name="create-outline" size={17} color="#1452A1"/></View>
                <Text style={styles.addNumberLabel}>{data.claim.insurer_claim_no ? 'Edit Claim Number' : 'Add Claim Number'}</Text>
                <Ionicons name="chevron-forward" size={17} color="#1452A1"/>
              </Pressable>
            ) : null}
            </View>
            <View style={styles.panel}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: journeyOpen }} onPress={() => setJourneyOpen(v => !v)} style={styles.panelHeader}><View style={styles.insurerJourneyLogo}><PartnerInsurerLogo name={data.insurer.name} style={styles.insurerJourneyImage} fallback={PartnerAssets.actions.quickClaims}/></View><View style={styles.panelCopy}><Text style={styles.panelTitle}>Claim Journey</Text><Text style={styles.panelSubtitle}>{tracker.progress}% complete • {tracker.current.label}</Text></View><Ionicons name={journeyOpen ? 'chevron-up' : 'chevron-down'} color="#526987" size={17}/></Pressable>
              {journeyOpen && <View style={styles.stageList}>{CLAIM_STAGES.map((stage, index) => {const done=tracker.completedKeys.has(stage.key), current=!done && index===tracker.index;return <Pressable key={stage.key} accessibilityRole="button" accessibilityLabel={`Open ${stage.label} details`} onPress={() => openStage(stage.key)} style={[styles.stageRow,current && styles.currentRow]}><View style={styles.rail}><View style={[styles.dot,done && styles.doneDot,current && styles.currentDot]}>{done ? <Ionicons name="checkmark" size={10} color="#FFF"/> : current ? <View style={styles.innerDot}/> : <Ionicons name="eye-outline" size={11} color="#A8B2C1"/>}</View>{index<8 && <View style={styles.line}/>}</View><View style={styles.stageCopy}><Text style={styles.stageName}>{stage.label}</Text><Text style={[styles.stageStatus,done && styles.doneStatus,current && styles.currentStatus]}>{done ? (stage.key === 'spot_intimation' ? 'Insurer informed' : stage.key === 'spot_status' ? 'Survey completed' : 'Completed') : current ? tracker.substage : 'Upcoming'}</Text></View><Ionicons name="chevron-forward" color="#607C9E" size={16}/></Pressable>})}</View>}
            </View>
            <View style={styles.panel}><Pressable accessibilityRole="button" accessibilityState={{ expanded: documentsOpen }} onPress={() => setDocumentsOpen(v => !v)} style={styles.panelHeader}><Image source={PartnerAssets.actions.claimDocumentsFolder} resizeMode="contain" style={styles.documentsIcon}/><View style={styles.panelCopy}><Text style={styles.panelTitle}>Documents</Text><Text style={styles.panelSubtitle}>Claim documents</Text></View><Ionicons name={documentsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#526987"/></Pressable>{documentsOpen && <View style={styles.documentBody}><PartnerClaimDocuments documents={data.documents} /></View>}</View>
          </>}
      </ScrollView>
      <Modal transparent animationType="fade" visible={numberModalOpen} onRequestClose={() => { if (!savingNumber) setNumberModalOpen(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.numberBackdrop}>
          <View style={styles.numberCard}>
            <View style={styles.numberShield}><Ionicons name="shield-checkmark-outline" size={29} color="#0B347A"/></View>
            <Text style={styles.numberTitle}>{data?.claim.insurer_claim_no ? 'Edit insurer claim number?' : 'Add insurer claim number?'}</Text>
            <View style={styles.numberField}>
              <Ionicons name="document-text-outline" size={19} color="#1452A1"/>
              <TextInput accessibilityLabel="Enter claim number" placeholder="Enter claim number" placeholderTextColor="#758093" value={numberDraft} onChangeText={setNumberDraft} maxLength={100} autoCapitalize="characters" autoCorrect={false} editable={!savingNumber} style={styles.numberInput}/>
            </View>
            <View style={styles.numberButtons}>
              <Pressable disabled={savingNumber} onPress={() => setNumberModalOpen(false)} style={styles.numberCancel}><Text style={styles.numberCancelText}>Not now</Text></Pressable>
              <Pressable disabled={savingNumber} onPress={() => void saveClaimNumber()} style={[styles.numberContinue, savingNumber && {opacity:0.6}]}><Text style={styles.numberContinueText}>{savingNumber ? 'Saving...' : 'Continue'}</Text><Ionicons name="arrow-forward" color="#FFF" size={19}/></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
addNumber:{minHeight:45,marginTop:12,backgroundColor:'#FFF',borderRadius:10,borderWidth:1,borderColor:'#CADAEA',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},
addNumberIcon:{width:28,height:28,backgroundColor:'#EAF2FF',borderRadius:8,alignItems:'center',justifyContent:'center'},
addNumberLabel:{flex:1,color:'#0B347A',fontSize:12,fontWeight:'800'},
numberBackdrop:{flex:1,backgroundColor:'rgba(3,15,39,0.66)',alignItems:'center',justifyContent:'center',paddingHorizontal:26},
numberCard:{backgroundColor:'#FFF',width:'100%',maxWidth:420,borderRadius:25,padding:22,alignItems:'center',gap:19},
numberShield:{width:63,height:63,borderRadius:19,backgroundColor:'#F0F6FF',borderWidth:1,borderColor:'#D9E6F8',alignItems:'center',justifyContent:'center'},
numberTitle:{color:'#0B2148',fontSize:19,fontWeight:'900',textAlign:'center'},
numberField:{borderWidth:1.5,borderColor:'#1454AA',borderRadius:13,width:'100%',minHeight:53,flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:10},
numberInput:{flex:1,fontSize:14,fontWeight:'600',color:'#0B2148',paddingVertical:10},
numberButtons:{flexDirection:'row',width:'100%',gap:10},
numberCancel:{flex:1,borderWidth:1.5,borderColor:'#1454AA',minHeight:49,borderRadius:13,alignItems:'center',justifyContent:'center'},
numberCancelText:{color:'#0B347A',fontWeight:'800',fontSize:13},
numberContinue:{flex:1.1,backgroundColor:'#1049A6',minHeight:49,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
numberContinueText:{color:'#FFF',fontWeight:'800',fontSize:13},
root:{flex:1,backgroundColor:'#EDF6FE'},  header: { height: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#081F4C' },
  backButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  headerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: 'transparent' },
  headerIconImage: { width: 22, height: 22 },
  headerCopy: { flex: 1, justifyContent: 'center' }, headerTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '800' },
scroll:{flex:1},content:{paddingHorizontal:13,paddingTop:12,paddingBottom:30,gap:12},title:{color:'#0D2857',fontSize:24,fontWeight:'900',marginBottom:5},hero:{backgroundColor:'#07347E',borderRadius:18,padding:12,shadowColor:'#142E58',shadowOpacity:.18,shadowRadius:6,elevation:4},heroTop:{flexDirection:'row',alignItems:'center',gap:8},logo:{width:43,height:43,borderRadius:9,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},logoImage:{width:36,height:36},heroMain:{flex:1},stageEyebrow:{color:'#BCD1EF',fontSize:9,fontWeight:'700'},vehicle:{color:'#FFF',fontSize:21,fontWeight:'900',marginTop:2},heroControl:{color:'#D9E7FA',fontSize:10,fontWeight:'700'},ring:{width:45,height:45,borderRadius:25,borderWidth:4,borderColor:'#527BAC',justifyContent:'center',alignItems:'center'},ringText:{color:'#FFF',fontWeight:'800',fontSize:12},heroDivider:{height:1,backgroundColor:'#6481AF',marginVertical:12},heroMiddle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroMinor:{fontSize:9,color:'#B8C9E5',fontWeight:'700'},heroDate:{color:'#FFF',fontSize:11,fontWeight:'800',marginTop:3},toggle:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#2E528C',borderRadius:10,borderWidth:1,borderColor:'#6483B0',padding:10},toggleText:{color:'#FFF',fontSize:10,fontWeight:'700'},details:{marginTop:10,backgroundColor:'#FFF',borderRadius:13,padding:11,flexDirection:'row',flexWrap:'wrap',rowGap:10},field:{width:'50%',paddingHorizontal:2},fieldLabel:{fontSize:9,color:'#7B889E',fontWeight:'600'},fieldValue:{fontSize:10.5,color:'#162C50',fontWeight:'800',marginTop:3},
panel:{borderRadius:18,borderColor:'#CFDDEC',borderWidth:1,overflow:'hidden',backgroundColor:'#F7FAFF'},panelHeader:{minHeight:62,flexDirection:'row',gap:11,paddingHorizontal:13,paddingVertical:10,alignItems:'center'},panelCopy:{flex:1},panelTitle:{fontSize:13,fontWeight:'900',color:'#10294D'},panelSubtitle:{fontSize:9,color:'#8793A4',fontWeight:'600',marginTop:3},stageList:{backgroundColor:'#FFF',paddingHorizontal:6,paddingBottom:4},stageRow:{minHeight:58,flexDirection:'row',alignItems:'center',paddingRight:10,borderBottomWidth:1,borderBottomColor:'#ECF1F6',gap:8},currentRow:{backgroundColor:'#EBF5FE',borderWidth:1,borderColor:'#D5E4F5',borderRadius:9},rail:{alignItems:'center',width:20,height:53,justifyContent:'flex-start',paddingTop:15},dot:{width:18,height:18,borderRadius:10,borderWidth:1,borderColor:'#E0E6EE',backgroundColor:'#F4F6F9',alignItems:'center',justifyContent:'center'},doneDot:{backgroundColor:'#20A56B',borderColor:'#20A56B'},currentDot:{backgroundColor:'#1455B0',borderColor:'#1455B0'},innerDot:{backgroundColor:'#FFF',height:7,width:7,borderRadius:4},line:{width:1,height:19,backgroundColor:'#E3E8EE',marginTop:3},stageCopy:{flex:1},stageName:{fontSize:11,fontWeight:'900',color:'#10284B'},stageStatus:{fontSize:9,fontWeight:'700',color:'#8D99A9',marginTop:3},doneStatus:{color:'#18865A'},currentStatus:{color:'#1153A2'},insurerJourneyLogo:{width:39,height:39,borderRadius:10,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",overflow:"hidden"},insurerJourneyImage:{width:33,height:33},documentsIcon:{width:43,height:43},documentBody:{padding:15,borderTopWidth:1,borderColor:'#D6E1EF'},documentNote:{fontSize:11,lineHeight:17,color:'#61748D'},nav:{height:61,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:7,borderTopLeftRadius:18,borderTopRightRadius:18},navItem:{alignItems:'center',flex:1,gap:2},navIcon:{width:35,height:33,borderRadius:12,backgroundColor:'#183461',justifyContent:'center',alignItems:'center'},navActive:{backgroundColor:'#FFF'},navText:{color:'#CEDAEE',fontSize:9,fontWeight:'700'},navTextActive:{color:'#FFF'}
});
