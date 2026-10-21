import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickAndUploadPartnerClaimDocument, type PartnerClaimUploadCategory } from '@/lib/claim-uploads';
import type { ClaimStageKey } from '@/lib/claim-tracker';

const CATEGORIES: Record<string,PartnerClaimUploadCategory[]> = {
  spot_status:['Spot Report','Accident Photo','Other'],
  claim_intimation:['Claim Form','Estimate Copy','Other'],
  work_approval:['Estimate Copy','Other'],
  repair_ri:['Accident Photo','Other'],
  billing:['Other'],
  delivery_order:['Other'],
  vehicle_delivery:['Other'],
  payment_encashment:['Other'],
};
export function PartnerClaimUploadPanel({claimId,stage}:{claimId:string;stage:ClaimStageKey}){
  const [uploading,setUploading]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);
  const options=CATEGORIES[stage]??['Other'];
  const upload=async(category:PartnerClaimUploadCategory)=>{
    if(uploading)return;
    setUploading(category);
    try{
      const id=await pickAndUploadPartnerClaimDocument(claimId,category);
      if(id)setSuccess(category+' uploaded successfully. Verification is pending.');
    }catch(e){Alert.alert('Document upload failed',e instanceof Error?e.message:'Please try again.');}
    finally{setUploading(null);}
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Supporting documents</Text>
    <Text style={styles.description}>Add evidence now or return later. Uploads remain private until authorized verification.</Text>
    <View style={styles.options}>{options.map(category=><Pressable key={category} accessibilityRole="button" accessibilityLabel={`Upload ${category}`} disabled={Boolean(uploading)} onPress={()=>void upload(category)} style={[styles.option,uploading&&styles.disabled]}><Ionicons name="cloud-upload-outline" color="#1758AD" size={18}/><Text style={styles.optionText}>{uploading===category?'Uploading…':category}</Text></Pressable>)}</View>
    {success?<Text accessibilityRole="text" style={styles.success}>{success}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
 card:{borderRadius:16,borderWidth:1,borderColor:'#D8E5F5',backgroundColor:'#FFF',padding:14,gap:10},
 title:{fontSize:15,fontWeight:'900',color:'#16345A'},description:{fontSize:11,lineHeight:17,color:'#64809B'},
 options:{flexDirection:'row',gap:8,flexWrap:'wrap'},option:{borderColor:'#C6D9EF',borderWidth:1,borderRadius:10,backgroundColor:'#F4F8FF',paddingVertical:11,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7},
 optionText:{fontSize:11,fontWeight:'800',color:'#17529C'},disabled:{opacity:.5},success:{fontSize:11,fontWeight:'600',color:'#16815A'}
});