import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { getLifeHealthCase, saveLifeHealthCaseEdit, appendNativeLifeHealthRemark, lifeHealthIssuanceAction, operationsCaseUrl, type LifeHealthIssueForm, type LifeHealthCaseDetail, type LifeHealthDocument, type LifeHealthActivity } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister, canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const navy='#17365D';
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
 sourcingDate:string;insurerId:string;
 customerName:string;customerPhone:string;customerAddress:string;
 productName:string;proposalNumber:string;premiumPayingTerm:string;policyDuration:string;
 paymentFrequency:string;paymentMode:string;premiumAmount:string;
};
const FREQUENCIES=['Monthly','Quarterly','Half Yearly','Annually','One Time'] as const;
const PAYMENT_MODES=['Cash','Cheque','NEFT/RTGS','UPI','Credit/Debit Card','Net Banking'] as const;
const TERM_OPTIONS=['','Single Pay',...Array.from({length:100},(_,i)=>`${i+1} Year${i?'s':''}`)];
const toIsoDate=(v:string)=>{const x=v.trim();const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(x);return m?`${m[3]}-${m[2]}-${m[1]}`:x;};

const validIso=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
function addYears(start:string,term:string){
  if(!validIso(start))return '';
  const match=term.trim().match(/^(\d+)\s+year/i);
  if(!match)return '';
  const years=Number(match[1]);
  const date=new Date(start+'T00:00:00Z');
  date.setUTCFullYear(date.getUTCFullYear()+years);
  date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}
