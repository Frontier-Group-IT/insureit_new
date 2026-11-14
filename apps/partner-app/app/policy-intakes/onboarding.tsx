import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerPolicyDateField } from '@/components/policy-intakes/partner-policy-date-field';
import { getPartnerPolicyIntakeDocumentUrl } from '@/lib/policy-intakes';
import { prepareNativePolicyOnboarding, saveNativePolicyOnboarding, bookNativePolicyOnboarding, requestNativePolicyDateApproval, verifyNativePolicyDateApproval, lookupNativePolicyRc, type NativePolicyDraft, type NativeOnboardingData, type NativeProductType } from '@/lib/policy-onboarding';

type FieldKey = keyof NativePolicyDraft;
type Field = { key:FieldKey; label:string; required?:boolean; options?:string[] };
const policy = [
  {key:'issuanceDate',label:'Proposal date',required:true},
  {key:'businessLine',label:'Policy type',required:true,options:['Motor','Life','Health','Non Motor']},
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
type ProductField = {key:string;label:string;required?:boolean;options?:string[];date?:boolean;wide?:boolean};
const yearOptions=Array.from({length:100},(_,i)=>i===0?'1 Year':(i+1)+' Years');
const paymentFrequencies=['Monthly','Quarterly','Half Yearly','Annually','One Time'];
const paymentModes=['Cheque','NEFT/RTGS','UPI','Credit/Debit Card','Net Banking'];
const commonPerson:ProductField[]=[
  {key:'insuredName',label:'Client / proposer name',required:true},
  {key:'phoneNo',label:'Client mobile number',required:true},
  {key:'address',label:'Address',wide:true},
];
const lifeProduct:ProductField[]=[
  {key:'insurerId',label:'Insurance company',required:true},
  {key:'productName',label:'Product name',required:true},
  {key:'proposalNumber',label:'Case / proposal number',required:true},
  {key:'ppt',label:'PPT - Premium paying term',options:['Single Pay',...yearOptions]},
  {key:'pd',label:'PD - Policy duration / term',options:yearOptions},
  {key:'paymentFrequency',label:'Payment frequency',required:true,options:paymentFrequencies},
];
const lifePremium:ProductField[]=[
  {key:'premiumAmount',label:'Premium amount (₹)',required:true},
  {key:'paymentMode',label:'Payment mode',required:true,options:paymentModes},
];
const nonMotorCategories=['Fire & Property','Marine','Engineering','Liability','Burglary','Employee Compensation','Cyber','Travel','Personal Accident','Package Policy','Other'];
const riskFields:Record<string,ProductField[]>={
  'Fire & Property':[{key:'riskTitle',label:'Risk / property description',required:true},{key:'riskLocation',label:'Risk location',required:true},{key:'occupancyType',label:'Occupancy type',required:true}],
  'Burglary':[{key:'riskTitle',label:'Risk / property description',required:true},{key:'riskLocation',label:'Risk location',required:true}],
  'Package Policy':[{key:'riskTitle',label:'Risk / property description',required:true},{key:'riskLocation',label:'Risk location',required:true}],
  'Marine':[{key:'cargoDescription',label:'Cargo description',required:true},{key:'transitFrom',label:'Transit from',required:true},{key:'transitTo',label:'Transit to',required:true},{key:'transitMode',label:'Transit mode',required:true,options:['Road','Rail','Air','Sea','Multimodal']}],
  'Engineering':[{key:'projectName',label:'Project name',required:true},{key:'projectValue',label:'Project value (₹)'},{key:'riskLocation',label:'Risk location',required:true}],
  'Liability':[{key:'natureOfBusiness',label:'Nature of business',required:true},{key:'liabilityType',label:'Liability type',required:true},{key:'riskLocation',label:'Risk location'}],
  'Employee Compensation':[{key:'natureOfBusiness',label:'Nature of business',required:true},{key:'employeeCount',label:'Employee count',required:true},{key:'annualWages',label:'Annual wages (₹)',required:true},{key:'riskLocation',label:'Risk location'}],
  'Cyber':[{key:'businessName',label:'Business name',required:true},{key:'natureOfBusiness',label:'Nature of business',required:true},{key:'annualTurnover',label:'Annual turnover (₹)'}],
  'Travel':[{key:'riskTitle',label:'Travel / insured risk',required:true},{key:'riskLocation',label:'Destination',required:true}],
  'Personal Accident':[{key:'riskTitle',label:'Insured activity / risk',required:true}],
  'Other':[{key:'riskTitle',label:'Risk description',required:true}],
};
const otherPolicy:ProductField[]=[
  {key:'category',label:'Policy category',required:true,options:nonMotorCategories},
  {key:'customerType',label:'Customer type',options:['Individual','Organisation']},
  {key:'productName',label:'Product / policy name',required:true},
  {key:'policyNumber',label:'Policy number',required:true},
  {key:'insurerId',label:'Insurance company',required:true},
];
const otherPremium:ProductField[]=[
  {key:'sumInsured',label:'Sum insured / limit (₹)',required:true},
  {key:'deductible',label:'Deductible / excess (₹)'},
  {key:'netPremium',label:'Net premium (₹)'},
  {key:'gstAmount',label:'GST (₹)'},
  {key:'grossPremium',label:'Gross premium (₹)',required:true},
  {key:'startDate',label:'Policy start',required:true,date:true},
  {key:'endDate',label:'Policy expiry',required:true,date:true},
];
const productExtras:ProductField[]=[
  {key:'proposalNumber',label:'Proposal number'},
  {key:'previousInsurer',label:'Previous insurer'},
  {key:'previousPolicyNumber',label:'Previous policy number'},
  {key:'previousClaims',label:'Previous claims'},
  {key:'addOns',label:'Add-ons',wide:true},
  {key:'specialConditions',label:'Special conditions',wide:true},
]; 
const insurerPayinFields:Field[]=[
  {key:'projectedOdPercent',label:'OD Pay-in %'},
  {key:'projectedTpPercent',label:'TP/CPA Pay-in %'},
  {key:'insurerScheme',label:'Insurer scheme'},
];
const partnerPayoutFields:Field[]=[
  {key:'payoutOdPercent',label:'Payout OD %'},
  {key:'payoutTpPercent',label:'Payout TP/CPA %'},
  {key:'payoutBasis',label:'Payout basis',options:['NET','OD','FLAT']},
  {key:'flatPayoutAmount',label:'Total agreed payout'},
];

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
  const [picker,setPicker]=useState<{key:string;items:{value:string;label:string}[];product?:boolean}|null>(null);
  const [dirty,setDirty]=useState(false);
  const [commercialExpanded,setCommercialExpanded]=useState(false);
  const [commercialModal,setCommercialModal]=useState<'payin'|'payout'|null>(null);
  const [remarkOpen,setRemarkOpen]=useState(false);
  const [remarkText,setRemarkText]=useState('');
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
  const productType:NativeProductType=(draft?.businessLine==='Life'||draft?.businessLine==='Health'||draft?.businessLine==='Non Motor')?draft.businessLine:'Motor';
  const isMotor=productType==='Motor';
  const productValues=(productType==='Motor'?{}:draft?.productDrafts?.[productType])??{};
  const updateProduct=(key:string,value:string)=>{
    if(productType==='Motor')return;
    setDraft(current=>current?{...current,productDrafts:{
      ...current.productDrafts,[productType]:{
        ...current.productDrafts?.[productType],[key]:value,
        ...(productType==='Non Motor'&&['netPremium','gstAmount'].includes(key)?{
          grossPremium:String(Number(key==='netPremium'?value:current.productDrafts?.[productType]?.netPremium||'0')+
            Number(key==='gstAmount'?value:current.productDrafts?.[productType]?.gstAmount||'0'))
        }:{})
      }
    }}:current);
    setDirty(true);
    setVerifiedApprovalId(null);
  };
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
  const net=useMemo(()=>draft?amount(draft.od)+amount(draft.tp)+(draft.vehicleClass==='CPM'?0:amount(draft.cpa))+amount(draft.addOnPremium||'0'):0,[draft]);
  const gst=useMemo(()=>draft?(draft.vehicleClass==='GCV'
    ?(amount(draft.od)+amount(draft.cpa)+amount(draft.addOnPremium||'0'))*.18+amount(draft.tp)*.05
    :net*.18):0,[draft,net]);
  const gross=net+gst;
  const payinTotal=draft?
    (amount(draft.od)+amount(draft.addOnPremium||'0'))*amount(draft.projectedOdPercent)/100
    +(amount(draft.tp)+(draft.vehicleClass==='CPM'?0:amount(draft.cpa)))*amount(draft.projectedTpPercent)/100
    +amount(draft.insurerScheme):0;
  const payoutTotal=draft?draft.payoutBasis==='FLAT'?amount(draft.flatPayoutAmount):
    (amount(draft.od)+amount(draft.addOnPremium||'0'))*amount(draft.payoutOdPercent)/100
    +(draft.payoutBasis==='OD'?0:(amount(draft.tp)+(draft.vehicleClass==='CPM'?0:amount(draft.cpa)))*amount(draft.payoutTpPercent)/100):0;
  const rupees=(value:number)=>'₹'+value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const filled=useMemo(()=>{
    if(!draft)return 0;
    const required=isMotor?[...policy,...proposer,...vehicle,...productCaseFields,...premiumFields].filter(field=>field.required):[...policy.filter(f=>f.required),...proposer.filter(f=>f.required)];
    if(!isMotor){
      const details=productType==='Non Motor'?[...otherPolicy,...(riskFields[productValues.category]??riskFields.Other),...otherPremium]:[...lifeProduct,...lifePremium];
      const count=required.filter(f=>String(draft[f.key]??'').trim()).length+details.filter(f=>f.required&&String(productValues[f.key]??'').trim()).length;
      return Math.round(100*count/(required.length+details.filter(f=>f.required).length));
    }
    return Math.round(100*required.filter(f=>String(draft[f.key]??'').trim()).length/required.length);
  },[draft,productType,isMotor,productValues]);
  const placeholderFor=(label:string,select=false)=>`${select?'Select':'Enter'} ${label.toLowerCase().replace(/ \(₹\)/g,'')}`;
  const field=(f:Field,fullWidth=false)=>{
    if(!draft)return null;
    const raw=draft[f.key];
    const current=typeof raw==='string'?raw:'';
    if(['issuanceDate','validFrom','validUpto','tpValidUpto','cpaValidUpto'].includes(f.key))return <PartnerPolicyDateField key={f.key} hidePlaceholder fullWidth={fullWidth} label={isMotor&&f.key==='issuanceDate'?'Policy issuance date':f.label.replace(' (YYYY-MM-DD)','')} value={current} required={f.required} onChange={v=>update(f.key,v)}/>;
    const productOptions=f.key==='policyProduct'?(draft.vehicleClass==='CPM'?['Comprehensive','SAOD']:['Comprehensive','Third Party','SAOD',...(['PCP','TWP'].includes(draft.vehicleClass)?['Bundled']:[]) ]):f.options??[];
    const options=f.key==='insurerId'?data?.insurers??[]:f.key==='make'?(data?.manufacturers??[]).map(x=>({value:x,label:x})):productOptions.map(x=>({value:x,label:x}));
    const displayed=options.find(x=>x.value===current)?.label??current;
    return <View key={f.key} style={[styles.field,fullWidth&&styles.sourcePrimary]}>
      <Text style={styles.label}>{f.label}{f.required?<Text style={styles.star}> *</Text>:null}</Text>
      {options.length?(
        <Pressable accessibilityRole="button" accessibilityLabel={f.label} onPress={()=>setPicker({key:f.key,items:options})} style={styles.inputRow}>
          <Text numberOfLines={1} style={[styles.value,!displayed&&styles.placeholder]}>{displayed||placeholderFor(f.label,true)}</Text>
          <Ionicons name="chevron-down" size={15} color="#63758D"/>
        </Pressable>
      ):(
        <TextInput accessibilityLabel={f.label} value={current} onChangeText={v=>update(f.key,v)}
          autoCapitalize={['registrationNo','chassisNo','engineNo','policyNo'].includes(f.key)?'characters':'sentences'}
          keyboardType={['phoneNo','idv','od','tp','cpa','capacity','manufacturingYear'].includes(f.key)?'numeric':'default'}
          placeholder={placeholderFor(f.label)} placeholderTextColor="#97A5B7"
          style={styles.input} />
      )}
      {isMotor&&f.key==='intermediaryType'&&draft.rmName?<Text style={styles.fieldMeta}>RM · {draft.rmName}</Text>:null}
      {isMotor&&f.key==='leadSource'&&draft.intermediaryCode?<Text style={styles.fieldMeta}>ID · {draft.intermediaryCode}</Text>:null}
    </View>;
  };
  const detailField=(f:ProductField)=>{
    if(!draft)return null;
    if(f.key==='insuredName'||f.key==='phoneNo')return field({key:f.key as FieldKey,label:f.label,required:f.required});
    const current=String(productValues[f.key]??'');
    if(f.key==='grossPremium')return <View key={f.key} style={styles.field}><Text style={styles.label}>{f.label}</Text><View style={styles.inputRow}><Text style={styles.value}>{current}</Text></View></View>;
    if(f.date)return <PartnerPolicyDateField key={f.key} hidePlaceholder label={f.label} value={current} required={f.required} onChange={v=>updateProduct(f.key,v)}/>;
    const options=f.key==='insurerId'?data?.insurers??[]:(f.options??[]).map(value=>({value,label:value}));
    return <View key={f.key} style={[styles.field,f.wide&&styles.wideField]}>
      <Text style={styles.label}>{f.label}{f.required?<Text style={styles.star}> *</Text>:null}</Text>
      {options.length?<Pressable accessibilityRole="button" accessibilityLabel={f.label} style={styles.inputRow} onPress={()=>setPicker({key:f.key,items:options,product:true})}>
        <Text style={[styles.value,!current&&styles.placeholder]} numberOfLines={1}>{options.find(o=>o.value===current)?.label||placeholderFor(f.label,true)}</Text>
        <Ionicons name="chevron-down" size={15} color="#63758D"/>
      </Pressable>:<TextInput accessibilityLabel={f.label} value={current} onChangeText={v=>updateProduct(f.key,v)}
        keyboardType={['premiumAmount','sumInsured','deductible','netPremium','gstAmount','grossPremium','employeeCount','annualWages','annualTurnover','projectValue'].includes(f.key)?'numeric':'default'}
        placeholder={placeholderFor(f.label)} placeholderTextColor="#97A5B7"
        style={styles.input}/>}
    </View>;
  };
  // Preserve Motor's newer source ownership rendering; compact the other policy types.
  const sourceMeta=(key:'rmName'|'intermediaryCode',label:string)=><View style={styles.sourceMeta}>
    <Text style={styles.sourceMetaLabel}>{label}</Text>
    <TextInput accessibilityLabel={label} value={draft?.[key]??''} onChangeText={value=>update(key,value)}
      placeholder={key==='rmName'?'Enter RM name':'Enter source ID'} placeholderTextColor="#97A5B7"
      style={styles.sourceMetaInput}/>
  </View>;
  const sourceSection=()=> <View style={styles.section}>
    <View style={styles.sectionHead}><Text style={styles.number}>01</Text><Text style={styles.sectionTitle}>Policy source & ownership</Text></View>
    <View style={styles.fields}>{policy.slice(0,4).map(item=><View key={item.key} style={styles.sourceCell}>
      {field(item,true)}
      {!isMotor&&item.key==='intermediaryType'?sourceMeta('rmName','RM'):null}
      {!isMotor&&item.key==='leadSource'?sourceMeta('intermediaryCode','Lead source ID'):null}
    </View>)}</View>
  </View>;
  const productSection=(number:string,title:string,items:ProductField[])=><View style={styles.section} key={number+'-'+title}>
    <View style={styles.sectionHead}><Text style={styles.number}>{number}</Text><Text style={styles.sectionTitle}>{title}</Text></View>
    <View style={styles.fields}>{items.map(detailField)}</View>
  </View>;
  const section=(number:string,title:string,items:Field[])=><View style={styles.section} key={number}>
    <View style={styles.sectionHead}>{number?<Text style={styles.number}>{number}</Text>:null}<Text style={styles.sectionTitle}>{title}</Text></View>
    <View style={styles.fields}>{items.map(item=>field(item))}</View>
  </View>;
  const motorVehicleFields:Field[]=[
    {key:'insuredName',label:'Insured name',required:true},
    {key:'phoneNo',label:'Phone number',required:true},
    {key:'vehicleClass',label:'Class',required:true,options:['PCP','TWP','PCV','GCV','CPM','MISD']},
    {key:'make',label:'Make',required:true},
    {key:'model',label:'Model',required:true},
    {key:'fuelType',label:'Fuel type',options:['Petrol','Diesel','CNG','Electric','Hybrid','Bi-Fuel','Other']},
    {key:'manufacturingYear',label:'Year of manufacturing'},
    {key:'capacity',label:draft?.vehicleClass==='PCV'?'Capacity (seats)':draft?.vehicleClass==='GCV'||draft?.vehicleClass==='CPM'?'Capacity (GVW)':draft?.fuelType==='Electric'?'Capacity (kW)':'Capacity (CC)'},
    {key:'chassisNo',label:'Chassis number',required:draft?.registrationMode==='unregistered'},
    {key:'engineNo',label:'Engine number',required:draft?.registrationMode==='unregistered'},
  ];
  const motorProductFields:Field[]=[
    {key:'policyProduct',label:'Policy product',required:true},
    {key:'policyNo',label:'Policy number',required:true},
    {key:'insurerId',label:'Insurance company',required:true},
    {key:'idv',label:'IDV',required:true},
    {key:'od',label:'OD premium',required:true},
    {key:'addOnPremium',label:'Add-on premium'},
    {key:'tp',label:'TP premium',required:draft?.policyProduct!=='SAOD'&&draft?.vehicleClass!=='CPM'},
    {key:'cpa',label:'CPA amount',required:draft?.vehicleClass==='GCV'},
    {key:'validFrom',label:'Validity from',required:true},
    {key:'validUpto',label:'Validity up to',required:true},
    ...(draft?.policyProduct==='Bundled'&&['PCP','TWP'].includes(draft?.vehicleClass??'')?[
      {key:'tpValidUpto' as FieldKey,label:'TP validity up to',required:true},
      {key:'cpaValidUpto' as FieldKey,label:'CPA validity up to',required:true},
    ]:[]),
  ];
  const registrationValid=Boolean(draft?.registrationNo.trim()&&/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/i.test(draft.registrationNo.replace(/[ -]/g,'')));
  const motorVehicleSection=<View style={styles.section}>
    <View style={styles.sectionHead}>
      <Text style={styles.number}>02</Text>
      <Text style={[styles.sectionTitle,styles.headingFlex]} numberOfLines={1}>Insured & vehicle</Text>
      <View style={styles.registrationToggle}>
        {(['registered','unregistered'] as const).map(mode=><Pressable key={mode}
          accessibilityRole="button" accessibilityLabel={mode==='registered'?'Registered':'Unregistered'}
          accessibilityState={{selected:draft?.registrationMode===mode}}
          onPress={()=>update('registrationMode',mode)}
          style={[styles.toggleButton,draft?.registrationMode===mode&&styles.toggleActive]}>
          <Text style={[styles.toggleText,draft?.registrationMode===mode&&styles.toggleActiveText]}>{mode==='registered'?'Registered':'Unregistered'}</Text>
        </Pressable>)}
      </View>
    </View>
    {draft?.registrationMode==='registered'?<View style={styles.registrationBlock}>
      <Text style={styles.label}>Registration No. <Text style={styles.star}>*</Text></Text>
      <View style={styles.registrationRow}>
        <TextInput accessibilityLabel="Registration number" value={draft.registrationNo}
          autoCapitalize="characters"
          onChangeText={value=>update('registrationNo',value.toUpperCase().replace(/\s/g,''))}
          style={styles.registrationInput}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Fetch RC details"
          disabled={lookingUpRc||!registrationValid}
          accessibilityState={{disabled:lookingUpRc||!registrationValid}}
          onPress={()=>void fetchRc()} style={[styles.rcButton,(lookingUpRc||!registrationValid)&&styles.rcButtonDisabled]}>
          {lookingUpRc?<ActivityIndicator color="#FFFFFF" size="small"/>:<Ionicons name="scan-outline" size={19} color="#FFFFFF"/>}
        </Pressable>
      </View>
    </View>:null}
    <View style={styles.fields}>
      {motorVehicleFields.slice(0,7).map(item=>field(item))}
      <View style={styles.field}>
        <Text style={styles.label}>RTO {draft?.vehicleClass==='CPM'?null:<Text style={styles.star}>*</Text>}</Text>
        <View style={styles.rtoRow}>
          <TextInput accessibilityLabel="RTO state" value={draft?.rtoState??''} onChangeText={value=>update('rtoState',value)} style={[styles.input,styles.rtoInput]}/>
          <TextInput accessibilityLabel="RTO name" value={draft?.rtoName??''} onChangeText={value=>update('rtoName',value)} style={[styles.input,styles.rtoInput]}/>
        </View>
      </View>
      {motorVehicleFields.slice(7).map(item=>field(item))}
    </View>
  </View>;
  const motorProductSection=section('03','Policy product, premium & validity',motorProductFields);
  return <PartnerScreen title="Policy Onboarding" eyebrow="POLICY INTAKE" onBack={()=>router.back()} navyTopBar navyStatusBar topBarIcon="document-text-outline">
    {loading?<View style={styles.wait}><ActivityIndicator color="#2843A9"/><Text style={styles.muted}>Loading saved Policy Onboarding…</Text></View>:null}
    {error?<View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color="#B42318"/><Text style={styles.errorText}>{error}</Text></View>:null}
    {!loading&&!draft?<Pressable style={styles.retry} onPress={()=>void load()}><Text style={styles.retryText}>Retry loading</Text></Pressable>:null}
    {draft?<>
      <View style={styles.status}><View><Text style={styles.intake}>{data?.intake_number||'Policy Intake'}</Text><Text style={styles.draftStatus}>{dirty?'Unsaved changes':'Draft'}</Text></View><View style={styles.progress}><Text style={styles.progressText}>{filled}%</Text></View></View>
      {sourceSection()}
      {isMotor?motorVehicleSection:productSection('02',productType==='Non Motor'?'Customer & policy':'Customer / Proposer',productType==='Non Motor'?[...commonPerson,...otherPolicy]:commonPerson)}
      {isMotor?motorProductSection:productType==='Non Motor'?productSection('03','Risk details',riskFields[productValues.category]??riskFields.Other):productSection('03','Policy product & case details',lifeProduct)}
      {!isMotor?productSection('04',productType==='Non Motor'?'Cover, premium & validity':'Premium & payment',productType==='Non Motor'?otherPremium:lifePremium):null}
      {!isMotor&&productType==='Non Motor'?productSection('05','Additional policy details',productExtras):null}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="chatbox-ellipses-outline" size={18} color="#254C83"/>
          <Text style={styles.sectionTitle}>Remarks</Text>
        </View>
        <View style={styles.remarkBody}>
          <Text style={styles.notice}>Add a remark to this policy onboarding draft.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add Remark" style={styles.remarkButton} onPress={()=>{
            setRemarkText(isMotor?draft.remarks:productValues.remarks||'');
            setRemarkOpen(true);
          }}>
            <Ionicons name="chatbox-text-outline" size={16} color="#17365D"/>
            <Text style={styles.remarkButtonText}>{(isMotor?draft.remarks:productValues.remarks)?.trim()?'Edit Remark':'Add Remark'}</Text>
          </Pressable>
          {(isMotor?draft.remarks:productValues.remarks)?.trim()?<Text style={styles.remarkPreview} numberOfLines={3}>{isMotor?draft.remarks:productValues.remarks}</Text>:null}
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="pie-chart-outline" size={18} color="#254C83"/>
          <Text style={styles.sectionTitle}>Onboarding summary</Text>
          <View style={styles.summaryProgress}><Text style={styles.progressText}>{filled}%</Text></View>
        </View>
        <View style={styles.summary}>
          <View style={styles.summaryStatusRow}><View><Text style={styles.summaryCaption}>POLICY STATUS</Text><Text style={styles.summaryTitle}>Onboarding summary</Text></View><Text style={styles.summaryStatusValue}>In progress</Text></View>
          {isMotor?<View style={styles.premiumRows}>
            {[{label:'Net premium',value:net},{label:'GST',value:gst},{label:'Gross premium',value:gross}].map(row=><View key={row.label} style={styles.premiumRow}>
              <Text style={styles.premiumLabel}>{row.label}</Text><Text style={styles.premiumValue}>{rupees(row.value)}</Text>
            </View>)}
          </View>:<>
            <Text style={styles.muted}>{productType==='Non Motor'?'Gross premium':'Premium'}</Text>
            <Text style={styles.total}>₹{amount(productValues[productType==='Non Motor'?'grossPremium':'premiumAmount']||'0').toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</Text>
          </>}
        </View>
        {!isMotor&&data?.commercialAccess?<View style={styles.commercialBody}>
          <Pressable accessibilityRole="button" accessibilityLabel="Payin–Payout" accessibilityState={{expanded:commercialExpanded}}
            onPress={()=>setCommercialExpanded(open=>!open)} style={styles.commercialToggle}>
            <Ionicons name="cash-outline" size={17} color="#254C83"/><Text style={styles.commercialToggleTitle}>Payin–Payout</Text>
            <Ionicons name={commercialExpanded?'chevron-up':'chevron-down'} size={16} color="#63758D"/>
          </Pressable>
          {commercialExpanded?<Text style={styles.notice}>Life, Health and Non Motor commercial calculations must be completed and approved in the Operations Portal. The native form does not submit these figures.</Text>:null}
        </View>:null}
        {isMotor&&data?.commercialAccess?<View style={styles.commercialCards}>
          <Text style={styles.commercialHeading}>Payin–Payout</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Insurer Pay-In popup"
            onPress={()=>setCommercialModal('payin')} style={styles.commercialAction}>
            <Ionicons name="arrow-down-circle-outline" size={19} color="#147D73"/>
            <Text style={styles.commercialActionTitle}>Insurer Pay-In</Text>
            <Text style={styles.commercialActionValue}>{draft.projectedOdPercent||draft.projectedTpPercent||draft.insurerScheme?rupees(payinTotal):'Not entered'}</Text>
            <Ionicons name="chevron-forward" size={15} color="#63758D"/>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Partner Payout popup"
            onPress={()=>setCommercialModal('payout')} style={styles.commercialAction}>
            <Ionicons name="wallet-outline" size={19} color="#7452BA"/>
            <Text style={styles.commercialActionTitle}>Partner Payout</Text>
            <Text style={styles.commercialActionValue}>{draft.payoutOdPercent||draft.payoutTpPercent||draft.flatPayoutAmount?rupees(payoutTotal):'Not entered'}</Text>
            <Ionicons name="chevron-forward" size={15} color="#63758D"/>
          </Pressable>
        </View>:null}
        {isMotor&&data?.commercialAccess?<View style={styles.retentionSummary}><Text style={styles.summaryCaption}>PROJECTED RETENTION · AFTER 10% TDS</Text><Text style={styles.premiumValue}>{rupees(payinTotal*.9-payoutTotal)}</Text></View>:null}
        <View style={styles.summaryDocuments}>
          <Text style={styles.commercialToggleTitle}>Documents</Text>
          <Text style={styles.muted}>Submitted policy copy</Text>
        </View>
        {!isMotor?<Text style={styles.notice}>Final booking and documents are completed in the Operations Portal.</Text>:null}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="cloud-upload-outline" size={18} color="#254C83"/>
          <Text style={styles.sectionTitle}>Upload Forms</Text>
        </View>
        <Text style={styles.notice}>{isMotor?'Form uploads are available in Operations Portal.':'Form uploads and final booking require Operations Portal.'}</Text>
        <Pressable accessibilityRole="button" disabled={viewingCopy} style={[styles.secondary,styles.documentAction]} onPress={()=>void openCopy()}>
          <Ionicons name="document-text-outline" size={17} color="#25466E"/>
          <Text style={styles.secondaryText}>{viewingCopy?'Opening document…':'View submitted policy copy'}</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving} style={styles.secondary} onPress={()=>void save(true)}><Text style={styles.secondaryText}>{saving?'Saving…':'Save & return to Intake'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving||!dirty} style={[styles.primary,(saving||!dirty)&&styles.disabled]} onPress={()=>void save()}><Text style={styles.primaryText}>{saving?'Saving…':'Save draft'}</Text></Pressable>
      </View>
      {isMotor?<Pressable accessibilityRole="button" disabled={booking||saving||!data} style={[styles.primary,(booking||saving)&&styles.disabled,styles.bookButton]} onPress={()=>void completeBooking()}>
        {booking?<ActivityIndicator size="small" color="white"/>:<Ionicons name="checkmark-circle-outline" size={18} color="white"/>}
        <Text style={styles.primaryText}>{booking?'Checking & booking…':'Book Active Policy'}</Text>
      </Pressable>:<View style={styles.bookingNotice}><Ionicons name="information-circle-outline" size={17} color="#8A5A17"/><Text style={styles.bookingText}>Draft saving is available for {productType}. Final case creation, documents, risk validation and permission-controlled commercials must be completed in the Operations Portal.</Text></View>}

    </>:null}

    <Modal transparent visible={Boolean(commercialModal)&&isMotor&&Boolean(data?.commercialAccess)}
      animationType="slide" onRequestClose={()=>setCommercialModal(null)}>
      <View style={styles.scrim}>
        <View style={styles.commercialSheet}>
          <View style={styles.sheetTitle}>
            <Text style={styles.sectionTitle}>{commercialModal==='payin'?'Projected Insurer Pay-in':'Partner Payout'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close commercial popup" onPress={()=>setCommercialModal(null)}>
              <Ionicons name="close" size={22} color="#4C5970"/>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.commercialModalContent}>
            {commercialModal==='payin'?<>
              <View style={styles.fields}>{insurerPayinFields.map(f=><View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput accessibilityLabel={f.label} value={String(draft?.[f.key]??'')} onChangeText={v=>update(f.key,v)}
                  keyboardType="decimal-pad" style={styles.input}/>
              </View>)}</View>
              <View style={styles.calculatedRow}><Text style={styles.premiumLabel}>Projected total pay-in</Text><Text style={styles.premiumValue}>{rupees(payinTotal)}</Text></View>
              <View style={styles.calculatedRow}><Text style={styles.premiumLabel}>TDS @ 10%</Text><Text style={styles.premiumValue}>{rupees(payinTotal*.1)}</Text></View>
              <View style={styles.calculatedRow}><Text style={styles.premiumLabel}>Pay-in after TDS</Text><Text style={styles.premiumValue}>{rupees(payinTotal*.9)}</Text></View>
              <Text style={styles.modalHelp}>These are projected values, not an insurer bill or recognized receipt. Empty values remain unentered.</Text>
            </>:<>
              <View style={styles.fields}>
                {partnerPayoutFields.filter(f=>f.key!=='flatPayoutAmount'||draft?.payoutBasis==='FLAT').map(f=>
                  f.key==='payoutBasis'?field(f):<View key={f.key} style={styles.field}>
                    <Text style={styles.label}>{f.label}</Text>
                    <TextInput accessibilityLabel={f.label} value={String(draft?.[f.key]??'')}
                      editable={f.key==='flatPayoutAmount'||(draft?.payoutBasis!=='FLAT'&&(f.key!=='payoutTpPercent'||draft?.payoutBasis==='NET'))}
                      onChangeText={v=>update(f.key,v)} keyboardType="decimal-pad"
                      style={[styles.input,(f.key!=='flatPayoutAmount'&&(draft?.payoutBasis==='FLAT'||f.key==='payoutTpPercent'&&draft?.payoutBasis!=='NET'))&&styles.readonlyInput]}/>
                  </View>
                )}
              </View>
              <View style={styles.calculatedRow}><Text style={styles.premiumLabel}>Total agreed payout</Text><Text style={styles.premiumValue}>{rupees(payoutTotal)}</Text></View>
              <View style={styles.calculatedRow}><Text style={styles.premiumLabel}>Projected retention</Text><Text style={styles.premiumValue}>{rupees(payinTotal*.9-payoutTotal)}</Text></View>
              <Text style={styles.modalHelp}>Payout approval, voucher and settlement remain in the existing partner-payment workflow.</Text>
            </>}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Save and close commercial popup" onPress={()=>setCommercialModal(null)}
            style={styles.commercialSave}><Text style={styles.primaryText}>Save & Close</Text></Pressable>
        </View>
      </View>
    </Modal>
    <Modal transparent visible={remarkOpen} animationType="fade" onRequestClose={()=>setRemarkOpen(false)}>
      <View style={styles.remarkScrim}>
        <View style={styles.remarkSheet}>
          <View style={styles.remarkHeader}>
            <View style={styles.remarkTitleRow}><Ionicons name="chatbox-text-outline" size={18} color="#17365D"/><Text style={styles.sectionTitle}>Add Remark</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close remark" onPress={()=>setRemarkOpen(false)}><Ionicons name="close" size={21} color="#64748B"/></Pressable>
          </View>
          <Text style={styles.remarkLabel}>New remark</Text>
          <TextInput accessibilityLabel="New remark" multiline textAlignVertical="top" value={remarkText}
            onChangeText={setRemarkText} maxLength={4000} placeholder="Enter a new remark"
            placeholderTextColor="#97A5B7" style={styles.remarkInput}/>
          <View style={styles.remarkActions}>
            <Pressable accessibilityRole="button" style={styles.remarkCancel} onPress={()=>setRemarkOpen(false)}><Text style={styles.remarkCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={!remarkText.trim()} style={[styles.remarkConfirm,!remarkText.trim()&&styles.disabled]}
              onPress={()=>{
                if(!remarkText.trim())return;
                if(isMotor)update('remarks',remarkText.trim());
                else updateProduct('remarks',remarkText.trim());
                setRemarkOpen(false);
              }}><Text style={styles.primaryText}>Add Remark</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
    <Modal transparent visible={dateApprovalOpen} animationType="fade" onRequestClose={()=>setDateApprovalOpen(false)}>
      <View style={styles.scrim}><View style={styles.sheet}>
        <View style={styles.sheetTitle}><Text style={styles.sectionTitle}>Policy Date Approval</Text><Pressable onPress={()=>setDateApprovalOpen(false)} accessibilityLabel="Close approval"><Ionicons name="close" size={21} color="#4C5970"/></Pressable></View>
        <Text style={styles.notice}>Select an authorised officer. An approval code will be emailed to them. Obtain approval before using the code.</Text>
        {!approvalRequestId ? <>
          {(data?.approvers??[]).map(approver=><Pressable key={approver.key} onPress={()=>setApproverKey(approver.key)} style={styles.choice}><Text style={styles.choiceText}>{approverKey===approver.key?'● ':'○ '}{approver.name}</Text></Pressable>)}
          <Pressable disabled={approvalBusy||!approverKey} style={[styles.primary,styles.bookButton]} onPress={()=>void requestApproval()}><Text style={styles.primaryText}>{approvalBusy?'Sending…':'Send Approval Request'}</Text></Pressable>
        </> : <>
          <TextInput accessibilityLabel="Six-digit approval code" keyboardType="numeric" maxLength={6} value={approvalCode} onChangeText={setApprovalCode} style={styles.input}/>
          <Pressable disabled={approvalBusy||approvalCode.length!==6} style={[styles.primary,styles.bookButton]} onPress={()=>void verifyApproval()}><Text style={styles.primaryText}>{approvalBusy?'Checking…':'Verify Approval'}</Text></Pressable>
        </>}
      </View></View>
    </Modal>
    <Modal transparent visible={Boolean(picker)} animationType="fade" onRequestClose={()=>setPicker(null)}>
      <View style={styles.scrim}><View style={styles.sheet}>
        <View style={styles.sheetTitle}><Text style={styles.sectionTitle}>Select {picker?.key}</Text><Pressable onPress={()=>setPicker(null)} accessibilityLabel="Close options"><Ionicons name="close" size={21} color="#4C5970"/></Pressable></View>
        <ScrollView style={styles.choiceScroll}>{picker?.items.map(item=><Pressable key={item.value} style={styles.choice} onPress={()=>{picker?.product?updateProduct(picker.key,item.value):update(picker!.key as FieldKey,item.value);setPicker(null);}}><Text style={styles.choiceText}>{item.label}</Text></Pressable>)}</ScrollView>
      </View></View>
    </Modal>
  </PartnerScreen>;
}
const styles=StyleSheet.create({
  wait:{padding:28,alignItems:'center',gap:12},muted:{fontSize:11,color:'#738196',lineHeight:17},
  error:{flexDirection:'row',gap:8,backgroundColor:'#FFF0EF',padding:12,borderRadius:11,marginBottom:10},errorText:{flex:1,color:'#A32924',fontSize:12},
  retry:{padding:14,backgroundColor:'#DFE8FF',borderRadius:10,alignItems:'center'},retryText:{color:'#1B397A',fontWeight:'700'},
  status:{backgroundColor:'#FFFFFF',borderRadius:13,borderWidth:1,borderColor:'#DFE6F1',padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:9},draftStatus:{fontSize:10,color:'#738196',marginTop:2},
  intake:{color:'#1C375D',fontWeight:'800',fontSize:14},progress:{borderRadius:20,backgroundColor:'#EAEFFA',paddingVertical:6,paddingHorizontal:10},progressText:{color:'#324D9E',fontWeight:'700',fontSize:11},
  section:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DFE6F0',borderRadius:13,marginBottom:11,overflow:'hidden'},
  sectionHead:{flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:13,paddingVertical:12,backgroundColor:'#EAF1FA'},
  number:{fontSize:11,color:'#355EA0',fontWeight:'800'},sectionTitle:{fontSize:13,color:'#1B385B',fontWeight:'800'},
  headingFlex:{flex:1,minWidth:0},
  registrationToggle:{flexDirection:'row',borderWidth:1,borderColor:'#C6D4E6',borderRadius:8,overflow:'hidden',backgroundColor:'#FFFFFF'},
  toggleButton:{paddingHorizontal:7,paddingVertical:8},toggleActive:{backgroundColor:'#17365D'},
  toggleText:{fontSize:9,fontWeight:'700',color:'#17365D'},toggleActiveText:{color:'#FFFFFF'},
  registrationBlock:{paddingHorizontal:12,paddingTop:12,gap:5},
  registrationRow:{height:42,flexDirection:'row',borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,overflow:'hidden'},
  registrationInput:{flex:1,minWidth:0,paddingHorizontal:11,fontSize:12,color:'#183653'},
  rcButton:{width:48,backgroundColor:'#17365D',alignItems:'center',justifyContent:'center'},
  rcButtonDisabled:{backgroundColor:'#A8B4C3'},
  rtoRow:{flexDirection:'row',gap:5},rtoInput:{flex:1,minWidth:0,paddingHorizontal:6},
  fieldMeta:{fontSize:9,color:'#315B85',fontWeight:'600'},premiumRows:{gap:0},
  premiumRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:9,borderBottomWidth:1,borderColor:'#E9EFF6'},
  premiumLabel:{fontSize:11,color:'#65758E'},premiumValue:{fontSize:12,color:'#183653',fontWeight:'800'},
  fields:{padding:12,flexDirection:'row',flexWrap:'wrap',columnGap:10,rowGap:11},field:{width:'48%',minWidth:0,gap:5},sourceCell:{width:'48%',minWidth:0,gap:3},sourcePrimary:{width:'100%'},sourceMeta:{minHeight:23,flexDirection:'row',alignItems:'center',gap:5},sourceMetaLabel:{fontSize:9,fontWeight:'700',color:'#72839C'},sourceMetaInput:{flex:1,minWidth:0,fontSize:10,color:'#25466E',fontWeight:'600',paddingVertical:2,paddingHorizontal:1},wideField:{width:'100%'},label:{fontSize:10,color:'#65758E',fontWeight:'700'},star:{color:'#B93333'},
  input:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',backgroundColor:'#FFFFFF',borderRadius:9,paddingHorizontal:11,fontSize:12,color:'#183653'},
  inputRow:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  value:{color:'#183653',fontSize:12,flex:1},placeholder:{color:'#97A5B7'},
  commercialCards:{marginHorizontal:12,marginBottom:12,gap:8},
  commercialHeading:{fontSize:11,color:'#26436B',fontWeight:'800'},
  commercialAction:{minHeight:48,flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:11,borderWidth:1,borderColor:'#DDE6F0',borderRadius:10,backgroundColor:'#F8FAFD'},
  commercialActionTitle:{flex:1,fontSize:11,fontWeight:'700',color:'#17365D'},
  commercialActionValue:{fontSize:10,color:'#53657D',fontWeight:'600'},
  commercialSheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:20,borderTopRightRadius:20,padding:16,maxHeight:'85%',gap:8},
  commercialModalContent:{paddingBottom:12},modalHelp:{fontSize:10,lineHeight:16,color:'#718097',paddingHorizontal:12,paddingVertical:10},
  calculatedRow:{flexDirection:'row',justifyContent:'space-between',padding:12,borderTopWidth:1,borderColor:'#E1E9F3'},
  readonlyInput:{backgroundColor:'#F3F6FA',color:'#738196'},
  commercialSave:{backgroundColor:'#17365D',borderRadius:10,padding:13,alignItems:'center'},
  summary:{padding:14,gap:7},summaryTitle:{fontSize:13,color:'#17365D',fontWeight:'800',marginTop:3},retentionSummary:{marginHorizontal:12,marginBottom:10,padding:12,backgroundColor:'#F5F8FD',borderRadius:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},summaryStatusRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},summaryStatusValue:{fontSize:10,fontWeight:'700',color:'#A96A00'},summaryCaption:{fontSize:10,fontWeight:'700',color:'#426188'},summaryProgress:{marginLeft:'auto',backgroundColor:'#E1EAF8',borderRadius:18,paddingHorizontal:9,paddingVertical:5},commercialToggle:{marginHorizontal:12,marginBottom:9,flexDirection:'row',alignItems:'center',gap:8,padding:11,borderWidth:1,borderColor:'#DDE6F0',borderRadius:10,backgroundColor:'#F8FAFD'},commercialToggleTitle:{flex:1,color:'#26436B',fontSize:11,fontWeight:'700'},commercialBody:{paddingHorizontal:12},summaryDocuments:{marginHorizontal:12,marginBottom:11,padding:12,flexDirection:'row',alignItems:'center',gap:10,borderColor:'#E1E9F3',borderWidth:1,borderRadius:10},documentAction:{marginHorizontal:12,marginBottom:12,flexDirection:'row',gap:8},total:{fontSize:20,color:'#1B385B',fontWeight:'800'},notice:{fontSize:10,lineHeight:16,color:'#65758E',paddingHorizontal:14,paddingBottom:13},
  remarkBody:{padding:12,gap:8},remarkButton:{flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',padding:12,borderRadius:9,borderWidth:1,borderColor:'#CDD9EB'},remarkButtonText:{fontSize:12,fontWeight:'700',color:'#17365D'},remarkPreview:{fontSize:11,color:'#53657D',lineHeight:17},remarkScrim:{flex:1,backgroundColor:'rgba(5,18,40,.5)',alignItems:'center',justifyContent:'center',padding:20},remarkSheet:{width:'100%',maxWidth:520,backgroundColor:'#FFFFFF',borderRadius:16,padding:18,gap:15},remarkHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:12,borderBottomWidth:1,borderColor:'#E6EDF5'},remarkTitleRow:{flexDirection:'row',alignItems:'center',gap:9},remarkLabel:{fontSize:11,color:'#40516B'},remarkInput:{minHeight:130,borderWidth:1,borderColor:'#A0B5E4',borderRadius:10,padding:12,fontSize:12,color:'#17365D'},remarkActions:{flexDirection:'row',justifyContent:'flex-end',gap:8},remarkCancel:{padding:12,borderRadius:10,borderWidth:1,borderColor:'#CDD9EB'},remarkCancelText:{fontSize:11,color:'#17365D'},remarkConfirm:{padding:12,backgroundColor:'#17365D',borderRadius:10},
  actions:{flexDirection:'row',gap:8,marginBottom:11},secondary:{flex:1,borderWidth:1,borderColor:'#CDD9EB',borderRadius:10,padding:13,alignItems:'center'},secondaryText:{fontWeight:'700',fontSize:11,color:'#25466E'},
  primary:{flex:1,backgroundColor:'#243F9E',borderRadius:10,padding:13,alignItems:'center'},primaryText:{fontSize:11,fontWeight:'800',color:'white'},disabled:{opacity:.48},
  bookButton:{marginBottom:11,flexDirection:'row',justifyContent:'center',gap:8},
  bookingNotice:{flexDirection:'row',gap:9,padding:12,backgroundColor:'#FFF7E9',borderRadius:10,marginBottom:14},bookingText:{flex:1,fontSize:10,lineHeight:16,color:'#75531C'},
  scrim:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(5,18,40,.5)'},sheet:{backgroundColor:'white',borderTopLeftRadius:20,borderTopRightRadius:20,padding:17,maxHeight:'70%'},
  sheetTitle:{flexDirection:'row',justifyContent:'space-between',paddingBottom:12},choiceScroll:{maxHeight:420},
  choice:{minHeight:44,justifyContent:'center',borderTopWidth:1,borderColor:'#EEF1F7'},choiceText:{fontSize:12,color:'#284064'},
});
