import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getLifeHealthCase, saveLifeHealthCaseEdit, operationsCaseUrl, type LifeHealthCaseDetail, type LifeHealthDocument, type LifeHealthActivity } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const navy='#17365D';
type CaseEditForm = {
 customerName:string;customerPhone:string;customerAddress:string;
 productName:string;proposalNumber:string;premiumPayingTerm:string;policyDuration:string;
 paymentFrequency:string;paymentMode:string;premiumAmount:string;
};
const FREQUENCIES=['Monthly','Quarterly','Half Yearly','Annually','One Time'] as const;
const PAYMENT_MODES=['Cash','Cheque','NEFT/RTGS','UPI','Credit/Debit Card','Net Banking'] as const;
function initialForm(value:LifeHealthCaseDetail):CaseEditForm {
 return {customerName:value.customer_name,customerPhone:value.customer_phone,
  customerAddress:value.customer_address,productName:value.product_name,proposalNumber:value.proposal_number,
  premiumPayingTerm:value.premium_paying_term||'',policyDuration:value.policy_duration||'',
  paymentFrequency:value.payment_frequency,paymentMode:value.payment_mode,premiumAmount:String(value.premium_amount)};
}
export default function LifeHealthCaseDetailScreen(){
 const {id}=useLocalSearchParams<{id:string}>();
 const router=useRouter();
 const {context}=usePartnerSession();
 const [record,setRecord]=useState<LifeHealthCaseDetail|null>(null);
 const [documents,setDocuments]=useState<LifeHealthDocument[]>([]);
 const [activities,setActivities]=useState<LifeHealthActivity[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [editing,setEditing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [form,setForm]=useState<CaseEditForm|null>(null);
 const setField=(key:keyof CaseEditForm,value:string)=>setForm(prev=>prev?{...prev,[key]:value}:prev);
 const beginEdit=()=>{
  if(!record||record.status_group==='rejected')return;
  setForm(initialForm(record));setSaveError('');setEditing(true);
 };
 const saveEdit=async()=>{
  if(!record||!form||saving)return;
  setSaveError('');setSaving(true);
  try{
   if(record.status_group==='issued'){
    await saveLifeHealthCaseEdit({id:record.id,customerName:form.customerName,
     customerPhone:form.customerPhone,customerAddress:form.customerAddress});
   }else{
    await saveLifeHealthCaseEdit({id:record.id,updatedAt:record.updated_at,
     productName:form.productName,proposalNumber:form.proposalNumber,
     premiumPayingTerm:form.premiumPayingTerm,policyDuration:form.policyDuration,
     paymentFrequency:form.paymentFrequency,paymentMode:form.paymentMode,
     premiumAmount:Number(form.premiumAmount.replace(/,/g,''))});
   }
   setEditing(false);setForm(null);await load();
  }catch(cause){setSaveError(cause instanceof Error?cause.message:'Unable to save changes.');}
  finally{setSaving(false);}
 };
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
       {record.status_group!=='rejected'?<Pressable accessibilityRole="button"
        accessibilityLabel={record.status_group==='issued'?'Edit issued policy customer in app':'Edit case in app'}
        onPress={beginEdit} style={styles.editButton}>
        <Ionicons name="create-outline" size={17} color={navy}/>
        <Text style={styles.editButtonText}>{record.status_group==='issued'?'Edit Proposer':'Edit Case'}</Text>
       </Pressable>:null}
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
     <Text style={styles.note}>Native editing is available for pending case proposal details and issued-case customer details. Issued policy number, dates, premium, commercial terms, document changes and issuance actions remain in the authorized Operations workflow.</Text>
   </View>:null}
   <Modal visible={editing&&!!form} transparent animationType="slide" onRequestClose={()=>{if(!saving)setEditing(false);}}>
    <View style={styles.editorBackdrop}>
     <View style={styles.editor}>
      <View style={styles.editorHeader}>
       <View style={{flex:1}}>
        <Text style={styles.editorTitle}>{record?.status_group==='issued'?'Edit Proposer':'Edit Case Details'}</Text>
        <Text style={styles.editorCaption}>{record?.case_number} · {record?.business_line}</Text>
       </View>
       <Pressable accessibilityRole="button" accessibilityLabel="Close edit" disabled={saving} onPress={()=>setEditing(false)}>
        <Ionicons name="close-circle-outline" size={26} color="#526780"/>
       </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editorContent}>
       {form?(record?.status_group==='issued'?<>
        <Text style={styles.editorSection}>Customer & insurer</Text>
        <EditInput title="Customer / proposer name" value={form.customerName} onChange={v=>setField('customerName',v)}/>
        <EditInput title="Mobile number" value={form.customerPhone} onChange={v=>setField('customerPhone',v)} keyboardType="phone-pad"/>
        <EditInput title="Customer address" value={form.customerAddress} onChange={v=>setField('customerAddress',v)} multiline/>
        <Text style={styles.editorHint}>Only customer details can be updated here for an issued policy. Policy schedule, commercial values and number remain protected.</Text>
       </>:<>
        <Text style={styles.editorSection}>Proposal & premium</Text>
        <EditInput title="Product name" value={form.productName} onChange={v=>setField('productName',v)}/>
        <EditInput title="Proposal number" value={form.proposalNumber} onChange={v=>setField('proposalNumber',v)}/>
        <EditInput title="Premium paying term" value={form.premiumPayingTerm} onChange={v=>setField('premiumPayingTerm',v)}/>
        <EditInput title="Policy duration" value={form.policyDuration} onChange={v=>setField('policyDuration',v)}/>
        <ChoiceField title="Payment frequency" value={form.paymentFrequency} values={FREQUENCIES} onChange={v=>setField('paymentFrequency',v)}/>
        <ChoiceField title="Payment mode" value={form.paymentMode} values={PAYMENT_MODES} onChange={v=>setField('paymentMode',v)}/>
        <EditInput title="Premium (₹)" value={form.premiumAmount} onChange={v=>setField('premiumAmount',v)} keyboardType="decimal-pad"/>
        <Text style={styles.editorHint}>Case source, ownership, insurer, documents and issuance remain under the existing Operations approval and verification rules.</Text>
       </>):null}
       {saveError?<Text style={styles.saveError}>{saveError}</Text>:null}
      </ScrollView>
      <View style={styles.editorActions}>
       <Pressable accessibilityRole="button" disabled={saving} onPress={()=>setEditing(false)} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancel</Text>
       </Pressable>
       <Pressable accessibilityRole="button" accessibilityLabel="Save case changes" disabled={saving} onPress={()=>void saveEdit()} style={styles.saveButton}>
        {saving?<ActivityIndicator color="#FFF" size="small"/>:<Ionicons name="checkmark" color="#FFF" size={17}/>}
        <Text style={styles.saveText}>{saving?'Saving…':'Save Changes'}</Text>
       </Pressable>
      </View>
     </View>
    </View>
   </Modal>
 </PartnerScreen>;
}
function EditInput({title,value,onChange,keyboardType,multiline}:{title:string;value:string;onChange:(v:string)=>void;keyboardType?:'phone-pad'|'decimal-pad';multiline?:boolean}){
 return <View style={styles.editField}><Text style={styles.editLabel}>{title}</Text>
  <TextInput accessibilityLabel={title} value={value} onChangeText={onChange}
   keyboardType={keyboardType} multiline={multiline} placeholder={title} placeholderTextColor="#91A0B2"
   style={[styles.editInput,multiline&&{minHeight:72,textAlignVertical:'top'}]}/></View>;
}
function ChoiceField({title,value,values,onChange}:{title:string;value:string;values:readonly string[];onChange:(v:string)=>void}){
 return <View style={styles.editField}><Text style={styles.editLabel}>{title}</Text>
 <View style={styles.choices}>{values.map(item=><Pressable key={item} accessibilityRole="button" accessibilityState={{selected:item===value}}
   onPress={()=>onChange(item)} style={[styles.choice,item===value&&styles.choiceActive]}>
    <Text style={[styles.choiceText,item===value&&styles.choiceTextActive]}>{item}</Text>
  </Pressable>)}</View></View>;
}
function Section({title,children}:{title:string;children:React.ReactNode}){
 return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}
