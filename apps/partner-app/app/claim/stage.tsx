import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerClaimDetail, type PartnerClaimDetail } from '@/lib/claims';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerSpotIntimation } from '@/components/partner-spot-intimation';
import { PartnerClaimReferenceStage } from '@/components/partner-claim-reference-stages';
import { PartnerWorkApproval } from '@/components/partner-work-approval';
import { PartnerVehicleDelivery } from '@/components/partner-vehicle-delivery';
import { PartnerClaimWorkshopStage } from '@/components/partner-claim-workshop-stages';
import { PartnerPaymentEncashment } from '@/components/partner-payment-encashment';
import { CLAIM_STAGES, formatClaimDate, getClaimTrackerState, getStageHistory, type ClaimStageKey } from '@/lib/claim-tracker';

export default function PartnerClaimStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const key = typeof params.key === 'string' ? params.key : '';
  const stage = CLAIM_STAGES.find(item => item.key === key);
  const [data, setData] = useState<PartnerClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id || !stage) { setLoading(false); setError('Invalid claim stage.'); return; }
    setLoading(true);
    try { setData(await getPartnerClaimDetail(id)); setError(''); }
    catch { setError('This claim is unavailable in your Partner scope.'); }
    finally { setLoading(false); }
  }, [id, stage?.key]);
  useEffect(() => { void load(); }, [load]);
  const history = data && stage ? getStageHistory(data, stage.key as ClaimStageKey) : [];
  const current = data && stage ? getClaimTrackerState(data) : null;
  const stageIndex = stage ? CLAIM_STAGES.findIndex(item => item.key === stage.key) : -1;
  const stageState = current ? stageIndex < current.completed ? 'Completed' : stageIndex === current.index ? 'Current stage' : 'Upcoming' : '';
  if (!loading && !error && data && stage?.key === 'spot_intimation') return <PartnerSpotIntimation data={data} />;
  if (!loading && !error && data && (stage?.key === 'spot_status' || stage?.key === 'claim_intimation')) return <PartnerClaimReferenceStage data={data} stage={stage.key} />;
  if (!loading && !error && data && stage?.key === 'work_approval') return <PartnerWorkApproval data={data} />;
  if (!loading && !error && data && (stage?.key === 'repair_ri' || stage?.key === 'billing' || stage?.key === 'delivery_order')) return <PartnerClaimWorkshopStage data={data} stage={stage.key} />;
  if (!loading && !error && data && stage?.key === 'vehicle_delivery') return <PartnerVehicleDelivery data={data} />;
  if (!loading && !error && data && stage?.key === 'payment_encashment') return <PartnerPaymentEncashment data={data} />;
  return <SafeAreaView style={styles.root} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" color="#FFF" size={24}/></Pressable><View><Text style={styles.headerTitle}>{stage?.label || 'Claim Stage'}</Text><Text style={styles.headerSubtitle}>Claim Tracker</Text></View></View>
    <ScrollView contentContainerStyle={styles.body}>
      {loading ? <PartnerStateView state="loading" title="Loading stage details"/> : error || !data || !stage
        ? <PartnerStateView state="error" title="Stage unavailable" message={error || 'Unable to load stage.'} actionLabel="Retry" onAction={() => void load()}/>
        : <>
          <View style={styles.status}><Text style={styles.eyebrow}>STAGE {stageIndex + 1} OF 9</Text><Text style={styles.title}>{stage.label}</Text><Text style={styles.chip}>{stageState}</Text><Text style={styles.vehicle}>{data.vehicle.vehicle_no || 'Vehicle not recorded'} • {data.claim.claim_no || 'Control number pending'}</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>Stage Details</Text><Detail label="Status" value={stageIndex === current?.index ? data.claim.current_status : stageState}/><Detail label="Insured Person" value={data.customer.name}/><Detail label="Insurer" value={data.insurer.name}/><Detail label="Policy No." value={data.policy.policy_no}/><Detail label="Insurer Claim No." value={data.claim.insurer_claim_no}/></View>
          <View style={styles.card}><Text style={styles.cardTitle}>Recorded Stage Activity</Text>{history.length ? history.map(row => <View key={row.id} style={styles.activity}><Ionicons name="checkmark-circle-outline" color="#1C64B4" size={18}/><View style={styles.activityCopy}><Text style={styles.activityTitle}>{row.label.replaceAll('_',' ')}</Text><Text style={styles.activityDate}>{formatClaimDate(row.date)}</Text></View></View>) : <Text style={styles.muted}>No matching stage updates have been recorded in the Partner claim-history service.</Text>}</View>
          <View style={styles.card}><Text style={styles.cardTitle}>Documents</Text><Text style={styles.muted}>Stage documents are not exposed by the current Partner claim-detail service. Document access requires an authorized Partner-scoped API.</Text></View>
          <Text style={styles.footer}>Read-only claim stage. No customer records or claim progression can be changed here.</Text>
        </>}
    </ScrollView>
  </SafeAreaView>;
}
function Detail({label,value}:{label:string;value:string|null|undefined}) {return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not recorded'}</Text></View>}
const styles=StyleSheet.create({
root:{flex:1,backgroundColor:'#EDF6FE'},header:{height:72,backgroundColor:'#081F4C',flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:15},back:{width:38,height:38,borderWidth:1,borderRadius:22,borderColor:'#61708D',justifyContent:'center',alignItems:'center'},headerTitle:{color:'#FFF',fontWeight:'900',fontSize:17},headerSubtitle:{color:'#BDD0EB',fontSize:10},body:{padding:14,gap:12,paddingBottom:32},status:{backgroundColor:'#07347E',borderRadius:17,padding:17},eyebrow:{color:'#AFC8EA',fontSize:10,fontWeight:'800'},title:{color:'#FFF',fontWeight:'900',fontSize:22,marginTop:3},chip:{color:'#D6E7FF',fontWeight:'800',fontSize:12,marginTop:8},vehicle:{color:'#E6EFFD',fontSize:11,marginTop:10},card:{borderRadius:15,backgroundColor:'#FFF',borderWidth:1,borderColor:'#DDE8F2',padding:15,gap:12},cardTitle:{fontSize:14,fontWeight:'900',color:'#142B50'},detail:{borderBottomWidth:1,borderColor:'#F0F3F7',paddingBottom:9},detailLabel:{fontSize:10,color:'#8595AA'},detailValue:{fontSize:12,color:'#1D3558',fontWeight:'800',marginTop:3},activity:{flexDirection:'row',gap:9,alignItems:'flex-start'},activityCopy:{flex:1},activityTitle:{fontSize:12,fontWeight:'700',color:'#162B4F'},activityDate:{fontSize:10,color:'#8391A5',marginTop:3},muted:{color:'#667C97',fontSize:12,lineHeight:19},footer:{fontSize:10,color:'#7C8EA4',textAlign:'center'}
});