function addMonthsClamped(start:string,months:number){
  if(!validIso(start))return '';
  const [y,m,d]=start.split('-').map(Number);
  const index=m-1+months,year=y+Math.floor(index/12);
  const month=((index%12)+12)%12;
  const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return new Date(Date.UTC(year,month,Math.min(d,last))).toISOString().slice(0,10);
}
function nextInstallment(start:string,frequency:string){
  const intervals:Record<string,number>={Monthly:1,Quarterly:3,'Half Yearly':6,Annually:12};
  return intervals[frequency]?addMonthsClamped(start,intervals[frequency]):'';
}
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
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [remarkOpen,setRemarkOpen]=useState(false);
 const [remarkDraft,setRemarkDraft]=useState('');
 const [remarkBusy,setRemarkBusy]=useState(false);
 const [remarkError,setRemarkError]=useState('');
 const [insurers,setInsurers]=useState<{id:string;name:string}[]>([]);
 const [choice,setChoice]=useState<{key:string;values:{id:string;name:string}[]}|null>(null);
 const [issue,setIssue]=useState<LifeHealthIssueForm>({caseId:'',policyNumber:'',issuanceDate:'',startDate:'',endDate:'',pptEndDate:'',nextInstallmentDate:'',finalPremium:'',sumInsured:'',approvalId:''});
 const [approvalOpen,setApprovalOpen]=useState(false);
 const [approvers,setApprovers]=useState<{key:string;name:string}[]>([]);
 const [approverKey,setApproverKey]=useState('');
 const [approvalId,setApprovalId]=useState('');
 const [otp,setOtp]=useState('');
 const [dateOverrides,setDateOverrides]=useState({endDate:false,pptEndDate:false,nextInstallmentDate:false});
 const [issuing,setIssuing]=useState(false);
 const [issueError,setIssueError]=useState('');
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState('');
 const [form,setForm]=useState<CaseEditForm|null>(null);
 const setField=(key:keyof CaseEditForm,value:string)=>setForm(prev=>prev?{...prev,[key]:value}:prev);
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
     setForm(initialForm(result.case));setInsurers(result.insurers??[]);
     setIssue({caseId:result.case.id,policyNumber:'',issuanceDate:'',startDate:'',endDate:'',pptEndDate:'',nextInstallmentDate:'',finalPremium:String(result.case.premium_amount||''),sumInsured:'',approvalId:''});
   }catch(cause){setError(cause instanceof Error?cause.message:'Unable to load case.');}
   finally{setLoading(false);}
 },[id]);
 useFocusEffect(useCallback(()=>{
   let active=true;
   // Guard against stale detail data after switching accounts or navigating away.
   void load();
   return ()=>{active=false;void active;setRecord(null);};
 },[load]));
 const setIssueField=(key:keyof LifeHealthIssueForm,value:string)=>{
   setIssue(prev=>({...prev,[key]:value,...(key==='issuanceDate'||key==='policyNumber'?{approvalId:''}:{})}));
   if(key==='issuanceDate'||key==='policyNumber'){setApprovalId('');setIssueError('');}
   if(key==='startDate')setDateOverrides({endDate:false,pptEndDate:false,nextInstallmentDate:false});
   if(key==='endDate'||key==='pptEndDate'||key==='nextInstallmentDate')
     setDateOverrides(prev=>({...prev,[key]:true}));
 };
 useEffect(()=>{
   if(!validIso(issue.startDate)||!form)return;
   const endDate=form.productName.toLowerCase().includes('pension')?'':addYears(issue.startDate,form.policyDuration);
   const pptEndDate=form.premiumPayingTerm.toLowerCase().includes('single')?'':addYears(issue.startDate,form.premiumPayingTerm);
   const nextDate=nextInstallment(issue.startDate,form.paymentFrequency);
   setIssue(prev=>{
     const calculated={
       endDate:dateOverrides.endDate?prev.endDate:endDate,
       pptEndDate:dateOverrides.pptEndDate?prev.pptEndDate:pptEndDate,
       nextInstallmentDate:dateOverrides.nextInstallmentDate?prev.nextInstallmentDate:nextDate,
     };
     if(Object.entries(calculated).every(([key,v])=>prev[key as keyof typeof calculated]===v))return prev;
     return {...prev,...calculated};
   });
 },[issue.startDate,form?.productName,form?.policyDuration,form?.premiumPayingTerm,
    form?.paymentFrequency,dateOverrides.endDate,dateOverrides.pptEndDate,dateOverrides.nextInstallmentDate]);
 const addRemark=async()=>{
   if(!record||!remarkDraft.trim()||remarkBusy)return;
   setRemarkBusy(true);setRemarkError('');
   try{
     await appendNativeLifeHealthRemark(record.id,remarkDraft.trim());
     setRemarkDraft('');setRemarkOpen(false);await load();
   }catch(e){setRemarkError(e instanceof Error?e.message:'Could not save remark.');}
   finally{setRemarkBusy(false);}
 };
 const requestIssue=async()=>{
   if(!record||!issue.policyNumber.trim()||!issue.issuanceDate||!issue.startDate||!issue.finalPremium)return setIssueError('Complete policy number, issuance date, start date and final premium.');
   setIssueError('');setIssuing(true);
   try{
     const result=await lifeHealthIssuanceAction('approvers',{caseId:record.id,policyNumber:issue.policyNumber,issuanceDate:issue.issuanceDate});
     if(result.approvalRequired&&!issue.approvalId){
       setApprovers(result.approvers??[]);setApprovalOpen(true);return;
     }
     await createIssuedPolicy();
   }catch(e){setIssueError(e instanceof Error?e.message:'Unable to verify policy issuance.');}
   finally{setIssuing(false);}
 };
 const createIssuedPolicy=async()=>{
   if(!record)return;
   setIssuing(true);setIssueError('');
   try{
     // Save pending case edits before conversion, using the same verified Case Register API.
     if(form){
       await saveLifeHealthCaseEdit({id:record.id,updatedAt:record.updated_at,
         sourcingDate:form.sourcingDate,insurerId:form.insurerId,
         customerName:form.customerName,customerPhone:form.customerPhone,customerAddress:form.customerAddress,
         productName:form.productName,proposalNumber:form.proposalNumber,
         premiumPayingTerm:form.premiumPayingTerm,policyDuration:form.policyDuration,
         paymentFrequency:form.paymentFrequency,paymentMode:form.paymentMode,
         premiumAmount:Number(form.premiumAmount)});
     }
     const result=await lifeHealthIssuanceAction('issue',{...issue,caseId:record.id,approvalId:issue.approvalId});
     setApprovalOpen(false);
     await load();
     setIssueError(result.policyCode?'Policy created: '+result.policyCode:'Policy created.');
   }catch(e){setIssueError(e instanceof Error?e.message:'Issuance outcome uncertain. Check Policy Register before retrying.');}
   finally{setIssuing(false);}
 };
 const sendApproval=async()=>{
   if(!record||!approverKey||issuing)return;
   setIssuing(true);setIssueError('');
   try{
     const result=await lifeHealthIssuanceAction('request_approval',{
       caseId:record.id,policyNumber:issue.policyNumber,issuanceDate:issue.issuanceDate,approverKey,
     });
     setApprovalId(result.approvalId??'');setOtp('');
   }catch(e){setIssueError(e instanceof Error?e.message:'Approval request failed.');}
   finally{setIssuing(false);}
 };
 const verifyApproval=async()=>{
   if(!record||!approvalId||otp.length!==6||issuing)return;
   setIssuing(true);setIssueError('');
   try{
     await lifeHealthIssuanceAction('verify_approval',{
       caseId:record.id,policyNumber:issue.policyNumber,issuanceDate:issue.issuanceDate,approvalId,otp,
     });
     setIssue(prev=>({...prev,approvalId}));
     setApprovalOpen(false);
   }catch(e){setIssueError(e instanceof Error?e.message:'Approval verification failed.');}
   finally{setIssuing(false);}
 };
 const openOperations=async()=>{
   if(!id)return;
   try {await Linking.openURL(operationsCaseUrl(id));}
   catch {setError('Could not open Operations Portal. Sign in there and open the case from Case Register.');}
 };
  if(!canPartnerAccessCaseRegister(context))return <PartnerScreen title="Case Register" onBack={()=>router.back()}>
    <Text style={styles.errorText}>You do not have Case Register permission.</Text>
  </PartnerScreen>;

  return <PartnerScreen title="Case Details" navyTopBar navyStatusBar onBack={()=>router.back()} bottomNavigation={<CaseBottomNav context={context} onGo={route=>router.replace(route as never)}/>}>
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
        <Text style={styles.heroSubtitle} numberOfLines={2} selectable>{record.customer_name} · {record.proposal_number} · {record.case_number}</Text>
      </View>
      <Section number="01" title="Policy source & ownership">
        <View style={styles.grid}>
          {form&&record.status_group==='pending'?<InlineInput label="Proposal date" value={dateLabel(form.sourcingDate)}
            onChange={v=>setField('sourcingDate',toIsoDate(v))} placeholder="DD/MM/YYYY"/>:
            <Field label="Proposal date" value={dateLabel(record.sourcing_date)}/>}
          <Field label="Policy type" value={record.business_line}/>
          <Field label="Intermediary type" value={record.intermediary_type}
            meta={`RM · ${record.rm_name?.trim()||'—'}`} secondaryMeta={record.rm_code?`ID · ${record.rm_code}`:undefined}/>
          <Field label="Lead source" value={record.lead_source}
            meta={record.intermediary_code?`ID · ${record.intermediary_code}`:undefined}
            secondaryMeta={record.intermediary_mobile||undefined}/>
        </View>
      </Section>

      <Section number="02" title="Customer / proposer">
        <View style={styles.grid}>
          {form&&record.status_group!=='rejected'?<>
            <InlineInput label="Client / proposer name" value={form.customerName} onChange={v=>setField('customerName',v)} required/>
            <InlineInput label="Client mobile number" value={form.customerPhone} onChange={v=>setField('customerPhone',v.replace(/\D/g,'').slice(0,10))} required keyboardType="phone-pad"/>
            <InlineInput label="Address" value={form.customerAddress} onChange={v=>setField('customerAddress',v)} wide multiline/>
          </>:<>
            <Field label="Client / proposer name" value={record.customer_name} required/>
            <Field label="Client mobile number" value={record.customer_phone} required/>
            <Field label="Address" value={record.customer_address} wide multiline/>
          </>}
        </View>
        {record.status_group==='issued'?<Pressable accessibilityRole="button" disabled={saving}
          onPress={()=>void saveEdit()} style={styles.saveButton}>
          <Text style={styles.saveText}>{saving?'Saving…':'Save Changes'}</Text>
        </Pressable>:null}
      </Section>

      <Section number="03" title="Policy product & case details">
        <View style={styles.grid}>
          {form&&record.status_group==='pending'?<>
            <InlineChoice label="Insurance company" value={insurers.find(i=>i.id===form.insurerId)?.name||record.insurer_name}
              onPress={()=>setChoice({key:'insurerId',values:insurers})} required wide/>
            <InlineInput label="Product name" value={form.productName} onChange={v=>setField('productName',v)} required wide/>
            <InlineInput label="Case / proposal number" value={form.proposalNumber} onChange={v=>setField('proposalNumber',v.toUpperCase())} required wide/>
            <InlineChoice label="PPT · Premium Paying Term" value={form.premiumPayingTerm}
              onPress={()=>setChoice({key:'premiumPayingTerm',values:TERM_OPTIONS.map(name=>({id:name,name}))})}/>
            <InlineChoice label="PD · Policy Duration / Term" value={form.policyDuration}
              onPress={()=>setChoice({key:'policyDuration',values:TERM_OPTIONS.map(name=>({id:name,name}))})}/>
            <InlineChoice label="Payment frequency" value={form.paymentFrequency}
              onPress={()=>setChoice({key:'paymentFrequency',values:FREQUENCIES.map(name=>({id:name,name}))})} required/>
          </>:<>
            <Field label="Insurance company" value={record.insurer_name} required wide multiline/>
            <Field label="Product name" value={record.product_name} required wide/>
            <Field label="Case / proposal number" value={record.proposal_number} required wide/>
            <Field label="PPT · Premium Paying Term" value={record.premium_paying_term}/>
            <Field label="PD · Policy Duration / Term" value={record.policy_duration}/>
            <Field label="Payment frequency" value={record.payment_frequency} required/>
          </>}
        </View>
      </Section>

      <Section number="04" title="Premium & payment">
        <View style={styles.grid}>
          {form&&record.status_group==='pending'?<>
            <InlineInput label="Premium amount" value={form.premiumAmount} onChange={v=>setField('premiumAmount',v.replace(/[^\d.]/g,''))}
              keyboardType="decimal-pad" required/>
            <InlineChoice label="Payment mode" value={form.paymentMode}
              onPress={()=>setChoice({key:'paymentMode',values:PAYMENT_MODES.map(name=>({id:name,name}))})} required/>
          </>:<>
            <Field label="Premium amount" value={amount(record.premium_amount)} required/>
            <Field label="Payment mode" value={record.payment_mode} required/>
          </>}
        </View>
        <View style={styles.remarkArea}>
          <Text style={styles.fieldLabel}>REMARKS</Text>
          {record.remarks?.trim()?<View style={styles.remarkRow}>
            <Text style={styles.remarkHistory} selectable>{record.remarks}</Text>
            {record.status_group==='pending'?<Pressable accessibilityRole="button" style={styles.remarkButtonCompact}
              onPress={()=>setRemarkOpen(true)}><Ionicons name="add" size={15} color={navy}/><Text style={styles.remarkButtonLabel}>Add Remark</Text></Pressable>:null}
          </View>:record.status_group==='pending'?<Pressable accessibilityRole="button" accessibilityLabel="Add Remark" style={styles.remarkButtonFull}
            onPress={()=>setRemarkOpen(true)}>
            <Ionicons name="chatbox-ellipses-outline" size={17} color={navy}/>
            <Text style={styles.remarkButtonLabel}>Add Remark</Text>
          </Pressable>:null}
        </View>
        {record.status_group==='pending'?<Pressable accessibilityRole="button" disabled={saving}
          onPress={()=>void saveEdit()} style={styles.saveButton}>
          <Ionicons name="save-outline" color="#FFFFFF" size={17}/>
          <Text style={styles.saveText}>{saving?'Saving…':'Save Changes'}</Text>
        </Pressable>:null}
        {saveError?<Text style={styles.saveError}>{saveError}</Text>:null}
      </Section>

      {record.status_group==='pending'?<Section number="05" title="Mark Policy Issued">
        <View style={styles.grid}>
          <InlineInput label="Policy number" value={issue.policyNumber} onChange={v=>setIssueField('policyNumber',v.toUpperCase())} required/>
          <InlineInput label="Issuance date" value={dateLabel(issue.issuanceDate)}
            onChange={v=>setIssueField('issuanceDate',toIsoDate(v))} placeholder="DD/MM/YYYY"/>
          <InlineInput label="Policy start date" value={dateLabel(issue.startDate)}
            onChange={v=>setIssueField('startDate',toIsoDate(v))} placeholder="DD/MM/YYYY"/>
          <InlineInput label="Policy end / maturity date" value={dateLabel(issue.endDate)}
            onChange={v=>setIssueField('endDate',toIsoDate(v))} placeholder="DD/MM/YYYY"/>
          <InlineInput label="PPT end date" value={dateLabel(issue.pptEndDate)}
            onChange={v=>setIssueField('pptEndDate',toIsoDate(v))} placeholder="DD/MM/YYYY"/>
          <InlineInput label="Next installment date" value={dateLabel(issue.nextInstallmentDate)}
            onChange={v=>setIssueField('nextInstallmentDate',toIsoDate(v))} placeholder="DD/MM/YYYY"/>
          <InlineInput label="Final premium" value={issue.finalPremium}
            onChange={v=>setIssueField('finalPremium',v.replace(/[^\d.]/g,''))} keyboardType="decimal-pad"/>
          <InlineInput label="Sum assured / insured" value={issue.sumInsured}
            onChange={v=>setIssueField('sumInsured',v.replace(/[^\d.]/g,''))} keyboardType="decimal-pad"/>
        </View>
        {issueError?<Text style={styles.saveError}>{issueError}</Text>:null}
        <Pressable accessibilityRole="button" accessibilityLabel="Create Policy and Close Case"
          disabled={issuing} onPress={()=>void requestIssue()} style={styles.saveButton}>
          <Ionicons name="shield-checkmark-outline" color="#FFFFFF" size={18}/>
          <Text style={styles.saveText}>{issuing?'Processing…':'Create Policy & Close Case'}</Text>
        </Pressable>
      </Section>:null}
      {record.policy_no?<Section number="05" title="Issued policy">
        <View style={styles.grid}><Field label="Policy number" value={record.policy_no} wide/></View>
      </Section>:null}
      {record.rejection_reason?.trim()?<Section title="Rejection reason">
        <Text style={styles.paragraph} selectable>{record.rejection_reason}</Text>
      </Section>:null}

      {documents.length>0?<Section number="06" title="Documents">
        <View style={styles.documentList}>
          {documents.map(doc=><View key={doc.id} style={styles.document}>
            <Ionicons name="document-attach-outline" size={18} color={navy}/>
            <Text style={styles.documentName} selectable>{doc.file_name}</Text>
          </View>)}
        </View>
      </Section>:null}

      {(activities.length>0||Boolean(record.remarks?.trim()))?<Section number="07" title="Activity status & remarks">
        <View style={styles.tabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab==='activity'}} style={[styles.tab,infoTab==='activity'&&styles.tabActive]} onPress={()=>setInfoTab('activity')}>
            <Text style={[styles.tabText,infoTab==='activity'&&styles.tabTextActive]}>Activity Status</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab==='remarks'}} style={[styles.tab,infoTab==='remarks'&&styles.tabActive]} onPress={()=>setInfoTab('remarks')}>
            <Text style={[styles.tabText,infoTab==='remarks'&&styles.tabTextActive]}>Remarks</Text>
          </Pressable>
        </View>
        {infoTab==='activity'?activities.map(activity=><View key={activity.id} style={styles.activity}>
          <Text style={styles.activityTitle}>{activity.action.replace(/_/g,' ')}</Text>
          <Text style={styles.activityDate}>{activityDate(activity.created_at)}</Text>
        </View>):
          record.remarks?.trim()?<Text style={styles.paragraph} selectable>{record.remarks}</Text>:null}
      </Section>:null}

      {record.status_group!=='pending'?<Pressable accessibilityRole="button"
        accessibilityLabel="Open case in Operations Portal" onPress={()=>void openOperations()} style={styles.portalButton}>
        <Ionicons name="open-outline" size={18} color="#FFFFFF"/>
        <Text style={styles.portalButtonText}>Open in Operations Portal</Text>
        <Ionicons name="chevron-forward" size={17} color="#FFFFFF"/>
      </Pressable>:null}
    </View>:null}

   <Modal transparent visible={Boolean(choice)} animationType="fade" onRequestClose={()=>setChoice(null)}>
     <View style={styles.dialogBackdrop}><View style={styles.dialogCard}>
       <View style={styles.dialogHeader}><Text style={styles.dialogTitle}>Select {choice?.key==='insurerId'?'Insurance Company':'Option'}</Text>
         <Pressable accessibilityLabel="Close options" onPress={()=>setChoice(null)}><Ionicons name="close" size={22} color={navy}/></Pressable>
       </View>
       <ScrollView style={styles.optionsScroll} keyboardShouldPersistTaps="handled">
         {choice?.values.map(item=><Pressable key={item.id} accessibilityRole="button" style={styles.optionItem}
           onPress={()=>{setField(choice.key as keyof CaseEditForm,item.id);setChoice(null)}}>
           <Text style={styles.optionText}>{item.name||'Not selected'}</Text>
         </Pressable>)}
       </ScrollView>
     </View></View>
   </Modal>
   <Modal transparent visible={remarkOpen} animationType="fade" onRequestClose={()=>{if(!remarkBusy)setRemarkOpen(false)}}>
     <View style={styles.dialogBackdrop}><View style={styles.dialogCard}>
       <View style={styles.dialogHeader}><Text style={styles.dialogTitle}>Add Remark</Text>
         <Pressable accessibilityLabel="Close remark" disabled={remarkBusy} onPress={()=>setRemarkOpen(false)}><Ionicons name="close" size={22} color={navy}/></Pressable>
       </View>
       {record?.remarks?.trim()?<ScrollView style={{maxHeight:140}}>
         <Text style={styles.remarkHistory}>{record.remarks}</Text>
       </ScrollView>:null}
       <TextInput accessibilityLabel="New remark" value={remarkDraft} multiline maxLength={2000}
         onChangeText={setRemarkDraft} placeholder="Enter new remark" placeholderTextColor="#8091A7"
         style={[styles.editInput,{minHeight:105,textAlignVertical:'top'}]}/>
       {remarkError?<Text style={styles.saveError}>{remarkError}</Text>:null}
       <Pressable accessibilityRole="button" disabled={remarkBusy||!remarkDraft.trim()}
         onPress={()=>void addRemark()} style={styles.saveButton}>
         <Text style={styles.saveText}>{remarkBusy?'Saving…':'Add Remark'}</Text>
       </Pressable>
     </View></View>
   </Modal>
   <Modal transparent visible={approvalOpen} animationType="fade" onRequestClose={()=>{if(!issuing)setApprovalOpen(false)}}>
     <View style={styles.dialogBackdrop}><View style={styles.dialogCard}>
       <View style={styles.dialogHeader}><Text style={styles.dialogTitle}>Earlier-Month Date Approval</Text>
         <Pressable accessibilityLabel="Close approval" disabled={issuing} onPress={()=>setApprovalOpen(false)}><Ionicons name="close" size={22} color={navy}/></Pressable>
       </View>
       {!approvalId?<><Text style={styles.editLabel}>Select approver</Text>
         {approvers.map(item=><Pressable key={item.key} accessibilityRole="button"
           accessibilityState={{selected:approverKey===item.key}}
           style={[styles.optionItem,approverKey===item.key&&styles.optionActive]} onPress={()=>setApproverKey(item.key)}>
           <Text style={styles.optionText}>{item.name}</Text>
         </Pressable>)}
         <Pressable disabled={!approverKey||issuing} onPress={()=>void sendApproval()} style={styles.saveButton}>
           <Text style={styles.saveText}>{issuing?'Requesting…':'Request Email OTP'}</Text>
         </Pressable>
       </>:<>
         <InlineInput label="Six-digit approver OTP" value={otp} onChange={v=>setOtp(v.replace(/\D/g,'').slice(0,6))} wide keyboardType="phone-pad"/>
         <Pressable disabled={otp.length!==6||issuing} onPress={()=>void verifyApproval()} style={styles.saveButton}>
           <Text style={styles.saveText}>{issuing?'Verifying…':'Verify Approval'}</Text>
         </Pressable>
       </>}
       {issueError?<Text style={styles.saveError}>{issueError}</Text>:null}
     </View></View>
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