function Item({label,value}:{label:string;value:string|null|undefined}){
 return <View style={styles.item}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value?.trim()||'—'}</Text></View>;
}
const styles=StyleSheet.create({
 editorBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(9,24,48,0.48)'},
 editor:{backgroundColor:'#F7F9FD',borderTopLeftRadius:22,borderTopRightRadius:22,maxHeight:'94%',minHeight:'55%'},
 editorHeader:{flexDirection:'row',alignItems:'center',padding:17,borderBottomWidth:1,borderBottomColor:'#DFE7F1'},
 editorTitle:{fontSize:17,fontWeight:'800',color:navy},
 editorCaption:{color:'#62738A',fontSize:11,marginTop:3},
 editorContent:{padding:15,gap:11,paddingBottom:24},
 editorSection:{fontSize:14,color:navy,fontWeight:'800',marginVertical:3},
 editorHint:{fontSize:11,lineHeight:17,color:'#677C97'},
 editField:{gap:5},
 editLabel:{fontSize:11,fontWeight:'700',color:'#435976'},
 editInput:{borderWidth:1,borderColor:'#D2DFEF',backgroundColor:'#FFF',borderRadius:10,minHeight:43,paddingHorizontal:12,paddingVertical:9,fontSize:13,color:navy},
 choices:{flexDirection:'row',flexWrap:'wrap',gap:7},
 choice:{paddingHorizontal:10,paddingVertical:9,borderWidth:1,borderColor:'#CEDAEC',borderRadius:9,backgroundColor:'#FFF'},
 choiceActive:{backgroundColor:navy,borderColor:navy},
 choiceText:{fontSize:11,color:'#4C6381',fontWeight:'700'},
 choiceTextActive:{color:'#FFF'},
 editorActions:{flexDirection:'row',gap:9,padding:15,borderTopWidth:1,borderTopColor:'#DFE7F1',backgroundColor:'#FFF'},
 cancelButton:{flex:1,minHeight:45,borderWidth:1,borderColor:'#C7D4E5',borderRadius:11,justifyContent:'center',alignItems:'center'},
 saveButton:{flex:1.5,minHeight:45,borderRadius:11,backgroundColor:navy,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},
 cancelText:{fontWeight:'800',color:navy,fontSize:12},
 saveText:{fontWeight:'800',color:'#FFF',fontSize:12},
 saveError:{color:'#A5272D',fontSize:12,fontWeight:'700'},
 editButton:{backgroundColor:'#FFF',alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,borderRadius:9,paddingHorizontal:12,paddingVertical:9,marginTop:5},
 editButtonText:{fontWeight:'800',color:navy,fontSize:12},
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
