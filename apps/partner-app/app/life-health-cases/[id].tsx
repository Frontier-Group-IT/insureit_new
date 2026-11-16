import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getLifeHealthCase, operationsCaseUrl, type LifeHealthCaseDetail, type LifeHealthDocument, type LifeHealthActivity } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const navy='#17365D';
export default function LifeHealthCaseDetailScreen(){
 const {id}=useLocalSearchParams<{id:string}>();
 const router=useRouter();
 const {context}=usePartnerSession();
 const [record,setRecord]=useState<LifeHealthCaseDetail|null>(null);
 const [documents,setDocuments]=useState<LifeHealthDocument[]>([]);
 const [activities,setActivities]=useState<LifeHealthActivity[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
   if(!id)return;
   setLoading(true);setError('');
   try{
     const result=await getLifeHealthCase(id);
     setRecord(result.case);setDocuments(result.documents);setActivities(result.activities);
   }catch(cause){setError(cause instanceof Error?cause.message:'Unable to load case.');}
   finally{setLoading(false);}
 },[id]);
 useFocusEffect(useCallback(()=>{
   let active=true;
   // Guard against stale detail data after switching accounts or navigating away.
   void load();
   return ()=>{active=false;void active;setRecord(null);};
 },[load]));
 const openOperations=async()=>{
   if(!id)return;
   try {await Linking.openURL(operationsCaseUrl(id));}
   catch {setError('Could not open Operations Portal. Sign in there and open the case from Case Register.');}
 };
 if(!canPartnerAccessCaseRegister(context))return <PartnerScreen title="Case Register" onBack={()=>router.back()}>
   <Text style={styles.note}>You do not have Case Register permission.</Text>
 </PartnerScreen>;
 return <PartnerScreen title="Case Details" onBack={()=>router.back()}>
   {loading?<ActivityIndicator color={navy} style={{marginTop:24}}/>:null}
   {error?<View style={styles.alert}><Text style={styles.alertText}>{error}</Text>
     <Pressable onPress={()=>void load()}><Text style={styles.actionText}>Retry</Text></Pressable></View>:null}
   {record&&!loading?<View style={styles.wrap}>
     <View style={styles.hero}>
       <Text style={styles.caseNo}>{record.case_number}</Text>
       <Text style={styles.heroText}>{record.business_line} · {record.status_group.toUpperCase()}</Text>
       <Text style={styles.heroText}>{record.customer_name}</Text>
     </View>
     <Section title="Policy source & ownership">
       <Item label="Lead source" value={record.lead_source}/>
       <Item label="Source code" value={record.intermediary_code}/>
       <Item label="Relationship Manager" value={record.rm_name}/>
       <Item label="RM code" value={record.rm_code}/>
       <Item label="Sourcing date" value={record.sourcing_date}/>
     </Section>
     <Section title="Customer & insurer">
       <Item label="Customer" value={record.customer_name}/>
       <Item label="Mobile" value={record.customer_phone}/>
       <Item label="Address" value={record.customer_address}/>
       <Item label="Insurer" value={record.insurer_name}/>
     </Section>
     <Section title="Proposal & premium">
       <Item label="Product" value={record.product_name}/>
       <Item label="Proposal number" value={record.proposal_number}/>
       <Item label="Premium paying term" value={record.premium_paying_term}/>
       <Item label="Policy duration" value={record.policy_duration}/>
       <Item label="Payment frequency" value={record.payment_frequency}/>
       <Item label="Payment mode" value={record.payment_mode}/>
       <Item label="Premium" value={`₹${Number(record.premium_amount).toLocaleString('en-IN',{maximumFractionDigits:2})}`}/>
       {record.policy_no?<Item label="Issued policy" value={record.policy_no}/>:null}
     </Section>
     {record.rejection_reason?<Section title="Rejection reason"><Text style={styles.paragraph}>{record.rejection_reason}</Text></Section>:null}
     <Section title={`Documents (${documents.length})`}>
       {documents.length?documents.map(doc=><View key={doc.id} style={styles.document}>
         <Ionicons name="document-attach-outline" size={18} color={navy}/>
         <View style={{flex:1}}><Text style={styles.value}>{doc.file_name}</Text><Text style={styles.small}>{doc.document_type.replace(/_/g,' ')}</Text></View>
       </View>):<Text style={styles.note}>No documents recorded.</Text>}
       <Text style={styles.small}>Document viewing, uploads and deletion use the secure Operations Portal workflow.</Text>
     </Section>
     <Section title="Remarks"><Text style={styles.paragraph}>{record.remarks?.trim()||'No remarks recorded.'}</Text></Section>
     <Section title="Activity history">
       {activities.length?activities.map(activity=><View key={activity.id} style={styles.activity}>
         <Text style={styles.value}>{activity.action.replace(/_/g,' ')}</Text>
         <Text style={styles.small}>{new Date(activity.created_at).toLocaleString('en-IN')}</Text>
       </View>):<Text style={styles.note}>No additional changes recorded.</Text>}
     </Section>
     <Pressable accessibilityRole="button" onPress={()=>void openOperations()} style={styles.open}>
       <Ionicons name="open-outline" size={19} color="#FFF"/>
       <Text style={styles.openText}>Open in Operations Portal</Text>
       <Ionicons name="chevron-forward" size={19} color="#FFF"/>
     </Pressable>
     <Text style={styles.note}>For case editing, adding remarks, managing documents, rejecting or issuing a policy, use the existing Operations Portal. Its original permission checks and validation remain in force. You may need to sign in to the portal.</Text>
   </View>:null}
 </PartnerScreen>;
}
function Section({title,children}:{title:string;children:React.ReactNode}){
 return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}
function Item({label,value}:{label:string;value:string|null|undefined}){
 return <View style={styles.item}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value?.trim()||'—'}</Text></View>;
}
const styles=StyleSheet.create({
 wrap:{gap:11,paddingBottom:28,marginTop:5},
 hero:{backgroundColor:navy,borderRadius:14,padding:15,gap:6},
 caseNo:{fontSize:16,color:'#FFF',fontWeight:'800'},
 heroText:{color:'#E5EFFD',fontSize:12,fontWeight:'600'},
 section:{backgroundColor:'#FFF',borderRadius:13,borderWidth:1,borderColor:'#DFE7F1',padding:13,gap:9},
 sectionTitle:{color:navy,fontSize:13,fontWeight:'800',paddingBottom:4,borderBottomWidth:1,borderBottomColor:'#E7EDF6'},
 item:{flexDirection:'row',justifyContent:'space-between',gap:12},
 label:{flex:1,fontSize:11,color:'#687A93'},
 value:{flex:1.5,fontSize:11,color:'#233852',fontWeight:'700',textAlign:'right'},
 document:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:6,borderBottomWidth:1,borderBottomColor:'#F0F3F8'},
 paragraph:{fontSize:11,lineHeight:18,color:'#34465E'},
 note:{fontSize:11,lineHeight:17,color:'#697A92'},
 small:{fontSize:10,color:'#71829A',marginTop:3},
 activity:{paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#F0F3F8'},
 open:{minHeight:48,borderRadius:12,backgroundColor:navy,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9,paddingHorizontal:12},
 openText:{color:'#FFF',fontSize:12,fontWeight:'800',flex:1,textAlign:'center'},
 alert:{backgroundColor:'#FFF0F0',padding:12,borderRadius:10,marginTop:8},
 alertText:{fontSize:11,color:'#B52E37'},
 actionText:{fontSize:12,fontWeight:'800',color:navy,marginTop:8},
});
