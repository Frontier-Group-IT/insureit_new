import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import { getPartnerPolicyIntakeDocumentUrl } from '@/lib/policy-intakes';
import { prepareNativePolicyOnboarding, saveNativePolicyOnboarding, bookNativePolicyOnboarding, requestNativePolicyDateApproval, verifyNativePolicyDateApproval, lookupNativePolicyRc, type NativePolicyDraft, type NativeOnboardingData } from '@/lib/policy-onboarding';

type FieldKey = keyof NativePolicyDraft;
type Field = { key:FieldKey; label:string; required?:boolean; options?:string[] };
const policy = [
  {key:'issuanceDate',label:'Policy issuance date',required:true},
  {key:'businessLine',label:'Policy type',required:true,options:['Motor']},
  {key:'intermediaryType',label:'Intermediary type',required:true,options:['POSP','MISP','SIBL / Partner']},
  {key:'leadSource',label:'Lead source',required:true},
  {key:'intermediaryCode',label:'Lead source code'},
  {key:'rmName',label:'Relationship manager'},
] satisfies Field[];
const proposer = [
  {key:'insuredName',label:'Client / proposer name',required:true},
  {key:'phoneNo',label:'Client mobile number',required:true},
] satisfies Field[];
const vehicle = [
  {key:'registrationMode',label:'Registration status',required:true,options:['registered','unregistered']},
  {key:'registrationNo',label:'Registration number'},
  {key:'vehicleClass',label:'Vehicle class',required:true,options:['PCP','TWP','PCV','GCV','CPM','MISD']},
  {key:'make',label:'Manufacturer',required:true},
  {key:'model',label:'Model / variant',required:true},
  {key:'fuelType',label:'Fuel type',options:['Petrol','Diesel','CNG','Electric','Hybrid','Bi-Fuel','Other']},
  {key:'manufacturingYear',label:'Manufacturing year'},
  {key:'rtoState',label:'RTO state'},
  {key:'rtoName',label:'RTO name'},
  {key:'capacity',label:'Capacity'},
  {key:'chassisNo',label:'Chassis number'},
  {key:'engineNo',label:'Engine number'},
] satisfies Field[];
const premiumFields:Field[] = [
  {key:'idv',label:'Insured declared value (₹)',required:true},
  {key:'od',label:'OD premium (₹)',required:true},
  {key:'tp',label:'TP premium (₹)',required:true},
  {key:'addOnPremium',label:'Add-on premium (₹)'},
  {key:'cpa',label:'CPA amount (₹)'},
  {key:'cpaOpted',label:'CPA opted',options:['Yes','No']},
];
const productCaseFields:Field[] = [
  {key:'insurerId',label:'Insurance company',required:true},
  {key:'policyProduct',label:'Policy product',required:true,options:['Comprehensive','Third Party','SAOD','Bundled']},
  {key:'policyNo',label:'Policy number',required:true},
  {key:'validFrom',label:'Validity from (YYYY-MM-DD)',required:true},
  {key:'validUpto',label:'Validity up to (YYYY-MM-DD)',required:true},
];
const commercial = [
  {key:'payoutBasis',label:'Pay-in / payout basis',options:['NET','FLAT']},
  {key:'projectedOdPercent',label:'Insurer OD pay-in (%)'},
  {key:'projectedTpPercent',label:'Insurer TP pay-in (%)'},
  {key:'insurerScheme',label:'Insurer scheme'},
  {key:'retention',label:'Retention (₹)'},
  {key:'payoutOdPercent',label:'Partner OD payout (%)'},
  {key:'payoutTpPercent',label:'Partner TP payout (%)'},
  {key:'flatPayoutAmount',label:'Flat payout amount (₹)'},
] satisfies Field[];

