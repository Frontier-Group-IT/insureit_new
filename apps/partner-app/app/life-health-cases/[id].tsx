import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerPolicyCalendarDialog } from '@/components/policy-intakes/partner-policy-calendar-dialog';
import { getLifeHealthCase, saveLifeHealthCaseEdit, appendLifeHealthCaseRemark, listLifeHealthInsurers, issueLifeHealthPolicy, requestLifeHealthIssueApproval, verifyLifeHealthIssueApproval, operationsCaseUrl, getLifeHealthDocumentUrl, mutateLifeHealthDocument, uploadLifeHealthDocument, rejectLifeHealthCaseNative, type LifeHealthInsurer, type LifeHealthIssue, type LifeHealthCaseDetail, type LifeHealthDocument, type LifeHealthActivity } from '@/lib/life-health-cases';
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
const CASE_FIELD_PLACEHOLDERS:Record<keyof CaseEditForm,string>={
 customerName:'Enter name',
 customerPhone:'Enter mobile',
 customerAddress:'Enter address',
 sourcingDate:'DD/MM/YYYY',
 insurerId:'Select insurer',
 productName:'Enter product',
 proposalNumber:'Enter proposal no.',
 premiumPayingTerm:'Select PPT',
 policyDuration:'Select PD',
 paymentFrequency:'Select frequency',
 paymentMode:'Select mode',
 premiumAmount:'Enter amount',
};
const ISSUE_FIELD_PLACEHOLDERS:Record<'policyNumber'|'issuanceDate'|'startDate'|'endDate'|'pptEndDate'|'nextInstallmentDate'|'finalPremium'|'sumInsured',string>={
 policyNumber:'Enter policy no.',
 issuanceDate:'DD/MM/YYYY',
 startDate:'DD/MM/YYYY',
 endDate:'DD/MM/YYYY',
 pptEndDate:'DD/MM/YYYY',
 nextInstallmentDate:'DD/MM/YYYY',
 finalPremium:'Enter premium',
 sumInsured:'Enter sum assured',
};
const FREQUENCIES=['Monthly','Quarterly','Half Yearly','Annually','One Time'] as const;
const PAYMENT_MODES=['Cash','Cheque','NEFT/RTGS','UPI','Credit/Debit Card','Net Banking'] as const;
function initialForm(value:LifeHealthCaseDetail):CaseEditForm {
 return {sourcingDate:value.sourcing_date,insurerId:value.insurance_company_id,customerName:value.customer_name,customerPhone:value.customer_phone,
  customerAddress:value.customer_address,productName:value.product_name,proposalNumber:value.proposal_number,
  premiumPayingTerm:value.premium_paying_term||'',policyDuration:value.policy_duration||'',
  paymentFrequency:value.payment_frequency,paymentMode:value.payment_mode,premiumAmount:String(value.premium_amount)};
}

/** Deterministic date calculations shared by native term and start-date edits. */
const parseIssueDate=(value:string):string=>{
 const raw=value.trim(),parts=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
 const iso=parts?parts[3]+'-'+parts[2]+'-'+parts[1]:raw;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
 const d=new Date(iso+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
};
const issueSchedule=(startValue:string,form:CaseEditForm)=>{
 const start=parseIssueDate(startValue);
 const ends=(term:string)=>{
  const match=/^\s*(\d+)\s+Years?\s*$/i.exec(term);
  if(!start||!match)return '';
  const date=new Date(start+'T00:00:00Z');
  date.setUTCFullYear(date.getUTCFullYear()+Number(match[1]));
  date.setUTCDate(date.getUTCDate()-1);
  return dateLabel(date.toISOString().slice(0,10));
 };
 let nextInstallmentDate='';
 const months=({Monthly:1,Quarterly:3,'Half Yearly':6,Annually:12} as Record<string,number>)[form.paymentFrequency];
 if(start&&months&&form.premiumPayingTerm!=='Single Pay'){
  const [year,month,day]=start.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1+months,1));
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
  nextInstallmentDate=dateLabel(date.toISOString().slice(0,10));
 }
 return {
  endDate:form.productName.match(/\bpension\b/i)?'':ends(form.policyDuration),
  pptEndDate:form.premiumPayingTerm==='Single Pay'?'':ends(form.premiumPayingTerm),
  nextInstallmentDate,
 };
};

