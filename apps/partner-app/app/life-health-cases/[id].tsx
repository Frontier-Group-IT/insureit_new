import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { getLifeHealthCase, saveLifeHealthCaseEdit, appendLifeHealthCaseRemark, listLifeHealthInsurers, issueLifeHealthPolicy, requestLifeHealthIssueApproval, verifyLifeHealthIssueApproval, operationsCaseUrl, type LifeHealthInsurer, type LifeHealthIssue, type LifeHealthCaseDetail, type LifeHealthDocument, type LifeHealthActivity } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const navy='#071E49';
const dateLabel=(value:string|null|undefined)=>{
  const date=value?.trim()??'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return date;
  const [year,month,day]=date.split('-');
  return `${day}/${month}/${year}`;
};
const amount=(value:number)=>`₹${Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const activityDate=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':date.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
};


type CaseEditForm = {
 customerName:string;customerPhone:string;customerAddress:string;sourcingDate:string;insurerId:string;
 productName:string;proposalNumber:string;premiumPayingTerm:string;policyDuration:string;
 paymentFrequency:string;paymentMode:string;premiumAmount:string;
};
const FREQUENCIES=['Monthly','Quarterly','Half Yearly','Annually','One Time'] as const;
const PAYMENT_MODES=['Cash','Cheque','NEFT/RTGS','UPI','Credit/Debit Card','Net Banking'] as const;
function initialForm(value:LifeHealthCaseDetail):CaseEditForm {
 return {sourcingDate:value.sourcing_date,insurerId:value.insurance_company_id,customerName:value.customer_name,customerPhone:value.customer_phone,
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
 const [infoTab,setInfoTab]=useState<'activity'|'remarks'>('activity');
 const [remarkOpen,setRemarkOpen]=useState(false);
 const [remarkDraft,setRemarkDraft]=useState('');
 const [remarkSaving,setRemarkSaving]=useState(false);
 const [remarkError,setRemarkError]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [insurers,setInsurers]=useState<LifeHealthInsurer[]>([]);
 const [picker,setPicker]=useState<keyof CaseEditForm|null>(null);
 const [issue,setIssue]=useState<LifeHealthIssue>({policyNumber:'',issuanceDate:'',startDate:'',endDate:'',pptEndDate:'',nextInstallmentDate:'',finalPremium:'',sumInsured:''});
 const [issuing,setIssuing]=useState(false);const [issueError,setIssueError]=useState('');
 const [approvalOpen,setApprovalOpen]=useState(false);const [approvalId,setApprovalId]=useState('');const [approvalVerified,setApprovalVerified]=useState(false);const [approverKey,setApproverKey]=useState('');const [otp,setOtp]=useState('');const [approvalLoading,setApprovalLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [form,setForm]=useState<CaseEditForm|null>(null);
 const setField=(key:keyof CaseEditForm,value:string)=>setForm(prev=>prev?{...prev,[key]:value}:prev);
 const submitRemark=async()=>{
  if(!record||remarkSaving||!remarkDraft.trim())return;
  setRemarkError('');setRemarkSaving(true);
  try{
   await appendLifeHealthCaseRemark(record.id,remarkDraft);
   setRemarkOpen(false);setRemarkDraft('');setInfoTab('remarks');
   await load();
  }catch(cause){setRemarkError(cause instanceof Error?cause.message:'Unable to save remark.');}
  finally{setRemarkSaving(false);}
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
     customerName:form.customerName,customerPhone:form.customerPhone,customerAddress:form.customerAddress,
     sourcingDate:form.sourcingDate,insurerId:form.insurerId,
     productName:form.productName,proposalNumber:form.proposalNumber,
     premiumPayingTerm:form.premiumPayingTerm,policyDuration:form.policyDuration,
     paymentFrequency:form.paymentFrequency,paymentMode:form.paymentMode,
     premiumAmount:Number(form.premiumAmount.replace(/,/g,''))});
   }
   await load();
  }catch(cause){setSaveError(cause instanceof Error?cause.message:'Unable to save changes.');}
  finally{setSaving(false);}
 };
 const load=useCallback(async()=>{
   if(!id)return;
   setLoading(true);setError('');
   try{
     const result=await getLifeHealthCase(id);
     setRecord(result.case);setDocuments(result.documents);setActivities(result.activities);
     setForm(initialForm(result.case));setIssue(current=>({...current,finalPremium:current.finalPremium||String(result.case.premium_amount)}));
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
  if(!canPartnerAccessCaseRegister(context))return <PartnerScreen title="Case Register" navyTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation/>} onBack={()=>router.back()}>
    <Text style={styles.errorText}>You do not have Case Register permission.</Text>
  </PartnerScreen>;

  return <PartnerScreen title="Case Details" navyTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation/>} onBack={()=>router.back()}>
    {loading?<ActivityIndicator color={navy} style={{marginTop:24}}/>:null}
    {error?<View style={styles.alert}>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry loading case" onPress={()=>void load()}>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    </View>:null}
    {record&&!loading?<View style={styles.wrap}>
      <View style={[styles.hero,record.status_group==='issued'?styles.heroIssued:record.status_group==='rejected'?styles.heroRejected:null]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroTitle}>Life / Health Case</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{record.status_group==='issued'?'Issued':record.status_group==='rejected'?'Rejected':'Pending'}</Text>
          </View>
        </View>
        <View style={styles.heroSecond}><Text style={styles.heroSubtitle} numberOfLines={1}>{record.customer_name} · {record.proposal_number}</Text><Text style={styles.heroCaseNumber} numberOfLines={1} selectable>{record.case_number}</Text></View>

      </View>

      <Section number="01" title="Policy source & ownership">
        <View style={styles.grid}>
          <Field label="Proposal date" value={dateLabel(record.sourcing_date)}/>
          <Field label="Policy type" value={record.business_line}/>
          <Field label="Intermediary type" value={record.intermediary_type} meta={`RM · ${record.rm_name?.trim()||'—'}`} secondaryMeta={record.rm_code?`ID · ${record.rm_code}`:undefined}/>
          <Field label="Lead source" value={record.lead_source}
            meta={record.intermediary_code?`ID · ${record.intermediary_code}`:undefined}
            secondaryMeta={record.intermediary_mobile||undefined}/>
        </View>
      </Section>

      <Section number="02" title="Customer / proposer">
        <View style={styles.grid}>
          <Field label="Client / proposer name" value={record.customer_name} required/>
          <Field label="Client mobile number" value={record.customer_phone} required/>
          <Field label="Address" value={record.customer_address} wide multiline/>
        </View>
      </Section>

      <Section number="03" title="Policy product & case details">
        <View style={styles.grid}>
          <Field label="Insurance company" value={record.insurer_name} required wide multiline/>
          <Field label="Product name" value={record.product_name} required wide/>
          <Field label="Case / proposal number" value={record.proposal_number} required wide/>
          <Field label="PPT · Premium Paying Term" value={record.premium_paying_term}/>
          <Field label="PD · Policy Duration / Term" value={record.policy_duration}/>
          <Field label="Payment frequency" value={record.payment_frequency} required/>
        </View>
      </Section>

      <Section number="04" title="Premium & payment">
        <View style={styles.grid}>
          <Field label="Premium amount" value={amount(record.premium_amount)} required/>
          <Field label="Payment mode" value={record.payment_mode} required/>
        </View>
      </Section>

      {record.status_group==='pending'?<Section number="05" title="Mark Policy Issued">
        <Pressable accessibilityRole="button" accessibilityLabel="Open the case issuance form in Operations Portal"
          onPress={()=>void openOperations()} style={styles.portalButton}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF"/>
          <Text style={styles.portalButtonText}>Open Issuance Form</Text>
          <Ionicons name="open-outline" size={16} color="#FFFFFF"/>
        </Pressable>
      </Section>:null}
      {record.policy_no?<Section number="05" title="Issued policy">
        <View style={styles.grid}><Field label="Policy number" value={record.policy_no} wide/></View>
      </Section>:null}
      {documents.length>0?<Section number="06" title="Documents">
        <View style={styles.documentList}>
          {documents.map(doc=><View key={doc.id} style={styles.document}>
            <Ionicons name="document-attach-outline" size={18} color={navy}/>
            <Text style={styles.documentName} selectable>{doc.file_name}</Text>
          </View>)}
        </View>
      </Section>:null}

      <Section number="07" title="Activity status & remarks">
        <View style={styles.tabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab==='activity'}} style={[styles.tab,infoTab==='activity'&&styles.tabActive]} onPress={()=>setInfoTab('activity')}>
            <Text style={[styles.tabText,infoTab==='activity'&&styles.tabTextActive]}>Activity Status</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab==='remarks'}} style={[styles.tab,infoTab==='remarks'&&styles.tabActive]} onPress={()=>setInfoTab('remarks')}>
            <Text style={[styles.tabText,infoTab==='remarks'&&styles.tabTextActive]}>Remarks</Text>
          </Pressable>
        </View>
        {infoTab==='activity'?(activities.length?activities.map(activity=><View key={activity.id} style={styles.activity}>
          <Text style={styles.activityTitle}>{activity.action.replace(/_/g,' ')}</Text>
          <Text style={styles.activityDate}>{activityDate(activity.created_at)}</Text>
        </View>):<Text style={styles.paragraph}>No recorded case activity available.</Text>):
         <View style={{gap:10}}>
          <Text style={styles.paragraph} selectable>{record.remarks?.trim()||'No remarks added yet.'}</Text>
          {record.status_group!=='issued'?<Pressable accessibilityRole="button" accessibilityLabel="Add case remark" onPress={()=>{setRemarkError('');setRemarkOpen(true);}} style={styles.remarkButton}>
           <Ionicons name="add-circle-outline" size={17} color="#FFFFFF"/>
           <Text style={styles.remarkButtonText}>Add Remark</Text>
          </Pressable>:null}
         </View>}
      </Section>

    </View>:null}
   <Modal visible={remarkOpen} transparent animationType="fade" onRequestClose={()=>{if(!remarkSaving)setRemarkOpen(false);}}>
    <View style={styles.editorBackdrop}>
     <View style={styles.remarkEditor}>
      <Text style={styles.editorTitle}>Add Remark</Text>
      <Text style={styles.editorHint}>The remark is appended to the case history. Existing remarks cannot be overwritten.</Text>
      <TextInput accessibilityLabel="New case remark" multiline value={remarkDraft} onChangeText={setRemarkDraft}
       placeholder="Enter remark..." placeholderTextColor="#91A0B2" maxLength={2000} style={[styles.editInput,{minHeight:110,textAlignVertical:'top'}]}/>
      {remarkError?<Text style={styles.saveError}>{remarkError}</Text>:null}
      <View style={styles.editorActions}>
       <Pressable accessibilityRole="button" disabled={remarkSaving} onPress={()=>setRemarkOpen(false)} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancel</Text>
       </Pressable>
       <Pressable accessibilityRole="button" disabled={remarkSaving||!remarkDraft.trim()} onPress={()=>void submitRemark()} style={[styles.saveButton,(remarkSaving||!remarkDraft.trim())&&{opacity:0.5}]}>
        {remarkSaving?<ActivityIndicator color="#FFFFFF" size="small"/>:<Ionicons name="checkmark" size={17} color="#FFFFFF"/>}
        <Text style={styles.saveText}>{remarkSaving?'Saving…':'Save Remark'}</Text>
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
function Section({number,title,children}:{number?:string;title:string;children:ReactNode}){
  return <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {number?<View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View>:null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionContent}>{children}</View>
  </View>;
}

function Field({label,value,meta,secondaryMeta,required=false,wide=false,multiline=false}:{
  label:string;value:string|null|undefined;meta?:string;secondaryMeta?:string;required?:boolean;wide?:boolean;multiline?:boolean;
}){
  return <View style={[styles.field,wide&&styles.fieldWide]}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}{required?<Text style={styles.asterisk}> *</Text>:null}</Text>
    <View style={[styles.fieldBox,multiline&&styles.fieldBoxMultiline]}>
      <Text style={styles.fieldValue} selectable>{value?.trim()||'—'}</Text>
    </View>
    {meta||secondaryMeta?<View style={styles.metaRow}>
      {meta?<Text style={styles.metaText}>{meta}</Text>:null}
      {secondaryMeta?<Text style={styles.metaText}>{secondaryMeta}</Text>:null}
    </View>:null}
  </View>;
}

const styles=StyleSheet.create({
 remarkEditor:{backgroundColor:'#FFFFFF',padding:18,gap:12,borderTopLeftRadius:18,borderTopRightRadius:18},
 remarkButton:{alignSelf:'flex-start',flexDirection:'row',gap:7,alignItems:'center',backgroundColor:'#071E49',borderRadius:10,paddingHorizontal:14,paddingVertical:11},
 remarkButtonText:{fontWeight:'800',color:'#FFFFFF',fontSize:12},
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

  wrap:{gap:11,paddingBottom:26,marginTop:4},
  hero:{backgroundColor:'#95651F',borderRadius:12,padding:13,gap:6},
  heroIssued:{backgroundColor:'#1E694F'},
  heroRejected:{backgroundColor:'#913D3D'},
  heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  heroSecond:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  heroTitle:{color:'#FFFFFF',fontSize:15,fontWeight:'800'},
  statusPill:{borderRadius:6,backgroundColor:'rgba(255,255,255,0.16)',borderWidth:1,borderColor:'rgba(255,255,255,0.36)',paddingHorizontal:9,paddingVertical:3},
  statusText:{fontSize:10,fontWeight:'700',color:'#FFFFFF'},
  heroSubtitle:{color:'#FFFFFF',fontWeight:'600',fontSize:10,flexShrink:1},
  heroCaseNumber:{color:'#F8F0E4',fontSize:9,fontWeight:'600',flexShrink:1},
  section:{backgroundColor:'#FFFFFF',borderRadius:14,borderWidth:1,borderColor:'#D9E2F0',overflow:'hidden'},
  sectionHeader:{flexDirection:'row',alignItems:'center',gap:10,minHeight:49,paddingHorizontal:12,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#D9E2F0',backgroundColor:'#EAF1FA'},
  sectionNumber:{width:30,height:30,borderRadius:9,backgroundColor:navy,alignItems:'center',justifyContent:'center'},
  sectionNumberText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},
  sectionTitle:{color:navy,fontSize:13,fontWeight:'800',flexShrink:1},
  sectionContent:{padding:12,gap:10},
  grid:{flexDirection:'row',flexWrap:'wrap',columnGap:9,rowGap:12,justifyContent:'space-between'},
  field:{width:'48%',minWidth:0,flexShrink:0},
  fieldWide:{width:'100%'},
  fieldLabel:{fontSize:9,color:'#66758B',fontWeight:'800',marginBottom:6,letterSpacing:0.2},
  asterisk:{color:'#B82F3B'},
  fieldBox:{borderWidth:1,borderColor:'#D8E0ED',borderRadius:10,paddingHorizontal:10,paddingVertical:10,minHeight:43,justifyContent:'center',backgroundColor:'#FBFCFE'},
  fieldBoxMultiline:{minHeight:52,justifyContent:'flex-start'},
  fieldValue:{fontSize:11,color:'#213653',fontWeight:'600',lineHeight:16,flexShrink:1},
  metaRow:{flexDirection:'row',flexWrap:'wrap',columnGap:7,rowGap:3,marginTop:6},
  metaText:{fontSize:9,fontWeight:'600',color:'#4C637F',flexShrink:1},
  documentList:{gap:0},
  document:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#ECF0F6'},
  documentName:{flex:1,fontSize:11,fontWeight:'600',color:navy},
  tabs:{flexDirection:'row',alignItems:'center',gap:6},
  tab:{paddingHorizontal:12,paddingVertical:9,borderRadius:9,backgroundColor:'#EDF3FB'},
  tabActive:{backgroundColor:navy},
  tabText:{fontSize:11,fontWeight:'700',color:navy},
  tabTextActive:{color:'#FFFFFF'},
  activity:{borderTopWidth:1,borderTopColor:'#ECF0F6',paddingTop:10,gap:4},
  activityTitle:{fontSize:11,fontWeight:'700',color:navy},
  activityDate:{fontSize:10,color:'#64748B'},
  paragraph:{fontSize:11,lineHeight:17,color:'#30445D'},
  portalButton:{minHeight:45,backgroundColor:navy,borderRadius:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:12},
  portalButtonText:{fontSize:12,fontWeight:'800',color:'#FFFFFF',textAlign:'center',flexShrink:1},
  alert:{backgroundColor:'#FFF1F1',borderRadius:10,padding:12,gap:8,marginTop:8},
  errorText:{fontSize:11,color:'#A32636'},
  retry:{fontSize:12,fontWeight:'800',color:navy},
});
