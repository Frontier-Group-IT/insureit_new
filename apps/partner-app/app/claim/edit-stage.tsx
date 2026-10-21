import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerClaimDetail, savePartnerStageDraft } from '@/lib/claims';
import { CLAIM_STAGES } from '@/lib/claim-tracker';

const FIELDS: Record<string, readonly [string, string][]> = {
  spot_status: [['spot_survey_done_date','Spot survey completion date'],['surveyor_name','Surveyor name'],['surveyor_phone','Surveyor phone'],['surveyor_email','Surveyor email']],
  claim_intimation: [['claim_intimation_date','Claim intimation date'],['dealership_name','Dealership name'],['dealership_location','Dealership location'],['gate_in_date','Gate-in date'],['estimate_amount','Estimate amount']],
  work_approval: [['approval_received_date','Approval received date'],['cashless','Cashless (true / false)']],
  repair_ri: [['repair_complete_date','Repair completion date'],['ri_done_date','RI completion date']],
  billing: [['bill_date','Bill date'],['bill_amount','Bill amount']],
  delivery_order: [['assessment_received','Assessment received'],['do_date','Delivery order date'],['do_amount','Delivery order amount']],
  vehicle_delivery: [['vehicle_received','Vehicle received (true / false)'],['vehicle_received_date','Vehicle received date']],
  payment_encashment: [['depreciation_slip_submitted','Depreciation slip submitted'],['satisfaction_voucher_submitted','Satisfaction voucher submitted'],['payment_received_date','Payment received date'],['payment_received_amount','Payment received amount']],
};
export default function PartnerStageDraftEditor() {
  const router = useRouter();
  const { id, key } = useLocalSearchParams<{ id: string; key: string }>();
  const [fields,setFields]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const stage=CLAIM_STAGES.find(s=>s.key===key);
  const load=useCallback(async()=>{
    setLoading(true);
    try {
      if(!id || !key || !FIELDS[key]) throw new Error('Unsupported claim stage');
      const detail=await getPartnerClaimDetail(id);
      if(['Claim Complete','Settled','Closed','Rejected'].includes(detail.claim.current_status||'')) throw new Error('This claim is closed to editing');
      setAuthorized(true);setError('');
    } catch(e) {setAuthorized(false);setError(e instanceof Error?e.message:'Claim not available in your Partner scope');}
    finally {setLoading(false);}
  },[id,key]);
  useEffect(()=>{void load();},[load]);
  const save=async()=>{
    if(!id || !key || busy || !authorized) return;
    const trimmed=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.trim()]).filter(([,v])=>v));
    if(Object.keys(trimmed).length===0){Alert.alert('Nothing to save','Enter at least one claim stage detail.');return;}
    setBusy(true);
    try { await savePartnerStageDraft(id,key,trimmed); Alert.alert('Saved','Stage details saved for Operations review. This does not advance claim status.',[{text:'OK',onPress:()=>router.back()}]); }
    catch(e){Alert.alert('Unable to save',e instanceof Error?e.message:'Try again.');}
    finally{setBusy(false);}
  };
  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Pressable onPress={()=>router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.heading}>{stage?.label||'Stage'} Details</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      {loading?<Text>Verifying claim access…</Text>:error?<Text style={styles.error}>{error}</Text>:<>
        <Text style={styles.note}>Enter relevant stage details. The Operations approval workflow remains unchanged; saving here does not mark any milestone complete.</Text>
        {FIELDS[key||'']?.map(([name,label])=><View key={name} style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={fields[name]||''} onChangeText={v=>setFields(old=>({...old,[name]:v}))} style={styles.input} placeholder={label}/></View>)}
        <Pressable disabled={busy} accessibilityRole="button" onPress={()=>void save()} style={[styles.save,busy&&{opacity:.5}]}><Text style={styles.saveText}>{busy?'Saving…':'Save Stage Details'}</Text></Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#EFF6FF'},header:{backgroundColor:'#081F4C',paddingHorizontal:16,paddingVertical:19,flexDirection:'row',alignItems:'center',gap:18},back:{color:'white',fontSize:15},heading:{color:'white',fontSize:17,fontWeight:'900'},content:{padding:16,gap:14},note:{color:'#4B6487',fontSize:12,lineHeight:19},error:{color:'#B91C1C'},field:{gap:6},label:{fontSize:12,fontWeight:'800',color:'#18365D'},input:{borderWidth:1,borderColor:'#C7D8E9',borderRadius:11,padding:13,backgroundColor:'white',color:'#152D50'},save:{backgroundColor:'#0B347A',padding:16,borderRadius:13,alignItems:'center'},saveText:{color:'white',fontWeight:'900'}});
