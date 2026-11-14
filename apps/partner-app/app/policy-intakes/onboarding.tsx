import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import { createPartnerPolicyIntakeBridgeUrl } from '@/lib/policy-intakes';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerPolicyDateField } from '@/components/policy-intakes/partner-policy-date-field';
import { motorValidityEnds } from '@/lib/motor-validity-dates';
import { prepareNativePolicyOnboarding, saveNativePolicyOnboarding, bookNativePolicyOnboarding, createNativeLifeHealthCase, requestNativePolicyDateApproval, verifyNativePolicyDateApproval, lookupNativePolicyRc, searchNativeNonMotorCustomers, type NativeNonMotorCustomer, type NativePolicyDraft, type NativeOnboardingData, type NativeProductType } from '@/lib/policy-onboarding';

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
  {key:'policyProduct',label:'Policy product',required:true,options:['Comprehensive','Third Party','SAOD','Bundled','Long Term Package','Long Term Third Party']},
  {key:'policyNo',label:'Policy number',required:true},
  {key:'validFrom',label:'Validity from (YYYY-MM-DD)',required:true},
  {key:'validUpto',label:'Validity up to (YYYY-MM-DD)',required:true},
];
type ProductField = {key:string;label:string;required?:boolean;options?:string[];date?:boolean;wide?:boolean};
const yearOptions=Array.from({length:100},(_,i)=>i===0?'1 Year':(i+1)+' Years');
// Use the same descending year range as Operations Portal Motor onboarding.
const manufacturingYearOptions=Array.from({length:new Date().getFullYear()-1900+1},(_,i)=>String(new Date().getFullYear()-i));
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
  {key:'policyNumber',label:'Policy number',required:true},
  {key:'insurerId',label:'Insurance company',required:true},
  {key:'productName',label:'Product / policy name',required:true},
  {key:'category',label:'Non-Motor category',required:true,options:nonMotorCategories},
  {key:'status',label:'Policy status',options:['Active','Pending','Expired','Cancelled']},
];
const nonMotorNewCustomerFields:ProductField[]=[
  {key:'customerType',label:'Customer type',options:['Organisation','Individual']},
  {key:'insuredName',label:'Insured / organisation name',required:true},
  {key:'contactName',label:'Contact person'},
  {key:'phone',label:'Mobile number',required:true},
  {key:'email',label:'Email'},
  {key:'address',label:'Address'},
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
  {key:'warranties',label:'Warranties',wide:true},
  {key:'specialConditions',label:'Special conditions',wide:true},
  {key:'endorsements',label:'Endorsements',wide:true},
  {key:'remarks',label:'Remarks',wide:true},
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
  const [creatingLifeHealth,setCreatingLifeHealth]=useState(false);
  const [lookingUpRc,setLookingUpRc]=useState(false);
  const [dateApprovalOpen,setDateApprovalOpen]=useState(false);
  const [approvalBusy,setApprovalBusy]=useState(false);
  const [approverKey,setApproverKey]=useState("");
  const [approvalRequestId,setApprovalRequestId]=useState<string|null>(null);
  const [verifiedApprovalId,setVerifiedApprovalId]=useState<string|null>(null);
  const [approvalCode,setApprovalCode]=useState("");
  const [picker,setPicker]=useState<{key:string;items:{value:string;label:string}[];product?:boolean}|null>(null);
  const [dirty,setDirty]=useState(false);
  const [nonMotorAdditionalOpen,setNonMotorAdditionalOpen]=useState(false);
  const [customerSearch,setCustomerSearch]=useState('');
  const [customerChoices,setCustomerChoices]=useState<NativeNonMotorCustomer[]>([]);
  const [customerSearchBusy,setCustomerSearchBusy]=useState(false);
  const [customerSearchError,setCustomerSearchError]=useState('');
  const [commercialModal,setCommercialModal]=useState<'payin'|'payout'|null>(null);
  const [remarkOpen,setRemarkOpen]=useState(false);
  const [remarkText,setRemarkText]=useState('');
  const [remarkError,setRemarkError]=useState('');
  const [payinSummaryExpanded,setPayinSummaryExpanded]=useState(false);
  const [payoutBasisExpanded,setPayoutBasisExpanded]=useState(false);
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
  const nonMotorCustomerMode=productValues.customerMode==='new'?'new':'existing';
  const setNonMotorCustomerMode=(mode:'existing'|'new')=>{
    setDraft(current=>current?{...current,productDrafts:{...current.productDrafts,
      'Non Motor':{...current.productDrafts?.['Non Motor'],customerMode:mode,customerId:'',
        ...(mode==='new'&&!current.productDrafts?.['Non Motor']?.customerType?{customerType:'Organisation'}:{}),
        ...(mode==='new'?{insuredName:'',contactName:'',phone:'',email:'',address:''}:{})}
    }}:current);
    setCustomerChoices([]);setCustomerSearch('');setCustomerSearchError('');setDirty(true);
  };
  async function findNonMotorCustomers(){
    if(!id||customerSearch.trim().length<2)return;
    setCustomerSearchBusy(true);setCustomerSearchError('');setCustomerChoices([]);
    try{
      const result=await searchNativeNonMotorCustomers(id,customerSearch.trim());
      setCustomerChoices(result.customers);
    }catch{setCustomerSearchError('Customer search is unavailable. Please try again.');}
    finally{setCustomerSearchBusy(false);}
  }
  const selectNonMotorCustomer=(customer:NativeNonMotorCustomer)=>{
    setDraft(current=>current?{...current,productDrafts:{...current.productDrafts,
      'Non Motor':{...current.productDrafts?.['Non Motor'],customerMode:'existing',customerId:customer.id,
        insuredName:customer.name,contactName:customer.contactName,phone:customer.phone,email:customer.email}
    }}:current);
    setCustomerSearch(customer.name);setCustomerChoices([]);setDirty(true);
  };
  const updateProduct=(key:string,value:string)=>{
    if(productType==='Motor')return;
    setDraft(current=>current?{...current,productDrafts:{
      ...current.productDrafts,[productType]:{
        ...current.productDrafts?.[productType],...(productType==='Non Motor'&&!current.productDrafts?.[productType]?.status?{status:'Active'}:{}),[key]:value,
        ...(productType==='Non Motor'&&['netPremium','gstAmount'].includes(key)&&
          (value.trim()||current.productDrafts?.[productType]?.[key==='netPremium'?'gstAmount':'netPremium']?.trim())?{
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
      // Keep the saved registration number in draft; Unregistered mode shows a disabled field.
      if(key==='vehicleClass'&&value!==current.vehicleClass)next.policyProduct='';
      // Mirror website date defaults, including Bundled PCP/TWP OD, TP and CPA periods.
      // Calculate only on explicit edits; loading saved drafts never replaces saved end dates.
      if(key==='validFrom'||key==='policyProduct'||(key==='vehicleClass'&&value!==current.vehicleClass)){
        Object.assign(next,motorValidityEnds(
          key==='validFrom'?value:current.validFrom,
          key==='vehicleClass'?value:current.vehicleClass,
          key==='policyProduct'?value:next.policyProduct,
        ));
      }
      if(key==='vehicleClass'&&value==='CPM'){next.tp='0';next.cpa='0';next.cpaOpted='No';}
      if(key==='policyProduct'&&(value==='Third Party'||value==='Long Term Third Party')){next.idv='0';next.od='0';}
      if(key==='cpa')next.cpaOpted=amount(value)>0?'Yes':'No';
      return next;
    });
    setDirty(true);
    setVerifiedApprovalId(null);
    setApprovalRequestId(null);
  };
  const save=async(goBack=false):Promise<boolean>=>{
    if(!draft||!data||saving)return false;
    setSaving(true);setError('');
    try{
      const result=await saveNativePolicyOnboarding(id,data.revision,draft);
      setData(current=>current?{...current,revision:result.revision}:current);
      setDirty(false);
      if(goBack)router.back();
      return true;
    }catch(e){setError(e instanceof Error?e.message:'Draft could not be saved.');return false;}
    finally{setSaving(false);}
  };

  // The intake contract stores remarks as one string. Append instead of replacing
  // existing remarks; save the complete revision-checked draft before closing.
  async function addRemark(){
    const note=remarkText.trim();
    if(!note||!draft||!data||saving||booking)return;
    setRemarkError('');setSaving(true);
    const previous=(isMotor?draft.remarks:productValues.remarks||'').trim();
    const remarks=previous?previous+'\n\n'+note:note;
    const updated:NativePolicyDraft=isMotor
      ?{...draft,remarks}
      :{...draft,productDrafts:{
        ...draft.productDrafts,
        [productType]:{...draft.productDrafts?.[productType],remarks},
      }};
    try{
      const result=await saveNativePolicyOnboarding(id,data.revision,updated);
      setDraft(updated);
      setData(current=>current?{...current,revision:result.revision}:current);
      setDirty(false);
      setVerifiedApprovalId(null);
      setApprovalRequestId(null);
      setRemarkOpen(false);
      setRemarkText('');
    }catch(e){
      setRemarkError(e instanceof Error?e.message:'Remark could not be saved.');
    }finally{setSaving(false);}
  }

  const cancelOnboarding=()=>{
    if(saving||booking||creatingLifeHealth)return;
    if(dirty){
      Alert.alert('Discard unsaved changes?', 'Your latest changes have not been saved.',[
        {text:'Keep editing',style:'cancel'},
        {text:'Discard and leave',style:'destructive',onPress:()=>router.back()},
      ]);
    }else router.back();
  };
  const createLifeHealth=async()=>{
    if(!draft||!data||saving||booking||creatingLifeHealth)return;
    if(productType!=='Life'&&productType!=='Health')return;
    setCreatingLifeHealth(true);setError('');
    try{
      let revision=data.revision;
      if(dirty){
        const saved=await saveNativePolicyOnboarding(id,revision,draft);
        revision=saved.revision;
        setData(current=>current?{...current,revision}:current);
        setDirty(false);
      }
      const result=await createNativeLifeHealthCase(id,revision);
      Alert.alert('Case created',`${productType} case ${result.case.number} created. Policy issuance remains pending in Operations.`,[
        {text:'Return to Intake',onPress:()=>router.back()},
      ]);
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not create the Life/Health case. Check the case register before retrying.');
    }finally{setCreatingLifeHealth(false);}
  };
    const createActivePolicy=async()=>{
    if(isMotor){await completeBooking();return;}
    if(!draft||!data||saving||booking)return;
    // Non-Motor/Life/Health final booking is performed by the authorized Operations flow.
    // Saving a revision-checked draft first prevents silently discarding entered details.
    setBooking(true);setError('');
    try{
      if(dirty){
        const saved=await saveNativePolicyOnboarding(id,data.revision,draft);
        setData(current=>current?{...current,revision:saved.revision}:current);
        setDirty(false);
      }
      const url=await createPartnerPolicyIntakeBridgeUrl(id,false,null);
      await Linking.openURL(url);
    }catch(e){setError(e instanceof Error?e.message:'Could not open the authorized policy creation flow.');}
    finally{setBooking(false);}
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
  const productPremium=productType==='Non Motor'?amount(productValues.netPremium||productValues.grossPremium||'0'):amount(productValues.premiumAmount||'0');
  const productPayinBase=productValues.payinBasis==='FLAT'?amount(productValues.payinValue||'0'):productPremium*amount(productValues.payinValue||'0')/100;
  const productPayin=productPayinBase+amount(productValues.payinScheme||'0');
  const productPayout=productValues.partnerPayoutBasis==='FLAT'?amount(productValues.partnerPayoutValue||'0'):productPremium*amount(productValues.partnerPayoutValue||'0')/100;
  const summaryPayin=isMotor?payinTotal:productPayin;
  const summaryPayout=isMotor?payoutTotal:productPayout;
  const payinEntered=isMotor?Boolean(draft?.projectedOdPercent||draft?.projectedTpPercent||draft?.insurerScheme):Boolean(productValues.payinValue!==undefined&&productValues.payinValue!==''||productValues.payinScheme!==undefined&&productValues.payinScheme!=='');
  const payoutEntered=isMotor?Boolean(draft?.payoutOdPercent||draft?.payoutTpPercent||draft?.flatPayoutAmount):Boolean(productValues.partnerPayoutValue!==undefined&&productValues.partnerPayoutValue!=='');
  const projectedRetention=summaryPayin*.9-summaryPayout;
  const filled=useMemo(()=>{
    if(!draft)return 0;
    const required=isMotor?[...policy,...proposer,...vehicle,...productCaseFields,...premiumFields].filter(field=>field.required):[...policy.filter(f=>f.required),...proposer.filter(f=>f.required)];
    if(!isMotor){
      if(productType==='Non Motor'){
        const sourceRequired=policy.filter(f=>f.required).map(f=>draft[f.key]??'');
        const customerRequired=nonMotorCustomerMode==='existing'
          ? [productValues.customerId??'']
          : [productValues.insuredName??'',productValues.phone??''];
        const otherRequired=[...otherPolicy,...(productValues.category?riskFields[productValues.category]??riskFields.Other:[]),...otherPremium]
          .filter(f=>f.required).map(f=>productValues[f.key]??'');
        const values=[...sourceRequired,...customerRequired,...otherRequired];
        return Math.round(100*values.filter(value=>String(value).trim()).length/Math.max(1,values.length));
      }
      const details=[...lifeProduct,...lifePremium];
      const count=required.filter(f=>String(draft[f.key]??'').trim()).length+details.filter(f=>f.required&&String(productValues[f.key]??'').trim()).length;
      return Math.round(100*count/(required.length+details.filter(f=>f.required).length));
    }
    return Math.round(100*required.filter(f=>String(draft[f.key]??'').trim()).length/required.length);
  },[draft,productType,isMotor,productValues]);
  const field=(f:Field,fullWidth=false)=>{
    if(!draft)return null;
    const raw=draft[f.key];
    const current=typeof raw==='string'?raw:'';
    if(['issuanceDate','validFrom','validUpto','tpValidUpto','cpaValidUpto'].includes(f.key))return <PartnerPolicyDateField key={f.key} fullWidth={fullWidth} label={f.key==='issuanceDate'?'Policy issuance date':f.label.replace(' (YYYY-MM-DD)','')} value={current} required={f.required} onChange={v=>update(f.key,v)}/>;
    const productOptions=f.key==='policyProduct'?(draft.vehicleClass==='CPM'?['Comprehensive','SAOD']:['Comprehensive','Third Party','SAOD',...(['PCP','TWP'].includes(draft.vehicleClass)?['Bundled']:[]),'Long Term Package','Long Term Third Party']):f.options??[];
    const options=f.key==='insurerId'?data?.insurers??[]:f.key==='make'?(data?.manufacturers??[]).map(x=>({value:x,label:x})):f.key==='manufacturingYear'?manufacturingYearOptions.map(value=>({value,label:value})):productOptions.map(x=>({value:x,label:f.key==='policyProduct'&&x==='Comprehensive'?'Package':x}));
    const displayed=options.find(x=>x.value===current)?.label??current;
    const masterSourceMatches=Boolean(data?.sourceMeta&&data.sourceMeta.code===draft.intermediaryCode&&data.sourceMeta.name.trim().toLowerCase()===draft.leadSource.trim().toLowerCase());
    const matchedSource=masterSourceMatches?data?.sourceMeta:null;
    const restricted=isMotor&&(
      (f.key==='capacity'&&!draft.vehicleClass)||
      (f.key==='policyProduct'&&!draft.vehicleClass)||
      (['idv','od'].includes(f.key)&&['Third Party','Long Term Third Party'].includes(draft.policyProduct))||
      (['rtoState','rtoName'].includes(f.key)&&draft.vehicleClass==='CPM'));
    const hint=['idv','od','tp','cpa','addOnPremium'].includes(f.key)?'₹ 0.00':
      ['projectedOdPercent','projectedTpPercent','payoutOdPercent','payoutTpPercent'].includes(f.key)?'0.00':
      f.key==='capacity'&&!draft.vehicleClass?'Select class first':f.key==='manufacturingYear'?'Select year':f.key==='model'?'Model / variant':f.key==='insuredName'?'Customer / insured name':
      f.key==='phoneNo'?'10 digit mobile':'Enter '+f.label.toLowerCase();
    return <View key={f.key} style={[styles.field,fullWidth&&styles.sourcePrimary]}>
      <Text style={styles.label}>{f.label}{f.required?<Text style={styles.star}> *</Text>:null}</Text>
      {options.length?(
        <Pressable accessibilityRole="button" accessibilityLabel={f.label} accessibilityState={{disabled:restricted}}
          disabled={restricted} onPress={()=>setPicker({key:f.key,items:options})}
          style={[styles.inputRow,restricted&&styles.readonlyInput]}>
          <Text numberOfLines={1} style={[styles.value,!displayed&&styles.placeholder]}>{displayed||(f.key==='manufacturingYear'?'Select year':'Select '+f.label.toLowerCase())}</Text>
          <Ionicons name="chevron-down" size={15} color="#63758D"/>
        </Pressable>
      ):(
        <TextInput accessibilityLabel={f.label} value={current} editable={!restricted} placeholder={hint}
          placeholderTextColor="#98A6B8" onChangeText={v=>update(f.key,v)}
          autoCapitalize={['registrationNo','chassisNo','engineNo','policyNo'].includes(f.key)?'characters':'sentences'}
          keyboardType={['phoneNo','idv','od','tp','cpa','capacity','manufacturingYear'].includes(f.key)?'numeric':'default'}
          style={[styles.input,restricted&&styles.readonlyInput]} />
      )}
    </View>;
  };
  const detailField=(f:ProductField)=>{
    if(!draft)return null;
    if(productType!=='Non Motor'&&(f.key==='insuredName'||f.key==='phoneNo'))return field({key:f.key as FieldKey,label:f.label,required:f.required});
    const current=String(productValues[f.key]??(productType==='Non Motor'&&f.key==='status'?'Active':''));
    // Gross premium is editable in Operations; net+GST may prefill it without locking the field.
    if(f.date)return <PartnerPolicyDateField key={f.key} label={f.label} value={current} required={f.required} onChange={v=>updateProduct(f.key,v)}/>;
    const options=f.key==='insurerId'?data?.insurers??[]:(f.options??[]).map(value=>({value,label:value}));
    return <View key={f.key} style={[styles.field,f.wide&&styles.wideField]}>
      <Text style={styles.label}>{f.label}{f.required?<Text style={styles.star}> *</Text>:null}</Text>
      {options.length?<Pressable accessibilityRole="button" accessibilityLabel={f.label} style={styles.inputRow} onPress={()=>setPicker({key:f.key,items:options,product:true})}>
        <Text style={[styles.value,!current&&styles.placeholder]} numberOfLines={1}>{options.find(o=>o.value===current)?.label||('Select '+f.label.toLowerCase())}</Text>
        <Ionicons name="chevron-down" size={15} color="#63758D"/>
      </Pressable>:<TextInput accessibilityLabel={f.label} value={current} placeholder={['sumInsured','netPremium','gstAmount','grossPremium'].includes(f.key)?'₹ 0.00':f.key==='previousClaims'?'Brief reference':f.key==='deductible'||productExtras.some(item=>item.key===f.key)?'Optional':'Enter '+f.label.toLowerCase()} placeholderTextColor="#98A6B8" onChangeText={v=>updateProduct(f.key,f.key==='phone'?v.replace(/\D/g,'').slice(0,10):f.key==='policyNumber'?v.toUpperCase():v)}
        keyboardType={['phone','premiumAmount','sumInsured','deductible','netPremium','gstAmount','grossPremium','employeeCount','annualWages','annualTurnover','projectValue'].includes(f.key)?'numeric':'default'}
        style={styles.input}/>}
    </View>;
  };
  // Preserve Motor's newer source ownership rendering; compact the other policy types.
  const sourceIsVerified=Boolean(data?.sourceMeta&&draft&&
    data.sourceMeta.name.trim().toLowerCase()===draft.leadSource.trim().toLowerCase()&&
    data.sourceMeta.code===draft.intermediaryCode);
  const verifiedSource=sourceIsVerified?data?.sourceMeta:null;

  const sourceMeta=(key:'rmName'|'intermediaryCode',label:string)=><View style={styles.sourceMeta}>
    <Text style={styles.sourceMetaLabel}>{label} ·</Text>
    {key==='rmName'&&isMotor
      ? <Text numberOfLines={1} style={styles.sourceMetaValue}>{draft?.rmName||verifiedSource?.rmName||''}</Text>
      : key==='intermediaryCode'&&verifiedSource
        ? <Text numberOfLines={1} style={styles.sourceMetaValue}>{draft?.intermediaryCode}</Text>
        : <TextInput accessibilityLabel={label} value={draft?.[key]??''} onChangeText={value=>update(key,value)}
            placeholder="" style={styles.sourceMetaInput}/>}
  </View>;
  const sourceSection=()=> <View style={[styles.section,styles.firstSection]}>
    <View style={styles.sectionHead}><Text style={styles.number}>01</Text><Text style={styles.sectionTitle}>Policy source & ownership</Text></View>
    <View style={styles.fields}>{policy.slice(0,4).map(item=><View key={item.key} style={styles.sourceCell}>
      {field(item,true)}
      {item.key==='intermediaryType'?<View style={styles.sourceOwnerRow}>
        {sourceMeta('rmName','RM')}
        {verifiedSource?.rmCode?<View style={styles.sourceMeta}>
          <Text style={styles.sourceMetaLabel}>ID ·</Text><Text style={styles.sourceMetaValue}>{verifiedSource.rmCode}</Text>
        </View>:null}
      </View>:null}
      {item.key==='leadSource'?<View style={styles.sourceLeadRow}>
        {sourceMeta('intermediaryCode','ID')}
        {verifiedSource?.mobile?<View style={styles.sourcePhone}>
          <Ionicons name="call-outline" size={13} color="#315B91"/>
          <Text numberOfLines={1} style={styles.sourcePhoneNumber}>{verifiedSource.mobile}</Text>
        </View>:null}
      </View>:null}
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
  const nonMotorCustomerPolicySection=<View style={styles.section}>
    <View style={styles.sectionHead}><Text style={styles.number}>02</Text><Text style={styles.sectionTitle}>Customer & policy</Text></View>
    <View style={styles.nonMotorCustomerArea}>
      <Text style={styles.label}>Customer record</Text>
      <View style={styles.nonMotorModeRow}>
        {(['existing','new'] as const).map(mode=><Pressable key={mode} accessibilityRole="button"
          accessibilityLabel={mode==='existing'?'Existing customer':'New customer'}
          accessibilityState={{selected:nonMotorCustomerMode===mode}}
          onPress={()=>setNonMotorCustomerMode(mode)}
          style={[styles.nonMotorModeButton,nonMotorCustomerMode===mode&&styles.nonMotorModeActive]}>
          <Text style={[styles.nonMotorModeText,nonMotorCustomerMode===mode&&styles.nonMotorModeTextActive]}>{mode==='existing'?'Existing':'New'}</Text>
        </Pressable>)}
      </View>
    </View>
    {nonMotorCustomerMode==='existing'?<View style={styles.nonMotorCustomerArea}>
      <Text style={styles.label}>Customer / organisation <Text style={styles.star}>*</Text></Text>
      <View style={styles.nonMotorSearchRow}>
        <TextInput accessibilityLabel="Search existing customer" value={customerSearch}
          onChangeText={value=>{
            setCustomerSearch(value);setCustomerChoices([]);
            if(productValues.customerId){
              updateProduct('customerId','');
            }
          }}
          style={[styles.input,styles.nonMotorSearchInput]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Search customers"
          disabled={customerSearchBusy||customerSearch.trim().length<2}
          style={styles.nonMotorSearchButton} onPress={()=>void findNonMotorCustomers()}>
          {customerSearchBusy?<ActivityIndicator color="#FFFFFF" size="small"/>:<Ionicons name="search" size={19} color="#FFFFFF"/>}
        </Pressable>
      </View>
      {productValues.customerId?<Text style={styles.fieldMeta}>Selected: {productValues.insuredName||'Customer'}</Text>:null}
      {customerSearchError?<Text style={styles.errorText}>{customerSearchError}</Text>:null}
      {customerChoices.map(customer=><Pressable key={customer.id} accessibilityRole="button"
        accessibilityLabel={'Select '+customer.name} style={styles.nonMotorCustomerChoice} onPress={()=>selectNonMotorCustomer(customer)}>
        <Text style={styles.nonMotorCustomerChoiceName}>{customer.name}</Text>
        <Text style={styles.fieldMeta}>{customer.phone}</Text>
      </Pressable>)}
    </View>:<View style={styles.fields}>
      {nonMotorNewCustomerFields.map(detailField)}
    </View>}
    <View style={styles.fields}>{otherPolicy.map(detailField)}</View>
  </View>;
  const nonMotorRiskSection=<View style={styles.section}>
    <View style={styles.sectionHead}><Text style={styles.number}>03</Text><Text style={styles.sectionTitle}>Risk details</Text></View>
    {productValues.category?<View style={styles.fields}>{(riskFields[productValues.category]??riskFields.Other).map(detailField)}</View>:null}
  </View>;
  const nonMotorAdditionalSection=<View style={styles.section}>
    <Pressable accessibilityRole="button" accessibilityLabel="Additional policy details"
      accessibilityState={{expanded:nonMotorAdditionalOpen}}
      style={styles.sectionHead} onPress={()=>setNonMotorAdditionalOpen(v=>!v)}>
      <Text style={styles.number}>05</Text>
      <Text style={[styles.sectionTitle,styles.headingFlex]}>Additional policy details</Text>
      <Ionicons name={nonMotorAdditionalOpen?'chevron-up':'chevron-down'} size={16} color="#315B85"/>
    </Pressable>
    {nonMotorAdditionalOpen?<View style={styles.fields}>
      {productExtras.filter(item=>item.key!=='remarks').map(detailField)}
      <View style={styles.wideField}>
        <Text style={styles.label}>Remarks</Text>
        <TextInput accessibilityLabel="Remarks" multiline textAlignVertical="top"
          value={productValues.remarks||''} onChangeText={value=>updateProduct('remarks',value)}
          maxLength={4000} placeholder="Any servicing note for future reference"
          placeholderTextColor="#98A6B8" style={[styles.input,styles.inlineRemarksInput]}/>
      </View>
    </View>:null}
  </View>;
  const nonMotorDocumentsSection=<View style={styles.section}>
    <View style={styles.sectionHead}><Text style={styles.number}>06</Text><Text style={styles.sectionTitle}>Documents</Text></View>
    <View style={styles.nonMotorDocuments}>
      {['Policy Copy','Proposal Form','KYC','Other Document'].map(label=><View key={label} style={styles.nonMotorDocumentRow}>
        <Ionicons name="document-text-outline" size={16} color="#315B85"/>
        <Text style={styles.nonMotorDocumentName}>{label}</Text>
        <Text style={styles.fieldMeta}>Policy Register</Text>
      </View>)}
    </View>
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
    {key:'validUpto',label:draft?.policyProduct==='Bundled'?'OD Validity Upto':'Validity up to',required:true},
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
    <View style={styles.fields}>
      <View style={[styles.field,styles.wideField,styles.registrationBlock]}>
      <Text style={styles.label}>Registration No. {draft?.registrationMode==='registered'?<Text style={styles.star}>*</Text>:null}</Text>
      <View style={styles.registrationRow}>
        <TextInput accessibilityLabel="Registration number" value={draft?.registrationMode==='registered'?draft.registrationNo:''}
           editable={draft?.registrationMode==='registered'} placeholder={draft?.registrationMode==='registered'?'MP20AB1234':'Pending after RTO registration'} placeholderTextColor="#9AA7B9"
          autoCapitalize="characters"
          onChangeText={value=>update('registrationNo',value.toUpperCase().replace(/\s/g,''))}
          style={[styles.registrationInput,draft?.registrationMode==='unregistered'&&styles.readonlyInput]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Fetch RC details"
          disabled={draft?.registrationMode!=='registered'||lookingUpRc||!registrationValid}
          accessibilityState={{disabled:draft?.registrationMode!=='registered'||lookingUpRc||!registrationValid}}
          onPress={()=>void fetchRc()} style={[styles.rcButton,(draft?.registrationMode!=='registered'||lookingUpRc||!registrationValid)&&styles.rcButtonDisabled]}>
          {lookingUpRc?<ActivityIndicator color="#FFFFFF" size="small"/>:<Ionicons name="scan-outline" size={19} color="#FFFFFF"/>}
        </Pressable>
      </View>
      </View>
      {motorVehicleFields.slice(0,7).map(item=>field(item))}
       {field(motorVehicleFields[9])}
      {motorVehicleFields.slice(7,9).map(item=>field(item))}
      <View style={[styles.field,styles.wideField]}>
        <Text style={styles.label}>RTO {draft?.vehicleClass==='CPM'?null:<Text style={styles.star}>*</Text>}</Text>
        <View style={styles.rtoRow}>
          <TextInput accessibilityLabel="RTO state" value={draft?.rtoState??''} editable={draft?.vehicleClass!=='CPM'}
             placeholder={draft?.vehicleClass==='CPM'?'Not required':'State'} placeholderTextColor="#9AA7B9"
             onChangeText={value=>update('rtoState',value)} style={[styles.input,styles.rtoInput,draft?.vehicleClass==='CPM'&&styles.readonlyInput]}/>
          <TextInput accessibilityLabel="RTO name" value={draft?.rtoName??''} editable={draft?.vehicleClass!=='CPM'}
             placeholder={draft?.vehicleClass==='CPM'?'Not required':'Name / code'} placeholderTextColor="#9AA7B9"
             onChangeText={value=>update('rtoName',value)} style={[styles.input,styles.rtoInput,draft?.vehicleClass==='CPM'&&styles.readonlyInput]}/>
        </View>
      </View>

    </View>
  </View>;
  const motorProductSection=section('03','Policy product, premium & validity',motorProductFields);
  return <PartnerScreen title="Policy Onboarding" eyebrow="POLICY INTAKE" onBack={()=>router.back()} navyTopBar navyStatusBar topBarIcon="document-text-outline">
    {loading?<PartnerStateView state="loading" title="Loading saved Policy Onboarding" />:null}
    {error?<View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color="#B42318"/><Text style={styles.errorText}>{error}</Text></View>:null}
    {!loading&&!draft?<Pressable style={styles.retry} onPress={()=>void load()}><Text style={styles.retryText}>Retry loading</Text></Pressable>:null}
    {draft?<>
      {sourceSection()}
      {isMotor?motorVehicleSection:productType==='Non Motor'?nonMotorCustomerPolicySection:productSection('02','Customer / Proposer',commonPerson)}
      {isMotor?motorProductSection:productType==='Non Motor'?nonMotorRiskSection:productSection('03','Policy product & case details',lifeProduct)}
      {!isMotor?productSection('04',productType==='Non Motor'?'Cover, premium & validity':'Premium & payment',productType==='Non Motor'?otherPremium:lifePremium):null}
      {!isMotor&&productType==='Non Motor'?<>{nonMotorAdditionalSection}{nonMotorDocumentsSection}</>:null}
      {productType!=='Non Motor'?<View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="chatbox-ellipses-outline" size={17} color="#254C83"/>
          <Text style={[styles.sectionTitle,styles.remarkHeading]}>Remarks</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add Remark" style={styles.remarkButton}
            onPress={()=>{setRemarkText('');setRemarkError('');setRemarkOpen(true);}}>
            <Ionicons name="add-circle-outline" size={15} color="#254C83"/>
            <Text style={styles.remarkButtonText}>Add Remark</Text>
          </Pressable>
        </View>
        {(isMotor?draft.remarks:productValues.remarks||'').trim()?<View style={styles.remarkBody}>
          {(isMotor?draft.remarks:productValues.remarks||'').split(/\n\s*\n/).filter(item=>item.trim()).map((item,index)=>
            <View key={index} style={styles.remarkEntry}><Text style={styles.remarkPreview}>{item.trim()}</Text></View>)}
        </View>:null}
      </View>:null}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.summaryHeading}><Text style={styles.summaryCaption}>POLICY STATUS</Text>
            <Text style={styles.sectionTitle}>Onboarding summary</Text></View>
          <View style={styles.summaryProgressStack}>
            <View style={[styles.summaryProgress,{
            borderTopColor:filled>=12.5?'#17365D':'#DFE7F0',
            borderRightColor:filled>=37.5?'#17365D':'#DFE7F0',
            borderBottomColor:filled>=62.5?'#17365D':'#DFE7F0',
            borderLeftColor:filled>=87.5?'#17365D':'#DFE7F0',
          }]}><Text style={styles.progressText}>{filled}%</Text></View>
          </View>
        </View>
        <View style={styles.summary}>
          {isMotor?<View style={styles.premiumRows}>
            <View style={styles.premiumHeading}><View style={styles.premiumIcon}><Ionicons name="cash-outline" size={16} color="#315B9A"/></View><Text style={styles.summaryCaption}>PREMIUM</Text></View>
            {[{label:'Net premium',value:net},{label:'GST',value:gst},{label:'Gross premium',value:gross}].map(row=><View key={row.label} style={styles.premiumRow}>
              <Text style={styles.premiumLabel}>{row.label}</Text><Text style={styles.premiumValue}>{rupees(row.value)}</Text>
            </View>)}
          </View>:productType==='Non Motor'?<View style={styles.premiumRows}>
            {[
              {label:'Category',value:productValues.category||'Non Motor'},
              {label:'Sum insured / limit',value:rupees(amount(productValues.sumInsured||'0'))},
              {label:'Gross premium',value:rupees(amount(productValues.grossPremium||'0'))},
              {label:'Risk reference',value:productValues.riskLocation||productValues.transitFrom||productValues.projectName||'Not entered'},
              {label:'Insurer',value:data?.insurers.find(x=>x.value===productValues.insurerId)?.label||'Not selected'},
              {label:'Policy expiry',value:productValues.endDate||'Not entered'},
            ].map(item=><View key={item.label} style={styles.premiumRow}>
              <Text style={styles.premiumLabel}>{item.label}</Text>
              <Text style={styles.nonMotorSummaryValue}>{item.value}</Text>
            </View>)}
          </View>:<View style={styles.premiumRows}>
            <View style={styles.premiumHeading}><View style={styles.premiumIcon}><Ionicons name="cash-outline" size={16} color="#315B9A"/></View><Text style={styles.summaryCaption}>PREMIUM</Text></View>
            <Text style={styles.total}>{rupees(amount(productValues.premiumAmount||'0'))}</Text>
            <Text style={styles.muted}>{productValues.paymentFrequency||'Frequency pending'} · {productValues.paymentMode||'Mode pending'}</Text>
          </View>}
        </View>
        {isMotor&&data?.commercialAccess?<View style={styles.referenceCommercial}>
          <View style={styles.referenceCommercialTitle}>
            <Text style={styles.summaryCaption}>PAYIN–PAYOUT</Text>
            <Text style={styles.referenceHelp}>Sensitive terms · popup entry</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Insurer Pay-In popup"
            onPress={()=>setCommercialModal('payin')} style={[styles.referenceCard,styles.referencePayinCard]}>
            <View style={[styles.referenceIcon,styles.referencePayinIcon]}>
              <Ionicons name="arrow-down-outline" size={18} color="#11857E"/>
            </View>
            <View style={styles.referenceCardBody}>
              <View style={styles.referenceCardNameRow}>
                <Text style={styles.referenceCardName}>Insurer Pay-in</Text>
                {payinEntered?<Ionicons name="checkmark-circle" size={13} color="#159566"/>:null}
              </View>
              <Text style={styles.referenceCardSubtitle} numberOfLines={1}>{payinEntered?`OD ${draft?.projectedOdPercent||'0'}% · TP/CPA ${draft?.projectedTpPercent||'0'}%`:'Add projected insurer terms'}</Text>
            </View>
            <View style={[styles.referencePill,payinEntered&&styles.referenceEnteredPill]}>
              <Text style={[styles.referencePillText,payinEntered&&styles.referenceEnteredText]} numberOfLines={1}>{payinEntered?rupees(summaryPayin):'Not entered'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8A98AA"/>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Partner Payout popup"
            onPress={()=>setCommercialModal('payout')} style={[styles.referenceCard,styles.referencePayoutCard]}>
            <View style={[styles.referenceIcon,styles.referencePayoutIcon]}>
              <Ionicons name="hand-left-outline" size={18} color="#6B54B6"/>
            </View>
            <View style={styles.referenceCardBody}>
              <View style={styles.referenceCardNameRow}>
                <Text style={styles.referenceCardName}>Partner Payout</Text>
                {payoutEntered?<Ionicons name="checkmark-circle" size={13} color="#159566"/>:null}
              </View>
              <Text style={styles.referenceCardSubtitle} numberOfLines={1}>{payoutEntered?`OD ${draft?.payoutOdPercent||'0'}% · TP/CPA ${draft?.payoutTpPercent||'0'}%`:'Add agreed partner payout'}</Text>
            </View>
            <View style={[styles.referencePill,payoutEntered&&styles.referenceEnteredPill]}>
              <Text style={[styles.referencePillText,payoutEntered&&styles.referenceEnteredText]} numberOfLines={1}>{payoutEntered?rupees(summaryPayout):'Not entered'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8A98AA"/>
          </Pressable>
        </View>:!isMotor&&data?.commercialAccess?<View style={styles.referenceCommercial}>
          <View style={styles.referenceCommercialHeader}><Ionicons name="hand-left-outline" size={16} color="#315B9A"/><Text style={styles.summaryCaption}>PAYIN–PAYOUT</Text></View>
          <View style={[styles.referenceCommercialRow,(productType==='Life'||productType==='Health')&&styles.referenceLifeHealthPayinRow]}>
            <View style={styles.referenceCommercialContent}><Text style={styles.referenceLabel}>INSURER PAY-IN</Text><Text style={styles.referenceValue}>{payinEntered?rupees(summaryPayin):'Not entered'}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Insurer Pay-In popup" onPress={()=>setCommercialModal('payin')} style={styles.referenceAdd}><Text style={styles.referenceAddText}>{payinEntered?'Edit':'Add'}</Text></Pressable>
          </View>
          <View style={[styles.referenceCommercialRow,(productType==='Life'||productType==='Health')&&styles.referenceLifeHealthPayoutRow]}>
            <View style={styles.referenceCommercialContent}><Text style={styles.referenceLabel}>PARTNER PAYOUT</Text><Text style={styles.referenceValue}>{payoutEntered?rupees(summaryPayout):'Not entered'}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Partner Payout popup" onPress={()=>setCommercialModal('payout')} style={styles.referenceAdd}><Text style={styles.referenceAddText}>{payoutEntered?'Edit':'Add'}</Text></Pressable>
          </View>
        </View>:null}

      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel Policy Onboarding"
          disabled={saving||booking||creatingLifeHealth} style={styles.secondary} onPress={cancelOnboarding}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        {(productType==='Life'||productType==='Health')?
          <Pressable accessibilityRole="button" accessibilityLabel="Create Policy"
            disabled={booking||saving||creatingLifeHealth||!data}
            style={[styles.primary,(booking||saving||creatingLifeHealth||!data)&&styles.disabled]}
            onPress={()=>void createLifeHealth()}>
            {creatingLifeHealth?<ActivityIndicator size="small" color="white"/>:<Ionicons name="checkmark-circle-outline" size={16} color="white"/>}
            <Text style={styles.primaryText}>{creatingLifeHealth?'Creating case…':'Create Policy'}</Text>
          </Pressable>:
          <Pressable accessibilityRole="button" accessibilityLabel="Create Active Policy"
            disabled={booking||saving||!data} style={[styles.primary,(booking||saving||!data)&&styles.disabled]}
            onPress={()=>void createActivePolicy()}>
            {booking?<ActivityIndicator size="small" color="white"/>:<Ionicons name="checkmark-circle-outline" size={16} color="white"/>}
            <Text style={styles.primaryText}>{booking?(isMotor?'Checking & booking…':'Opening Operations…'):'Create Active Policy'}</Text>
          </Pressable>}
      </View>


    </>:null}

    <Modal transparent visible={remarkOpen} animationType="fade"
      onRequestClose={()=>{if(!saving)setRemarkOpen(false);}}>
      <View style={styles.remarkOverlay}>
        <View style={styles.remarkSheet}>
          <View style={styles.remarkHeader}>
            <View style={styles.remarkTitle}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color="#254C83"/>
              <Text style={styles.sectionTitle}>Add Remark</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close remark" disabled={saving}
              onPress={()=>setRemarkOpen(false)}><Ionicons name="close" size={21} color="#4C5970"/></Pressable>
          </View>
          <TextInput accessibilityLabel="New remark" multiline autoFocus
            textAlignVertical="top" value={remarkText} onChangeText={setRemarkText}
            maxLength={2000} placeholder="Write a remark" placeholderTextColor="#9AA7B9"
            style={styles.remarkInput}/>
          {remarkError?<Text style={styles.errorText}>{remarkError}</Text>:null}
          <View style={styles.remarkActions}>
            <Pressable accessibilityRole="button" disabled={saving} style={styles.remarkCancel}
              onPress={()=>setRemarkOpen(false)}><Text style={styles.remarkCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Save Remark"
              disabled={saving||booking||!remarkText.trim()}
              style={[styles.remarkConfirm,(saving||booking||!remarkText.trim())&&styles.disabled]}
              onPress={()=>void addRemark()}><Text style={styles.primaryText}>{saving?'Saving…':'Save Remark'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
    <Modal transparent visible={Boolean(commercialModal)&&Boolean(data?.commercialAccess)}
      animationType="slide" onRequestClose={()=>setCommercialModal(null)}>
      <View style={styles.scrim}>
        <View style={styles.commercialSheet}>
          <View style={styles.sheetTitle}>
            <View style={styles.commercialTitleGroup}>
              <Text style={styles.sectionTitle}>{commercialModal==='payin'?'Projected Insurer Pay-in':'Partner Payout'}</Text>
              <Text style={styles.modalDescription}>{commercialModal==='payin'?
                'Projected pay-in only. This does not confirm actual insurer receipts.':
                'Agreed partner payout; independent from insurer receipts.'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close commercial popup" onPress={()=>setCommercialModal(null)} style={styles.modalClose}>
              <Ionicons name="close" size={19} color="#4C5970"/>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.commercialModalContent}>
            {!isMotor?<View style={styles.fields}>
              {commercialModal==='payin'?<>
                <View style={styles.field}><Text style={styles.label}>PAY-IN BASIS</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Pay-in basis" style={styles.inputRow}
                    onPress={()=>setPicker({key:'payinBasis',product:true,items:[{value:'NET',label:'Net Premium %'},{value:'FLAT',label:'Fixed Amount'}]})}>
                    <Text style={styles.value}>{productValues.payinBasis==='FLAT'?'Fixed Amount':'Net Premium %'}</Text><Ionicons name="chevron-down" size={15} color="#63758D"/>
                  </Pressable></View>
                <View style={styles.field}><Text style={styles.label}>{productValues.payinBasis==='FLAT'?'PAY-IN AMOUNT':'PAY-IN %'}</Text>
                  <TextInput accessibilityLabel="Pay-in value" style={styles.input} keyboardType="decimal-pad" placeholder="0.00" value={productValues.payinValue||''}
                    onChangeText={v=>updateProduct('payinValue',v)}/></View>
                <View style={styles.field}><Text style={styles.label}>INSURER SCHEME / INCENTIVE</Text>
                  <TextInput accessibilityLabel="Insurer scheme incentive" style={styles.input} keyboardType="decimal-pad" placeholder="₹ 0.00"
                    value={productValues.payinScheme||''} onChangeText={v=>updateProduct('payinScheme',v)}/></View>
                {[
                  ['BASE PROJECTED PAY-IN',productPayinBase],['PROJECTED TOTAL PAY-IN',productPayin],
                  ['TDS @ 10%',productPayin*.1],['PAY-IN AFTER TDS',productPayin*.9]
                ].map(([label,value])=><View key={String(label)} style={styles.field}><Text style={styles.label}>{label}</Text><View style={[styles.inputRow,styles.readonlyInput]}><Text style={styles.premiumValue}>{rupees(Number(value))}</Text></View></View>)}
                <Text style={styles.commercialNote}>Blank means projected pay-in has not been entered. Entering 0 explicitly is valid and preserved.</Text>
              </>:<>
                <View style={styles.field}><Text style={styles.label}>PAYOUT BASIS</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Partner payout basis" style={styles.inputRow}
                    onPress={()=>setPicker({key:'partnerPayoutBasis',product:true,items:[{value:'NET',label:'Net Premium %'},{value:'FLAT',label:'Fixed Amount'}]})}>
                    <Text style={styles.value}>{productValues.partnerPayoutBasis==='FLAT'?'Fixed Amount':'Net Premium %'}</Text><Ionicons name="chevron-down" size={15} color="#63758D"/>
                  </Pressable></View>
                <View style={styles.field}><Text style={styles.label}>{productValues.partnerPayoutBasis==='FLAT'?'PAYOUT AMOUNT':'PAYOUT %'}</Text>
                  <TextInput accessibilityLabel="Payout value" style={styles.input} keyboardType="decimal-pad" placeholder="0.00"
                    value={productValues.partnerPayoutValue||''} onChangeText={v=>updateProduct('partnerPayoutValue',v)}/></View>
                <View style={styles.field}><Text style={styles.label}>TOTAL AGREED PAYOUT</Text><View style={[styles.inputRow,styles.readonlyInput]}><Text style={styles.premiumValue}>{rupees(productPayout)}</Text></View></View>
                <View style={styles.field}><Text style={styles.label}>PROJECTED RETENTION</Text><View style={[styles.inputRow,styles.readonlyInput]}><Text style={styles.premiumValue}>{rupees(projectedRetention)}</Text></View></View>
                <Text style={styles.commercialNote}>The payout is tagged to the selected Section 01 Lead Source. Negative retention is allowed and remains for finance review.</Text>
              </>}
            </View>:commercialModal==='payin'?<>
              <View style={styles.fields}>{insurerPayinFields.map(f=><View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label.toUpperCase()}</Text>
                <TextInput accessibilityLabel={f.label} value={String(draft?.[f.key]??'')}
                  onChangeText={v=>update(f.key,v)} placeholder={f.key==='insurerScheme'?'₹ 0.00':'0.00'}
                  placeholderTextColor="#9AA7B9" keyboardType="decimal-pad" style={styles.input}/>
              </View>)}
              <View style={styles.field}>
                <Text style={styles.label}>PROJECTED TOTAL PAY-IN</Text>
                <View style={[styles.inputRow,styles.readonlyInput]}>
                  <Text style={styles.premiumValue}>{rupees(payinTotal)}</Text><Text style={styles.autoText}>AUTO</Text>
                </View>
              </View></View>
              <View style={styles.fields}>
                <View style={styles.field}><Text style={styles.label}>TDS @ 10%</Text><View style={[styles.inputRow,styles.readonlyInput]}><Text style={styles.premiumValue}>{rupees(payinTotal*.1)}</Text></View></View>
                <View style={styles.field}><Text style={styles.label}>PAY-IN AFTER TDS</Text><View style={[styles.inputRow,styles.readonlyInput]}><Text style={styles.premiumValue}>{rupees(payinTotal*.9)}</Text></View></View>
              </View>
              <View style={styles.payinSummary}>
                <Pressable accessibilityRole="button" accessibilityLabel="Toggle pay-in summary"
                  accessibilityState={{expanded:payinSummaryExpanded}}
                  onPress={()=>setPayinSummaryExpanded(value=>!value)} style={styles.summaryToggleRow}>
                  <Text style={styles.commercialHeading}>Pay-in summary</Text>
                  <Text style={styles.summaryLink}>{payinSummaryExpanded?'Show Less':'Show More'}</Text>
                </Pressable>
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}><Text style={styles.statLabel}>Total projected</Text><Text style={styles.statValue}>{rupees(payinTotal)}</Text></View>
                  <View style={styles.summaryStat}><Text style={styles.statLabel}>Total received</Text><Text style={styles.statValue}>—</Text></View>
                  <View style={styles.summaryStat}><Text style={styles.statLabel}>Pending</Text><Text style={styles.statValue}>—</Text></View>
                </View>
                {payinSummaryExpanded?<View style={styles.summarySchedule}>
                  <View style={styles.scheduleRow}>
                    {['Date','Projected','Received','Pending'].map(col=><Text key={col} style={styles.scheduleHeader}>{col}</Text>)}
                  </View>
                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleCell}>{draft?.validFrom||draft?.issuanceDate||'—'}</Text>
                    <Text style={styles.scheduleCell}>{rupees(payinTotal)}</Text>
                    <Text style={styles.scheduleCell}>—</Text>
                    <Text style={styles.scheduleCell}>—</Text>
                  </View>
                  <Text style={styles.scheduleNote}>Projected values are estimates. Actual receipt history is not provided for this intake draft.</Text>
                </View>:null}
              </View>
            </>:<>
              <View style={styles.fields}>
                {partnerPayoutFields.filter(f=>f.key!=='flatPayoutAmount').map(f=>
                  f.key==='payoutBasis'?<View key={f.key} style={styles.field}>
                    <Text style={styles.label}>PAYOUT BASIS</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Payout basis"
                      accessibilityState={{expanded:payoutBasisExpanded}}
                      onPress={()=>setPayoutBasisExpanded(value=>!value)} style={styles.inputRow}>
                      <Text style={styles.value}>{draft?.payoutBasis||'NET'}</Text>
                      <Ionicons name={payoutBasisExpanded?'chevron-up':'chevron-down'} size={15} color="#63758D"/>
                    </Pressable>
                    {payoutBasisExpanded?<View style={styles.basisOptions}>
                      {(['NET','OD','FLAT'] as const).map(value=><Pressable key={value} accessibilityRole="button"
                        accessibilityLabel={`Payout basis ${value}`} accessibilityState={{selected:draft?.payoutBasis===value}}
                        onPress={()=>{update('payoutBasis',value);setPayoutBasisExpanded(false);}} style={styles.basisChoice}>
                        <Text style={styles.basisText}>{value}</Text>
                        {draft?.payoutBasis===value?<Ionicons name="checkmark" size={14} color="#17365D"/>:null}
                      </Pressable>)}
                    </View>:null}
                  </View>:<View key={f.key} style={styles.field}>
                    <Text style={styles.label}>{f.label.toUpperCase()}</Text>
                    <TextInput accessibilityLabel={f.label} value={String(draft?.[f.key]??'')}
                      editable={draft?.payoutBasis!=='FLAT'&&(f.key!=='payoutTpPercent'||draft?.payoutBasis==='NET')}
                      onChangeText={v=>update(f.key,v)} keyboardType="decimal-pad"
                      placeholder="0.00" placeholderTextColor="#9AA7B9"
                      style={[styles.input,(draft?.payoutBasis==='FLAT'||(f.key==='payoutTpPercent'&&draft?.payoutBasis!=='NET'))&&styles.readonlyInput]}/>
                  </View>
                )}
                <View style={styles.field}>
                  <Text style={styles.label}>TOTAL AGREED PAYOUT</Text>
                  {draft?.payoutBasis==='FLAT'?<TextInput accessibilityLabel="Total agreed payout" value={String(draft?.flatPayoutAmount??'')}
                    placeholder="₹ 0.00" placeholderTextColor="#9AA7B9" keyboardType="decimal-pad"
                    onChangeText={value=>update('flatPayoutAmount',value)} style={styles.input}/>:
                  <View style={[styles.inputRow,styles.readonlyInput]}>
                    <Text style={styles.premiumValue}>{rupees(payoutTotal)}</Text><Text style={styles.autoText}>AUTO</Text>
                  </View>}
                </View>
                <View style={styles.fields}><View style={styles.field}><Text style={styles.label}>PROJECTED RETENTION</Text><View style={[styles.inputRow,styles.readonlyInput]}><Text style={styles.premiumValue}>{rupees(projectedRetention)}</Text></View></View></View>
              </View>
            </>}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable accessibilityRole="button" accessibilityLabel="Save and close commercial popup"
              disabled={saving} accessibilityState={{disabled:saving}}
              onPress={()=>{void save().then(success=>{if(success)setCommercialModal(null);});}}
              style={styles.commercialSave}><Text style={styles.primaryText}>{saving?'Saving…':'Save & Close'}</Text></Pressable>
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
      <View style={[styles.scrim,picker?.key==='policyProduct'&&styles.productPickerScrim]}><View style={[styles.sheet,picker?.key==='policyProduct'&&styles.productPickerSheet]}>
        <View style={styles.sheetTitle}><Text style={styles.sectionTitle}>{picker?.key==='policyProduct'?'Select product':picker?.key==='businessLine'?'Select Policy Type':`Select ${picker?.key}`}</Text><Pressable onPress={()=>setPicker(null)} accessibilityLabel="Close options"><Ionicons name="close" size={21} color="#4C5970"/></Pressable></View>
        <ScrollView style={styles.choiceScroll}>{picker?.items.map(item=>{
          const selected=(picker.product?String(productValues[picker.key]??''):String(draft?.[picker.key as FieldKey]??''))===item.value;
          return <Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected}}
            style={[styles.choice,selected&&styles.choiceSelected]}
            onPress={()=>{
              if(picker.key==='businessLine'){
                setPicker(null);
                if(item.value!==draft?.businessLine)update('businessLine',item.value);
                return;
              }
              picker.product?updateProduct(picker.key,item.value):update(picker.key as FieldKey,item.value);
              setPicker(null);
            }}>
            <Text style={[styles.choiceText,selected&&styles.choiceTextSelected]}>{item.label}</Text>
            {selected?<Ionicons name="checkmark" size={17} color="#FFFFFF"/>:null}
          </Pressable>;
        })}</ScrollView>
      </View></View>
    </Modal>
  </PartnerScreen>;
}
const styles=StyleSheet.create({
  wait:{padding:28,alignItems:'center',gap:12},muted:{fontSize:11,color:'#738196',lineHeight:17},
  error:{flexDirection:'row',gap:8,backgroundColor:'#FFF0EF',padding:12,borderRadius:11,marginBottom:10},errorText:{flex:1,color:'#A32924',fontSize:12},
  retry:{padding:14,backgroundColor:'#DFE8FF',borderRadius:10,alignItems:'center'},retryText:{color:'#1B397A',fontWeight:'700'},
  status:{backgroundColor:'#FFFFFF',borderRadius:13,borderWidth:1,borderColor:'#DFE6F1',padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:9},draftStatus:{fontSize:10,color:'#738196',marginTop:2},
  intake:{color:'#1C375D',fontWeight:'800',fontSize:14},progress:{borderRadius:20,backgroundColor:'#EAEFFA',paddingVertical:6,paddingHorizontal:10},progressText:{color:'#324D9E',fontWeight:'700',fontSize:9},
  firstSection:{marginTop:14},
  section:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DFE6F0',borderRadius:13,marginBottom:11,overflow:'hidden'},
  sectionHead:{flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:13,paddingVertical:12,backgroundColor:'#EAF1FA'},
  number:{fontSize:11,color:'#355EA0',fontWeight:'800'},sectionTitle:{fontSize:13,color:'#1B385B',fontWeight:'800'},
  headingFlex:{flex:1,minWidth:0},
  registrationToggle:{flexDirection:'row',borderWidth:1,borderColor:'#C6D4E6',borderRadius:8,overflow:'hidden',backgroundColor:'#FFFFFF'},
  toggleButton:{paddingHorizontal:7,paddingVertical:8},toggleActive:{backgroundColor:'#17365D'},
  toggleText:{fontSize:9,fontWeight:'700',color:'#17365D'},toggleActiveText:{color:'#FFFFFF'},
  registrationBlock:{gap:5},
  registrationRow:{height:42,flexDirection:'row',borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,overflow:'hidden'},
  registrationInput:{flex:1,minWidth:0,paddingHorizontal:11,fontSize:12,color:'#183653'},
  rcButton:{width:48,backgroundColor:'#17365D',alignItems:'center',justifyContent:'center'},
  rcButtonDisabled:{backgroundColor:'#A8B4C3'},
  rtoRow:{flexDirection:'row',gap:5},rtoInput:{flex:1,minWidth:0,paddingHorizontal:6},
  fieldMeta:{fontSize:9,color:'#315B85',fontWeight:'600'},sourceDetails:{flexDirection:'row',flexWrap:'wrap',gap:6},
  sourceOwnerRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',columnGap:7,rowGap:2,minHeight:19},
  sourceLeadRow:{flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:8,minHeight:19},
  sourcePhone:{flexDirection:'row',alignItems:'center',gap:3,flexShrink:0},
  sourcePhoneNumber:{fontSize:9,color:'#315B91',fontWeight:'600'},
  sourceMetaValue:{fontSize:9,color:'#315B91',fontWeight:'600'},
  premiumRows:{gap:0},
  premiumRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:9,borderBottomWidth:1,borderColor:'#E9EFF6'},
  premiumLabel:{fontSize:11,color:'#65758E'},premiumValue:{fontSize:12,color:'#183653',fontWeight:'800'},
  fields:{padding:12,flexDirection:'row',flexWrap:'wrap',columnGap:10,rowGap:11},field:{width:'48%',minWidth:0,gap:5},sourceCell:{width:'48%',minWidth:0,gap:3},sourcePrimary:{width:'100%'},sourceMeta:{minHeight:19,flexDirection:'row',alignItems:'center',gap:3,flexShrink:1},sourceMetaLabel:{fontSize:9,fontWeight:'700',color:'#72839C'},sourceMetaInput:{minWidth:0,maxWidth:76,fontSize:9,color:'#315B91',fontWeight:'600',paddingVertical:0,paddingHorizontal:0,padding:0},wideField:{width:'100%'},label:{fontSize:10,color:'#65758E',fontWeight:'700'},star:{color:'#B93333'},
  input:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',backgroundColor:'#FFFFFF',borderRadius:9,paddingHorizontal:11,fontSize:12,color:'#183653'},
  inputRow:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  value:{color:'#183653',fontSize:12,flex:1},placeholder:{color:'#97A5B7'},
  premiumIcon:{width:27,height:27,borderRadius:8,backgroundColor:'#EDF3FC',alignItems:'center',justifyContent:'center'},referenceCommercial:{marginHorizontal:12,marginBottom:12,borderWidth:1,borderColor:'#D7E3F3',borderRadius:11,overflow:'hidden',backgroundColor:'#F8FAFD'},referenceCommercialHeader:{flexDirection:'row',alignItems:'center',gap:9,padding:11,borderBottomWidth:1,borderColor:'#E0E7F0'},referenceCommercialRow:{minHeight:66,paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},referenceLifeHealthPayinRow:{borderWidth:1,borderColor:'#DCE6F1',borderRadius:11,backgroundColor:'#FFFFFF',marginHorizontal:9,marginTop:9},referenceLifeHealthPayoutRow:{borderWidth:1,borderColor:'#E3DEF1',borderRadius:11,backgroundColor:'#FFFFFF',marginHorizontal:9,marginTop:9,marginBottom:9},referenceCommercialContent:{gap:5,flex:1},referenceLabel:{fontSize:9,fontWeight:'700',color:'#74829A'},referenceValue:{fontSize:12,fontWeight:'700',color:'#17365D'},referenceAdd:{minHeight:34,minWidth:45,alignItems:'center',justifyContent:'center'},referenceAddText:{fontSize:11,fontWeight:'700',color:'#315B9A'},referenceRetention:{paddingHorizontal:12,paddingVertical:11,borderTopWidth:1,borderColor:'#DCE5F1',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},commercialNote:{fontSize:10,lineHeight:17,color:'#71819A',padding:8,width:'100%'},
  referenceCommercialTitle:{paddingHorizontal:12,paddingTop:11,paddingBottom:7,gap:3},referenceHelp:{fontSize:9,color:'#98A2B3'},
  referenceCard:{minHeight:59,marginHorizontal:9,marginBottom:9,paddingHorizontal:9,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:8,borderWidth:1,borderRadius:11},
  referencePayinCard:{borderColor:'#DCE6F1',backgroundColor:'#F8FBFE'},referencePayoutCard:{borderColor:'#E3DEF1',backgroundColor:'#FBFAFE'},
  referenceIcon:{width:32,height:32,borderRadius:9,alignItems:'center',justifyContent:'center'},
  referencePayinIcon:{backgroundColor:'#E4F7F5'},referencePayoutIcon:{backgroundColor:'#F0EAFE'},
  referenceCardBody:{flex:1,minWidth:0,gap:3},referenceCardNameRow:{flexDirection:'row',alignItems:'center',gap:4},
  referenceCardName:{color:'#17365D',fontSize:11,fontWeight:'700'},referenceCardSubtitle:{fontSize:9,color:'#667085'},
  referencePill:{maxWidth:90,backgroundColor:'#F1F4F8',paddingHorizontal:6,paddingVertical:5,borderRadius:15},
  referenceEnteredPill:{backgroundColor:'#EAF7F2'},referencePillText:{fontSize:8,color:'#7A8798',fontWeight:'700'},
  referenceEnteredText:{color:'#18794E'},
  commercialCards:{marginHorizontal:12,marginBottom:12,gap:8},
  commercialHeading:{fontSize:11,color:'#26436B',fontWeight:'800'},
  commercialAction:{minHeight:48,flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:11,borderWidth:1,borderColor:'#DDE6F0',borderRadius:10,backgroundColor:'#F8FAFD'},
  commercialActionBody:{flex:1,minWidth:0,gap:2},commercialActionTitle:{fontSize:11,fontWeight:'700',color:'#17365D'},actionSubtitle:{fontSize:9,color:'#738196'},
  commercialActionValue:{fontSize:10,color:'#53657D',fontWeight:'600'},
  commercialSheet:{backgroundColor:'#FFFFFF',borderRadius:18,padding:0,maxHeight:'85%',width:'96%',alignSelf:'center',overflow:'hidden'},
  commercialTitleGroup:{flex:1,minWidth:0,gap:5},modalDescription:{color:'#738196',fontSize:9,lineHeight:14},
  modalClose:{width:32,height:32,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#DDE6F0',borderRadius:20},
  modalFooter:{padding:12,alignItems:'flex-end',backgroundColor:'#F7F9FC',borderTopWidth:1,borderColor:'#E1E9F3'},
  autoText:{fontSize:9,color:'#98A6B8',fontWeight:'700'},
  basisOptions:{marginTop:4,borderWidth:1,borderColor:'#DDE6F0',borderRadius:10,overflow:'hidden'},basisChoice:{minHeight:31,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#EEF1F7'},basisText:{color:'#17365D',fontSize:10,fontWeight:'700'},
  payinSummary:{marginHorizontal:12,marginBottom:12,padding:12,backgroundColor:'#FAF8FF',borderWidth:1,borderColor:'#E4DFF2',borderRadius:12,gap:9},
  summaryToggleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},summaryLink:{fontSize:10,color:'#315B9A',fontWeight:'700'},
  summaryStats:{flexDirection:'row',gap:8},summaryStat:{flex:1,minWidth:0,gap:3},statLabel:{fontSize:9,color:'#72819A'},statValue:{fontSize:11,fontWeight:'800',color:'#17365D'},
  summarySchedule:{gap:6,marginTop:5},scheduleRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderColor:'#EBE6F3'},
  scheduleHeader:{fontSize:8,color:'#405375',fontWeight:'700',width:'24%'},scheduleCell:{fontSize:8,color:'#17365D',width:'24%'},scheduleNote:{fontSize:9,lineHeight:14,color:'#738196'},
  commercialModalContent:{paddingBottom:8},
  calculatedRow:{flexDirection:'row',justifyContent:'space-between',padding:12,borderTopWidth:1,borderColor:'#E1E9F3'},
  readonlyInput:{backgroundColor:'#F3F6FA',color:'#738196'},
  commercialSave:{backgroundColor:'#17365D',borderRadius:10,paddingHorizontal:17,paddingVertical:12,alignItems:'center'},
  summary:{padding:14,gap:7},summaryStatusRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},summaryCaption:{fontSize:10,fontWeight:'700',color:'#426188'},summaryHeading:{flex:1,gap:3},premiumHeading:{flexDirection:'row',gap:6,alignItems:'center',paddingVertical:7},summaryProgressStack:{alignItems:'center',justifyContent:'center',gap:3},summaryProgress:{width:35,height:35,borderRadius:18,borderWidth:4,borderTopColor:'#17365D',borderRightColor:'#17365D',borderBottomColor:'#DFE7F0',borderLeftColor:'#DFE7F0',alignItems:'center',justifyContent:'center'},commercialToggle:{marginHorizontal:12,marginBottom:9,flexDirection:'row',alignItems:'center',gap:8,padding:11,borderWidth:1,borderColor:'#DDE6F0',borderRadius:10,backgroundColor:'#F8FAFD'},commercialToggleTitle:{flex:1,color:'#26436B',fontSize:11,fontWeight:'700'},commercialBody:{paddingHorizontal:12},total:{fontSize:20,color:'#1B385B',fontWeight:'800'},notice:{fontSize:10,lineHeight:16,color:'#65758E',paddingHorizontal:14,paddingBottom:13},
  remarkHeading:{flex:1,minWidth:0},remarkBody:{padding:12,gap:8},remarkEntry:{borderWidth:1,borderColor:'#E0E8F2',borderRadius:8,padding:10,backgroundColor:'#FBFCFE'},remarkButton:{minHeight:30,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:9,borderWidth:1,borderColor:'#CDD9EB',borderRadius:8,backgroundColor:'#F8FAFD'},remarkButtonText:{fontSize:10,fontWeight:'700',color:'#254C83'},remarkPreview:{fontSize:11,lineHeight:17,color:'#53657D'},remarkOverlay:{flex:1,alignItems:'center',justifyContent:'center',padding:20,backgroundColor:'rgba(5,18,40,.55)'},remarkSheet:{width:'100%',maxWidth:520,borderRadius:16,backgroundColor:'#FFFFFF',padding:16,gap:12},remarkHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:10,borderBottomWidth:1,borderColor:'#E6EDF5'},remarkTitle:{flexDirection:'row',alignItems:'center',gap:8},remarkInput:{borderWidth:1,borderColor:'#9BB2D7',borderRadius:9,minHeight:128,padding:11,fontSize:12,color:'#17365D'},remarkActions:{flexDirection:'row',gap:9,justifyContent:'flex-end'},remarkCancel:{paddingHorizontal:14,paddingVertical:11,borderWidth:1,borderColor:'#CDD9EB',borderRadius:8},remarkCancelText:{fontSize:11,fontWeight:'700',color:'#254C83'},remarkConfirm:{paddingHorizontal:14,paddingVertical:11,borderRadius:8,backgroundColor:'#17365D'},remarkNote:{fontSize:10,color:'#75859B'},
  nonMotorCustomerArea:{paddingHorizontal:12,paddingTop:12,gap:7},
  nonMotorModeRow:{flexDirection:'row',borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,overflow:'hidden'},
  nonMotorModeButton:{flex:1,alignItems:'center',paddingVertical:11,backgroundColor:'#FFFFFF'},
  nonMotorModeActive:{backgroundColor:'#EAF1FA'},
  nonMotorModeText:{fontSize:11,color:'#65758E'},nonMotorModeTextActive:{color:'#17365D',fontWeight:'600'},
  nonMotorSearchRow:{flexDirection:'row',alignItems:'center',gap:6},
  nonMotorSearchInput:{flex:1,minWidth:0},
  nonMotorSearchButton:{width:44,height:42,backgroundColor:'#17365D',borderRadius:9,justifyContent:'center',alignItems:'center'},
  nonMotorCustomerChoice:{paddingVertical:10,paddingHorizontal:9,borderRadius:8,borderWidth:1,borderColor:'#DDE6F0',gap:3},
  nonMotorCustomerChoiceName:{fontSize:11,color:'#17365D',fontWeight:'600'},
  nonMotorDocuments:{paddingHorizontal:12,paddingVertical:8,gap:5},
  nonMotorDocumentRow:{flexDirection:'row',alignItems:'center',minHeight:39,gap:9,paddingHorizontal:9,borderRadius:8,borderWidth:1,borderColor:'#E1E9F3'},
  nonMotorDocumentName:{fontSize:11,color:'#17365D',flex:1},
  nonMotorSummaryValue:{fontSize:11,color:'#17365D',fontWeight:'600',maxWidth:'58%',textAlign:'right'},
  inlineRemarksInput:{minHeight:76,paddingVertical:11},
  actions:{flexDirection:'row',gap:8,marginBottom:11,alignItems:'stretch'},secondary:{flex:1,borderWidth:1,borderColor:'#CDD9EB',borderRadius:10,paddingHorizontal:7,paddingVertical:12,minHeight:45,alignItems:'center',justifyContent:'center'},secondaryText:{fontWeight:'700',fontSize:11,color:'#25466E'},
  primary:{flex:1,backgroundColor:'#243F9E',borderRadius:10,paddingHorizontal:7,paddingVertical:12,minHeight:45,flexDirection:'row',gap:5,justifyContent:'center',alignItems:'center'},primaryText:{fontSize:11,fontWeight:'800',color:'white'},disabled:{opacity:.48},
  bookButton:{marginBottom:11,flexDirection:'row',justifyContent:'center',gap:8},
  bookingNotice:{flexDirection:'row',gap:9,padding:12,backgroundColor:'#FFF7E9',borderRadius:10,marginBottom:14},bookingText:{flex:1,fontSize:10,lineHeight:16,color:'#75531C'},
  scrim:{flex:1,justifyContent:'center',backgroundColor:'rgba(5,18,40,.5)'},sheet:{backgroundColor:'white',borderTopLeftRadius:20,borderTopRightRadius:20,padding:17,maxHeight:'70%'},
  sheetTitle:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:12,padding:14,backgroundColor:'#F4F7FB',borderBottomWidth:1,borderColor:'#E2E9F2'},choiceScroll:{maxHeight:420},productPickerScrim:{alignItems:'center',justifyContent:'center',paddingHorizontal:18},productPickerSheet:{width:'100%',maxWidth:430,borderRadius:12,maxHeight:'76%',padding:0,overflow:'hidden'},
  choice:{minHeight:44,justifyContent:'space-between',alignItems:'center',flexDirection:'row',paddingHorizontal:12,borderTopWidth:1,borderColor:'#EEF1F7'},
  choiceText:{fontSize:12,color:'#284064'},choiceSelected:{backgroundColor:'#17365D'},choiceTextSelected:{color:'#FFFFFF',fontWeight:'800'},
  switchSheet:{marginHorizontal:20,padding:18,borderRadius:14,backgroundColor:'#FFFFFF',gap:12},
  switchTitle:{fontSize:16,fontWeight:'800',color:'#17365D'},
  switchDescription:{fontSize:12,lineHeight:19,color:'#53657D'},
  switchActions:{flexDirection:'row',gap:10,justifyContent:'flex-end'},
  switchCancel:{minWidth:95,alignItems:'center',padding:12,borderWidth:1,borderColor:'#CDD9EB',borderRadius:9},
  switchCancelText:{fontSize:12,fontWeight:'700',color:'#17365D'},
  switchConfirm:{minWidth:95,alignItems:'center',padding:12,backgroundColor:'#17365D',borderRadius:9},
  switchConfirmText:{fontSize:12,fontWeight:'800',color:'#FFFFFF'},
});
