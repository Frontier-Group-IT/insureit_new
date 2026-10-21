import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { savePartnerStageDraft, type PartnerClaimDetail } from '@/lib/claims';
import type { ClaimStageKey } from '@/lib/claim-tracker';

const FIELDS: Partial<Record<ClaimStageKey, readonly {key: string; label: string}[]>> = {
  spot_status: [{key:'spot_survey_done_date',label:'Spot survey date'},{key:'surveyor_name',label:'Surveyor name'},{key:'surveyor_phone',label:'Surveyor phone'}],
  claim_intimation: [{key:'claim_intimation_date',label:'Claim intimation date'},{key:'dealership_name',label:'Workshop / dealership'},{key:'dealership_location',label:'Workshop location'},{key:'gate_in_date',label:'Gate-in date'},{key:'estimate_amount',label:'Estimate amount'}],
  work_approval: [{key:'approval_received_date',label:'Approval received date'},{key:'cashless',label:'Cashless (Yes / No)'},{key:'approval_remarks',label:'Approval remarks'}],
  repair_ri: [{key:'repair_complete_date',label:'Repair completion date'},{key:'ri_requested_date',label:'RI request date'},{key:'ri_done_date',label:'RI done date'}],
  billing: [{key:'bill_date',label:'Bill date'},{key:'bill_amount',label:'Bill amount'},{key:'bill_number',label:'Bill number'}],
  delivery_order: [{key:'assessment_received',label:'Assessment received (Yes / No)'},{key:'do_date',label:'Delivery order date'},{key:'do_amount',label:'Delivery order amount'}],
  vehicle_delivery: [{key:'vehicle_received',label:'Vehicle received (Yes / No)'},{key:'delivery_date',label:'Delivery date'},{key:'receiver_name',label:'Receiver'}],
  payment_encashment: [{key:'depreciation_slip_submitted',label:'Depreciation slip submitted (Yes / No)'},{key:'satisfaction_voucher_submitted',label:'Satisfaction voucher submitted (Yes / No)'},{key:'payment_received_date',label:'Payment received date'},{key:'payment_received_amount',label:'Payment received amount'}],
};

/** Draft entry only: insurer verification, status transitions and financial approvals remain with Operations. */
export function PartnerClaimStageDraft({data,stage}:{data:PartnerClaimDetail;stage:ClaimStageKey}) {
  const fields=FIELDS[stage];
  const [values,setValues]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  if (!fields?.length) return null;
  const closed=['Settled','Closed','Rejected','Claim Complete'].includes(data.claim.current_status||'');
  const save=async()=>{
    const provided=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()]).filter(([,value])=>Boolean(value)));
    if(!Object.keys(provided).length){Alert.alert('No changes','Enter at least one stage detail to save.');return;}
    setSaving(true);
    try{await savePartnerStageDraft(data.claim.id,stage,provided);Alert.alert('Draft saved','Your entries were recorded for review. This did not advance the claim status.');}
    catch(error){Alert.alert('Could not save',error instanceof Error?error.message:'Please retry.');}
    finally{setSaving(false);}
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Enter stage details</Text>
    <Text style={styles.caption}>Partner entries are saved as drafts. Operations verifies each stage before approval or progression.</Text>
    {fields.map(field=><View key={field.key} style={styles.field}><Text style={styles.label}>{field.label}</Text><TextInput accessibilityLabel={field.label} value={values[field.key]||''} onChangeText={text=>setValues(current=>({...current,[field.key]:text}))} editable={!closed&&!saving} placeholder="Enter details" placeholderTextColor="#8695A8" style={styles.input}/></View>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Save stage draft" disabled={closed||saving} onPress={()=>void save()} style={[styles.button,(closed||saving)&&styles.disabled]}><Text style={styles.buttonText}>{saving?'Saving…':closed?'Claim closed':'Save stage draft'}</Text></Pressable>
  </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:'#DDE8F4',padding:15,gap:12},
 title:{fontWeight:'900',fontSize:16,color:'#123054'},caption:{fontSize:11,lineHeight:16,color:'#607B9A'},
 field:{gap:6},label:{fontSize:12,fontWeight:'700',color:'#1B365B'},input:{minHeight:47,borderRadius:10,borderWidth:1,borderColor:'#BDD3EA',backgroundColor:'#F9FCFF',paddingHorizontal:12,fontSize:13,color:'#132F52'},
 button:{backgroundColor:'#0B347A',minHeight:48,borderRadius:12,alignItems:'center',justifyContent:'center'},
 buttonText:{fontWeight:'800',fontSize:13,color:'#FFF'},disabled:{opacity:0.45}
});