function amount(value:string){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}
export default function NativePolicyOnboarding(){
  const { id }=useLocalSearchParams<{id:string}>();
  const router=useRouter();
  const [data,setData]=useState<NativeOnboardingData|null>(null);
  const [draft,setDraft]=useState<NativePolicyDraft|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [booking,setBooking]=useState(false);
  const [lookingUpRc,setLookingUpRc]=useState(false);
  const [viewingCopy,setViewingCopy]=useState(false);
  const [dateApprovalOpen,setDateApprovalOpen]=useState(false);
  const [approvalBusy,setApprovalBusy]=useState(false);
  const [approverKey,setApproverKey]=useState("");
  const [approvalRequestId,setApprovalRequestId]=useState<string|null>(null);
  const [verifiedApprovalId,setVerifiedApprovalId]=useState<string|null>(null);
  const [approvalCode,setApprovalCode]=useState("");
  const [picker,setPicker]=useState<{key:FieldKey;items:{value:string;label:string}[]}|null>(null);
  const [dirty,setDirty]=useState(false);
  const [commercialExpanded,setCommercialExpanded]=useState(false);
  const load=useCallback(async()=>{
    if(!id)return;
    setLoading(true);setError('');
    try{
      const loaded=await prepareNativePolicyOnboarding(id);
      setData(loaded);setDraft(loaded.draft);setDirty(false);
    }catch(e){setError(e instanceof Error?e.message:'Onboarding could not be opened.');}
    finally{setLoading(false);}
  },[id]);
  useEffect(()=>{void load();},[load]);
  const update=(key:FieldKey,value:string)=>{
    setDraft(current=>{
      if(!current)return current;
      const next={...current,[key]:value};
      if(key==='registrationMode'&&value==='unregistered')next.registrationNo='';
      if(key==='vehicleClass'&&value!==current.vehicleClass)next.policyProduct='';
      if(key==='vehicleClass'&&value==='CPM'){next.tp='0';next.cpa='0';next.cpaOpted='No';}
      if(key==='policyProduct'&&value==='Third Party'){next.idv='0';next.od='0';}
      if(key==='cpa')next.cpaOpted=amount(value)>0?'Yes':'No';
      return next;
    });
    setDirty(true);
    setVerifiedApprovalId(null);
    setApprovalRequestId(null);
  };
  const save=async(goBack=false)=>{
    if(!draft||!data||saving)return;
    setSaving(true);setError('');
    try{
      const result=await saveNativePolicyOnboarding(id,data.revision,draft);
      setData(current=>current?{...current,revision:result.revision}:current);
      setDirty(false);
      if(goBack)router.back();
    }catch(e){setError(e instanceof Error?e.message:'Draft could not be saved.');}
    finally{setSaving(false);}
  };

  async function completeBooking(resolution?:Record<string,unknown>){
    if(!draft||!data||booking||saving)return;
    setBooking(true);setError('');
    let revision=data.revision;
    try{
      if(dirty){
        const saved=await saveNativePolicyOnboarding(id,revision,draft);
        revision=saved.revision;
        setData(current=>current?{...current,revision}:current);
        setDirty(false);
      }
      const {booking:result}=await bookNativePolicyOnboarding(id,revision,resolution,verifiedApprovalId);
      if(result.ok){
        Alert.alert('Policy booked','Policy '+result.policyCode+' was booked successfully.',[
          {text:'OK',onPress:()=>router.replace('/policy-intakes')},
        ]);
        return;
      }
      if(result.kind==='customer_match'){
        const choices=result.candidates.slice(0,2).map(candidate=>({
          text:'Use '+candidate.name,
          onPress:()=>void completeBooking({selectedCustomerId:candidate.id}),
        }));
        Alert.alert('Confirm customer','Select an existing matching customer, or create a new customer.',[
          ...choices,{text:'Create new',onPress:()=>void completeBooking({createNewCustomer:true})},{text:'Cancel',style:'cancel'},
        ]);
        return;
      }
      if(result.kind==='ownership_conflict'){
        Alert.alert('Vehicle ownership', 'The existing vehicle belongs to '+result.conflict.customerName+'. Reuse this owner?',[
          {text:'Cancel',style:'cancel'},
          {text:'Keep existing owner',onPress:()=>void completeBooking({ownershipDecision:'keep_existing',selectedCustomerId:result.conflict.customerId})},
        ]);
        return;
      }
      if(result.kind==='business_conflict'){
        const conflict=result.conflict;
        const message=conflict.message||'Review the policy conflict for '+(conflict.existingPolicyNo||conflict.existingVehicleNo||conflict.type)+'.';
        const choices:{text:string;onPress?:()=>void;style?:'cancel'}[]=[{text:'Review',style:'cancel'}];
        if(conflict.type==='coverage_gap')choices.unshift({text:'Accept coverage gap',onPress:()=>void completeBooking({acceptCoverageGap:true})});
        if(conflict.type==='active_policy_notice')choices.unshift({text:'Continue',onPress:()=>void completeBooking({acceptActivePolicyNotice:true})});
        if(conflict.type==='expired_policy_history')choices.unshift({text:'Continue',onPress:()=>void completeBooking({acceptExpiredPolicyHistory:true})});
        if(conflict.type==='vehicle_identity_conflict'&&conflict.existingVehicleId)choices.unshift({text:'Use existing vehicle',onPress:()=>void completeBooking({selectedExistingVehicleId:conflict.existingVehicleId})});
        Alert.alert('Policy verification',message,choices);
        return;
      }
      if(result.kind==='validation'&&result.error.includes('Email OTP approval is required')){
        setDateApprovalOpen(true);
      }else{
        setError(result.error);
      }
    }catch(e){
      setError('The booking response could not be confirmed. Check Policy Register before retrying to avoid duplicates. '+(e instanceof Error?e.message:''));
    }finally{setBooking(false);}
  }

  async function requestApproval(){
    if(!data||!draft||dirty){setError('Save the draft before requesting date approval.');return;}
    if(!approverKey){setError('Choose an approving officer.');return;}
    setApprovalBusy(true);setError('');
    try{
      const result=await requestNativePolicyDateApproval(id,data.revision,approverKey);
      setApprovalRequestId(result.approval_id);setApprovalCode('');
    }catch(e){setError(e instanceof Error?e.message:'Could not request approval.');}
    finally{setApprovalBusy(false);}
  }
  async function verifyApproval(){
    if(!data||!approvalRequestId||!/^\d{6}$/.test(approvalCode)){setError('Enter the six-digit approval code.');return;}
    setApprovalBusy(true);setError('');
    try{
      await verifyNativePolicyDateApproval(id,data.revision,approvalRequestId,approvalCode);
      setVerifiedApprovalId(approvalRequestId);setDateApprovalOpen(false);
      Alert.alert('Date approved','The approved policy can now be booked.');
    }catch(e){setError(e instanceof Error?e.message:'Approval could not be verified.');}
    finally{setApprovalBusy(false);}
  }

  async function fetchRc(){
    if(!draft||lookingUpRc||draft.registrationMode!=='registered')return;
    if(!draft.registrationNo.trim()){setError('Enter a registration number first.');return;}
    setLookingUpRc(true);setError('');
    try{
      const {review}=await lookupNativePolicyRc(id,draft.registrationNo);
      const vc=(review.vehicleClass||'').toLowerCase();
      const category=/two.?wheel|motor.?cycle|scooter/.test(vc)?'TWP':/goods|truck|cargo/.test(vc)?'GCV':/passenger|bus|taxi/.test(vc)?'PCV':/plant|machinery/.test(vc)?'CPM':/car|private|lmv/.test(vc)?'PCP':'MISD';
      const make=(data?.manufacturers??[]).find(m=>m.toLowerCase()===(review.make||'').toLowerCase());
      Alert.alert('RC details found','Apply fetched details to this draft?',[
        {text:'Cancel',style:'cancel'},
        {text:'Apply',onPress:()=>{
          setDraft(current=>current?{
            ...current,
            registrationNo:review.registrationNumber||current.registrationNo,
            insuredName:current.insuredName||review.ownerName||'',
            phoneNo:current.phoneNo||review.mobileNumber||'',
            vehicleClass:current.vehicleClass||category,
            make:current.make||make||'',
            model:current.model||review.model||'',
            fuelType:current.fuelType||review.fuelType||'',
            manufacturingYear:current.manufacturingYear||review.manufacturingYear||'',
            capacity:current.capacity||(category==='PCV'?review.seatingCapacity:(category==='GCV'||category==='CPM')?review.grossWeight:review.engineCapacity)||'',
            chassisNo:current.chassisNo||review.chassisNumber||'',
            engineNo:current.engineNo||review.engineNumber||'',
            rtoState:current.rtoState||review.rtoState||'',
            rtoName:current.rtoName||review.rtoName||'',
          }:current);
          setDirty(true);setVerifiedApprovalId(null);
        }},
      ]);
    }catch(e){setError(e instanceof Error?e.message:'RC lookup failed.');}
    finally{setLookingUpRc(false);}
  }
  async function openCopy(){
    if(viewingCopy)return;
    setViewingCopy(true);setError('');
    try{
      const url=await getPartnerPolicyIntakeDocumentUrl(id);
      await Linking.openURL(url);
    }catch(e){setError(e instanceof Error?e.message:'Could not open policy copy.');}
    finally{setViewingCopy(false);}
  }
  const net=useMemo(()=>draft?amount(draft.od)+amount(draft.tp)+amount(draft.cpa)+amount(draft.addOnPremium||'0'):0,[draft]);
  const filled=useMemo(()=>{
    if(!draft)return 0;
    const required=[...policy,...proposer,...vehicle,...productCaseFields,...premiumFields].filter(field=>field.required);
    return Math.round(100*required.filter(f=>String(draft[f.key]??'').trim()).length/required.length);
  },[draft]);
  const field=(f:Field)=>{
    if(!draft)return null;
    const current=draft[f.key]??'';
    const productOptions=f.key==='policyProduct'?(draft.vehicleClass==='CPM'?['Comprehensive','SAOD']:['Comprehensive','Third Party','SAOD',...(['PCP','TWP'].includes(draft.vehicleClass)?['Bundled']:[]) ]):f.options??[];
    const options=f.key==='insurerId'?data?.insurers??[]:f.key==='make'?(data?.manufacturers??[]).map(x=>({value:x,label:x})):productOptions.map(x=>({value:x,label:x}));
    const displayed=options.find(x=>x.value===current)?.label??current;
    return <View key={f.key} style={styles.field}>
      <Text style={styles.label}>{f.label}{f.required?<Text style={styles.star}> *</Text>:null}</Text>
      {options.length?(
        <Pressable accessibilityRole="button" accessibilityLabel={f.label} onPress={()=>setPicker({key:f.key,items:options})} style={styles.inputRow}>
          <Text numberOfLines={1} style={[styles.value,!current&&styles.placeholder]}>{displayed||'Select '+f.label.toLowerCase()}</Text>
          <Ionicons name="chevron-down" size={15} color="#63758D"/>
        </Pressable>
      ):(
        <TextInput accessibilityLabel={f.label} value={current} onChangeText={v=>update(f.key,v)} placeholder={'Enter '+f.label.toLowerCase()}
          autoCapitalize={['registrationNo','chassisNo','engineNo','policyNo'].includes(f.key)?'characters':'sentences'}
          keyboardType={['phoneNo','idv','od','tp','cpa','capacity','manufacturingYear'].includes(f.key)?'numeric':'default'}
          style={styles.input} placeholderTextColor="#9AA7B9" />
      )}
    </View>;
  };
  const section=(number:string,title:string,items:Field[])=><View style={styles.section} key={number}>
    <View style={styles.sectionHead}>{number?<Text style={styles.number}>{number}</Text>:null}<Text style={styles.sectionTitle}>{title}</Text></View>
    <View style={styles.fields}>{items.map(field)}</View>
  </View>;
  return <PartnerScreen title="Policy Onboarding" eyebrow="POLICY INTAKE" onBack={()=>router.back()} navyTopBar navyStatusBar topBarIcon="document-text-outline">
    {loading?<View style={styles.wait}><ActivityIndicator color="#2843A9"/><Text style={styles.muted}>Loading saved Policy Onboarding…</Text></View>:null}
    {error?<View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color="#B42318"/><Text style={styles.errorText}>{error}</Text></View>:null}
    {!loading&&!draft?<Pressable style={styles.retry} onPress={()=>void load()}><Text style={styles.retryText}>Retry loading</Text></Pressable>:null}
    {draft?<>
      <View style={styles.status}><View><Text style={styles.intake}>{data?.intake_number||'Policy Intake'}</Text><Text style={styles.muted}>Existing draft · {dirty?'Unsaved changes':'Saved revision '+data?.revision}</Text></View><View style={styles.progress}><Text style={styles.progressText}>{filled}% complete</Text></View></View>
      {section('01','Policy source & ownership',policy)}
      {section('02','Customer / Proposer',proposer)}
      {section('','Vehicle identification — Motor',vehicle)}
      {draft.registrationMode==='registered'?<Pressable accessibilityRole="button" disabled={lookingUpRc} style={[styles.secondary,{marginBottom:11}]} onPress={()=>void fetchRc()}><Text style={styles.secondaryText}>{lookingUpRc?'Fetching RC…':'Fetch RC Details'}</Text></Pressable>:null}
      {section('03','Policy product & case details',draft.policyProduct==='Bundled'&&['PCP','TWP'].includes(draft.vehicleClass)?[
        ...productCaseFields,{key:'tpValidUpto',label:'TP validity up to (YYYY-MM-DD)',required:true},{key:'cpaValidUpto',label:'CPA validity up to (YYYY-MM-DD)',required:true}
      ]:productCaseFields)}
      {section('04','Premium & payment',premiumFields)}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="pie-chart-outline" size={18} color="#254C83"/>
          <Text style={styles.sectionTitle}>Onboarding summary</Text>
          <View style={styles.summaryProgress}><Text style={styles.progressText}>{filled}%</Text></View>
        </View>
        <View style={styles.summary}>
          <Text style={styles.summaryCaption}>POLICY STATUS  ·  In progress</Text>
          <Text style={styles.muted}>PREMIUM</Text>
          <Text style={styles.total}>₹{net.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</Text>
          <Text style={styles.muted}>Estimated Motor premium · Final amount confirmed on booking</Text>
        </View>
        {data?.commercialAccess?<>
          <Pressable accessibilityRole="button" accessibilityLabel="Payin–Payout" accessibilityState={{expanded:commercialExpanded}}
            onPress={()=>setCommercialExpanded(open=>!open)} style={styles.commercialToggle}>
            <Ionicons name="cash-outline" size={17} color="#254C83"/>
            <Text style={styles.commercialToggleTitle}>Payin–Payout</Text>
            <Ionicons name={commercialExpanded?'chevron-up':'chevron-down'} size={16} color="#63758D"/>
          </Pressable>
          {commercialExpanded?<View style={styles.commercialBody}>
            {section('','Insurer pay-in & partner payout',commercial)}
          </View>:null}
        </>:null}
        <View style={styles.summaryDocuments}>
          <Text style={styles.commercialToggleTitle}>Documents</Text>
          <Text style={styles.muted}>Submitted policy copy</Text>
        </View>
        <Text style={styles.notice}>This draft summary is not the final policy premium calculation. Taxes, premiums, validation and booking remain with the Operations booking engine.</Text>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="cloud-upload-outline" size={18} color="#254C83"/>
          <Text style={styles.sectionTitle}>Upload Forms</Text>
        </View>
        <Text style={styles.notice}>Proposal Form, Illustration Form, Payment Receipt and Other Form uploads are managed on the Operations website. The native Motor booking API does not currently accept these uploads.</Text>
        <Pressable accessibilityRole="button" disabled={viewingCopy} style={[styles.secondary,styles.documentAction]} onPress={()=>void openCopy()}>
          <Ionicons name="document-text-outline" size={17} color="#25466E"/>
          <Text style={styles.secondaryText}>{viewingCopy?'Opening document…':'View submitted policy copy'}</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving} style={styles.secondary} onPress={()=>void save(true)}><Text style={styles.secondaryText}>{saving?'Saving…':'Save & return to Intake'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving||!dirty} style={[styles.primary,(saving||!dirty)&&styles.disabled]} onPress={()=>void save()}><Text style={styles.primaryText}>{saving?'Saving…':'Save draft'}</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" disabled={booking||saving||!data} style={[styles.primary,(booking||saving)&&styles.disabled,styles.bookButton]} onPress={()=>void completeBooking()}>
        {booking?<ActivityIndicator size="small" color="white"/>:<Ionicons name="checkmark-circle-outline" size={18} color="white"/>}
        <Text style={styles.primaryText}>{booking?'Checking & booking…':'Book Active Policy'}</Text>
      </Pressable>
      <View style={styles.bookingNotice}><Ionicons name="shield-checkmark-outline" size={17} color="#8A5A17"/><Text style={styles.bookingText}>Booking uses Operations validation. Earlier-month policies require date approval. If the response is uncertain, first check Policy Register before retrying.</Text></View>
    </>:null}

    <Modal transparent visible={dateApprovalOpen} animationType="fade" onRequestClose={()=>setDateApprovalOpen(false)}>
      <View style={styles.scrim}><View style={styles.sheet}>
        <View style={styles.sheetTitle}><Text style={styles.sectionTitle}>Policy Date Approval</Text><Pressable onPress={()=>setDateApprovalOpen(false)} accessibilityLabel="Close approval"><Ionicons name="close" size={21} color="#4C5970"/></Pressable></View>
        <Text style={styles.notice}>Select an authorised officer. An approval code will be emailed to them. Obtain approval before using the code.</Text>
        {!approvalRequestId ? <>
          {(data?.approvers??[]).map(approver=><Pressable key={approver.key} onPress={()=>setApproverKey(approver.key)} style={styles.choice}><Text style={styles.choiceText}>{approverKey===approver.key?'● ':'○ '}{approver.name}</Text></Pressable>)}
          <Pressable disabled={approvalBusy||!approverKey} style={[styles.primary,styles.bookButton]} onPress={()=>void requestApproval()}><Text style={styles.primaryText}>{approvalBusy?'Sending…':'Send Approval Request'}</Text></Pressable>
        </> : <>
          <TextInput accessibilityLabel="Six-digit approval code" keyboardType="numeric" maxLength={6} value={approvalCode} onChangeText={setApprovalCode} placeholder="6-digit approval code" style={styles.input}/>
          <Pressable disabled={approvalBusy||approvalCode.length!==6} style={[styles.primary,styles.bookButton]} onPress={()=>void verifyApproval()}><Text style={styles.primaryText}>{approvalBusy?'Checking…':'Verify Approval'}</Text></Pressable>
        </>}
      </View></View>
    </Modal>
    <Modal transparent visible={Boolean(picker)} animationType="fade" onRequestClose={()=>setPicker(null)}>
      <View style={styles.scrim}><View style={styles.sheet}>
        <View style={styles.sheetTitle}><Text style={styles.sectionTitle}>Select {picker?.key}</Text><Pressable onPress={()=>setPicker(null)} accessibilityLabel="Close options"><Ionicons name="close" size={21} color="#4C5970"/></Pressable></View>
        <ScrollView style={styles.choiceScroll}>{picker?.items.map(item=><Pressable key={item.value} style={styles.choice} onPress={()=>{update(picker!.key,item.value);setPicker(null);}}><Text style={styles.choiceText}>{item.label}</Text></Pressable>)}</ScrollView>
      </View></View>
    </Modal>
  </PartnerScreen>;
}
const styles=StyleSheet.create({
  wait:{padding:28,alignItems:'center',gap:12},muted:{fontSize:11,color:'#738196',lineHeight:17},
  error:{flexDirection:'row',gap:8,backgroundColor:'#FFF0EF',padding:12,borderRadius:11,marginBottom:10},errorText:{flex:1,color:'#A32924',fontSize:12},
  retry:{padding:14,backgroundColor:'#DFE8FF',borderRadius:10,alignItems:'center'},retryText:{color:'#1B397A',fontWeight:'700'},
  status:{backgroundColor:'#FFFFFF',borderRadius:13,borderWidth:1,borderColor:'#DFE6F1',padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  intake:{color:'#1C375D',fontWeight:'800',fontSize:14},progress:{borderRadius:20,backgroundColor:'#EAEFFA',paddingVertical:6,paddingHorizontal:10},progressText:{color:'#324D9E',fontWeight:'700',fontSize:11},
  section:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DFE6F0',borderRadius:13,marginBottom:11,overflow:'hidden'},
  sectionHead:{flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:13,paddingVertical:12,backgroundColor:'#EAF1FA'},
  number:{fontSize:11,color:'#355EA0',fontWeight:'800'},sectionTitle:{fontSize:13,color:'#1B385B',fontWeight:'800'},
  fields:{padding:12,flexDirection:'row',flexWrap:'wrap',columnGap:10,rowGap:11},field:{width:'48%',minWidth:0,gap:5},label:{fontSize:10,color:'#65758E',fontWeight:'700'},star:{color:'#B93333'},
  input:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',backgroundColor:'#FFFFFF',borderRadius:9,paddingHorizontal:11,fontSize:12,color:'#183653'},
  inputRow:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  value:{color:'#183653',fontSize:12,flex:1},placeholder:{color:'#97A5B7'},
  summary:{padding:14,gap:7},summaryCaption:{fontSize:10,fontWeight:'700',color:'#426188'},summaryProgress:{marginLeft:'auto',backgroundColor:'#E1EAF8',borderRadius:18,paddingHorizontal:9,paddingVertical:5},commercialToggle:{marginHorizontal:12,marginBottom:9,flexDirection:'row',alignItems:'center',gap:8,padding:11,borderWidth:1,borderColor:'#DDE6F0',borderRadius:10,backgroundColor:'#F8FAFD'},commercialToggleTitle:{flex:1,color:'#26436B',fontSize:11,fontWeight:'700'},commercialBody:{paddingHorizontal:12},summaryDocuments:{marginHorizontal:12,marginBottom:11,padding:12,flexDirection:'row',alignItems:'center',gap:10,borderColor:'#E1E9F3',borderWidth:1,borderRadius:10},documentAction:{marginHorizontal:12,marginBottom:12,flexDirection:'row',gap:8},total:{fontSize:20,color:'#1B385B',fontWeight:'800'},notice:{fontSize:10,lineHeight:16,color:'#65758E',paddingHorizontal:14,paddingBottom:13},
  actions:{flexDirection:'row',gap:8,marginBottom:11},secondary:{flex:1,borderWidth:1,borderColor:'#CDD9EB',borderRadius:10,padding:13,alignItems:'center'},secondaryText:{fontWeight:'700',fontSize:11,color:'#25466E'},
  primary:{flex:1,backgroundColor:'#243F9E',borderRadius:10,padding:13,alignItems:'center'},primaryText:{fontSize:11,fontWeight:'800',color:'white'},disabled:{opacity:.48},
  bookButton:{marginBottom:11,flexDirection:'row',justifyContent:'center',gap:8},
  bookingNotice:{flexDirection:'row',gap:9,padding:12,backgroundColor:'#FFF7E9',borderRadius:10,marginBottom:14},bookingText:{flex:1,fontSize:10,lineHeight:16,color:'#75531C'},
  scrim:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(5,18,40,.5)'},sheet:{backgroundColor:'white',borderTopLeftRadius:20,borderTopRightRadius:20,padding:17,maxHeight:'70%'},
  sheetTitle:{flexDirection:'row',justifyContent:'space-between',paddingBottom:12},choiceScroll:{maxHeight:420},
  choice:{minHeight:44,justifyContent:'center',borderTopWidth:1,borderColor:'#EEF1F7'},choiceText:{fontSize:12,color:'#284064'},
});
