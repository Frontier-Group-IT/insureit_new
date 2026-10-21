import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { completePartnerClaimStage, getPartnerStageDraft, savePartnerStageDraft, type PartnerClaimDetail } from '@/lib/claims';
import { CLAIM_STAGES, type ClaimStageKey } from '@/lib/claim-tracker';

const FIELDS: Partial<Record<ClaimStageKey, readonly {key: string; label: string}[]>> = {
  spot_status: [{key:'spot_survey_done_date',label:'Spot survey date'},{key:'surveyor_name',label:'Surveyor name'},{key:'surveyor_email',label:'Surveyor email'},{key:'surveyor_phone',label:'Surveyor phone'}],
  claim_intimation: [{key:'claim_intimation_date',label:'Claim intimation date'},{key:'dealership_name',label:'Workshop / dealership'},{key:'dealership_location',label:'Workshop location'},{key:'gate_in_date',label:'Gate-in date'},{key:'estimate_amount',label:'Estimate amount'}],
  work_approval: [{key:'approval_received_date',label:'Approval received date'},{key:'cashless',label:'Cashless (Yes / No)'},{key:'approval_remarks',label:'Approval remarks'}],
  repair_ri: [{key:'repair_complete_date',label:'Repair completion date'},{key:'ri_requested_date',label:'RI request date'},{key:'ri_done_date',label:'RI done date'}],
  billing: [{key:'bill_date',label:'Bill date'},{key:'bill_amount',label:'Bill amount'},{key:'bill_number',label:'Bill number'}],
  delivery_order: [{key:'assessment_received',label:'Assessment received (Yes / No)'},{key:'do_date',label:'Delivery order date'},{key:'do_amount',label:'Delivery order amount'}],
  vehicle_delivery: [{key:'vehicle_received',label:'Vehicle received (Yes / No)'},{key:'vehicle_received_date',label:'Vehicle received date'},{key:'receiver_name',label:'Receiver'}],
  payment_encashment: [{key:'depreciation_slip_submitted',label:'Depreciation slip submitted (Yes / No)'},{key:'satisfaction_voucher_submitted',label:'Satisfaction voucher submitted (Yes / No)'},{key:'payment_received_date',label:'Payment received date'},{key:'payment_received_amount',label:'Payment received amount'}],
};

/** Draft entry only: insurer verification, status transitions and financial approvals remain with Operations. */
export function PartnerClaimStageDraft({data,stage}:{data:PartnerClaimDetail;stage:ClaimStageKey}) {
  const router=useRouter();
  const fields=FIELDS[stage];
  const [values,setValues]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let mounted=true;
    setLoaded(false);
    void getPartnerStageDraft(data.claim.id,stage).then(draft=>{
      if(mounted) setValues(Object.fromEntries(Object.entries(draft).filter(([,v])=>typeof v==='string').map(([key,value])=>[key,String(value)])));
    }).catch(()=>undefined).finally(()=>{if(mounted)setLoaded(true);});
    return()=>{mounted=false;};
  },[data.claim.id,stage]);
  if (!fields?.length) return null;
  const closed=['Settled','Closed','Rejected','Claim Complete'].includes(data.claim.current_status||'');
  const save=async()=>{
    const provided=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()]).filter(([,value])=>Boolean(value)));
    if(!loaded)return;
    if(!Object.keys(provided).length){Alert.alert('No changes','Enter at least one stage detail to save.');return;}
    setSaving(true);
    try{await savePartnerStageDraft(data.claim.id,stage,provided);Alert.alert('Draft saved','Your entries were recorded for review. This did not advance the claim status.');}
    catch(error){Alert.alert('Could not save',error instanceof Error?error.message:'Please retry.');}
    finally{setSaving(false);}
  };
  const submit=async()=>{
    if(!loaded||saving)return;
    const provided=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()]).filter(([,value])=>Boolean(value)));
    setSaving(true);
    try{
      await completePartnerClaimStage(data.claim.id,stage,provided);
      const nextIndex=CLAIM_STAGES.findIndex(item=>item.key===stage)+1;
      const next=CLAIM_STAGES[nextIndex];
      Alert.alert('Stage completed','This claim stage was verified and advanced.');
      if(next)router.replace({pathname:'/claim/stage',params:{id:data.claim.id,key:next.key}} as never);
      else router.replace({pathname:'/claim/[id]',params:{id:data.claim.id}} as never);
    }catch(error){Alert.alert('Cannot complete stage',error instanceof Error?error.message:'Check required details and current claim status.');}
    finally{setSaving(false);}
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Enter stage details</Text>
    <Text style={styles.caption}>Partner entries are saved as drafts. Operations verifies each stage before approval or progression.</Text>
    {fields.map(field=><View key={field.key} style={styles.field}><Text style={styles.label}>{field.label}</Text><TextInput accessibilityLabel={field.label} value={values[field.key]||''} onChangeText={text=>setValues(current=>({...current,[field.key]:text}))} editable={!closed&&!saving} placeholder="Enter details" placeholderTextColor="#8695A8" style={styles.input}/></View>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Save stage draft" disabled={closed||saving||!loaded} onPress={()=>void save()} style={[styles.button,(closed||saving)&&styles.disabled]}><Text style={styles.buttonText}>{saving?'Saving…':closed?'Claim closed':!loaded?'Loading draft…':'Save stage draft'}</Text></Pressable>
    {stage!=="payment_encashment" ? <Pressable accessibilityRole="button" accessibilityLabel="Complete claim stage and continue" disabled={closed||saving||!loaded} onPress={()=>void submit()} style={[styles.button,(closed||saving||!loaded)&&styles.disabled]}><Text style={styles.buttonText}>Complete Stage & Continue</Text></Pressable> : <Text style={styles.caption}>Final settlement and claim closure remain subject to Operations approval.</Text>}
  </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:'#DDE8F4',padding:15,gap:12},
 title:{fontWeight:'900',fontSize:16,color:'#123054'},caption:{fontSize:11,lineHeight:16,color:'#607B9A'},
 field:{gap:6},label:{fontSize:12,fontWeight:'700',color:'#1B365B'},input:{minHeight:47,borderRadius:10,borderWidth:1,borderColor:'#BDD3EA',backgroundColor:'#F9FCFF',paddingHorizontal:12,fontSize:13,color:'#132F52'},
 button:{backgroundColor:'#0B347A',minHeight:48,borderRadius:12,alignItems:'center',justifyContent:'center'},
 buttonText:{fontWeight:'800',fontSize:13,color:'#FFF'},disabled:{opacity:0.45}
});