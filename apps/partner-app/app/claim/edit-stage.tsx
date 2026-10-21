import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPartnerClaimDetail, savePartnerStageDraft, completePartnerClaimStage, uploadPartnerClaimDocument } from '@/lib/claims';
import { CLAIM_STAGES, getClaimTrackerState } from '@/lib/claim-tracker';

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
  const [uploading,setUploading]=useState(false);
  const [activeStage,setActiveStage]=useState(0);
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
      setActiveStage(getClaimTrackerState(detail).index);
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

  const normalized=()=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.trim()]).filter(([,v])=>v));
  const finish=async()=>{
    if(!id || !key || busy || !authorized)return;
    const values=normalized();
    setBusy(true);
    try {
      await completePartnerClaimStage(id,key,values);
      const index=CLAIM_STAGES.findIndex(s=>s.key===key);
      const next=CLAIM_STAGES[index+1];
      Alert.alert('Stage completed','Claim milestone saved and progressed successfully.',[{
        text:'OK',onPress:()=>router.replace(next?{pathname:'/claim/stage',params:{id,key:next.key}} as never:{pathname:'/claim/[id]',params:{id}} as never),
      }]);
    } catch(e){Alert.alert('Cannot complete stage',e instanceof Error?e.message:'Please check required fields and try again.');}
    finally{setBusy(false);}
  };
  const confirmComplete=()=>Alert.alert('Complete this claim stage?','This updates the official claim status. Confirm only when the required milestone work has actually been completed.',[
    {text:'Cancel',style:'cancel'},{text:'Complete & Continue',onPress:()=>void finish()},
  ]);
  const attachDocuments=async()=>{
    if(!id || !key || uploading || !authorized)return;
    try{
      const pick=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/jpeg','image/png','image/webp'],multiple:true,copyToCacheDirectory:true});
      if(pick.canceled||!pick.assets?.length)return;
      if(pick.assets.length>8)throw new Error('You can attach up to eight files at once.');
      setUploading(true);
      let count=0;
      for(const asset of pick.assets){await uploadPartnerClaimDocument(id,'additional_document',asset,key);count++;}
      Alert.alert('Documents uploaded',`${count} document${count===1?'':'s'} attached to this claim stage.`);
    }catch(e){Alert.alert('Upload failed',e instanceof Error?e.message:'Previously completed uploads remain attached.');}
    finally{setUploading(false);}
  };
  const stageIndex=CLAIM_STAGES.findIndex(s=>s.key===key);
  const canComplete=authorized&&stageIndex===activeStage;
  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Pressable onPress={()=>router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.heading}>{stage?.label||'Stage'} Details</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      {loading?<Text>Verifying claim access…</Text>:error?<Text style={styles.error}>{error}</Text>:<>
        <Text style={styles.note}>Enter relevant stage details. Save a draft at any permitted stage, or complete the current stage when the required work and documents are ready. Completion updates the official claim workflow.</Text>
        {FIELDS[key||'']?.map(([name,label])=><View key={name} style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={fields[name]||''} onChangeText={v=>setFields(old=>({...old,[name]:v}))} style={styles.input} placeholder={label}/></View>)}
        <Pressable accessibilityRole="button" disabled={busy||uploading} onPress={()=>void attachDocuments()} style={[styles.save,{backgroundColor:'#E8F1FC',borderWidth:1,borderColor:'#A7C6E8'},uploading&&{opacity:.5}]}><Text style={{fontWeight:'900',color:'#154A86'}}>{uploading?'Uploading…':'Attach Stage Documents'}</Text></Pressable>
        <Pressable disabled={busy} accessibilityRole="button" onPress={()=>void save()} style={[styles.save,busy&&{opacity:.5}]}><Text style={styles.saveText}>{busy?'Saving…':'Save Draft'}</Text></Pressable>
        <Pressable disabled={busy||!canComplete} accessibilityRole="button" accessibilityState={{disabled:busy||!canComplete}} onPress={confirmComplete} style={[styles.save,{backgroundColor:'#1063B5'},(busy||!canComplete)&&{opacity:.4}]}><Text style={styles.saveText}>{busy?'Saving…':'Complete & Continue'}</Text></Pressable>
        {!canComplete?<Text style={styles.note}>Stage completion is available only for the current eligible milestone. Drafts are still subject to server-side authorization.</Text>:null}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#EFF6FF'},header:{backgroundColor:'#081F4C',paddingHorizontal:16,paddingVertical:19,flexDirection:'row',alignItems:'center',gap:18},back:{color:'white',fontSize:15},heading:{color:'white',fontSize:17,fontWeight:'900'},content:{padding:16,gap:14},note:{color:'#4B6487',fontSize:12,lineHeight:19},error:{color:'#B91C1C'},field:{gap:6},label:{fontSize:12,fontWeight:'800',color:'#18365D'},input:{borderWidth:1,borderColor:'#C7D8E9',borderRadius:11,padding:13,backgroundColor:'white',color:'#152D50'},save:{backgroundColor:'#0B347A',padding:16,borderRadius:13,alignItems:'center'},saveText:{color:'white',fontWeight:'900'}});