function InlineInput({label,value,onChange,required=false,wide=false,multiline=false,keyboardType,placeholder}:{
  label:string;value:string;onChange:(next:string)=>void;required?:boolean;wide?:boolean;multiline?:boolean;
  keyboardType?:'phone-pad'|'decimal-pad';placeholder?:string;
}){
  return <View style={[styles.field,wide&&styles.fieldWide]}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}{required?<Text style={styles.asterisk}> *</Text>:null}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder||label}
      placeholderTextColor="#92A0B5" keyboardType={keyboardType} multiline={multiline}
      style={[styles.fieldBox,styles.inlineValue,multiline&&{minHeight:72,textAlignVertical:'top'}]}/>
  </View>;
}
function InlineChoice({label,value,onPress,wide=false,required=false}:{
  label:string;value:string;onPress:()=>void;wide?:boolean;required?:boolean;
}){
  return <View style={[styles.field,wide&&styles.fieldWide]}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}{required?<Text style={styles.asterisk}> *</Text>:null}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.fieldBox,styles.choiceRow]}>
      <Text style={styles.fieldValue} numberOfLines={2}>{value||'Select'}</Text>
      <Ionicons name="chevron-down" size={15} color="#63758D"/>
    </Pressable>
  </View>;
}
function CaseBottomNav({context,onGo}:{context:Parameters<typeof canPartnerAccess>[0];onGo:(route:string)=>void}){
  const tabs=[
    {label:'Home',route:'/(tabs)/index',icon:'home-outline' as const,access:'view_dashboard' as const},
    {label:'Business',route:'/(tabs)/business',icon:'briefcase-outline' as const,access:'view_dashboard' as const},
    {label:'Policies',route:'/(tabs)/policies',icon:'document-text-outline' as const,access:'view_policies' as const},
    {label:'Claims',route:'/(tabs)/claims',icon:'shield-outline' as const,access:'view_claims' as const},
    {label:'More',route:'/(tabs)/more',icon:'grid-outline' as const,access:null},
  ];
  return <View style={styles.bottomTabs}>
    {tabs.filter(t=>!t.access||canPartnerAccess(context,t.access)).map(t=><Pressable key={t.label}
      accessibilityRole="button" accessibilityLabel={t.label} onPress={()=>onGo(t.route)} style={styles.bottomTab}>
      <Ionicons name={t.icon} color="#FFFFFF" size={20}/>
      <Text style={styles.bottomTabText}>{t.label}</Text>
    </Pressable>)}
  </View>;
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
  inlineValue:{fontSize:11,fontWeight:'600',color:'#213653',minHeight:43},
  choiceRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},
  remarkArea:{gap:8,marginTop:5},
  remarkRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
  remarkHistory:{flex:1,backgroundColor:'#F8FAFD',borderRadius:9,padding:10,color:navy,fontSize:11,lineHeight:17},
  remarkButtonCompact:{flexDirection:'row',alignItems:'center',gap:4,padding:9,borderRadius:8,borderWidth:1,borderColor:'#BFD3EE',backgroundColor:'#EFF5FF'},
  remarkButtonFull:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,minHeight:42,
    backgroundColor:'#EFF5FF',borderWidth:1,borderColor:'#BFD3EE',borderRadius:9},
  remarkButtonLabel:{fontSize:11,fontWeight:'700',color:navy},
  dialogBackdrop:{flex:1,justifyContent:'center',backgroundColor:'rgba(15,23,42,0.5)',padding:18},
  dialogCard:{backgroundColor:'#FFFFFF',borderRadius:18,padding:17,gap:11,maxHeight:'80%'},
  dialogHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  dialogTitle:{color:navy,fontSize:15,fontWeight:'800'},
  optionsScroll:{maxHeight:350},
  optionItem:{paddingVertical:11,paddingHorizontal:9,borderBottomWidth:1,borderBottomColor:'#EDF1F6'},
  optionActive:{backgroundColor:'#EAF1FA'},
  optionText:{fontSize:12,color:navy,fontWeight:'600'},
  bottomTabs:{backgroundColor:'#071E49',flexDirection:'row',justifyContent:'space-around',paddingTop:7,minHeight:58},
  bottomTab:{alignItems:'center',justifyContent:'center',gap:4,minWidth:43,flex:1},
  bottomTabText:{color:'#FFFFFF',fontSize:9,fontWeight:'600'},

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
  hero:{backgroundColor:'#95651F',borderRadius:12,padding:10,gap:3},
  heroIssued:{backgroundColor:'#1E694F'},
  heroRejected:{backgroundColor:'#913D3D'},
  heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},
  heroTitle:{color:'#FFFFFF',fontSize:15,fontWeight:'800'},
  statusPill:{borderRadius:6,backgroundColor:'rgba(255,255,255,0.16)',borderWidth:1,borderColor:'rgba(255,255,255,0.36)',paddingHorizontal:9,paddingVertical:3},
  statusText:{fontSize:10,fontWeight:'700',color:'#FFFFFF'},
  heroSubtitle:{color:'#FFFFFF',fontWeight:'600',fontSize:11},
  heroCaseNumber:{color:'#F8F0E4',fontSize:10,fontWeight:'600'},
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