export default function LifeHealthCaseDetailScreen(){
 const {id}=useLocalSearchParams<{id:string}>();
 const router=useRouter();
 const {context}=usePartnerSession();
 const [record,setRecord]=useState<LifeHealthCaseDetail|null>(null);
 const [documents,setDocuments]=useState<LifeHealthDocument[]>([]);
 const [activities,setActivities]=useState<LifeHealthActivity[]>([]);
 const [infoTab,setInfoTab]=useState<'activity'|'remarks'>('activity');
 const [expandedCaseTab,setExpandedCaseTab]=useState<'activity'|'remarks'|null>(null);
 const [remarkOpen,setRemarkOpen]=useState(false);
 const [remarkDraft,setRemarkDraft]=useState('');
 const [remarkSaving,setRemarkSaving]=useState(false);
 const [remarkError,setRemarkError]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [insurers,setInsurers]=useState<LifeHealthInsurer[]>([]);
 const [picker,setPicker]=useState<keyof CaseEditForm|null>(null);
 const [calendarField,setCalendarField]=useState<'sourcingDate'|'issuanceDate'|'startDate'|'endDate'|'pptEndDate'|'nextInstallmentDate'|null>(null);
 const [issue,setIssue]=useState<LifeHealthIssue>({policyNumber:'',issuanceDate:'',startDate:'',endDate:'',pptEndDate:'',nextInstallmentDate:'',finalPremium:'',sumInsured:''});
 const [issuing,setIssuing]=useState(false);const [issueError,setIssueError]=useState('');
 const [approvalOpen,setApprovalOpen]=useState(false);const [approvalId,setApprovalId]=useState('');const [approvalVerified,setApprovalVerified]=useState(false);const [approverKey,setApproverKey]=useState('');const [otp,setOtp]=useState('');const [approvalLoading,setApprovalLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [saveSuccess,setSaveSuccess]=useState(false);
 const [documentBusy,setDocumentBusy]=useState(false);
 const [documentError,setDocumentError]=useState('');
 const [rejectOpen,setRejectOpen]=useState(false);
 const [rejectReason,setRejectReason]=useState('');
 const [rejectBusy,setRejectBusy]=useState(false);
 const [rejectError,setRejectError]=useState('');
 const [form,setForm]=useState<CaseEditForm|null>(null);
 const [dateOverrides,setDateOverrides]=useState({endDate:false,pptEndDate:false,nextInstallmentDate:false});
 const setField=(key:keyof CaseEditForm,value:string)=>{
  setSaveSuccess(false);
  const nextForm=form?{...form,[key]:value}:null;
  setForm(nextForm);
  if(nextForm&&['policyDuration','premiumPayingTerm','paymentFrequency','productName'].includes(key)){
   const schedule=issueSchedule(issue.startDate,nextForm);
   setIssue(current=>({
    ...current,
    endDate:dateOverrides.endDate?current.endDate:schedule.endDate,
    pptEndDate:nextForm.premiumPayingTerm==='Single Pay'?'':dateOverrides.pptEndDate?current.pptEndDate:schedule.pptEndDate,
    nextInstallmentDate:nextForm.paymentFrequency==='One Time'||nextForm.premiumPayingTerm==='Single Pay'?'':dateOverrides.nextInstallmentDate?current.nextInstallmentDate:schedule.nextInstallmentDate,
   }));
  }
 };
 const submitRemark=async()=>{
  if(!record||record.status_group!=='pending'||remarkSaving||!remarkDraft.trim())return;
  setRemarkError('');setRemarkSaving(true);
  try{
   await appendLifeHealthCaseRemark(record.id,remarkDraft);
   setRemarkOpen(false);setRemarkDraft('');setExpandedCaseTab('remarks');setInfoTab('remarks');
   await load();
  }catch(cause){setRemarkError(cause instanceof Error?cause.message:'Unable to save remark.');}
  finally{setRemarkSaving(false);}
 };
 const saveEdit=async()=>{
  if(!record||!form||saving)return;
  setSaveError('');setSaveSuccess(false);setSaving(true);
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
   await load();setSaveSuccess(true);
  }catch(cause){setSaveError(cause instanceof Error?cause.message:'Unable to save changes.');}
  finally{setSaving(false);}
 };
 const caseDirty=Boolean(record&&form&&JSON.stringify(form)!==JSON.stringify(initialForm(record)));
 const confirmCancel=()=>{
  if(saving||issuing||documentBusy||rejectBusy)return;
  const leave=()=>router.replace('/life-health-cases');
  if(caseDirty)partnerAlert('Discard changes?','Unsaved case edits will be lost.',[
   {text:'Keep Editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:leave}
  ]);else leave();
 };
 const openDocument=async(doc:LifeHealthDocument)=>{
  if(!record||documentBusy)return;
  setDocumentError('');setDocumentBusy(true);
  try{const url=await getLifeHealthDocumentUrl(record.id,doc.id);await Linking.openURL(url);}
  catch(cause){setDocumentError(cause instanceof Error?cause.message:'Could not open document.');}
  finally{setDocumentBusy(false);}
 };
 const pickDocument=async(type:string)=>{
  if(!record||documentBusy||record.status_group!=='pending')return;
  try{
   const picked=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/jpeg','image/png','image/webp'],copyToCacheDirectory:true,multiple:false});
   if(picked.canceled||!picked.assets?.[0])return;
   setDocumentError('');setDocumentBusy(true);
   await uploadLifeHealthDocument(record.id,type,picked.assets[0]);
   await load();
  }catch(cause){setDocumentError(cause instanceof Error?cause.message:'Document upload failed.');}
  finally{setDocumentBusy(false);}
 };
 const deleteDocument=(doc:LifeHealthDocument)=>{
  if(!record||record.status_group!=='pending'||documentBusy)return;
  partnerAlert('Delete document?','Permanently delete '+doc.file_name+'?',[
   {text:'Cancel',style:'cancel'},
   {text:'Delete',style:'destructive',onPress:()=>{void (async()=>{
    setDocumentError('');setDocumentBusy(true);
    try{await mutateLifeHealthDocument(record.id,doc.id,'delete_document');await load();}
    catch(cause){setDocumentError(cause instanceof Error?cause.message:'Document delete failed.');}
    finally{setDocumentBusy(false);}
   })();}}
  ]);
 };
 const submitRejection=async()=>{
  if(!record||rejectBusy||!rejectReason.trim())return;
  setRejectError('');setRejectBusy(true);
  try{await rejectLifeHealthCaseNative(record.id,rejectReason);setRejectOpen(false);setRejectReason('');await load();}
  catch(cause){setRejectError(cause instanceof Error?cause.message:'Unable to reject case.');}
  finally{setRejectBusy(false);}
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
   setExpandedCaseTab(null);
   // Guard against stale detail data after switching accounts or navigating away.
   void load();
   void listLifeHealthInsurers().then(setInsurers).catch(()=>setInsurers([]));
   return ()=>{active=false;void active;setRecord(null);};
 },[load]));
 const openOperations=async()=>{
   if(!id)return;
   try {await Linking.openURL(operationsCaseUrl(id));}
   catch {setError('Could not open Operations Portal. Sign in there and open the case from Case Register.');}
 };

 const choices=(key:keyof CaseEditForm):{value:string;label:string}[]=>key==='insurerId'
   ?insurers.map(item=>({value:item.id,label:item.name}))
   :key==='paymentFrequency'?FREQUENCIES.map(value=>({value,label:value}))
   :key==='paymentMode'?PAYMENT_MODES.map(value=>({value,label:value}))
   :key==='premiumPayingTerm'||key==='policyDuration'
     ?[...(key==='premiumPayingTerm'?['Single Pay']:[]),...Array.from({length:100},(_,i)=>(i+1)+' Year'+(i?'s':''))].map(value=>({value,label:value}))
     :[];
 const inline=(key:keyof CaseEditForm,label:string,fallback:string,required=false,wide=false,multiline=false,keyboardType?:'phone-pad'|'decimal-pad')=>{
   const darkLabel=['insurerId','productName','proposalNumber','paymentFrequency','premiumPayingTerm','policyDuration','premiumAmount','paymentMode'].includes(key);
   const editable=record?.status_group==='pending'||(record?.status_group==='issued'&&['customerName','customerPhone','customerAddress'].includes(key));
   if(!editable||!form)return <Field label={label} value={fallback} required={required} wide={wide} multiline={multiline} darkLabel={darkLabel}/>;
   const items=choices(key);
   return <View style={[styles.field,wide&&styles.fieldWide]}>
     <Text style={[styles.fieldLabel,darkLabel&&styles.darkFieldLabel]}>{label.toUpperCase()}{required?<Text style={styles.asterisk}> *</Text>:null}</Text>
     {key==='sourcingDate'?<Pressable accessibilityRole="button" accessibilityLabel={'Select '+label+' date'}
       style={[styles.fieldBox,styles.inlineSelector]} onPress={()=>setCalendarField('sourcingDate')}>
       <Text style={styles.fieldValue}>{dateLabel(form.sourcingDate)||'DD/MM/YYYY'}</Text>
       <Ionicons name="calendar-outline" size={16} color={navy}/>
     </Pressable>:items.length?<Pressable accessibilityRole="button" accessibilityLabel={'Select '+label}
       style={[styles.fieldBox,styles.inlineSelector]} onPress={()=>setPicker(key)}>
       <Text style={[styles.fieldValue,!form[key]&&styles.datePlaceholder]} numberOfLines={1} ellipsizeMode="tail">{form[key]?(key==='insurerId'?insurers.find(x=>x.id===form.insurerId)?.name||record?.insurer_name||CASE_FIELD_PLACEHOLDERS.insurerId:form[key]):CASE_FIELD_PLACEHOLDERS[key]}</Text>
       <Ionicons name="chevron-down" size={15} color={navy}/>
     </Pressable>:
     <TextInput accessibilityLabel={label} value={form[key]} onChangeText={v=>setField(key,v)}
       multiline={multiline} keyboardType={keyboardType} placeholder={CASE_FIELD_PLACEHOLDERS[key]} placeholderTextColor="#90A0B7"
       style={[styles.fieldBox,styles.inlineInput,multiline&&styles.fieldBoxMultiline]}/>}
   </View>;
 };
 const toISO=parseIssueDate;
 const issuedForm=():LifeHealthIssue=>({
   ...issue,issuanceDate:toISO(issue.issuanceDate),startDate:toISO(issue.startDate),
   endDate:issue.endDate?toISO(issue.endDate):'',pptEndDate:issue.pptEndDate?toISO(issue.pptEndDate):'',
   nextInstallmentDate:issue.nextInstallmentDate?toISO(issue.nextInstallmentDate):'',
   dateApprovalId:approvalVerified?approvalId:'',
 });
 const setIssued=(key:keyof LifeHealthIssue,value:string)=>{
  if(key==='startDate')setDateOverrides({endDate:false,pptEndDate:false,nextInstallmentDate:false});
  if(key==='endDate'||key==='pptEndDate'||key==='nextInstallmentDate')
   setDateOverrides(previous=>({...previous,[key]:true}));
  setIssue(current=>{
   const next={...current,[key]:value};
   if(key==='startDate'&&form)Object.assign(next,issueSchedule(value,form));
   return next;
  });
  if(key==='issuanceDate'||key==='policyNumber'){setApprovalId('');setApprovalVerified(false);}
 };
 const requiresApproval=()=>{
   const value=toISO(issue.issuanceDate);
   if(!value)return false;
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
   const current=(key:string)=>Number(parts.find(part=>part.type===key)?.value||'0');
   const [y,m]=value.split('-').map(Number),delta=(current('year')-y)*12+current('month')-m;
   return delta>1||(delta===1&&current('day')>15);
 };
 const submitIssue=async()=>{
   if(!record||record.status_group!=='pending'||issuing||!form)return;
   setIssueError('');
   const data=issuedForm();
   if(!data.policyNumber.trim()||!data.issuanceDate||!data.startDate||
      !data.finalPremium.trim()||!Number.isFinite(Number(data.finalPremium))){
     setIssueError('Enter a valid policy number, issuance date, start date and final premium.');return;
   }
   for(const key of ['endDate','pptEndDate','nextInstallmentDate'] as const){
     if(issue[key].trim()&&!data[key]){
       setIssueError('Enter a valid DD/MM/YYYY date for '+key+'.');return;
     }
   }
   if(JSON.stringify(form)!==JSON.stringify(initialForm(record))){
     setIssueError('Save your case edits before issuing the policy.');return;
   }
   if(requiresApproval()&&!approvalVerified){setApprovalOpen(true);return;}
   setIssuing(true);
   try{await issueLifeHealthPolicy(record.id,data);await load();}
   catch(e){setIssueError(e instanceof Error?e.message:'Issuance outcome unclear. Check Policy Register before retrying.');}
   finally{setIssuing(false);}
 };
 const requestApproval=async()=>{
   if(!record||!approverKey||approvalLoading)return;
   setApprovalLoading(true);setIssueError('');
   try{const result=await requestLifeHealthIssueApproval(record.id,issuedForm(),approverKey);setApprovalId(result.approvalId);setApprovalVerified(false);}
   catch(e){setIssueError(e instanceof Error?e.message:'Approval request failed.');}
   finally{setApprovalLoading(false);}
 };
 const verifyApproval=async()=>{
   if(!record||!approvalId||!otp||approvalLoading)return;
   setApprovalLoading(true);setIssueError('');
   try{await verifyLifeHealthIssueApproval(record.id,issuedForm(),approvalId,otp);setApprovalVerified(true);setApprovalOpen(false);}
   catch(e){setIssueError(e instanceof Error?e.message:'OTP verification failed.');}
   finally{setApprovalLoading(false);}
 };
 const issueField=(key:keyof LifeHealthIssue,label:string,required=false,date=false)=>{
   const value=issue[key]||'';
   return <View style={styles.field}>
     <Text style={[styles.fieldLabel,styles.darkFieldLabel]}>{label.toUpperCase()}{required?<Text style={styles.asterisk}> *</Text>:null}</Text>
     {date?<View style={[styles.fieldBox,styles.issueFieldRow]}>
       <Pressable accessibilityRole="button" accessibilityLabel={'Select '+label+' date'} style={styles.issueDateTap}
         onPress={()=>setCalendarField(key as 'issuanceDate'|'startDate'|'endDate'|'pptEndDate'|'nextInstallmentDate')}>
         <Text style={[styles.fieldValue,!value&&styles.datePlaceholder]}>{value||'DD/MM/YYYY'}</Text>
         <Ionicons name="calendar-outline" size={15} color="#000000"/>
       </Pressable>
       {!required&&value?<Pressable accessibilityRole="button" accessibilityLabel={'Clear '+label+' date'} hitSlop={8}
         onPress={()=>setIssued(key,'')}><Ionicons name="close-circle-outline" size={17} color="#7D8FA8"/></Pressable>:null}
     </View>:<View style={[styles.fieldBox,styles.issueFieldRow]}>
       <TextInput accessibilityLabel={label} style={styles.issueTextInput} value={value}
         placeholder={ISSUE_FIELD_PLACEHOLDERS[key as keyof typeof ISSUE_FIELD_PLACEHOLDERS]||label} placeholderTextColor="#90A0B7"
         keyboardType={key==='finalPremium'||key==='sumInsured'?'decimal-pad':'default'}
         onChangeText={v=>setIssued(key,v)}/>
     </View>}
   </View>;
 };
 const calendarValue=calendarField==='sourcingDate'?form?.sourcingDate:calendarField?issue[calendarField]:'';
 const validCalendarValue=toISO(calendarValue||'');
 const selectedCalendarDate=validCalendarValue?new Date(validCalendarValue+'T12:00:00'):new Date();
 const chooseCalendarDay=(date:Date)=>{
   const day=String(date.getDate()).padStart(2,'0');
   const month=String(date.getMonth()+1).padStart(2,'0');
   const year=String(date.getFullYear());
   if(calendarField==='sourcingDate')setField('sourcingDate',year+'-'+month+'-'+day);
   else if(calendarField)setIssued(calendarField,day+'/'+month+'/'+year);
   setCalendarField(null);
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
          {inline("sourcingDate","Proposal date",dateLabel(record.sourcing_date))}
          <Field label="Policy type" value={record.business_line}/>
          <Field label="Intermediary type" value={record.intermediary_type} meta={`RM · ${record.rm_name?.trim()||'—'}`} secondaryMeta={record.rm_code?`ID · ${record.rm_code}`:undefined}/>
          <Field label="Lead source" value={record.lead_source}
            meta={record.intermediary_code?`ID · ${record.intermediary_code}`:undefined}
            secondaryMeta={record.intermediary_mobile||undefined}/>
        </View>
      </Section>

      <Section number="02" title="Customer / proposer">
        <View style={styles.grid}>
          {inline("customerName","Client / proposer name",record.customer_name,true)}
          {inline("customerPhone","Client mobile number",record.customer_phone,true,false,false,"phone-pad")}
          {inline("customerAddress","Address",record.customer_address,false,true,true)}
        </View>
      </Section>

      <Section number="03" title="Policy product & case details">
        <View style={styles.grid}>
          {inline("insurerId","Insurance company",record.insurer_name,true,true)}
          {inline("productName","Product name",record.product_name,true,true)}
          {inline("proposalNumber","Case / proposal number",record.proposal_number,true)}
          {inline("paymentFrequency","Payment frequency",record.payment_frequency,true)}
          {inline("premiumPayingTerm","PPT · Premium Paying Term",record.premium_paying_term||"")}
          {inline("policyDuration","PD · Policy Duration / Term",record.policy_duration||"")}
        </View>
      </Section>

      <Section number="04" title="Premium & payment">
        <View style={styles.grid}>
          {inline("premiumAmount","Premium amount",amount(record.premium_amount),true,false,false,"decimal-pad")}
          {inline("paymentMode","Payment mode",record.payment_mode,true)}
        </View>
      </Section>

      {(record.status_group==='pending'||record.status_group==='rejected')?<View style={styles.remarkSection}>
        <View style={styles.remarkSectionTitle}>
          <Ionicons name="chatbubble-ellipses-outline" size={19} color="#24517E"/>
          <Text style={styles.remarkSectionText}>Remarks</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add Remark"
          accessibilityState={{disabled:record.status_group==='rejected'}}
          disabled={record.status_group==='rejected'}
          onPress={()=>{if(record.status_group!=='pending')return;setRemarkError('');setRemarkOpen(true);}}
          style={[styles.remarkHeaderAction,record.status_group==='rejected'&&styles.remarkHeaderActionDisabled]}>
          <Ionicons name={record.status_group==='rejected'?'lock-closed-outline':'add-circle-outline'}
            size={17} color={record.status_group==='rejected'?'#7C8797':'#24517E'}/>
          <Text style={[styles.remarkHeaderText,record.status_group==='rejected'&&styles.remarkHeaderTextDisabled]}>Add Remark</Text>
        </Pressable>
      </View>:null}

      {record.status_group==='pending'?<Section number="05" title="Mark Policy Issued" highlight>
        <View style={styles.grid}>
          {issueField("policyNumber","Policy number",true)}
          {issueField("issuanceDate","Issuance date",false,true)}
          {issueField("startDate","Policy start date",true,true)}
          {issueField("endDate","Policy end / maturity date",false,true)}
          {form?.premiumPayingTerm==='Single Pay'?<Field label="PPT end date" value="Not applicable · Single Pay" darkLabel/>:issueField("pptEndDate","PPT end date",false,true)}
          {form?.paymentFrequency==='One Time'||form?.premiumPayingTerm==='Single Pay'?<Field label="Next installment date" value="Not applicable · One Time" darkLabel/>:issueField("nextInstallmentDate","Next installment date",false,true)}
          {issueField("finalPremium","Final premium",true)}
          {issueField("sumInsured","Sum assured / insured")}
        </View>
        {issueError?<Text style={styles.saveError}>{issueError}</Text>:null}

      </Section>:null}
      {record.policy_no?<Section number="05" title="Issued policy">
        <View style={styles.grid}><Field label="Policy number" value={record.policy_no} wide/></View>
      </Section>:null}
      <Section number="06" title="Documents">
        <View style={styles.documentList}>
          {documents.map(doc=><View key={doc.id} style={styles.document}>
            <Pressable accessibilityRole="button" accessibilityLabel={'Open '+doc.file_name} onPress={()=>void openDocument(doc)} disabled={documentBusy} style={styles.documentOpen}>
              <Ionicons name="document-text-outline" size={17} color="#11734B"/>
              <Text style={styles.documentName} numberOfLines={2} ellipsizeMode="middle">{doc.file_name}</Text>
            </Pressable>
            {record.status_group==='pending'?<>
              <Pressable accessibilityRole="button" accessibilityLabel={'Delete '+doc.file_name} onPress={()=>deleteDocument(doc)} disabled={documentBusy} style={styles.documentIconButton}>
                <Ionicons name="trash-outline" size={17} color="#CE3541"/>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={'Replace '+doc.file_name} onPress={()=>void pickDocument(doc.document_type)} disabled={documentBusy} style={styles.documentIconButton}>
                <Ionicons name="refresh-outline" size={17} color={navy}/>
              </Pressable>
            </>:null}
          </View>)}
          {record.status_group==='pending'?<View style={styles.documentUploadGrid}>
            {([
              ['policy_copy','Policy Copy'],['proposal_form','Proposal Form'],
              ['benefit_illustration','Illustration Form'],['premium_receipt','Payment Receipt'],['other_document','Other Form']
            ] as const).filter(([type])=>!documents.some(doc=>doc.document_type===type)).map(([type,label])=>
              <Pressable key={type} accessibilityRole="button" accessibilityLabel={'Add '+label}
                onPress={()=>void pickDocument(type)} disabled={documentBusy} style={styles.uploadButton}>
                <Ionicons name="cloud-upload-outline" size={15} color="#24569A"/>
                <Text style={styles.uploadText}>Add {label}</Text>
              </Pressable>)}
          </View>:null}
          {documentBusy?<ActivityIndicator color={navy}/>:null}
          {documentError?<Text style={styles.saveError}>{documentError}</Text>:null}
          {!documents.length&&record.status_group!=='pending'?<Text style={styles.paragraph}>No documents recorded.</Text>:null}
        </View>
      </Section>

      {(record.status_group==='pending'||record.status_group==='rejected')?(
        <View style={styles.activityCard}>
          <View style={styles.tabs}>
            {(['activity','remarks'] as const).map(tab=><Pressable key={tab} accessibilityRole="button"
              accessibilityLabel={tab==='activity'?'Activity Status':'Remarks'}
              accessibilityState={{expanded:expandedCaseTab===tab}}
              onPress={()=>setExpandedCaseTab(previous=>previous===tab?null:tab)}
              style={[styles.tab,expandedCaseTab===tab&&styles.tabActive]}>
              <Text style={[styles.tabText,expandedCaseTab===tab&&styles.tabTextActive]}>
                {tab==='activity'?'Activity Status':'Remarks'}
              </Text>
            </Pressable>)}
          </View>
          {expandedCaseTab==='activity'?<View style={styles.activityHistory}>
            {activities.length?activities.map(activity=><View key={activity.id} style={styles.activity}>
              <View style={styles.activityRow}>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTitle}>{activity.action.replace(/_/g,' ')}</Text>
                  {activity.createdBy?<Text style={styles.activityDate}>By: {activity.createdBy}</Text>:null}
                </View>
                <Text style={styles.activityTimestamp}>At: {activityDate(activity.created_at)}</Text>
              </View>
              {activity.changes?.map((change,index)=><Text key={index} style={styles.activityDate}>• {change}</Text>)}
            </View>):<Text style={styles.paragraph}>No recorded case activity available.</Text>}
          </View>:expandedCaseTab==='remarks'?<View style={styles.activityHistory}>
            {record.remarks?.trim()?record.remarks.trim().split(/\n\s*\n/).filter(Boolean).map((remark,index)=>
              <View key={index} style={styles.activity}><Text style={styles.paragraph} selectable>{remark}</Text></View>
            ):<Text style={styles.paragraph}>No remarks added yet.</Text>}
          </View>:null}
        </View>
      ):(
        <View style={styles.activityCard}>
          <View style={styles.tabs}>
            <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab==='activity'}} style={[styles.tab,infoTab==='activity'&&styles.tabActive]} onPress={()=>setInfoTab('activity')}>
              <Text style={[styles.tabText,infoTab==='activity'&&styles.tabTextActive]}>Activity Status</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab==='remarks'}} style={[styles.tab,infoTab==='remarks'&&styles.tabActive]} onPress={()=>setInfoTab('remarks')}>
              <Text style={[styles.tabText,infoTab==='remarks'&&styles.tabTextActive]}>Remarks</Text>
            </Pressable>
          </View>
          {infoTab==='activity'?(activities.length?activities.map(activity=><View key={activity.id} style={styles.activity}>
            <View style={styles.activityRow}>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>{activity.action.replace(/_/g,' ')}</Text>
                {activity.createdBy?<Text style={styles.activityDate}>By: {activity.createdBy}</Text>:null}
              </View>
              <Text style={styles.activityTimestamp}>At: {activityDate(activity.created_at)}</Text>
            </View>
            {activity.changes?.map((change,index)=><Text key={index} style={styles.activityDate}>• {change}</Text>)}
          </View>):<Text style={styles.paragraph}>No recorded case activity available.</Text>):
            (record.remarks?.trim()?record.remarks.trim().split(/\n\s*\n/).filter(Boolean).map((remark,index)=>
              <View key={index} style={styles.activity}><Text style={styles.paragraph} selectable>{remark}</Text></View>
            ):<Text style={styles.paragraph}>No remarks added yet.</Text>)}
        </View>
      )}
      {saveError?<Text style={styles.saveError}>{saveError}</Text>:null}
      {saveSuccess?<Text style={styles.saveSuccess}>Case details saved successfully.</Text>:null}
      {record.status_group==='pending'?<View style={styles.caseActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Reject case" onPress={()=>{setRejectError('');setRejectOpen(true);}}
          disabled={saving||issuing||documentBusy||rejectBusy} style={[styles.caseAction,styles.actionReject]}>
          <Text style={styles.rejectActionText} numberOfLines={1}>Reject</Text>
        </Pressable>
        <View style={styles.caseActionMiddle}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel case edits" onPress={confirmCancel}
            disabled={saving||issuing||documentBusy||rejectBusy} style={[styles.caseAction,styles.actionCancel]}>
            <Text style={styles.cancelActionText} numberOfLines={1}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Save Case Details" onPress={()=>void saveEdit()}
            disabled={saving||issuing||documentBusy||rejectBusy||!caseDirty}
            style={[styles.caseAction,styles.actionSave,!caseDirty&&styles.disabledAction]}>
            {saving?<ActivityIndicator size="small" color={navy}/>:<Text style={styles.saveActionText} numberOfLines={1}>Save Case</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Create Policy" onPress={()=>void submitIssue()}
            disabled={saving||issuing||documentBusy||rejectBusy} style={[styles.caseAction,styles.actionIssue]}>
            {issuing?<ActivityIndicator size="small" color="#FFFFFF"/>:<Text style={styles.issueActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Create Policy</Text>}
          </Pressable>
        </View>
      </View>:null}

    </View>:null}
   <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={()=>{if(!rejectBusy){Keyboard.dismiss();setRejectOpen(false);}}}>
     <KeyboardAvoidingView style={styles.centeredModalKeyboardAvoid} behavior={Platform.OS==='ios'?'padding':'height'}>
       <View style={styles.centeredModalBackdrop}><View style={styles.centeredModalCard}>
         <Text style={styles.editorTitle}>Reject Life / Health Case?</Text>
         <Text style={styles.editorHint}>Case {record?.case_number||'—'} will move to Rejected. A reason is required.</Text>
         <View style={styles.centeredModalDivider}/>
         <Text style={styles.editLabel}>Reason for rejection <Text style={styles.asterisk}>*</Text></Text>
         <TextInput accessibilityLabel="Rejection reason" multiline maxLength={2000} value={rejectReason}
           onChangeText={setRejectReason} placeholder="Enter the reason for rejecting this case..."
           placeholderTextColor="#91A0B2" style={styles.centeredModalInput}/>
         {rejectError?<Text style={styles.saveError}>{rejectError}</Text>:null}
         <View style={styles.centeredModalDivider}/>
         <View style={styles.centeredModalActions}>
           <Pressable accessibilityRole="button" disabled={rejectBusy}
             onPress={()=>{Keyboard.dismiss();setRejectOpen(false);}} style={styles.cancelButton}>
             <Text style={styles.cancelText}>Cancel</Text>
           </Pressable>
           <Pressable accessibilityRole="button" disabled={rejectBusy||!rejectReason.trim()}
             onPress={()=>{Keyboard.dismiss();void submitRejection();}}
             style={[styles.saveButton,rejectReason.trim()&& !rejectBusy?styles.confirmRejectButtonActive:styles.confirmRejectButton]}>
             <Text style={styles.saveText}>{rejectBusy?'Rejecting…':'Confirm Reject'}</Text>
           </Pressable>
         </View>
       </View></View>
     </KeyboardAvoidingView>
   </Modal>
   <Modal visible={Boolean(picker)} transparent animationType="fade" onRequestClose={()=>setPicker(null)}>
     <View style={styles.editorBackdrop}><View style={styles.remarkEditor}>
       <View style={styles.editorHeader}>
         <Text style={styles.editorTitle}>Select {picker==='insurerId'?'Insurance Company':picker||'Option'}</Text>
         <Pressable accessibilityRole="button" accessibilityLabel="Close selector" onPress={()=>setPicker(null)}>
           <Ionicons name="close" size={22} color={navy}/>
         </Pressable>
       </View>
       <ScrollView style={{maxHeight:380}}>
         {picker?choices(picker).map(item=><Pressable key={item.value} accessibilityRole="button"
           onPress={()=>{setField(picker,item.value);setPicker(null);}} style={styles.modalOption}>
           <Text style={styles.fieldValue}>{item.label}</Text>
         </Pressable>):null}
       </ScrollView>
     </View></View>
   </Modal>
   <Modal visible={approvalOpen} transparent animationType="fade" onRequestClose={()=>{if(!approvalLoading)setApprovalOpen(false);}}>
     <View style={styles.editorBackdrop}><View style={styles.remarkEditor}>
       <Text style={styles.editorTitle}>Earlier-month issuance approval</Text>
       <Text style={styles.fieldLabel}>APPROVER</Text>
       <View style={styles.choices}>
         {['jatin','vishal','varun','gagan'].map(value=><Pressable key={value} accessibilityRole="button"
           onPress={()=>setApproverKey(value)} style={[styles.choice,approverKey===value&&styles.choiceActive]}>
           <Text style={[styles.choiceText,approverKey===value&&styles.choiceTextActive]}>{value.toUpperCase()}</Text>
         </Pressable>)}
       </View>
       {approvalId?<TextInput accessibilityLabel="Approval OTP" placeholder="Enter 6-digit OTP" value={otp}
         onChangeText={setOtp} keyboardType="number-pad" maxLength={6} style={styles.editInput}/>:null}
       {issueError?<Text style={styles.saveError}>{issueError}</Text>:null}
       <View style={styles.editorActions}>
         <Pressable accessibilityRole="button" disabled={approvalLoading} onPress={()=>setApprovalOpen(false)}
           style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
         <Pressable accessibilityRole="button" disabled={approvalLoading||(!approvalId&&!approverKey)}
           onPress={()=>void (approvalId?verifyApproval():requestApproval())} style={styles.saveButton}>
           <Text style={styles.saveText}>{approvalLoading?'Please wait…':approvalId?'Verify OTP':'Request OTP'}</Text>
         </Pressable>
       </View>
     </View></View>
   </Modal>
   <Modal visible={remarkOpen} transparent animationType="fade"
     onRequestClose={()=>{if(!remarkSaving){Keyboard.dismiss();setRemarkOpen(false);}}}>
     <KeyboardAvoidingView style={styles.remarkKeyboardAvoid}
       behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={0}>
       <View style={styles.centeredModalBackdrop}>
         <View style={[styles.centeredModalCard,styles.centeredRemarkCard]}>
           <View style={styles.remarkModalHeader}>
             <View style={styles.remarkSectionTitle}>
               <Ionicons name="chatbubble-ellipses-outline" size={19} color="#24517E"/>
               <Text style={styles.editorTitle}>Add Remark</Text>
             </View>
             <Pressable accessibilityRole="button" accessibilityLabel="Close remark popup"
               disabled={remarkSaving} onPress={()=>{Keyboard.dismiss();setRemarkOpen(false);}} style={styles.remarkModalClose}>
               <Ionicons name="close" size={23} color="#52627C"/>
             </Pressable>
           </View>
           <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="none"
             style={styles.centeredRemarkScroll} contentContainerStyle={styles.remarkModalContent}>
             <TextInput accessibilityLabel="New case remark" multiline value={remarkDraft} onChangeText={setRemarkDraft}
               placeholder="Write a remark" placeholderTextColor="#91A0B2" maxLength={2000}
               scrollEnabled style={styles.remarkTextArea}/>
             {remarkError?<Text style={styles.saveError}>{remarkError}</Text>:null}
           </ScrollView>
           <View style={styles.centeredModalActions}>
             <Pressable accessibilityRole="button" disabled={remarkSaving}
               onPress={()=>{Keyboard.dismiss();setRemarkOpen(false);}} style={styles.cancelButton}>
               <Text style={styles.cancelText}>Cancel</Text>
             </Pressable>
             <Pressable accessibilityRole="button" disabled={remarkSaving||!remarkDraft.trim()}
               onPress={()=>{Keyboard.dismiss();void submitRemark();}}
               style={[styles.saveButton,(remarkSaving||!remarkDraft.trim())&&{opacity:0.5}]}>
               {remarkSaving?<ActivityIndicator color="#FFFFFF" size="small"/>:<Ionicons name="checkmark" size={17} color="#FFFFFF"/>}
               <Text style={styles.saveText}>{remarkSaving?'Saving…':'Save Remark'}</Text>
             </Pressable>
           </View>
         </View>
       </View>
     </KeyboardAvoidingView>
   </Modal>
   <PartnerPolicyCalendarDialog visible={Boolean(calendarField)} value={selectedCalendarDate}
     onCancel={()=>setCalendarField(null)} onConfirm={chooseCalendarDay}/>
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
function Section({number,title,children,highlight=false}:{number?:string;title:string;children:ReactNode;highlight?:boolean}){
  return <View style={[styles.section,highlight&&styles.sectionHighlight]}>
    <View style={[styles.sectionHeader,highlight&&styles.sectionHeaderHighlight]}>
      {highlight?<View style={[styles.sectionNumber,styles.sectionNumberHighlight]}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF"/>
      </View>:number?<View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View>:null}
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {highlight?<Text style={styles.sectionSubtitle}>Update policy status to issued</Text>:null}
      </View>
      {highlight?<Ionicons name="shield-checkmark-outline" size={22} color="#4784DD"/>:null}
    </View>
    <View style={styles.sectionContent}>{children}</View>
  </View>;
}

function Field({label,value,meta,secondaryMeta,required=false,wide=false,multiline=false,darkLabel=false}:{
  label:string;value:string|null|undefined;meta?:string;secondaryMeta?:string;required?:boolean;wide?:boolean;multiline?:boolean;darkLabel?:boolean;
}){
  return <View style={[styles.field,wide&&styles.fieldWide]}>
    <Text style={[styles.fieldLabel,darkLabel&&styles.darkFieldLabel]}>{label.toUpperCase()}{required?<Text style={styles.asterisk}> *</Text>:null}</Text>
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
  modalOption:{padding:12,borderBottomWidth:1,borderBottomColor:'#E6ECF5'},
  inlineInput:{color:navy,fontSize:12,fontWeight:'600'},
  inlineSelector:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},
  remarkInlineRow:{flexDirection:'row',alignItems:'center',gap:8},
  remarkExisting:{color:navy,fontSize:11,lineHeight:17,backgroundColor:'#F5F8FD',borderRadius:9,padding:10},
  remarkHeaderSpacer:{flex:1},
  remarkSection:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,backgroundColor:'#EAF1FA',borderRadius:11,borderWidth:1,borderColor:'#D9E2F0',paddingHorizontal:11,paddingVertical:7,minHeight:48},
  remarkSectionTitle:{flexDirection:'row',alignItems:'center',gap:9,flexShrink:1},
  remarkSectionText:{fontSize:12,fontWeight:'800',color:navy},
  remarkHeaderAction:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#C9D8EA',paddingHorizontal:9,paddingVertical:7,borderRadius:8,minHeight:34},
  remarkHeaderText:{fontSize:11,fontWeight:'800',color:'#24517E'},
  remarkHeaderActionDisabled:{backgroundColor:'#E2E6EC',borderColor:'#D5DBE4'},
  remarkHeaderTextDisabled:{color:'#7C8797'},
  remarkInlineAction:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:navy,paddingHorizontal:10,paddingVertical:12,borderRadius:9},
  remarkFullWidth:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,minHeight:44,backgroundColor:navy,borderRadius:9},
  saveInline:{gap:6},
  issueFieldRow:{flexDirection:'row',alignItems:'center',gap:3},
  issueTextInput:{flex:1,minWidth:0,fontSize:11,color:navy,fontWeight:'600',padding:0},
  issueDateTap:{flex:1,minWidth:0,minHeight:25,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},
  datePlaceholder:{color:'#90A0B7'},

 remarkKeyboardAvoid:{flex:1},
 centeredModalKeyboardAvoid:{flex:1},
 centeredModalBackdrop:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:16,paddingVertical:18,backgroundColor:'rgba(9,24,48,0.48)'},
 centeredModalCard:{width:'100%',maxWidth:460,maxHeight:'94%',backgroundColor:'#FFFFFF',borderRadius:16,padding:16,gap:10},
 centeredRemarkCard:{gap:0},
 centeredRemarkScroll:{flexGrow:0},
 centeredModalDivider:{height:1,backgroundColor:'#DFE7F1',marginVertical:7},
 centeredModalInput:{borderWidth:1,borderColor:'#CBD5E1',borderRadius:11,minHeight:110,maxHeight:180,padding:12,fontSize:13,color:navy,textAlignVertical:'top'},
 centeredModalActions:{flexDirection:'row',gap:9,justifyContent:'flex-end',paddingTop:12},
 confirmRejectButton:{backgroundColor:'#D98D93'},
 confirmRejectButtonActive:{backgroundColor:'#B4232D'},
 remarkEditor:{backgroundColor:'#FFFFFF',padding:15,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'90%'},
 remarkModalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingBottom:13,borderBottomWidth:1,borderBottomColor:'#DFE7F1'},
 remarkModalClose:{minWidth:36,minHeight:36,alignItems:'center',justifyContent:'center'},
 remarkModalContent:{paddingVertical:15},
 remarkTextArea:{borderWidth:1,borderColor:'#A8BDDC',borderRadius:11,backgroundColor:'#FFFFFF',padding:12,minHeight:155,maxHeight:210,fontSize:13,color:navy,textAlignVertical:'top'},
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
  sectionHighlight:{backgroundColor:'#F7FAFF',borderColor:'#C9D9F5'},
  sectionHeader:{flexDirection:'row',alignItems:'center',gap:10,minHeight:49,paddingHorizontal:12,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#D9E2F0',backgroundColor:'#EAF1FA'},
  sectionHeaderHighlight:{backgroundColor:'#E1EDFF',borderBottomColor:'#C9DAF4'},
  sectionHeaderCopy:{flex:1,gap:2},
  sectionSubtitle:{color:'#59749F',fontSize:9},
  sectionNumberHighlight:{backgroundColor:'#5276CB'},
  sectionNumber:{width:30,height:30,borderRadius:9,backgroundColor:navy,alignItems:'center',justifyContent:'center'},
  sectionNumberText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},
  sectionTitle:{color:navy,fontSize:13,fontWeight:'800',flexShrink:1},
  sectionContent:{padding:12,gap:10},
  grid:{flexDirection:'row',flexWrap:'wrap',columnGap:9,rowGap:12,justifyContent:'space-between'},
  field:{width:'48%',minWidth:0,flexShrink:0},
  fieldWide:{width:'100%'},
  fieldLabel:{fontSize:9,color:'#66758B',fontWeight:'800',marginBottom:6,letterSpacing:0.2},
  darkFieldLabel:{color:'#000000'},
  asterisk:{color:'#B82F3B'},
  fieldBox:{borderWidth:1,borderColor:'#D8E0ED',borderRadius:10,paddingHorizontal:10,paddingVertical:10,minHeight:43,justifyContent:'center',backgroundColor:'#FBFCFE'},
  fieldBoxMultiline:{minHeight:52,justifyContent:'flex-start'},
  fieldValue:{fontSize:11,color:'#213653',fontWeight:'600',lineHeight:16,flexShrink:1},
  metaRow:{flexDirection:'row',flexWrap:'wrap',columnGap:7,rowGap:3,marginTop:6},
  metaText:{fontSize:9,fontWeight:'600',color:'#4C637F',flexShrink:1},
  documentList:{width:'100%',gap:8},
  documentOpen:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:8,minHeight:40},
  documentIconButton:{width:38,minHeight:40,justifyContent:'center',alignItems:'center',borderLeftWidth:1,borderLeftColor:'#C9E8D8'},
  documentUploadGrid:{width:'100%',flexDirection:'column',gap:8},
  uploadButton:{width:'100%',minHeight:45,borderRadius:9,borderWidth:1,borderColor:'#CEDAEC',paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#FFFFFF'},
  uploadText:{fontSize:10,color:'#24569A',fontWeight:'700'},
  activityCard:{backgroundColor:'#FFFFFF',borderRadius:14,borderWidth:1,borderColor:'#D9E2F0',padding:12,gap:10},
  activityToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:35},
  activityToggleTitle:{fontSize:13,fontWeight:'800',color:navy},
  activityHistory:{gap:8},
  saveSuccess:{fontSize:11,color:'#166B4B',fontWeight:'700'},
  caseActions:{gap:8},
  caseAction:{minHeight:47,borderRadius:10,alignItems:'center',justifyContent:'center',flexDirection:'row',paddingHorizontal:4,minWidth:0},
  caseActionMiddle:{flexDirection:'row',gap:7,width:'100%'},
  actionReject:{width:'100%',borderColor:'#F9C8CA',borderWidth:1,backgroundColor:'#FFF3F3'},
  actionCancel:{flex:1,borderColor:'#C8D5E6',borderWidth:1,backgroundColor:'#FFFFFF'},
  actionSave:{flex:1,borderColor:'#BDD4F4',borderWidth:1,backgroundColor:'#EAF2FF'},
  actionIssue:{flex:1.15,backgroundColor:'#103C74'},
  cancelActionText:{fontSize:12,fontWeight:'800',color:'#071E49',textAlign:'center'},
  rejectActionText:{fontSize:12,fontWeight:'800',color:'#C32B37',textAlign:'center'},
  saveActionText:{fontSize:12,fontWeight:'800',color:'#17365D',textAlign:'center'},
  issueActionText:{fontSize:11,fontWeight:'800',color:'#FFFFFF',textAlign:'center',flexShrink:1},
  disabledAction:{opacity:0.56},
  document:{width:'100%',flexDirection:'row',alignItems:'center',gap:1,minHeight:45,backgroundColor:'#E9FAF0',borderWidth:1,borderColor:'#A6E1C5',borderRadius:9,overflow:'hidden'},
  documentName:{flex:1,fontSize:11,fontWeight:'600',color:navy},
  tabs:{flexDirection:'row',alignItems:'center',gap:6},
  tab:{paddingHorizontal:12,paddingVertical:9,borderRadius:9,backgroundColor:'#EDF3FB'},
  tabActive:{backgroundColor:navy},
  tabText:{fontSize:11,fontWeight:'700',color:navy},
  tabTextActive:{color:'#FFFFFF'},
  activity:{borderTopWidth:1,borderTopColor:'#ECF0F6',paddingTop:10,gap:4},
  activityRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8},
  activityDetails:{flex:1,minWidth:0,gap:4},
  activityTimestamp:{color:'#64748B',fontSize:10,lineHeight:15,textAlign:'right',width:130,flexShrink:0},
  activityTitle:{fontSize:11,fontWeight:'700',color:navy},
  activityDate:{fontSize:10,color:'#64748B'},
  paragraph:{fontSize:11,lineHeight:17,color:'#30445D'},
  portalButton:{minHeight:45,backgroundColor:navy,borderRadius:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:12},
  portalButtonText:{fontSize:12,fontWeight:'800',color:'#FFFFFF',textAlign:'center',flexShrink:1},
  alert:{backgroundColor:'#FFF1F1',borderRadius:10,padding:12,gap:8,marginTop:8},
  errorText:{fontSize:11,color:'#A32636'},
  retry:{fontSize:12,fontWeight:'800',color:navy},
});
